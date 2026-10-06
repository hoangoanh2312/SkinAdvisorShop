const mongoose = require("mongoose");
const Order = require("../models/Order");
const Variant = require("../models/Variant");
const { isValidObjectId } = require("../utils/controllerHelpers");
const { createPaymentUrl, verifyCallback, callbackAmount, VnpayError } = require("../services/vnpayService");
const { buildVietQrPayload, VietQrError } = require("../services/vietqrService");

const publicOrderResult = (order, params) => ({
  orderId: String(order._id),
  paymentStatus: order.paymentStatus,
  result: order.paymentStatus === "paid" ? "success" : params.vnp_ResponseCode === "00" ? "pending" : "failed",
});

const createVnpayPayment = async (req, res) => {
  if (!isValidObjectId(req.body?.orderId)) return res.status(400).json({ success: false, message: "ID đơn hàng không hợp lệ" });
  try {
    const order = await Order.findById(req.body.orderId);
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    if (!order.user.equals(req.user._id)) return res.status(403).json({ success: false, message: "Bạn không có quyền thanh toán đơn hàng này" });
    if (order.paymentMethod !== "VNPAY") return res.status(400).json({ success: false, message: "Đơn hàng không sử dụng VNPay" });
    if (order.paymentStatus === "paid" || ["cancelled", "completed"].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: "Đơn hàng không còn hợp lệ để thanh toán" });
    }

    const { paymentUrl, transactionRef } = createPaymentUrl({
      orderId: order._id, amount: order.total, ipAddress: req.ip,
    });
    order.vnpayTxnRef = transactionRef;
    order.paymentStatus = "unpaid";
    order.vnpayResponseCode = "";
    await order.save();
    return res.status(200).json({ success: true, data: { paymentUrl } });
  } catch (error) {
    if (error instanceof VnpayError && error.code === "VNPAY_NOT_CONFIGURED") {
      return res.status(503).json({ success: false, message: "VNPay Sandbox chưa được cấu hình" });
    }
    console.error(`VNPay create failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Không thể tạo yêu cầu thanh toán" });
  }
};

const findOwnedBankTransferOrder = async (orderId, userId) => {
  const order = await Order.findById(orderId);
  if (!order) return { status: 404, message: "Không tìm thấy đơn hàng" };
  if (!order.user.equals(userId)) return { status: 403, message: "Bạn không có quyền truy cập thanh toán này" };
  if (order.paymentMethod !== "BANK_TRANSFER") return { status: 400, message: "Đơn hàng không sử dụng chuyển khoản ngân hàng" };
  return { order };
};

const getBankTransfer = async (req, res) => {
  if (!isValidObjectId(req.params.orderId)) return res.status(400).json({ success: false, message: "ID đơn hàng không hợp lệ" });
  try {
    const checked = await findOwnedBankTransferOrder(req.params.orderId, req.user._id);
    if (!checked.order) return res.status(checked.status).json({ success: false, message: checked.message });
    if (["cancelled", "completed"].includes(checked.order.orderStatus)
      || !["unpaid", "pending_verification"].includes(checked.order.paymentStatus)) {
      return res.status(400).json({ success: false, message: "Đơn hàng không còn hợp lệ để chuyển khoản" });
    }
    return res.status(200).json({ success: true, data: buildVietQrPayload(checked.order) });
  } catch (error) {
    if (error instanceof VietQrError) return res.status(503).json({ success: false, message: "Thanh toán chuyển khoản chưa được cấu hình" });
    console.error(`VietQR instructions failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Không thể tải thông tin chuyển khoản" });
  }
};

