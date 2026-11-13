import { useCallback, useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import AdminPager from "../../components/admin/AdminPager";
import ConfirmActionModal from "../../components/admin/ConfirmActionModal";
import { displayOrderCode, formatCurrency, formatDate, orderStatusLabel } from "../../utils/formatters";

export default function UsersAdmin() {
  const [items, setItems] = useState([]), [pagination, setPagination] = useState(null);
  const [query, setQuery] = useState(""), [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null), [detailPage, setDetailPage] = useState(1);
  const [confirming, setConfirming] = useState(null), [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get("/admin/customers", { params: { search: query, page }, sessionProtected: true });
      setItems(data.data.customers); setPagination(data.data.pagination); setError("");
    } catch (requestError) { setError(requestError.response?.data?.message || "Không thể tải khách hàng."); }
    finally { setLoading(false); }
  }, [query, page]);
  useEffect(() => { load(); }, [load]);
  const openDetail = async (id, targetPage = 1) => {
    setError("");
    try {
      const { data } = await axiosClient.get(`/admin/customers/${id}`, { params: { page: targetPage }, sessionProtected: true });
      setDetail(data.data); setDetailPage(targetPage);
    } catch (requestError) { setError(requestError.response?.data?.message || "Không thể tải lịch sử khách hàng."); }
  };
  const toggle = async () => {
    if (!confirming || saving) return;
    setSaving(true); setError("");
    try {
      await axiosClient.patch(`/admin/customers/${confirming._id}/status`, { isActive: !confirming.isActive }, { sessionProtected: true });
      setConfirming(null); await load();
      if (detail?.customer._id === confirming._id) await openDetail(confirming._id, detailPage);
    } catch (requestError) { setError(requestError.response?.data?.message || "Không thể cập nhật khách hàng."); }
    finally { setSaving(false); }
  };
  return <section className="admin-table-card">
    <div className="table-title"><h3>Khách hàng</h3></div>
    <input className="admin-filter-input" placeholder="Tìm tên hoặc email" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
    {error && <div className="admin-state error" role="alert">{error} <button onClick={load}>Thử lại</button></div>}
    {loading ? <div className="admin-state">Đang tải...</div> : items.length ? <table><thead><tr><th>Khách hàng</th><th>Ngày tạo</th><th>Đơn hàng</th><th>Tổng chi tiêu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{items.map(item => <tr key={item._id}><td><strong>{item.fullName}</strong><small>{item.email}</small></td><td>{formatDate(item.createdAt)}</td><td>{item.orderCount}</td><td>{formatCurrency(item.totalSpent)}</td><td>{item.isActive ? "Active" : "Inactive"}</td><td><div className="admin-action-row"><button className="admin-row-button" onClick={() => openDetail(item._id)}>Chi tiết</button><button className="admin-row-button" onClick={() => setConfirming(item)}>{item.isActive ? "Vô hiệu hóa" : "Kích hoạt"}</button></div></td></tr>)}</tbody></table> : <div className="empty">Chưa có khách hàng.</div>}
    <AdminPager pagination={pagination} onPage={setPage} />
    {detail && <section className="admin-editor"><div className="table-title"><h3>{detail.customer.fullName}</h3><button className="admin-row-button" onClick={() => setDetail(null)}>Đóng</button></div><p>{detail.customer.email} · {detail.customer.phone || "Chưa có số điện thoại"}</p><h4>Lịch sử đơn hàng</h4>{detail.orders.length ? <table><thead><tr><th>Mã đơn</th><th>Ngày</th><th>Tổng</th><th>Trạng thái</th></tr></thead><tbody>{detail.orders.map(order => <tr key={order._id}><td>{displayOrderCode(order)}</td><td>{formatDate(order.createdAt)}</td><td>{formatCurrency(order.total)}</td><td>{orderStatusLabel[order.orderStatus] || order.orderStatus}</td></tr>)}</tbody></table> : <div className="empty">Chưa có đơn hàng.</div>}<AdminPager pagination={detail.pagination} onPage={next => openDetail(detail.customer._id, next)} /></section>}
    {confirming && <ConfirmActionModal title={`${confirming.isActive ? "Vô hiệu hóa" : "Kích hoạt"} khách hàng?`} description={`Thay đổi quyền truy cập của ${confirming.fullName}; không xóa tài khoản hay đơn hàng.`} confirmLabel="Xác nhận" danger={confirming.isActive} busy={saving} error={error} onConfirm={toggle} onClose={() => setConfirming(null)} />}
  </section>;
}
