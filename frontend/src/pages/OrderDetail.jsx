import { ArrowLeft, CalendarDays, Check, Clock3, Landmark, MapPin, RotateCcw, WalletCards, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { useCart } from "../contexts/CartContext";
import { displayOrderCode, formatCurrency, formatDate, isAwaitingBankTransfer, isAwaitingVnpayPayment, orderDisplayStatus, paymentStatusLabel } from "../utils/formatters";
import { normalizeProduct } from "../utils/productAdapter";

const timelineSteps = [
  { status: "confirmed", label: "Đang chuẩn bị" },
  { status: "shipping", label: "Đang giao" },
  { status: "completed", label: "Hoàn thành" },
];
const statusRanks = { pending: 0, confirmed: 1, shipping: 2, completed: 3 };
const paymentMethodNames = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  VNPAY: "VNPay",
  ZALOPAY: "ZaloPay",
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(() => axiosClient.get(`/orders/${id}`, { sessionProtected: true })
    .then(({ data }) => setOrder(data.data.order))
    .catch((requestError) => setError(requestError.response?.data?.message || "Không thể tải đơn hàng"))
    .finally(() => setLoading(false)), [id]);
  useEffect(() => { load(); }, [load]);

  const cancel = async () => {
    setError(""); setActing(true);
    try { await axiosClient.put(`/orders/${id}/cancel`, {}, { sessionProtected: true }); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Không thể hủy đơn hàng"); }
    finally { setActing(false); }
  };

  const payNow = async () => {
    setError(""); setActing(true);
    try {
      const { data } = await axiosClient.post(`/payments/${order.paymentMethod === "ZALOPAY" ? "zalopay" : "vnpay"}/create`, { orderId: order._id }, { sessionProtected: true });
      window.location.assign(data.data.paymentUrl);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể tạo yêu cầu thanh toán");
      setActing(false);
    }
  };

  const buyAgain = async () => {
    setError(""); setNotice(""); setActing(true);
    try {
      const results = await Promise.all(order.items.map(async (item) => {
        try {
          const { data } = await axiosClient.get(`/products/${item.product}`);
          const variant = data.data.variants.find((candidate) => candidate._id === item.variant);
          if (!variant || variant.stock < 1) return false;
          return addToCart(normalizeProduct(data.data.product, data.data.variants), variant, Math.min(item.quantity, variant.stock));
        } catch { return false; }
      }));
      const added = results.filter(Boolean).length;
      if (!added) setError("Các sản phẩm trong đơn hiện không còn khả dụng");
      else if (added < order.items.length) setNotice("Đã thêm các sản phẩm còn bán và còn hàng vào giỏ");
      else navigate("/cart");
    } finally { setActing(false); }
  };

  if (loading) return <div className="container empty">Đang tải đơn hàng...</div>;
  if (!order) return <div className="container empty"><p>{error}</p><Link to="/orders">Quay lại đơn hàng</Link></div>;

  const currentRank = statusRanks[order.orderStatus] ?? -1;
  const address = order.shippingAddress || {};
  const addressParts = [address.address || address.addressLine, address.ward, address.district, address.province].filter(Boolean);
  const cancelled = order.orderStatus === "cancelled";
  const steps = [
    { key: "placed", label: "Đã đặt hàng", done: true, date: formatDate(order.createdAt) },
    ...(cancelled ? [{ key: "cancelled", label: "Đã hủy", cancelled: true }]
      : timelineSteps.map((step) => ({
        key: step.status,
        label: step.label,
        done: currentRank >= statusRanks[step.status],
        current: currentRank === statusRanks[step.status],
      }))),
  ];
  const statusTone = cancelled ? "cancelled" : order.orderStatus === "completed" ? "completed" : "active";

  return <div className="container orders-page order-detail-page">
    <header className="order-detail-hero">
      <Link className="order-detail-back" to="/orders"><ArrowLeft size={16} aria-hidden="true" /> Tất cả đơn hàng</Link>
      <div className="order-detail-hero-row">
        <div className="order-detail-hero-copy">
          <span className="eyebrow">THEO DÕI ĐƠN HÀNG</span>
          <h1>Chi tiết đơn hàng</h1>
          <div className="order-meta-line">
            <span className="order-code">#{displayOrderCode(order)}</span>
            <span className="order-created"><CalendarDays size={15} aria-hidden="true" /> {formatDate(order.createdAt)}</span>
          </div>
        </div>
        <span className={`order-state-pill is-${statusTone}`}>{orderDisplayStatus(order)}</span>
      </div>
    </header>

    <div className="order-detail-grid">
      <div className="order-detail-main">
        <section className="order-panel order-status-panel" aria-label="Trạng thái đơn hàng">
          <div className="order-panel-heading">
            <div><span>TIẾN TRÌNH ĐƠN HÀNG</span><h2>{orderDisplayStatus(order)}</h2></div>
            <span className="order-status-icon"><Clock3 aria-hidden="true" /></span>
          </div>
          <ol className={`order-timeline${cancelled ? " is-cancelled" : ""}`} style={{ "--stage-count": steps.length }}>
            {steps.map((step) => <li className={`${step.done ? "done" : ""} ${step.current ? "current" : ""} ${step.cancelled ? "cancelled" : ""}`} key={step.key}>
              <span className="order-timeline-marker" aria-hidden="true">{step.done ? <Check /> : step.cancelled ? <X /> : null}</span>
              <strong>{step.label}</strong>
              {step.date && <small>{step.date}</small>}
            </li>)}
          </ol>
          {order.paidAt && <p className="order-paid-note"><Check size={15} aria-hidden="true" /> Đã ghi nhận thanh toán: {formatDate(order.paidAt)}</p>}
        </section>

        <section className="order-panel order-products-panel">
          <div className="order-section-heading"><h2>Sản phẩm trong đơn</h2><span>{order.items.length} sản phẩm</span></div>
          {order.items.map((item, index) => <div className="order-detail-item" key={`${item.variant || item.product}-${index}`}>
            <img src={item.image} alt={item.productName || "Sản phẩm"} loading="lazy" />
            <div className="order-detail-item-info">
              <strong>{item.productName}</strong>
              <span>Phân loại: {item.variantName}, số lượng: {item.quantity}</span>
              {item.sku && <small title={item.sku}>{item.sku}</small>}
            </div>
            <b className="order-detail-item-price">{formatCurrency(item.subtotal)}</b>
          </div>)}
        </section>

        <section className="order-panel shipping-snapshot">
          <span className="order-shipping-icon"><MapPin aria-hidden="true" /></span>
          <div className="order-shipping-content">
            <h2>Địa chỉ nhận hàng</h2>
            <strong>{address.fullName || "Người nhận"}</strong>
            {address.phone && <p className="order-recipient-phone">{address.phone}</p>}
            <p>{addressParts.join(", ") || "Chưa có thông tin địa chỉ"}</p>
          </div>
        </section>
      </div>

      <aside className="order-panel order-detail-summary" aria-label="Thông tin thanh toán">
        <h2>Thông tin thanh toán</h2>
        <p><span>Phương thức</span><strong>{paymentMethodNames[order.paymentMethod] || order.paymentMethod}</strong></p>
        <p><span>Trạng thái</span><strong className="order-payment-status">{paymentStatusLabel[order.paymentStatus] || "Đang cập nhật"}</strong></p>
        {order.orderStatus === "pending" && order.paymentStatus === "unpaid" && order.reservedUntil && <p><span>Giữ hàng đến</span><strong>{formatDate(order.reservedUntil)}</strong></p>}
        {cancelled && order.cancelReason && <p><span>Lý do hủy</span><strong>{order.cancelReason}</strong></p>}
        <p><span>Tạm tính</span><strong>{formatCurrency(order.subtotal)}</strong></p>
        {order.discount > 0 && <p><span>Giảm giá</span><strong>-{formatCurrency(order.discount)}</strong></p>}
        <p><span>Phí vận chuyển</span><strong>{formatCurrency(order.shippingFee)}</strong></p>
        <div className="summary-total"><span>Tổng cộng</span><strong>{formatCurrency(order.total)}</strong></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}
        <div className="order-actions">
          {isAwaitingVnpayPayment(order) && <button className="btn btn-dark full" disabled={acting} onClick={payNow}><WalletCards /> Thanh toán ngay</button>}
          {isAwaitingBankTransfer(order) && <Link className="btn btn-dark full" to={`/payment/bank-transfer/${order._id}`}><Landmark /> Xem thông tin chuyển khoản</Link>}
          {order.orderStatus === "pending" && <button className="btn btn-light full" disabled={acting} onClick={cancel}>Hủy đơn hàng</button>}
          <button className="btn btn-light full" disabled={acting} onClick={buyAgain}><RotateCcw /> Mua lại</button>
        </div>
      </aside>
    </div>
  </div>;
}
