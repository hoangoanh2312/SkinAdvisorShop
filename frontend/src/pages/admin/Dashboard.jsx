import { useCallback, useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import { Link } from "react-router-dom";
import { displayOrderCode, formatCurrency, formatDate, orderStatusLabel } from "../../utils/formatters";

export default function Dashboard() {
  const [data, setData] = useState(null), [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const response = await axiosClient.get("/admin/dashboard/summary", { sessionProtected: true }); setData(response.data.data); setError(""); }
    catch (requestError) { setError(requestError.response?.data?.message || "Không thể tải tổng quan."); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <div className="admin-state error" role="alert"><p>{error}</p><button onClick={load}>Thử lại</button></div>;
  if (!data) return <div className="admin-state">Đang tải tổng quan...</div>;
  const stats = [
    ["Sản phẩm active", data.activeProducts], ["Danh mục active", data.activeCategories],
    ["Thương hiệu active", data.activeBrands], ["Khách hàng active", data.activeCustomers],
    ["Tổng đơn hàng", data.totalOrders], ["Đơn chờ xử lý", data.pendingOrders],
    ["Doanh thu hợp lệ", formatCurrency(data.revenue)],
  ];
  return <>
    <section className="admin-table-card admin-operation-card"><h3>Vận hành cửa hàng</h3><div className="admin-operation-toolbar"><Link className="btn btn-light btn-small" to="/admin/inventory">Kho hàng</Link><Link className="btn btn-light btn-small" to="/admin/returns">Trả hàng</Link><Link className="btn btn-light btn-small" to="/admin/reports">Báo cáo doanh thu</Link><Link className="btn btn-light btn-small" to="/admin/readiness">Rà soát dữ liệu AI</Link><Link className="btn btn-light btn-small" to="/admin/launch-readiness">Sẵn sàng vận hành</Link></div></section>
    <div className="stat-grid">{stats.map(([label, value]) => <article key={label}><div><small>{label}</small><strong>{value}</strong></div></article>)}</div>
    <div className="admin-grid">
      <section className="admin-table-card"><div className="table-title"><h3>Đơn hàng gần đây</h3></div>{data.recentOrders.length ? <table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày</th><th>Tổng</th><th>Trạng thái</th></tr></thead><tbody>{data.recentOrders.map(order => <tr key={order._id}><td>{displayOrderCode(order)}</td><td>{order.user?.fullName || "—"}</td><td>{formatDate(order.createdAt)}</td><td>{formatCurrency(order.total)}</td><td>{orderStatusLabel[order.orderStatus]}</td></tr>)}</tbody></table> : <div className="empty">Chưa có đơn hàng.</div>}</section>
      <section className="admin-table-card"><div className="table-title"><h3>Sắp hết hàng</h3></div>{data.lowStock.length ? data.lowStock.map(variant => <div className="admin-stock-row" key={variant._id}><span><strong>{variant.product?.name || variant.sku}</strong><small>{variant.sku}</small></span><b>{variant.stock}</b></div>) : <div className="empty">Không có sản phẩm sắp hết hàng.</div>}</section>
    </div>
  </>;
}
