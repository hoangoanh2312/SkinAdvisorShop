const mongoose = require("mongoose");
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Voucher = require("../models/Voucher");
const { isValidObjectId, escapeRegex, sendControllerError } = require("../utils/controllerHelpers");
const { calculateVoucherDiscount } = require("../utils/commerceHelpers");
const { withOrderCodeRetry } = require("../services/orderCodeService");

const SHIPPING_FEE = 0;

const normalizeShippingAddress = (rawAddress) => {
  if (!rawAddress || typeof rawAddress !== "object") return null;

  const fields = ["fullName", "phone", "province", "ward", "address"];
  const address = Object.fromEntries(
    fields.map((field) => [
      field,
      typeof rawAddress[field] === "string" ? rawAddress[field].trim() : "",
    ])
  );

  return fields.every((field) => address[field]) ? address : null;
};

const commerceError = (res, error, fallback) => {
  const errors = {
    INVALID_ITEMS: [400, "Danh sách sản phẩm không hợp lệ"],
    VARIANT_NOT_FOUND: [400, "Phiên bản sản phẩm không tồn tại hoặc đã bị vô hiệu hóa"],
    PRODUCT_NOT_FOUND: [400, "Sản phẩm không tồn tại hoặc đã bị vô hiệu hóa"],
    INSUFFICIENT_STOCK: [400, "Sản phẩm không đủ tồn kho"],
    VOUCHER_INVALID: [400, "Voucher không hoạt động"],
    VOUCHER_EXPIRED: [400, "Voucher chưa có hiệu lực hoặc đã hết hạn"],
    VOUCHER_LIMIT: [400, "Voucher đã hết lượt sử dụng"],
    VOUCHER_MIN_ORDER: [400, "Đơn hàng chưa đạt giá trị tối thiểu"],
    ORDER_NOT_FOUND: [404, "Không tìm thấy đơn hàng"],
    ORDER_FORBIDDEN: [403, "Bạn không có quyền truy cập đơn hàng này"],
    INVALID_TRANSITION: [400, "Trạng thái đơn hàng không thể chuyển đổi như yêu cầu"],
    PAYMENT_REQUIRED: [400, "Đơn hàng cần được thanh toán trước khi xác nhận"],
    BANK_TRANSFER_ONLY: [400, "Chỉ có thể xác minh đơn chuyển khoản ngân hàng"],
    PAYMENT_NOT_PENDING_VERIFICATION: [400, "Thanh toán chưa ở trạng thái chờ xác minh"],
    ORDER_TERMINAL: [400, "Đơn hàng đã kết thúc và không thể xác minh thanh toán"],
  };
  if (errors[error.message]) return res.status(errors[error.message][0]).json({ success: false, message: errors[error.message][1] });
  return sendControllerError(res, error, fallback);
};

