// Giữ hàng cho đơn chờ thanh toán online.
// Khi đặt hàng, kho đã bị trừ ngay (xem orderController.createOrder). Đơn ZaloPay/VNPay chưa thanh toán
// được giữ PAYMENT_HOLD_MINUTES phút, đơn chuyển khoản BANK_TRANSFER_HOLD_HOURS giờ. Quá hạn mà chưa trả tiền
// (hoặc cổng báo thanh toán thất bại) thì đơn tự hủy và số lượng được cộng trả lại kho cho khách khác mua.
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Variant = require("../models/Variant");
const { recordStockMovement } = require("./stockLedger");

const ONLINE_METHODS = ["VNPAY", "ZALOPAY", "BANK_TRANSFER"];
const positive = (value, fallback) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; };
const holdMs = (method) => method === "BANK_TRANSFER"
  ? positive(process.env.BANK_TRANSFER_HOLD_HOURS, 24) * 3600 * 1000
  : positive(process.env.PAYMENT_HOLD_MINUTES, 15) * 60 * 1000;

/** Hạn giữ hàng cho đơn mới; COD không cần (đơn được xử lý ngay). */
const reservationDeadline = (paymentMethod, now = new Date()) =>
  ONLINE_METHODS.includes(paymentMethod) ? new Date(now.getTime() + holdMs(paymentMethod)) : null;

/** Hoàn kho + hủy một đơn trong transaction đang mở. Trả về true nếu đã hoàn kho. */
const restockAndCancel = async (order, reason, session) => {
  let restocked = false;
  if (order.stockDeducted && !order.stockRestored) {
    for (const item of order.items) {
      await Variant.updateOne({ _id: item.variant }, { $inc: { stock: item.quantity } }, { session });
      await recordStockMovement({ item, kind: "cancellation", delta: item.quantity, note: reason, reference: order.orderCode || order._id, session });
    }
    order.stockRestored = true;
    restocked = true;
  }
  order.orderStatus = "cancelled";
  order.cancelReason = reason.slice(0, 200);
  order.reservedUntil = null;
  return restocked;
};

const expiredFilter = (now) => ({
  orderStatus: "pending",
  paymentMethod: { $in: ONLINE_METHODS },
  // Đơn chuyển khoản đã gửi xác nhận (pending_verification) chờ admin đối soát, không tự hủy.
  paymentStatus: { $in: ["unpaid", "failed"] },
  reservedUntil: { $ne: null, $lte: now },
});

/** Hủy các đơn quá hạn giữ hàng và hoàn kho. Mỗi đơn một transaction; kiểm tra lại điều kiện bên trong để an toàn khi chạy song song. */
const releaseExpiredReservations = async ({ now = new Date(), limit = 50 } = {}) => {
  const candidates = await Order.find(expiredFilter(now)).select("_id").limit(limit).lean();
  let released = 0;
  for (const { _id } of candidates) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await Order.findOne({ _id, ...expiredFilter(now) }).select("+stockDeducted +stockRestored").session(session);
        if (!order) return;
        await restockAndCancel(order, "Hết thời gian giữ hàng chờ thanh toán", session);
        await order.save({ session });
        released += 1;
      });
    } catch (error) {
      console.error(`[stock-reservation] Không hoàn kho được đơn ${_id}: ${error.message}`);
    } finally { await session.endSession(); }
  }
  return released;
};

let timer = null;
const startReservationSweeper = (intervalMs = 60 * 1000) => {
  if (timer) return timer;
  const tick = () => releaseExpiredReservations()
    .then((n) => { if (n) console.log(`[stock-reservation] Đã hủy ${n} đơn quá hạn thanh toán và hoàn kho`); })
    .catch((error) => console.error(`[stock-reservation] ${error.message}`));
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick();
  return timer;
};
const stopReservationSweeper = () => { if (timer) clearInterval(timer); timer = null; };

/** Số giây còn lại để cổng thanh toán đặt hạn giao dịch (tối thiểu 300 giây theo ZaloPay). */
const secondsLeft = (order, now = new Date()) => order?.reservedUntil ? Math.floor((new Date(order.reservedUntil) - now) / 1000) : null;

module.exports = { reservationDeadline, restockAndCancel, releaseExpiredReservations, startReservationSweeper, stopReservationSweeper, expiredFilter, secondsLeft, ONLINE_METHODS };