const confirmBankTransfer = async (req, res) => {
  if (!isValidObjectId(req.params.orderId)) return res.status(400).json({ success: false, message: "ID đơn hàng không hợp lệ" });
  try {
    const checked = await findOwnedBankTransferOrder(req.params.orderId, req.user._id);
    if (!checked.order) return res.status(checked.status).json({ success: false, message: checked.message });
    const order = checked.order;
    if (["cancelled", "completed"].includes(order.orderStatus) || order.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Đơn hàng không còn hợp lệ để xác nhận chuyển khoản" });
    }
    if (order.paymentStatus === "pending_verification") {
      return res.status(200).json({ success: true, data: { order } });
    }
    if (order.paymentStatus !== "unpaid") {
      return res.status(400).json({ success: false, message: "Trạng thái thanh toán không hợp lệ" });
    }
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, user: req.user._id, paymentMethod: "BANK_TRANSFER", paymentStatus: "unpaid", orderStatus: { $nin: ["cancelled", "completed"] } },
      { $set: { paymentStatus: "pending_verification" } },
      { returnDocument: "after", runValidators: true }
    );
    if (updated) return res.status(200).json({ success: true, data: { order: updated } });
    const current = await Order.findById(order._id);
    if (current?.paymentStatus === "pending_verification") return res.status(200).json({ success: true, data: { order: current } });
    return res.status(400).json({ success: false, message: "Không thể xác nhận chuyển khoản cho đơn hàng này" });
  } catch (error) {
    console.error(`Bank transfer confirm failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Không thể xác nhận đã chuyển khoản" });
  }
};

const validateCallbackOrder = async (params) => {
  const order = await Order.findOne({ vnpayTxnRef: params.vnp_TxnRef });
  if (!order) return { error: "ORDER_NOT_FOUND" };
  if (callbackAmount(params) !== order.total) return { error: "INVALID_AMOUNT", order };
  return { order };
};

const vnpayReturn = async (req, res) => {
  try {
    const { valid, params } = verifyCallback(req.query);
    if (!valid) return res.status(400).json({ success: false, message: "Chữ ký VNPay không hợp lệ" });
    const { order, error } = await validateCallbackOrder(params);
    if (error === "ORDER_NOT_FOUND") return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    if (error === "INVALID_AMOUNT") return res.status(400).json({ success: false, message: "Số tiền thanh toán không hợp lệ" });
    return res.status(200).json({ success: true, data: publicOrderResult(order, params) });
  } catch (error) {
    if (error instanceof VnpayError) return res.status(503).json({ success: false, message: "VNPay Sandbox chưa được cấu hình" });
    return res.status(500).json({ success: false, message: "Không thể xác minh kết quả thanh toán" });
  }
};

const saveCallbackDetails = (order, params) => {
  order.vnpayTransactionNo = params.vnp_TransactionNo || "";
  order.vnpayBankCode = params.vnp_BankCode || "";
  order.vnpayResponseCode = params.vnp_ResponseCode || "";
  order.vnpayPayDate = params.vnp_PayDate || "";
};

const vnpayIpn = async (req, res) => {
  try {
    const { valid, params } = verifyCallback(req.query);
    if (!valid) return res.status(200).json({ RspCode: "97", Message: "Invalid checksum" });
    const checked = await validateCallbackOrder(params);
    if (checked.error === "ORDER_NOT_FOUND") return res.status(200).json({ RspCode: "01", Message: "Order not found" });
    if (checked.error === "INVALID_AMOUNT") return res.status(200).json({ RspCode: "04", Message: "Invalid amount" });
    if (checked.order.paymentStatus === "paid") return res.status(200).json({ RspCode: "02", Message: "Order already confirmed" });

    const successful = params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";
    const session = await mongoose.startSession();
    let duplicate = false;
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(checked.order._id).select("+stockDeducted +stockRestored").session(session);
        if (order.paymentStatus === "paid") { duplicate = true; return; }
        saveCallbackDetails(order, params);
        if (successful) {
          if (!order.stockDeducted) {
            for (const item of order.items) {
              const result = await Variant.updateOne(
                { _id: item.variant, isActive: true, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } }, { session }
              );
              if (result.modifiedCount !== 1) throw new Error("INSUFFICIENT_STOCK");
            }
            order.stockDeducted = true;
          }
          order.paymentStatus = "paid";
          order.paidAt = new Date();
        } else {
          order.paymentStatus = "failed";
        }
        await order.save({ session });
      });
    } finally { await session.endSession(); }
    if (duplicate) return res.status(200).json({ RspCode: "02", Message: "Order already confirmed" });
    return res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
  } catch (error) {
    if (error instanceof VnpayError) return res.status(200).json({ RspCode: "99", Message: "Configuration error" });
    console.error(`VNPay IPN failed: ${error.message === "INSUFFICIENT_STOCK" ? "INSUFFICIENT_STOCK" : error.name || "Error"}`);
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
};

module.exports = { createVnpayPayment, vnpayReturn, vnpayIpn, getBankTransfer, confirmBankTransfer };