const createOrder = async (req, res) => {
  const rawItems = req.body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return res.status(400).json({ success: false, message: "Danh sách sản phẩm không hợp lệ" });
  if (!["COD", "VNPAY", "BANK_TRANSFER"].includes(req.body.paymentMethod)) return res.status(400).json({ success: false, message: "Phương thức thanh toán không hợp lệ" });

  const shippingAddress = normalizeShippingAddress(req.body.shippingAddress);
  if (!shippingAddress) {
    return res.status(400).json({ success: false, message: "Thông tin nhận hàng không hợp lệ" });
  }

  const quantities = new Map();
  for (const item of rawItems) {
    const quantity = Number(item.quantity);
    if (!isValidObjectId(item.variantId) || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ success: false, message: "Danh sách sản phẩm không hợp lệ" });
    quantities.set(String(item.variantId), (quantities.get(String(item.variantId)) || 0) + quantity);
  }

  let orderId;
  try {
    orderId = await withOrderCodeRetry(async (orderCode) => {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
      const items = [];
      let subtotal = 0;
      for (const [variantId, quantity] of quantities) {
        const variant = await Variant.findOne({ _id: variantId, isActive: true }).session(session);
        if (!variant) throw new Error("VARIANT_NOT_FOUND");
        const product = await Product.findOne({ _id: variant.product, isActive: true }).session(session);
        if (!product) throw new Error("PRODUCT_NOT_FOUND");
        const unitPrice = variant.salePrice !== null ? variant.salePrice : variant.price;
        const itemSubtotal = unitPrice * quantity;
        items.push({ product: product._id, variant: variant._id, productName: product.name, variantName: variant.name, sku: variant.sku, image: variant.image || product.images[0] || "", quantity, unitPrice, subtotal: itemSubtotal });
        subtotal += itemSubtotal;

        if (req.body.paymentMethod === "COD") {
          const stockUpdate = await Variant.updateOne({ _id: variant._id, isActive: true, stock: { $gte: quantity } }, { $inc: { stock: -quantity } }, { session });
          if (stockUpdate.modifiedCount !== 1) throw new Error("INSUFFICIENT_STOCK");
        } else if (variant.stock < quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }

      let voucher = null;
      let discount = 0;
      const voucherCode = typeof req.body.voucherCode === "string" ? req.body.voucherCode.trim().toUpperCase() : "";
      if (voucherCode) {
        voucher = await Voucher.findOne({ code: voucherCode }).session(session);
        if (!voucher) throw new Error("VOUCHER_INVALID");
        discount = calculateVoucherDiscount(voucher, subtotal);
      }

      const [order] = await Order.create([{
        orderCode,
        user: req.user._id,
        items,
        shippingAddress,
        subtotal,
        discount,
        shippingFee: SHIPPING_FEE,
        total: Math.max(subtotal - discount + SHIPPING_FEE, 0),
        voucher: voucher?._id || null,
        voucherCode,
        paymentMethod: req.body.paymentMethod,
        note: typeof req.body.note === "string" ? req.body.note : "",
        stockDeducted: req.body.paymentMethod === "COD",
      }], { session });
      orderId = order._id;
        });
        return orderId;
      } finally {
        await session.endSession();
      }
    });
    if (!orderId) throw new Error("ORDER_CODE_GENERATION_FAILED");
    const order = await Order.findById(orderId);
    return res.status(201).json({ success: true, message: "Tạo đơn hàng thành công", data: { order } });
  } catch (error) {
    return commerceError(res, error, "Không thể tạo đơn hàng");
  }
};

const getMyOrders = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
    const filter = { user: req.user._id };
    if (req.query.status) filter.orderStatus = req.query.status;
    const [orders, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Order.countDocuments(filter)]);
    return res.status(200).json({ success: true, data: { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) { return sendControllerError(res, error, "Không thể lấy đơn hàng"); }
};

const getOrder = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID đơn hàng không hợp lệ" });
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    if (req.user.role !== "admin" && !order.user.equals(req.user._id)) return res.status(403).json({ success: false, message: "Bạn không có quyền truy cập đơn hàng này" });
    return res.status(200).json({ success: true, data: { order } });
  } catch (error) { return sendControllerError(res, error, "Không thể lấy đơn hàng"); }
};

const cancelOrderInternal = async (orderId, user, isAdmin) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).select("+stockDeducted +stockRestored").session(session);
      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (!isAdmin && !order.user.equals(user._id)) throw new Error("ORDER_FORBIDDEN");
      const cancellable = isAdmin ? ["pending", "confirmed"] : ["pending"];
      if (!cancellable.includes(order.orderStatus)) throw new Error("INVALID_TRANSITION");
      if (order.stockDeducted && !order.stockRestored) {
        for (const item of order.items) await Variant.updateOne({ _id: item.variant }, { $inc: { stock: item.quantity } }, { session });
        order.stockRestored = true;
      }
      order.orderStatus = "cancelled";
      await order.save({ session });
    });
    return Order.findById(orderId);
  } finally { await session.endSession(); }
};

const cancelOrder = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID đơn hàng không hợp lệ" });
  try {
    const order = await cancelOrderInternal(req.params.id, req.user, false);
    return res.status(200).json({ success: true, message: "Hủy đơn hàng thành công", data: { order } });
  } catch (error) { return commerceError(res, error, "Không thể hủy đơn hàng"); }
};

