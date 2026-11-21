import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { formatCurrency, orderStatusLabel, paymentStatusLabel } from '../../utils/formatters';

const isoDay = value => value.toISOString().slice(0, 10);
const today = new Date();
const initialTo = isoDay(today);
const initialFrom = isoDay(new Date(today.getTime() - 89 * 86400000));
const emptyList = value => Array.isArray(value) ? value : [];
const validateRange = (from, to) => {
  const valid = text => /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00.000Z`)) && isoDay(new Date(`${text}T00:00:00.000Z`)) === text;
  if (!valid(from) || !valid(to) || from > to) return 'Vui lòng chọn khoảng ngày hợp lệ';
  if ((new Date(`${to}T00:00:00.000Z`) - new Date(`${from}T00:00:00.000Z`)) / 86400000 >= 366) return 'Khoảng báo cáo tối đa 366 ngày';
  return '';
};

export default function ReportsAdmin() {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [range, setRange] = useState({ from: initialFrom, to: initialTo });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get('/admin/reports/summary', { params: range, sessionProtected: true });
      setData(response.data.data);
      setError('');
    } catch (requestError) {
      setData(null);
      setError(requestError.response?.data?.message || 'Không thể tải báo cáo. Kiểm tra máy chủ và thử lại.');
    } finally { setLoading(false); }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const download = async type => {
    setBusy(true); setError('');
    try {
      const response = await axiosClient.get('/admin/reports/export', {
        params: { ...range, type }, responseType: 'blob', sessionProtected: true,
      });
      if (response.data.type.includes('json')) {
        const payload = JSON.parse(await response.data.text());
        throw new Error(payload.message || 'Không thể xuất dữ liệu');
      }
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sandwich-${type}-${range.from}-${range.to}.csv`;
      document.body.appendChild(link);
      link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (requestError) {
      setError(requestError.message || 'Không thể xuất tệp CSV');
    } finally { setBusy(false); }
  };

  const daily = emptyList(data?.dailyRevenue);
  const top = emptyList(data?.topItems);
  const statuses = emptyList(data?.orderStatuses);
  const payments = emptyList(data?.paymentStatuses);
  const maxRevenue = Math.max(1, ...daily.map(row => Number(row.revenue) || 0));
  const noOrders = data && !data.orders?.orders;
  const noStock = data && !data.inventory?.units;

  return <div className="admin-operation-page admin-reports-page">
    <div className="admin-page-heading">
      <h2>Báo cáo doanh thu &amp; kinh doanh</h2>
      <p>Chỉ ghi nhận doanh thu từ đơn hoàn thành và thanh toán đủ điều kiện; không tính đơn đã hoàn tiền. Báo cáo theo <strong>ngày tạo đơn (UTC)</strong>, không phải ngày giao hoặc ngày nhận tiền</p>
    </div>
    <section className="admin-table-card admin-operation-card">
      <form className="admin-operation-toolbar" onSubmit={event => {
        event.preventDefault(); const issue = validateRange(from, to);
        if (issue) { setError(issue); return; }
        setError(''); setRange({ from, to });
      }}>
        <label>Từ ngày<input type="date" required value={from} max={to} onChange={event => setFrom(event.target.value)} /></label>
        <label>Đến ngày<input type="date" required value={to} min={from} onChange={event => setTo(event.target.value)} /></label>
        <button type="submit" className="btn btn-dark btn-small" disabled={loading}>Xem báo cáo</button>
      </form>
      <div className="admin-operation-toolbar" aria-label="Xuất dữ liệu CSV">
        <button type="button" disabled={busy} className="btn btn-light btn-small" onClick={() => download('orders')}>Xuất đơn hàng CSV</button>
        <button type="button" disabled={busy} className="btn btn-light btn-small" onClick={() => download('inventory')}>Xuất kho CSV</button>
        <button type="button" disabled={busy} className="btn btn-light btn-small" onClick={() => download('movements')}>Xuất biến động kho CSV</button>
      </div>
      <p className="admin-operation-muted">CSV UTF-8 mở bằng Excel. Tối đa 10.000 dòng mỗi lần xuất, khoảng thời gian tối đa 366 ngày. <strong>Số tồn kho là số hiện tại</strong>, không phụ thuộc khoảng ngày</p>
    </section>
    {error && <p role="alert" className="admin-operation-error">{error} <button type="button" className="btn btn-light btn-small" onClick={load}>Thử lại</button></p>}
    {loading ? <p role="status">Đang tải dữ liệu báo cáo...</p> : data ? <>
      <div className="admin-operation-stats">
        <article><span>Đơn tạo trong kỳ</span><strong>{data.orders?.orders || 0}</strong></article>
        <article><span>Giá trị đơn tạo trong kỳ</span><strong>{formatCurrency(data.orders?.gross)}</strong></article>
        <article><span>Doanh thu đủ điều kiện</span><strong>{formatCurrency(data.revenue)}</strong></article>
        <article><span>Tổng số lượng tồn kho hiện tại</span><strong>{data.inventory?.units || 0}</strong></article>
        <article><span>Mã hàng đang hết hàng</span><strong>{data.inventory?.outOfStock || 0}/{data.inventory?.skus || 0}</strong></article>
      </div>
      {(noOrders || noStock) && <section className="admin-reports-notice" aria-label="Tình trạng dữ liệu kinh doanh">
        <h3>Chưa có đủ dữ liệu kinh doanh để thống kê đầy đủ</h3>
        {noStock && <p>Kho đang có 0 sản phẩm. Chỉ ghi nhận hàng đã kiểm kê trong <Link to="/admin/inventory">Kho hàng</Link>; không nhập số lượng giả để tạo doanh thu</p>}
        {noOrders && <p>Chưa có đơn trong khoảng đã chọn. Khi khách tạo đơn và quản trị viên xử lý đúng quy trình, hệ thống sẽ cập nhật số liệu từ MongoDB.</p>}
        <div className="admin-reports-links"><Link to="/admin/products">Kiểm tra sản phẩm</Link><Link to="/admin/launch-readiness">Kiểm tra sẵn sàng vận hành</Link><Link to="/admin/orders">Xem đơn hàng</Link></div>
      </section>}
      <section className="admin-table-card admin-operation-card"><h3>Doanh thu theo ngày tạo đơn</h3>
        {daily.length ? <div className="admin-operation-bars" aria-label="Biểu đồ doanh thu theo ngày">{daily.map(row => <div key={row._id} className="admin-operation-bar-row"><span>{row._id}</span><div className="admin-operation-bar-track"><div style={{ width: `${100 * (Number(row.revenue) || 0) / maxRevenue}%` }} /></div><strong>{formatCurrency(row.revenue)}</strong></div>)}</div> : <p className="admin-reports-empty">Chưa có đơn hoàn thành đủ điều kiện ghi nhận doanh thu trong khoảng ngày này</p>}
      </section>
      <section className="admin-table-card admin-operation-card"><h3>Sản phẩm bán chạy nhất</h3>
        {top.length ? <div className="admin-operation-scroll"><table className="admin-reports-table"><thead><tr><th>Mã hàng</th><th>Sản phẩm</th><th>Số lượng</th><th>Giá trị trước chiết khấu đơn</th></tr></thead><tbody>{top.map(item => <tr key={item._id}><td data-label="Mã hàng">{item._id}</td><td data-label="Sản phẩm">{item.name}</td><td data-label="Số lượng">{item.quantity}</td><td data-label="Giá trị">{formatCurrency(item.revenue)}</td></tr>)}</tbody></table></div> : <p className="admin-reports-empty">Chưa có sản phẩm bán ra từ đơn hàng đủ điều kiện trong kỳ</p>}
      </section>
      <section className="admin-table-card admin-operation-card"><h3>Đơn theo trạng thái</h3>
        {statuses.length ? <div className="admin-operation-tags">{statuses.map(item => <span key={item._id}>{orderStatusLabel[item._id] || item._id}: <strong>{item.count}</strong></span>)}</div> : <p className="admin-reports-empty">Chưa có đơn hàng trong kỳ</p>}
        <h3>Thanh toán theo trạng thái</h3>
        {payments.length ? <div className="admin-operation-tags">{payments.map(item => <span key={item._id}>{paymentStatusLabel[item._id] || item._id}: <strong>{item.count}</strong> đơn, {formatCurrency(item.total)}</span>)}</div> : <p className="admin-reports-empty">Chưa có thanh toán để đối chiếu</p>}
      </section>
    </> : null}
  </div>;
}
