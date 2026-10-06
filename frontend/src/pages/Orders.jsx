import { PackageSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { displayOrderCode, formatCurrency, formatDate, isAwaitingBankTransfer, isAwaitingVnpayPayment, orderDisplayStatus } from "../utils/formatters";

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

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAllOrders = async () => {
      const allOrders = [];
      let page = 1;
      let totalPages = 1;
      do {
        const { data } = await axiosClient.get("/orders/my-orders", { params: { page, limit: 100 }, sessionProtected: true });
        allOrders.push(...data.data.orders);
        totalPages = data.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);
      return allOrders;
    };
    loadAllOrders()
      .then(setOrders)
      .catch((requestError) => setError(requestError.response?.data?.message || "Không thể tải đơn hàng."))
      .finally(() => setLoading(false));
  }, []);

  const visibleOrders = useMemo(() => {
    const tab = tabs.find((item) => item.key === activeTab);
    return orders.filter(tab?.matches || tabs[0].matches);
  }, [activeTab, orders]);

  return <div className="container orders-page">
    <div className="page-intro compact"><span className="eyebrow">LỊCH SỬ ĐƠN HÀNG</span><h1>Đơn hàng của tôi</h1></div>
    <div className="order-tabs" role="tablist" aria-label="Lọc đơn hàng">
      {tabs.map((tab) => <button className={activeTab === tab.key ? "active" : ""} key={tab.key} onClick={() => setActiveTab(tab.key)} role="tab" aria-selected={activeTab === tab.key}>{tab.label}</button>)}
    </div>
    {loading ? <div className="empty"><p>Đang tải đơn hàng...</p></div>
      : error ? <div className="empty"><p>{error}</p></div>
        : visibleOrders.length ? <div className="order-cards">{visibleOrders.map((order) => <Link to={`/orders/${order._id}`} key={order._id}><article><PackageSearch /><div><strong>#{displayOrderCode(order)}</strong><span>{formatDate(order.createdAt)} · {order.items.length} sản phẩm</span></div><b>{formatCurrency(order.total)}</b><em>{orderDisplayStatus(order)}</em></article></Link>)}</div>
          : <div className="empty"><h2>Không có đơn hàng trong mục này</h2><Link to="/products">Tiếp tục mua sắm</Link></div>}
  </div>;
}
