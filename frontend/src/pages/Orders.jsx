import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Package,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import {
  displayOrderCode,
  formatCurrency,
  formatDate,
  isAwaitingBankTransfer,
  isAwaitingVnpayPayment,
  orderDisplayStatus,
} from "../utils/formatters";
import "../customer-orders.css";

const isAwaitingPayment = (order) => isAwaitingVnpayPayment(order) || isAwaitingBankTransfer(order);

const tabs = [
  { key: "all", label: "Tất cả", matches: () => true },
  { key: "payment", label: "Chờ thanh toán", matches: isAwaitingPayment },
  { key: "pending", label: "Chờ xác nhận", matches: (order) => order.orderStatus === "pending" && !isAwaitingPayment(order) },
  { key: "confirmed", label: "Đang chuẩn bị", matches: (order) => order.orderStatus === "confirmed" && !isAwaitingPayment(order) },
  { key: "shipping", label: "Đang giao", matches: (order) => order.orderStatus === "shipping" && !isAwaitingPayment(order) },
  { key: "completed", label: "Hoàn thành", matches: (order) => order.orderStatus === "completed" },
  { key: "cancelled", label: "Đã hủy", matches: (order) => order.orderStatus === "cancelled" },
];

const getTone = (order) => {
  if (order.orderStatus === "cancelled") return "cancelled";
  if (order.orderStatus === "completed") return "completed";
  if (isAwaitingPayment(order)) return "payment";
  if (order.orderStatus === "shipping") return "shipping";
  if (order.orderStatus === "confirmed") return "confirmed";
  return "pending";
};

const statusIcons = {
  cancelled: XCircle,
  completed: CheckCircle2,
  payment: CreditCard,
  shipping: Truck,
  confirmed: PackageCheck,
  pending: Clock3,
};

const paymentMethodLabel = {
  COD: "Thanh toán khi nhận hàng",
  BANK_TRANSFER: "Chuyển khoản",
  VNPAY: "VNPay",
};