const listAdminOrders = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    if (req.query.status) filter.orderStatus = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.search?.trim()) {
      const search = req.query.search.trim();
      const expression = new RegExp(escapeRegex(search), "i");
      const users = await User.find({ $or: [{ fullName: expression }, { email: expression }] }).select("_id").lean();
      const conditions = [
        { orderCode: expression },
        { voucherCode: expression },
        ...(users.length ? [{ user: { $in: users.map((user) => user._id) } }] : []),
      ];
      if (isValidObjectId(search)) conditions.push({ _id: search });
      filter.$or = conditions;
    }
    const [orders, total] = await Promise.all([Order.find(filter).populate("user", "fullName email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Order.countDocuments(filter)]);
    return res.status(200).json({ success: true, data: { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) { return sendControllerError(res, error, "Không thể lấy danh sách đơn hàng"); }
};

const getAdminOrder = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID đơn hàng không hợp lệ" });
  try {
    const order = await Order.findById(req.params.id).populate("user", "fullName email phone");
    if (!order) throw new Error("ORDER_NOT_FOUND");
    return res.status(200).json({ success: true, data: { order } });
  } catch (error) { return commerceError(res, error, "Không thể lấy chi tiết đơn hàng"); }
};

const verifyBankTransferPayment = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID đơn hàng không hợp lệ" });
  const session = await mongoose.startSession();
  let verifiedOrder;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).select("+stockDeducted +stockRestored").session(session);
      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (["cancelled", "completed"].includes(order.orderStatus)) throw new Error("ORDER_TERMINAL");
      if (order.paymentMethod !== "BANK_TRANSFER") throw new Error("BANK_TRANSFER_ONLY");
      if (order.paymentStatus === "paid") {
        verifiedOrder = order;
        return;
      }
      if (order.paymentStatus !== "pending_verification") throw new Error("PAYMENT_NOT_PENDING_VERIFICATION");
      if (!order.stockDeducted) {
        for (const item of order.items) {
          const result = await Variant.updateOne(
            { _id: item.variant, isActive: true, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { session }
          );
          if (result.modifiedCount !== 1) throw new Error("INSUFFICIENT_STOCK");
        }
        order.stockDeducted = true;
      }
      order.paymentStatus = "paid";
      order.paidAt = new Date();
      await order.save({ session });
      verifiedOrder = order;
    });
    const order = await Order.findById(verifiedOrder._id).populate("user", "fullName email phone");
    return res.status(200).json({ success: true, message: "Xác minh thanh toán thành công", data: { order } });
  } catch (error) {
    return commerceError(res, error, "Không thể xác minh thanh toán");
  } finally {
    await session.endSession();
  }
};

const updateOrderStatus = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID đơn hàng không hợp lệ" });
  const nextStatus = req.body.orderStatus;
  try {
    const existing = await Order.findById(req.params.id);
    if (!existing) throw new Error("ORDER_NOT_FOUND");
    if (nextStatus === "cancelled") {
      await cancelOrderInternal(req.params.id, req.user, true);
      const order = await Order.findById(req.params.id).populate("user", "fullName email phone");
      return res.status(200).json({ success: true, message: "Cập nhật trạng thái thành công", data: { order } });
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(req.params.id).session(session);
        if (!order) throw new Error("ORDER_NOT_FOUND");
        const transitions = { pending: ["confirmed"], confirmed: ["shipping"], shipping: ["completed"] };
        if (!transitions[order.orderStatus]?.includes(nextStatus)) throw new Error("INVALID_TRANSITION");
        if (nextStatus === "confirmed" && ["VNPAY", "BANK_TRANSFER"].includes(order.paymentMethod) && order.paymentStatus !== "paid") throw new Error("PAYMENT_REQUIRED");
        order.orderStatus = nextStatus;
        if (nextStatus === "confirmed" && order.voucher) {
          const voucher = await Voucher.findById(order.voucher).session(session);
          if (!voucher || (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit)) throw new Error("VOUCHER_LIMIT");
          voucher.usedCount += 1;
          await voucher.save({ session });
        }
        await order.save({ session });
      });
    } finally { await session.endSession(); }
    const order = await Order.findById(req.params.id).populate("user", "fullName email phone");
    return res.status(200).json({ success: true, message: "Cập nhật trạng thái thành công", data: { order } });
  } catch (error) { return commerceError(res, error, "Không thể cập nhật trạng thái đơn hàng"); }
};

module.exports = { createOrder, getMyOrders, getOrder, cancelOrder, listAdminOrders, getAdminOrder, verifyBankTransferPayment, updateOrderStatus };
