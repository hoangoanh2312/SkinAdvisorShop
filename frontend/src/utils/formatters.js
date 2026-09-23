export const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value) || 0);

export const formatDate = (value) =>
  value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export const orderStatusLabel = { pending: "Chờ xác nhận", confirmed: "Đã xác nhận", shipping: "Đang giao hàng", completed: "Đã hoàn thành", cancelled: "Đã hủy" };
export const paymentStatusLabel = { unpaid: "Chưa thanh toán", paid: "Đã thanh toán", failed: "Thanh toán thất bại", refunded: "Đã hoàn tiền" };
