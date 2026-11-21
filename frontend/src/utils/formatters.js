export const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value) || 0);

export const formatDate = (value) =>
  value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export const orderStatusLabel = { pending: "Chờ xác nhận", confirmed: "Đang chuẩn bị", shipping: "Đang giao", completed: "Hoàn thành", cancelled: "Đã hủy" };
export const paymentStatusLabel = { unpaid: "Chưa thanh toán", pending_verification: "Chờ xác minh", paid: "Đã thanh toán", failed: "Thanh toán thất bại", refunded: "Đã hoàn tiền" };

// Online gateway orders (VNPay or ZaloPay) that can still be paid.
export const isAwaitingVnpayPayment = (order) => ["VNPAY", "ZALOPAY"].includes(order?.paymentMethod)
  && order.paymentStatus !== "paid"
  && !["completed", "cancelled"].includes(order.orderStatus);

export const isAwaitingBankTransfer = (order) => order?.paymentMethod === "BANK_TRANSFER"
  && ["unpaid", "pending_verification"].includes(order.paymentStatus)
  && !["completed", "cancelled"].includes(order.orderStatus);

export const orderDisplayStatus = (order) => {
  if (order?.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "pending_verification") return "Chờ xác minh";
  if (order?.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "unpaid" && !["completed", "cancelled"].includes(order.orderStatus)) return "Chờ chuyển khoản";
  if (isAwaitingVnpayPayment(order)) return "Chờ thanh toán";
  return orderStatusLabel[order?.orderStatus] || order?.orderStatus || "—";
};

export const displayOrderCode = (order) => order?.orderCode || order?._id?.slice(-8).toUpperCase() || "—";
