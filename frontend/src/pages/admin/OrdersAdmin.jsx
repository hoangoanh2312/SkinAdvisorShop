import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { displayOrderCode, formatCurrency, formatDate, orderStatusLabel, paymentStatusLabel } from "../../utils/formatters";

const paymentMethodLabel = { COD: "COD", VNPAY: "VNPay", ZALOPAY: "ZaloPay", BANK_TRANSFER: "Chuyển khoản" };

export default function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: "", status: "", paymentStatus: "", from: "", to: "" });
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
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const { data } = await axiosClient.get(`/admin/orders?${params}`, { sessionProtected: true });
      if (sequence === requestSequence.current) {
        setOrders(data.data.orders);
        setPagination(data.data.pagination);
        setError("");
      }
    } catch (requestError) {
      if (sequence === requestSequence.current) {
        setError(requestError.response?.data?.message || "Không thể tải danh sách đơn hàng");
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [appliedSearch, filters.status, filters.paymentStatus, filters.from, filters.to]);

  // Tải dữ liệu từ backend khi thay đổi bộ lọc.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { load(1); }, [load]);

  return (
    <section className="admin-table-card admin-orders-page">
      <div className="table-title">
        <div>
          <h3>Đơn hàng</h3>
          <p>{pagination.total} đơn hàng</p>
        </div>
      </div>
      <p className="admin-order-click-hint">
        Nhấn vào <strong>mã đơn</strong> hoặc nút <strong>Mở để xác nhận</strong> để xem chi tiết và xử lý đơn hàng
      </p>

      <div className="admin-order-toolbar">
        <form className="admin-search" onSubmit={(event) => {
          event.preventDefault();
          const nextSearch = filters.search.trim();
          setLoading(true); setError("");
          if (nextSearch === appliedSearch) load(1);
          else setAppliedSearch(nextSearch);
        }}>
          <Search aria-hidden="true" />
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Mã đơn, email hoặc tên khách hàng" aria-label="Tìm đơn hàng" />
          <button type="submit">Tìm</button>
        </form>
        <select aria-label="Lọc trạng thái đơn" value={filters.status} onChange={(event) => { setLoading(true); setError(""); setFilters((current) => ({ ...current, status: event.target.value })); }}>
          <option value="">Mọi trạng thái đơn</option>
          {Object.entries(orderStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Lọc trạng thái thanh toán" value={filters.paymentStatus} onChange={(event) => { setLoading(true); setError(""); setFilters((current) => ({ ...current, paymentStatus: event.target.value })); }}>
          <option value="">Mọi trạng thái thanh toán</option>
          {Object.entries(paymentStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="admin-date-filter">Từ<input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
        <label className="admin-date-filter">Đến<input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
      </div>

      {loading ? <div className="admin-state">Đang tải đơn hàng...</div>
        : error ? <div className="admin-state error"><p>{error}</p><button className="btn btn-small" onClick={() => { setLoading(true); setError(""); load(pagination.page); }}>Thử lại</button></div>
          : orders.length ? <>
            <div className="admin-order-card-list">
              {orders.map((order) => {
                const pendingConfirmable = order.orderStatus === "pending" && (order.paymentMethod === "COD" || order.paymentStatus === "paid");
                const actionLabel = pendingConfirmable ? "Mở để xác nhận" : "Xem & xử lý";
                const orderCode = displayOrderCode(order);
                return (
                  <Link key={order._id} className="admin-order-entry" to={`/admin/orders/${order._id}`} aria-label={`${actionLabel} đơn hàng ${orderCode}`}>
                    <div className="admin-order-entry-top">
                      <div className="admin-order-entry-heading">
                        <span className="admin-order-entry-eyebrow">ĐẶT LÚC {formatDate(order.createdAt)}</span>
                        <strong className="admin-order-entry-code">{orderCode}</strong>
                      </div>
                      <span className="admin-order-entry-action">{actionLabel}<ArrowRight aria-hidden="true" size={18} /></span>
                    </div>
                    <div className="admin-order-entry-info">
                      <div className="admin-order-entry-field"><span>Khách hàng</span><strong>{order.user?.fullName || order.shippingAddress?.fullName || "Khách hàng"}</strong><small>{order.user?.email || "—"}</small></div>
                      <div className="admin-order-entry-field"><span>Trạng thái đơn</span><span className={`admin-badge order-${order.orderStatus}`}>{orderStatusLabel[order.orderStatus] || order.orderStatus}</span></div>
                      <div className="admin-order-entry-field"><span>Thanh toán</span><strong>{paymentMethodLabel[order.paymentMethod] || order.paymentMethod}</strong><span className={`admin-badge payment-${order.paymentStatus}`}>{paymentStatusLabel[order.paymentStatus] || order.paymentStatus}</span></div>
                      <div className="admin-order-entry-field admin-order-entry-total"><span>Tổng tiền</span><strong>{formatCurrency(order.total)}</strong><small>{(order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} sản phẩm</small></div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="admin-pagination">
              <button aria-label="Trang trước" disabled={pagination.page <= 1} onClick={() => { setLoading(true); load(pagination.page - 1); }}><ChevronLeft /></button>
              <span>Trang {pagination.page} / {Math.max(pagination.totalPages, 1)}</span>
              <button aria-label="Trang sau" disabled={pagination.page >= pagination.totalPages} onClick={() => { setLoading(true); load(pagination.page + 1); }}><ChevronRight /></button>
            </div>
          </> : <div className="admin-state">Không tìm thấy đơn hàng phù hợp</div>}
    </section>
  );
}