function OrderCard({ order }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.reduce((count, item) => count + (Number(item.quantity) || 0), 0);
  const featured = items[0];
  const extraCount = Math.max(0, items.length - 1);
  const tone = getTone(order);
  const StatusIcon = statusIcons[tone];
  const target = `/orders/${order._id}`;

  return <article className="sw-order-card">
    <div className="sw-order-card-head">
      <div className="sw-order-code">
        <span className="sw-order-code-icon"><ShoppingBag size={19} strokeWidth={1.9} aria-hidden="true" /></span>
        <div className="sw-order-code-text">
          <span className="sw-order-subtitle">ĐƠN HÀNG</span>
          <Link to={target} className="sw-order-code-link">#{displayOrderCode(order)}</Link>
          <span className="sw-order-date">Đặt lúc {formatDate(order.createdAt)}</span>
        </div>
      </div>
      <span className={`sw-order-status sw-order-status--${tone}`}><StatusIcon size={16} aria-hidden="true" />{orderDisplayStatus(order)}</span>
    </div>

    <div className="sw-order-body">
      <Link to={target} className="sw-order-product" aria-label={`Xem chi tiết đơn hàng ${displayOrderCode(order)}`}>
        <div className="sw-order-image">
          {featured?.image ? <img src={featured.image} alt={featured.productName || "Sản phẩm"} loading="lazy" /> : <Package size={26} aria-hidden="true" />}
        </div>
        <div className="sw-order-product-copy">
          <strong>{featured?.productName || "Đơn hàng của bạn"}</strong>
          {featured?.variantName && <span className="sw-order-variant">Phân loại: {featured.variantName}</span>}
          <span className="sw-order-quantity">Số lượng: {featured?.quantity || itemCount || 1}{extraCount > 0 ? ` · Và ${extraCount} sản phẩm khác` : ""}</span>
        </div>
        <ArrowRight className="sw-order-product-arrow" size={19} aria-hidden="true" />
      </Link>
    </div>

    <div className="sw-order-card-foot">
      <div className="sw-order-payment">
        <span>{paymentMethodLabel[order.paymentMethod] || order.paymentMethod || "Phương thức thanh toán"}</span>
        <div><small>Tổng thanh toán</small><strong>{formatCurrency(order.total)}</strong></div>
      </div>
      <Link to={target} className="sw-order-view-btn">Xem chi tiết <ArrowRight size={17} aria-hidden="true" /></Link>
    </div>
  </article>;
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const allOrders = [];
      let page = 1;
      let totalPages = 1;
      do {
        const { data } = await axiosClient.get("/orders/my-orders", { params: { page, limit: 100 }, sessionProtected: true });
        const result = data?.data || {};
        allOrders.push(...(Array.isArray(result.orders) ? result.orders : []));
        totalPages = Number(result.pagination?.totalPages) || 1;
        page += 1;
      } while (page <= totalPages);
      setOrders(allOrders);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể tải đơn hàng. Vui lòng kiểm tra kết nối và thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const counts = useMemo(() => Object.fromEntries(tabs.map((tab) => [tab.key, orders.filter(tab.matches).length])), [orders]);
  const visibleOrders = useMemo(() => orders.filter(tabs.find((tab) => tab.key === activeTab)?.matches || tabs[0].matches), [activeTab, orders]);

  return <main className="sw-customer-orders container orders-page">
    <section className="sw-orders-heading">
      <div className="sw-orders-heading-copy">
        <span className="sw-orders-eyebrow">TÀI KHOẢN / ĐƠN HÀNG</span>
        <h1>Đơn hàng của tôi</h1>
        <p>Theo dõi tình trạng đơn hàng và xem lại các sản phẩm đã chọn.</p>
      </div>
      <div className="sw-orders-heading-art" aria-hidden="true"><ShoppingBag size={44} strokeWidth={1.4} /><span>sandwich.</span></div>
    </section>

    <section className="sw-orders-content" aria-label="Danh sách đơn hàng">
      <div className="sw-orders-topline">
        <div><strong>Lịch sử mua sắm</strong><span>{loading ? "Đang cập nhật..." : `${orders.length} đơn hàng`}</span></div>
        <button className="sw-orders-reload" onClick={loadOrders} disabled={loading} type="button"><RefreshCw size={16} aria-hidden="true" /> Làm mới</button>
      </div>

      <div className="sw-orders-tabs" role="tablist" aria-label="Lọc đơn hàng">
        {tabs.map((tab) => <button type="button" className={activeTab === tab.key ? "active" : ""} key={tab.key} onClick={() => setActiveTab(tab.key)} role="tab" aria-selected={activeTab === tab.key}>
          {tab.label} <span>{counts[tab.key] || 0}</span>
        </button>)}
      </div>

      {loading ? <div className="sw-orders-state" role="status"><div className="sw-orders-state-icon"><Package size={27} /></div><strong>Đang tải đơn hàng...</strong><p>sandwich đang cập nhật danh sách mới nhất.</p></div>
        : error ? <div className="sw-orders-state" role="alert"><div className="sw-orders-state-icon"><XCircle size={27} /></div><strong>Không thể tải đơn hàng</strong><p>{error}</p><button type="button" onClick={loadOrders} className="sw-order-view-btn">Thử lại <RefreshCw size={16} /></button></div>
          : visibleOrders.length ? <div className="sw-orders-list">{visibleOrders.map((order) => <OrderCard order={order} key={order._id} />)}</div>
            : <div className="sw-orders-state"><div className="sw-orders-state-icon"><ShoppingBag size={30} /></div><strong>{activeTab === "all" ? "Bạn chưa có đơn hàng nào" : "Chưa có đơn hàng ở trạng thái này"}</strong><p>Khám phá các sản phẩm chăm sóc da và chọn món phù hợp với bạn.</p><Link to="/products" className="sw-order-view-btn">Khám phá sản phẩm <ArrowRight size={16} /></Link></div>}
    </section>
  </main>;
}
