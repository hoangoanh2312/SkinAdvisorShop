import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { displayOrderCode, formatCurrency, formatDate } from '../../utils/formatters';
const labels = { requested: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', received: 'Đã nhận hàng', refund_confirmed: 'Đã xác nhận hoàn tiền' };
export default function ReturnsAdmin() {
  const [params] = useSearchParams();
  const [orderId, setOrderId] = useState(params.get('orderId') || ''), [reason, setReason] = useState('');
  const [status, setStatus] = useState(''), [items, setItems] = useState([]), [page, setPage] = useState(1), [pages, setPages] = useState(1);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [refundInputs, setRefundInputs] = useState({});
  const load = useCallback(async () => {
    try { const { data } = await axiosClient.get('/admin/returns', { params: { status, page, limit: 20 }, sessionProtected: true }); setItems(data.data.items); setPages(data.data.pagination.totalPages || 1); setError(''); }
    catch (err) { setError(err.response?.data?.message || 'Không thể tải yêu cầu trả hàng.'); } finally { setLoading(false); }
  }, [page, status]);
  useEffect(() => { load(); }, [load]);
  const create = async event => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await axiosClient.post('/admin/returns', { orderId: orderId.trim(), reason: reason.trim() }, { sessionProtected: true }); setOrderId(''); setReason(''); setMessage('Đã tạo hồ sơ trả hàng (toàn bộ đơn).'); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Không thể tạo hồ sơ.'); } finally { setBusy(false); }
  };
  const act = async (item, action, shouldRestock = false) => {
    const body = { action };
    if (action === 'receive') body.restock = shouldRestock;
    if (action === 'confirm_refund') {
      const fields = refundInputs[item._id] || {};
      if ((fields.reference || '').trim().length < 4) { setError('Nhập mã chứng từ hoàn tiền tối thiểu 4 ký tự.'); return; }
      body.refundReference = fields.reference.trim(); body.refundNote = (fields.note || '').trim(); body.confirmFundsSent = true;
    }
    if (!window.confirm(action === 'confirm_refund' ? 'Xác nhận đã chuyển hoàn tiền THẬT bên ngoài sandwich và có chứng từ? Hệ thống KHÔNG tự chuyển tiền.' : 'Xác nhận cập nhật hồ sơ trả hàng?')) return;
    setBusy(true); setError(''); setMessage('');
    try { await axiosClient.patch(`/admin/returns/${item._id}`, body, { sessionProtected: true }); setMessage('Đã cập nhật hồ sơ trả hàng.'); setRefundInputs(current => ({ ...current, [item._id]: {} })); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Không thể cập nhật hồ sơ.'); } finally { setBusy(false); }
  };
  return <div className="admin-operation-page">
    <div className="admin-page-heading"><h2>Trả hàng và hoàn tiền</h2><p>Quy trình dành cho <strong>trả toàn bộ đơn đã hoàn thành</strong>. Hoàn tiền phải thực hiện qua kênh thanh toán thực tế trước khi xác nhận tại đây.</p></div>
    {error && <p role="alert" className="admin-operation-error">{error}</p>}{message && <p role="status" className="admin-operation-success">{message}</p>}
    <section className="admin-table-card admin-operation-card"><h3>Tạo hồ sơ trả hàng</h3><form onSubmit={create} className="admin-operation-form"><label>ID đơn hàng (lấy từ đường dẫn chi tiết đơn)<input required value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="MongoDB Order ID" /></label><label>Lý do khách trả hàng<textarea required minLength="8" maxLength="500" value={reason} onChange={e => setReason(e.target.value)} placeholder="Mô tả tình trạng hàng và yêu cầu của khách" /></label><button className="btn btn-dark btn-small" disabled={busy}>Tạo hồ sơ</button></form></section>
    <section className="admin-table-card admin-operation-card"><div className="admin-operation-toolbar"><h3>Danh sách xử lý</h3><select aria-label="Lọc trả hàng" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả</option>{Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
      {loading ? <p>Đang tải...</p> : !items.length ? <p>Chưa có hồ sơ trả hàng.</p> : <div className="admin-return-grid">{items.map(item => <article className="admin-return-card" key={item._id}><div className="admin-operation-toolbar"><strong>{displayOrderCode(item.order || {})}</strong><span className="admin-operation-pill">{labels[item.status]}</span></div><p>Tạo {formatDate(item.createdAt)} · {formatCurrency(item.order?.total || 0)}</p><p><strong>Lý do:</strong> {item.reason}</p><p>Kho: {item.restockDecision === 'restocked' ? 'Đã hoàn kho' : item.restockDecision === 'damaged' ? 'Không nhập lại' : 'Chưa xử lý'}</p>
      {item.status === 'requested' && <div className="admin-operation-toolbar"><button disabled={busy} onClick={() => act(item, 'approve')} className="btn btn-dark btn-small">Duyệt</button><button disabled={busy} onClick={() => act(item, 'reject')} className="btn btn-light btn-small">Từ chối</button></div>}
      {item.status === 'approved' && <div className="admin-operation-toolbar"><button disabled={busy} onClick={() => act(item, 'receive', true)} className="btn btn-dark btn-small">Nhận hàng · Có nhập lại kho</button><button disabled={busy} onClick={() => act(item, 'receive', false)} className="btn btn-light btn-small">Nhận hàng · Không nhập lại</button></div>}
      {item.status === 'received' && <div className="admin-operation-form"><p className="admin-operation-muted">Sau khi đã hoàn tiền ngoài hệ thống, nhập mã chứng từ và xác nhận.</p><input aria-label="Mã chứng từ hoàn tiền" placeholder="Mã chứng từ hoàn tiền" value={refundInputs[item._id]?.reference || ''} onChange={e => setRefundInputs(current => ({ ...current, [item._id]: { ...current[item._id], reference: e.target.value } }))} /><input aria-label="Ghi chú hoàn tiền" placeholder="Ghi chú (không bắt buộc)" value={refundInputs[item._id]?.note || ''} onChange={e => setRefundInputs(current => ({ ...current, [item._id]: { ...current[item._id], note: e.target.value } }))} /><button disabled={busy} onClick={() => act(item, 'confirm_refund')} className="btn btn-dark btn-small">Đã hoàn tiền thực tế</button></div>}
      {item.status === 'refund_confirmed' && <p>Chứng từ: <strong>{item.refundReference}</strong></p>}
    </article>)}</div>}
      <div className="admin-operation-pager"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Sau</button></div>
    </section>
  </div>;
}
