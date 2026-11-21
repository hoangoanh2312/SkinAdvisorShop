const { recordStockMovement } = require("../services/stockLedger");
const { restockAndCancel, secondsLeft } = require("../services/stockReservation");
const { paymentCapabilities } = require("../services/paymentCapabilities");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Variant = require("../models/Variant");
const { isValidObjectId } = require("../utils/controllerHelpers");
const { createPaymentUrl, verifyCallback, callbackAmount, VnpayError } = require("../services/vnpayService");
const { buildVietQrPayload, VietQrError } = require("../services/vietqrService");

const publicOrderResult = (order, params) => ({
  orderId: String(order._id),
  paymentStatus: order.paymentStatus,
  result: order.paymentStatus === "paid" ? "success" :
    order.orderStatus !== "pending" || ["failed", "refunded"].includes(order.paymentStatus)
      ? "failed" : params.vnp_ResponseCode === "00" ? "pending" : "failed",
});

const createVnpayPayment = async (req, res) => {
  if (!paymentCapabilities().VNPAY.available) return res.status(503).json({ success: false, message: "VNPay chưa sẵn sàng để thanh toán thực tế" });
  if (!isValidObjectId(req.body?.orderId)) return res.status(400).json({ success: false, message: "Mã đơn hàng không hợp lệ" });
  try {
    const order = await Order.findById(req.body.orderId);
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    if (!order.user.equals(req.user._id)) return res.status(403).json({ success: false, message: "Bạn không có quyền thanh toán đơn hàng này" });
    if (order.paymentMethod !== "VNPAY") return res.status(400).json({ success: false, message: "Đơn hàng không sử dụng VNPay" });
    if (order.paymentStatus === "paid" || ["cancelled", "completed"].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: "Đơn hàng không còn hợp lệ để thanh toán" });
    }

    const left = secondsLeft(order);
    if (left !== null && left <= 0) return res.status(410).json({ success: false, message: "Đơn hàng đã hết thời gian giữ hàng. Vui lòng đặt lại." });
    const { paymentUrl, transactionRef } = createPaymentUrl({
      orderId: order._id, amount: order.total, ipAddress: req.ip,
      expireAt: order.reservedUntil || undefined,
    });
    order.vnpayTxnRef = transactionRef;
    order.paymentStatus = "unpaid";
    order.vnpayResponseCode = "";
    await order.save();
    return res.status(200).json({ success: true, data: { paymentUrl } });
  } catch (error) {
    if (error instanceof VnpayError && error.code === "VNPAY_NOT_CONFIGURED") {
      return res.status(503).json({ success: false, message: "VNPay thử nghiệm chưa được cấu hình" });
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
  if (!isValidObjectId(req.params.orderId)) return res.status(400).json({ success: false, message: "Mã đơn hàng không hợp lệ" });
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
  if (!isValidObjectId(req.params.orderId)) return res.status(400).json({ success: false, message: "Mã đơn hàng không hợp lệ" });
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

// Shared by IPN and (sandbox only) the browser return: verify-once, deduct stock in a transaction, idempotent.
// Shared by VNPay (IPN / sandbox return) and ZaloPay (callback / verified return): one transaction,
// stock deducted at most once, idempotent on retries.
const applyOnlinePayment = async (orderId, { method, successful, saveDetails, note }) => {
  const session = await mongoose.startSession();
  let duplicate = false;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).select("+stockDeducted +stockRestored").session(session);
      if (order.paymentStatus === "paid") { duplicate = true; return; }
      if (!isOnlineOrderPayable(order, method)) throw new Error("ORDER_NOT_PAYABLE");
      saveDetails(order);
      if (successful) {
        if (!order.stockDeducted) {
          for (const item of order.items) {
            const result = await Variant.updateOne(
              { _id: item.variant, isActive: true, stock: { $gte: item.quantity } },
              { $inc: { stock: -item.quantity } }, { session }
            );
            if (result.modifiedCount !== 1) throw new Error("INSUFFICIENT_STOCK");
            await recordStockMovement({ item, kind: 'sale', delta: -item.quantity, note, reference: order.orderCode || order._id, session });
          }
          order.stockDeducted = true;
        }
        order.paymentStatus = "paid";
        order.paidAt = new Date();
      } else {
        order.paymentStatus = "failed";
        // Đơn thanh toán thất bại không thể thanh toán lại -> hủy và trả hàng về kho ngay cho khách khác.
        await restockAndCancel(order, `Thanh toán ${method} không thành công`, session);
      }
      await order.save({ session });
    });
  } finally { await session.endSession(); }
  return duplicate ? "duplicate" : "applied";
};
const applyVnpayResult = (orderId, params, source = "ipn") => applyOnlinePayment(orderId, {
  method: "VNPAY",
  successful: params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00",
  saveDetails: (order) => saveCallbackDetails(order, params),
  note: source === "return" ? "Xuất kho sau VNPay (trang kết quả thử nghiệm)" : "Xuất kho sau VNPay IPN",
});

