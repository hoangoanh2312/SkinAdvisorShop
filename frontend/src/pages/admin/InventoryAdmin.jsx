import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { formatCurrency, formatDate } from '../../utils/formatters';
import InventoryImport from '../../components/admin/InventoryImport';

const errorText = (error, fallback) => error.response?.data?.message || fallback;
const kindNames = { receipt: 'Nhập hàng', adjustment: 'Điều chỉnh', return: 'Hoàn trả', sale: 'Bán hàng', cancellation: 'Hủy đơn' };
export default function InventoryAdmin() {
  const [search, setSearch] = useState(''), [term, setTerm] = useState(''), [low, setLow] = useState(false), [page, setPage] = useState(1);
  const [items, setItems] = useState([]), [pages, setPages] = useState(1), [total, setTotal] = useState(0);
  const [movements, setMovements] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null), [kind, setKind] = useState('receipt'), [delta, setDelta] = useState(''), [note, setNote] = useState(''), [reference, setReference] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        axiosClient.get('/admin/inventory', { params: { page, limit: 20, search: term, low }, sessionProtected: true }),
        axiosClient.get('/admin/inventory/movements', { params: { limit: 12 }, sessionProtected: true }),
      ]);
      setItems(a.data.data.items); setPages(a.data.data.pagination.totalPages || 1); setTotal(a.data.data.pagination.total); setMovements(b.data.data.items); setError('');
    } catch (e) { setError(errorText(e, 'Không thể tải kho hàng')); } finally { setLoading(false); }
  }, [page, term, low]);
  useEffect(() => { load(); }, [load]);
  const submit = async event => {
    event.preventDefault(); setNotice(''); setError('');
    const quantity = Number(delta);
    if (!editing || !Number.isSafeInteger(quantity) || quantity === 0 || Math.abs(quantity) > 100000 || (kind === 'receipt' && quantity < 1)) { setError('Số lượng phải là số nguyên khác 0 (nhập hàng phải lớn hơn 0)'); return; }
    if (note.trim().length < 6) { setError('Nhập lý do tối thiểu 6 ký tự'); return; }
    const finalStock = editing.stock + quantity;
    if (finalStock < 0) { setError('Không thể xuất kho vượt số lượng hiện có'); return; }
    if (!window.confirm(`Xác nhận ${quantity > 0 ? '+' : ''}${quantity} mã hàng ${editing.sku}? Tồn kho dự kiến: ${editing.stock} → ${finalStock}.`)) return;
    setBusy(true);
    try {
      await axiosClient.post('/admin/inventory/adjust', { variantId: editing._id, delta: quantity, kind, note: note.trim(), reference: reference.trim() }, { sessionProtected: true });
      setEditing(null); setDelta(''); setNote(''); setReference(''); setNotice('Cập nhật tồn kho thành công'); await load();
    } catch (e) { setError(errorText(e, 'Không thể cập nhật kho')); } finally { setBusy(false); }
  };
  return <div className="admin-operation-page">
    <div className="admin-page-heading"><h2>Kho hàng và nhập / xuất</h2><p>Chỉ ghi nhận số lượng đã kiểm kê, mỗi điều chỉnh được lưu kèm lý do và người thực hiện</p></div>
    <InventoryImport onDone={load} />
    <section className="admin-table-card admin-operation-card">
      <form className="admin-operation-toolbar" onSubmit={e => { e.preventDefault(); setPage(1); setTerm(search.trim()); }}>
        <input aria-label="Tìm mã hàng" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã hàng hoặc tên sản phẩm" />
        <button className="btn btn-dark btn-small">Tìm</button>
        <label className="admin-operation-check"><input type="checkbox" checked={low} onChange={e => { setPage(1); setLow(e.target.checked); }} /> Tồn kho ≤ 5</label>
      </form>
      <p className="admin-operation-muted">{total} SKU. Lịch sử gồm nhập/xuất thủ công, đặt hàng, thanh toán, hủy đơn và hàng hoàn trả sau khi cài bản này.</p>
      {notice && <p role="status" className="admin-operation-success">{notice}</p>}{error && <p role="alert" className="admin-operation-error">{error}</p>}
      {loading ? <p>Đang tải tồn kho...</p> : <div className="admin-operation-scroll"><table><thead><tr><th>Sản phẩm</th><th>Mã hàng</th><th>Giá</th><th>Kho</th><th>Trạng thái</th><th>Điều chỉnh</th></tr></thead><tbody>{items.map(item => <tr key={item._id}><td><Link to={`/admin/products/${item.product?._id}/edit`}>{item.product?.name || 'Sản phẩm không còn tồn tại'}</Link></td><td>{item.sku}</td><td>{formatCurrency(item.price)}</td><td><strong>{item.stock}</strong></td><td>{item.isActive ? 'Hoạt động' : 'Tạm ẩn'}</td><td><button type="button" className="btn btn-light btn-small" onClick={() => { setEditing(item); setDelta(''); setNote(''); setReference(''); setError(''); }}>Nhập / điều chỉnh</button></td></tr>)}</tbody></table></div>}
      {!loading && !items.length && <p>Không có mã hàng phù hợp</p>}
      <div className="admin-operation-pager"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Sau</button></div>
    </section>
    {editing && <section className="admin-table-card admin-operation-card" aria-label="Điều chỉnh tồn kho"><h3>Điều chỉnh: {editing.sku}</h3><p>Đang có <strong>{editing.stock}</strong> sản phẩm trong kho</p><form onSubmit={submit} className="admin-operation-form">
      <label>Loại giao dịch<select value={kind} onChange={e => setKind(e.target.value)}><option value="receipt">Nhập hàng thực tế</option><option value="adjustment">Điều chỉnh tăng / giảm sau kiểm kê</option></select></label>
      <label>Số lượng thay đổi ({kind === 'adjustment' ? 'dùng dấu âm để giảm' : 'dương để nhập'})<input type="number" required step="1" value={delta} onChange={e => setDelta(e.target.value)} /></label>
      <label>Lý do / thông tin kiểm kê<textarea required minLength="6" maxLength="500" value={note} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: Nhập 5 chai theo phiếu nhập ngày..." /></label>
      <label>Mã phiếu / chứng từ (không bắt buộc)<input maxLength="100" value={reference} onChange={e => setReference(e.target.value)} /></label>
      <div className="admin-operation-toolbar"><button className="btn btn-dark btn-small" disabled={busy}>{busy ? 'Đang lưu...' : 'Xác nhận cập nhật kho'}</button><button type="button" className="btn btn-light btn-small" onClick={() => setEditing(null)}>Hủy</button></div>
    </form></section>}
    <section className="admin-table-card admin-operation-card"><h3>Giao dịch kho gần đây</h3><div className="admin-operation-scroll"><table><thead><tr><th>Ngày</th><th>Mã hàng</th><th>Loại</th><th>Thay đổi</th><th>Trước → Sau</th><th>Lý do</th><th>Người thực hiện</th></tr></thead><tbody>{movements.map(m => <tr key={m._id}><td>{formatDate(m.createdAt)}</td><td>{m.variant?.sku || '—'}</td><td>{kindNames[m.kind] || m.kind}</td><td><strong>{m.delta > 0 ? '+' : ''}{m.delta}</strong></td><td>{m.before} → {m.after}</td><td>{m.note}</td><td>{m.actor?.fullName || 'Hệ thống'}</td></tr>)}</tbody></table></div>{!movements.length && <p>Chưa có lịch sử điều chỉnh kho</p>}</section>
  </div>;
}
