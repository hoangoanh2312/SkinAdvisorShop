import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { formatDate } from '../../utils/formatters';
export default function AuditAdmin() {
  const [resource, setResource] = useState(''), [page, setPage] = useState(1), [pages, setPages] = useState(1), [items, setItems] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { const { data } = await axiosClient.get('/admin/audit', { params: { page, limit: 25, resource }, sessionProtected: true }); setItems(data.data.items); setPages(data.data.pagination.totalPages || 1); setError(''); }
    catch (err) { setError(err.response?.data?.message || 'Không thể tải nhật ký.'); } finally { setLoading(false); }
  }, [page, resource]);
  useEffect(() => { load(); }, [load]);
  return <div className="admin-operation-page"><div className="admin-page-heading"><h2>Nhật ký thao tác quản trị</h2><p>Ghi nhận những thao tác ghi dữ liệu và người thực hiện. Thông tin nhạy cảm như mật khẩu, token, dữ liệu chuyển khoản không được ghi vào nhật ký.</p></div>
    <section className="admin-table-card admin-operation-card"><div className="admin-operation-toolbar"><label>Lọc theo nhóm<select value={resource} onChange={e => { setResource(e.target.value); setPage(1); }}><option value="">Tất cả</option>{['products', 'variants', 'orders', 'inventory', 'return', 'customers', 'vouchers', 'categories', 'brands'].map(x => <option key={x} value={x}>{x}</option>)}</select></label><button className="btn btn-light btn-small" onClick={load}>Làm mới</button></div>{error && <p role="alert" className="admin-operation-error">{error}</p>}
    {loading ? <p>Đang tải nhật ký...</p> : <div className="admin-operation-scroll"><table><thead><tr><th>Thời gian</th><th>Admin</th><th>Thao tác</th><th>Nhóm</th><th>Mã</th><th>Chi tiết</th></tr></thead><tbody>{items.map(item => <tr key={item._id}><td>{formatDate(item.createdAt)}</td><td>{item.actor?.fullName || item.actor?.email || '—'}</td><td>{item.action}</td><td>{item.resource}</td><td>{item.resourceId || '—'}</td><td>{item.details || '—'}</td></tr>)}</tbody></table></div>}{!loading && !items.length && <p>Chưa có nhật ký.</p>}
    <div className="admin-operation-pager"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Sau</button></div>
    <p className="admin-operation-muted">Nhật ký thao tác cũ dùng ghi sau khi API thành công nên cần đối chiếu với lịch sử kho và backup khi kiểm toán quan trọng. Những thay đổi trước ngày cài bản này không có log hồi tố.</p></section></div>;
}