// VNPAY sandbox often cannot save an IPN URL; then the browser return is the only callback we get.
// Only in sandbox mode (VNP_URL on sandbox.vnpayment.vn) and never in production, where IPN is the source of truth.
const confirmOnReturnEnabled = () => /sandbox\.vnpayment\.vn/i.test(process.env.VNP_URL || "") && process.env.NODE_ENV !== "production" && process.env.VNPAY_CONFIRM_ON_RETURN !== "false";

const vnpayReturn = async (req, res) => {
  try {
    const { valid, params } = verifyCallback(req.query);
    if (!valid) return res.status(400).json({ success: false, message: "Chữ ký VNPay không hợp lệ" });
    const { order, error } = await validateCallbackOrder(params);
    if (error === "ORDER_NOT_FOUND") return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    if (error === "INVALID_AMOUNT") return res.status(400).json({ success: false, message: "Số tiền thanh toán không hợp lệ" });
    if (confirmOnReturnEnabled() && isVnpayOrderPayable(order)) {
      try {
        await applyVnpayResult(order._id, params, "return");
        const fresh = await Order.findById(order._id);
        return res.status(200).json({ success: true, data: publicOrderResult(fresh || order, params) });
      } catch (applyError) {
        if (applyError.message !== "ORDER_NOT_PAYABLE") console.error(`VNPay return confirm failed: ${applyError.message === "INSUFFICIENT_STOCK" ? "INSUFFICIENT_STOCK" : applyError.name || "Error"}`);
      }
    }
    return res.status(200).json({ success: true, data: publicOrderResult(order, params) });
  } catch (error) {
    if (error instanceof VnpayError) return res.status(503).json({ success: false, message: "VNPay thử nghiệm chưa được cấu hình" });
    return res.status(500).json({ success: false, message: "Không thể xác minh kết quả thanh toán" });
  }
};

// Only an unpaid, still-pending order may accept a new VNPay callback.
// Cancelled orders must never consume inventory or be marked paid by a late IPN.
const isOnlineOrderPayable = (order, method) => order?.paymentMethod === method &&
  order.orderStatus === "pending" && order.paymentStatus === "unpaid";
const isVnpayOrderPayable = (order) => isOnlineOrderPayable(order, "VNPAY");

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
    if (!isVnpayOrderPayable(checked.order)) return res.status(200).json({ RspCode: "02", Message: "Order no longer payable" });

    const duplicate = (await applyVnpayResult(checked.order._id, params)) === "duplicate";
    if (duplicate) return res.status(200).json({ RspCode: "02", Message: "Order already confirmed" });
    return res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
  } catch (error) {
    if (error.message === "ORDER_NOT_PAYABLE") return res.status(200).json({ RspCode: "02", Message: "Order no longer payable" });
    if (error instanceof VnpayError) return res.status(200).json({ RspCode: "99", Message: "Configuration error" });
    console.error(`VNPay IPN failed: ${error.message === "INSUFFICIENT_STOCK" ? "INSUFFICIENT_STOCK" : error.name || "Error"}`);
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
};

// ---------------- ZaloPay ----------------
const zalopay = require("../services/zalopayService");

