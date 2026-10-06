import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { displayOrderCode, formatCurrency, formatDate, orderStatusLabel, paymentStatusLabel } from "../../utils/formatters";

const paymentMethodLabel = { COD: "COD", VNPAY: "VNPay", BANK_TRANSFER: "Chuyển khoản" };

export default function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: "", status: "", paymentStatus: "" });
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const load = useCallback(async (page = 1) => {
    const sequence = ++requestSequence.current;
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (appliedSearch) params.set("search", appliedSearch);
      if (filters.status) params.set("status", filters.status);
      if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
      const { data } = await axiosClient.get(`/admin/orders?${params}`, { sessionProtected: true });
      if (sequence === requestSequence.current) { setOrders(data.data.orders); setPagination(data.data.pagination); }
    } catch (requestError) { if (sequence === requestSequence.current) setError(requestError.response?.data?.message || "Không thể tải danh sách đơn hàng."); }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [appliedSearch, filters.status, filters.paymentStatus]);
  // The effect starts an external API synchronization; state updates occur after the request settles.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { load(1); }, [load]);
  return <section className="admin-table-card admin-orders-page">
    <div className="table-title"><div><h3>Đơn hàng</h3><p>{pagination.total} đơn hàng · dữ liệu trực tiếp từ backend</p></div></div>
    <div className="admin-order-toolbar">
      <form className="admin-search" onSubmit={(event) => { event.preventDefault(); const nextSearch = filters.search.trim(); setLoading(true); setError(""); if (nextSearch === appliedSearch) load(1); else setAppliedSearch(nextSearch); }}><Search /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Mã đơn, email hoặc tên khách hàng" /><button type="submit">Tìm</button></form>
      <select aria-label="Lọc trạng thái đơn" value={filters.status} onChange={(event) => { setLoading(true); setError(""); setFilters((current) => ({ ...current, status: event.target.value })); }}><option value="">Mọi trạng thái đơn</option>{Object.entries(orderStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Lọc trạng thái thanh toán" value={filters.paymentStatus} onChange={(event) => { setLoading(true); setError(""); setFilters((current) => ({ ...current, paymentStatus: event.target.value })); }}><option value="">Mọi trạng thái thanh toán</option>{Object.entries(paymentStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </div>
    {loading ? <div className="admin-state">Đang tải đơn hàng...</div> : error ? <div className="admin-state error"><p>{error}</p><button className="btn btn-small" onClick={() => { setLoading(true); setError(""); load(pagination.page); }}>Thử lại</button></div> : orders.length ? <>
      <div className="admin-order-table-wrap"><table><thead><tr><th>Đơn hàng</th><th>Khách hàng</th><th>Thanh toán</th><th>Trạng thái</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Giao đến</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id}>
        <td><Link className="admin-order-link" to={`/admin/orders/${order._id}`}>{displayOrderCode(order)}</Link><small>{formatDate(order.createdAt)}</small></td><td><strong>{order.user?.fullName || "Khách hàng"}</strong><small>{order.user?.email || "—"}</small></td>
        <td><span>{paymentMethodLabel[order.paymentMethod] || order.paymentMethod}</span><small className={`admin-badge payment-${order.paymentStatus}`}>{paymentStatusLabel[order.paymentStatus]}</small></td><td><span className={`admin-badge order-${order.orderStatus}`}>{orderStatusLabel[order.orderStatus]}</span></td>
        <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td><strong>{formatCurrency(order.total)}</strong></td><td className="admin-address-cell">{order.shippingAddress?.province}<small>{order.shippingAddress?.fullName} · {order.shippingAddress?.phone}</small></td>
      </tr>)}</tbody></table></div><div className="admin-pagination"><button aria-label="Trang trước" disabled={pagination.page <= 1} onClick={() => { setLoading(true); load(pagination.page - 1); }}><ChevronLeft /></button><span>Trang {pagination.page} / {Math.max(pagination.totalPages, 1)}</span><button aria-label="Trang sau" disabled={pagination.page >= pagination.totalPages} onClick={() => { setLoading(true); load(pagination.page + 1); }}><ChevronRight /></button></div>
    </> : <div className="admin-state">Không tìm thấy đơn hàng phù hợp.</div>}
  </section>;
}
