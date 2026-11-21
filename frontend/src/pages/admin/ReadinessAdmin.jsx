import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
export default function ReadinessAdmin() {
  const [report, setReport] = useState(null), [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const { data } = await axiosClient.get('/admin/readiness', { sessionProtected: true }); setReport(data.data); setError(''); }
    catch (e) { setError(e.response?.data?.message || 'Không thể kiểm tra dữ liệu mỹ phẩm'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return <div className="admin-operation-page"><div className="admin-page-heading"><h2>Kiểm tra dữ liệu mỹ phẩm và AI</h2><p>Rà soát dữ liệu cần thiết cho danh mục sản phẩm và Trợ lý da AI. Danh sách là cảnh báo để quản trị viên kiểm chứng, không tự điền thông tin mỹ phẩm hay mở bán sản phẩm.</p></div>
    {error && <p className="admin-operation-error" role="alert">{error}</p>}
    <section className="admin-table-card admin-operation-card"><div className="admin-operation-toolbar"><button className="btn btn-light btn-small" onClick={load}>Kiểm tra lại</button>{report && <strong>{report.productsNeedingReview}/{report.totalProducts} sản phẩm cần rà soát</strong>}</div>
      {!report ? <p>Đang tải dữ liệu...</p> : !report.issues.length ? <p>Không phát hiện vấn đề theo bộ quy tắc tự động</p> : <div className="admin-operation-scroll"><table><thead><tr><th>Sản phẩm</th><th>Trạng thái</th><th>Cần kiểm tra</th><th>Chỉnh sửa</th></tr></thead><tbody>{report.issues.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.isActive ? 'Đang bật bán' : 'Chưa bật bán'}</td><td><ul>{item.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></td><td><Link className="btn btn-light btn-small" to={`/admin/products/${item.id}/edit`}>Sửa</Link></td></tr>)}</tbody></table></div>}
      <p className="admin-operation-muted">Không thể dùng tự động để xác minh giá thị trường, nguồn gốc sản phẩm, hạn sử dụng hoặc tính chính xác của thành phần. Cần kiểm tra với nhà cung cấp.</p></section></div>;
}