const createZalopayPayment = async (req, res) => {
  if (!paymentCapabilities().ZALOPAY.available) return res.status(503).json({ success: false, message: "ZaloPay chưa sẵn sàng để thanh toán" });
  if (!isValidObjectId(req.body?.orderId)) return res.status(400).json({ success: false, message: "Mã đơn hàng không hợp lệ" });
  try {
    const order = await Order.findById(req.body.orderId);
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    if (!order.user.equals(req.user._id)) return res.status(403).json({ success: false, message: "Bạn không có quyền thanh toán đơn hàng này" });
    if (order.paymentMethod !== "ZALOPAY") return res.status(400).json({ success: false, message: "Đơn hàng không sử dụng ZaloPay" });
    if (!isOnlineOrderPayable(order, "ZALOPAY")) return res.status(400).json({ success: false, message: "Đơn hàng không còn hợp lệ để thanh toán" });
    const left = secondsLeft(order);
    if (left !== null && left <= 0) return res.status(410).json({ success: false, message: "Đơn hàng đã hết thời gian giữ hàng. Vui lòng đặt lại." });
    // ZaloPay yêu cầu hạn giao dịch tối thiểu 300 giây: nếu còn ít hơn thì gia hạn giữ hàng cho đủ.
    if (left !== null && left < 300) order.reservedUntil = new Date(Date.now() + 300 * 1000);
    const { orderUrl, appTransId } = await zalopay.createGatewayOrder({
      orderId: order._id, amount: order.total, userId: req.user._id,
      expireSeconds: left === null ? undefined : Math.max(left, 300),
      description: `sandwich beauty - Thanh toan don ${order.orderCode || order._id}`,
    });
    order.zalopayAppTransId = appTransId;
    await order.save();
    return res.status(200).json({ success: true, data: { paymentUrl: orderUrl } });
  } catch (error) {
    if (error instanceof zalopay.ZalopayError) {
      console.error(`ZaloPay create failed: ${error.code}${error.detail ? ` (${error.detail})` : ""}`);
      const message = error.code === "ZALOPAY_INVALID_AMOUNT" ? "Số tiền tối thiểu cho ZaloPay là 1.000đ" : "Không tạo được giao dịch ZaloPay. Vui lòng thử lại.";
      return res.status(error.code === "ZALOPAY_INVALID_AMOUNT" ? 400 : 502).json({ success: false, message });
    }
    console.error(`ZaloPay create failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Không thể tạo yêu cầu thanh toán" });
  }
};

const applyZalopayStatus = async (order, { status, amount, zpTransId }, note) => {
  if (!isOnlineOrderPayable(order, "ZALOPAY") || status === "processing") return;
  if (status === "paid" && Number.isFinite(amount) && amount !== order.total) throw new Error("INVALID_AMOUNT");
  await applyOnlinePayment(order._id, {
    method: "ZALOPAY", successful: status === "paid", note,
    saveDetails: (doc) => { doc.zalopayTransId = zpTransId || doc.zalopayTransId || ""; },
  });
};

// Server-to-server notification from ZaloPay (needs a public URL, e.g. the cloudflare tunnel).
const zalopayCallback = async (req, res) => {
  try {
    const { valid, data } = zalopay.verifyCallback(req.body);
    if (!valid) return res.status(200).json({ return_code: -1, return_message: "mac not equal" });
    const order = await Order.findOne({ zalopayAppTransId: data.app_trans_id });
    if (!order) return res.status(200).json({ return_code: 2, return_message: "order not found" });
    await applyZalopayStatus(order, { status: "paid", amount: Number(data.amount), zpTransId: data.zp_trans_id ? String(data.zp_trans_id) : "" }, "Xuất kho sau ZaloPay callback");
    return res.status(200).json({ return_code: 1, return_message: "success" });
  } catch (error) {
    if (error.message === "ORDER_NOT_PAYABLE") return res.status(200).json({ return_code: 2, return_message: "order no longer payable" });
    console.error(`ZaloPay callback failed: ${error.message === "INVALID_AMOUNT" || error.message === "INSUFFICIENT_STOCK" ? error.message : error.name || "Error"}`);
    return res.status(200).json({ return_code: 0, return_message: "retry" }); // ZaloPay retries up to 3 times
  }
};

// Browser return: verify checksum, then ask ZaloPay for the authoritative status (works even without callback).
const zalopayReturn = async (req, res) => {
  try {
    // A bad checksum means the redirect parameters can't be trusted, but the status itself comes from our own
    // key1-signed query to ZaloPay, so it is still safe to check. We then hide the order id from the response.
    const trustedRedirect = zalopay.verifyRedirect(req.query);
    if (!trustedRedirect) console.warn("ZaloPay redirect checksum mismatch - check ZALOPAY_KEY2; verifying via status query");
    if (typeof req.query.apptransid !== "string" || !/^\d{6}_[\w-]{1,33}$/.test(req.query.apptransid)) return res.status(400).json({ success: false, message: "Thông tin giao dịch ZaloPay không hợp lệ" });
    let order = await Order.findOne({ zalopayAppTransId: req.query.apptransid });
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    let gatewayStatus = "processing";
    if (isOnlineOrderPayable(order, "ZALOPAY")) {
      try {
        const remote = await zalopay.queryOrderStatus(order.zalopayAppTransId);
        gatewayStatus = remote.status;
        await applyZalopayStatus(order, remote, "Xuất kho sau ZaloPay (xác minh trang kết quả)");
        order = (await Order.findById(order._id)) || order;
      } catch (error) {
        if (error.message === "INVALID_AMOUNT") return res.status(400).json({ success: false, message: "Số tiền thanh toán không hợp lệ" });
        if (error.message !== "ORDER_NOT_PAYABLE") console.error(`ZaloPay return check failed: ${error.code || error.message || "Error"}`);
      }
    }
    const result = order.paymentStatus === "paid" ? "success"
      : order.orderStatus !== "pending" || ["failed", "refunded"].includes(order.paymentStatus) ? "failed"
      : gatewayStatus === "failed" || (trustedRedirect && req.query.status === "-49") ? "failed" : "pending";
    return res.status(200).json({ success: true, data: { orderId: trustedRedirect ? String(order._id) : "", paymentStatus: order.paymentStatus, result, gateway: "ZALOPAY" } });
  } catch (error) {
    console.error(`ZaloPay return failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Không thể xác minh kết quả thanh toán" });
  }
};

module.exports = { createVnpayPayment, vnpayReturn, vnpayIpn, getBankTransfer, confirmBankTransfer, isVnpayOrderPayable, isOnlineOrderPayable, publicOrderResult, createZalopayPayment, zalopayCallback, zalopayReturn };
