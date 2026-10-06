import { Check, Clock3, Landmark, MapPin, RotateCcw, WalletCards } from "lucide-react";
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
    .catch((requestError) => setError(requestError.response?.data?.message || "Không thể tải đơn hàng."))
    .finally(() => setLoading(false)), [id]);
  useEffect(() => { load(); }, [load]);

  const cancel = async () => {
    setError(""); setActing(true);
    try { await axiosClient.put(`/orders/${id}/cancel`, {}, { sessionProtected: true }); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Không thể hủy đơn hàng."); }
    finally { setActing(false); }
  };

  const payNow = async () => {
    setError(""); setActing(true);
    try {
      const { data } = await axiosClient.post("/payments/vnpay/create", { orderId: order._id }, { sessionProtected: true });
      window.location.assign(data.data.paymentUrl);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể tạo yêu cầu thanh toán.");
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
      if (!added) setError("Các sản phẩm trong đơn hiện không còn khả dụng.");
      else if (added < order.items.length) setNotice("Đã thêm các sản phẩm còn bán và còn hàng vào giỏ.");
      else navigate("/cart");
    } finally { setActing(false); }
  };

  if (loading) return <div className="container empty">Đang tải đơn hàng...</div>;
  if (!order) return <div className="container empty"><p>{error}</p><Link to="/orders">Quay lại</Link></div>;

  const currentRank = statusRanks[order.orderStatus] ?? -1;
  const address = order.shippingAddress || {};
  const addressParts = [address.address || address.addressLine, address.ward, address.district, address.province].filter(Boolean);

  return <div className="container orders-page order-detail-page">
    <div className="page-intro compact"><span className="eyebrow">CHI TIẾT ĐƠN HÀNG</span><h1>#{displayOrderCode(order)}</h1><p>{formatDate(order.createdAt)}</p></div>
    <div className="order-detail-grid">
      <main>
        <section className="order-panel">
          <div className="order-panel-heading"><div><span>Trạng thái đơn hàng</span><h2>{orderDisplayStatus(order)}</h2></div><Clock3 /></div>
          <div className="order-timeline">
            <div className="done"><i><Check /></i><strong>Đã đặt hàng</strong><small>{formatDate(order.createdAt)}</small></div>
            {order.paidAt && <div className="done"><i><Check /></i><strong>Đã thanh toán</strong><small>{formatDate(order.paidAt)}</small></div>}
            {order.orderStatus === "cancelled" ? <div className="current cancelled"><i /><strong>Đã hủy</strong></div> : timelineSteps.map((step) => <div className={currentRank >= statusRanks[step.status] ? "done" : ""} key={step.status}><i>{currentRank >= statusRanks[step.status] && <Check />}</i><strong>{step.label}</strong></div>)}
          </div>
        </section>
        <section className="order-panel"><h2>Sản phẩm</h2>{order.items.map((item) => <div className="order-detail-item" key={item.variant}><img src={item.image} alt="" /><span><strong>{item.productName}</strong><small>{item.variantName} · {item.sku} × {item.quantity}</small></span><b>{formatCurrency(item.subtotal)}</b></div>)}</section>
        <section className="order-panel shipping-snapshot"><MapPin /><div><h2>Địa chỉ nhận hàng</h2><strong>{address.fullName} · {address.phone}</strong><p>{addressParts.join(", ")}</p></div></section>
      </main>
      <aside className="order-panel order-detail-summary">
        <h2>Thanh toán</h2>
        <p><span>Phương thức</span><strong>{order.paymentMethod}</strong></p><p><span>Trạng thái</span><strong>{paymentStatusLabel[order.paymentStatus]}</strong></p>
        <p><span>Tạm tính</span><strong>{formatCurrency(order.subtotal)}</strong></p>{order.discount > 0 && <p><span>Giảm giá</span><strong>-{formatCurrency(order.discount)}</strong></p>}<p><span>Phí vận chuyển</span><strong>{formatCurrency(order.shippingFee)}</strong></p>
        <div className="summary-total"><span>Tổng cộng</span><strong>{formatCurrency(order.total)}</strong></div>
        {error && <p className="form-error">{error}</p>}{notice && <p className="form-notice">{notice}</p>}
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
