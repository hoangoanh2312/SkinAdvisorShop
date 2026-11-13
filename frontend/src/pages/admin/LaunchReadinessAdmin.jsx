import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
const navigation = { sellable: '/admin/products', prices: '/admin/products', bank: '/admin/orders', gemini: '/admin/readiness' };
export default function LaunchReadinessAdmin() {
  const [report, setReport] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const { data } = await axiosClient.get('/admin/launch-readiness', { sessionProtected: true }); setReport(data.data); setError(''); }
    catch (e) { setError(e.response?.data?.message || 'Không tải được kết quả kiểm tra.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const required = report?.checks.filter(check => ['database','sellable','prices','orders','jwt','cors','gemini'].includes(check.id)) || [];
  return <div className="admin-operation-page">
    <div className="admin-page-heading"><h2>Sẵn sàng vận hành sandwich</h2><p>Đối chiếu dữ liệu và cấu hình thật. Đây là kiểm tra chỉ đọc, không tự tạo tồn kho, giá, đơn hàng hoặc kết quả AI.</p></div>
    {error && <p className="admin-operation-error" role="alert">{error}</p>}
    <section className="admin-table-card admin-operation-card">
      <div className="admin-operation-toolbar"><button className="btn btn-light btn-small" onClick={refresh} disabled={loading}>{loading ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</button>{report && <strong>Điều kiện cốt lõi: {required.filter(c=>c.passed).length}/{required.length} đạt</strong>}</div>
      {report && <><p className="admin-operation-muted">Database đang kiểm tra: <strong>{report.database}</strong> · {report.inventory.products} sản phẩm · {report.inventory.skus} SKU · {report.inventory.missingPrices} SKU thiếu giá · {report.inventory.stockedSku} SKU có hàng · {report.inventory.sellableProducts} sản phẩm đủ điều kiện bán.</p>
        <div className="admin-operation-scroll"><table><thead><tr><th>Nhóm</th><th>Điều kiện</th><th>Kết quả</th><th>Ghi chú</th></tr></thead><tbody>{report.checks.map(check=><tr key={check.id}><td>{check.category}</td><td>{navigation[check.id] ? <Link to={navigation[check.id]}>{check.label}</Link> : check.label}</td><td><strong className={check.passed?'launch-ok':'launch-warn'}>{check.passed?'Đạt':'Chưa đạt / chưa cấu hình'}</strong></td><td>{check.detail}</td></tr>)}</tbody></table></div>
        <h3>Các bước phải kiểm tra bằng người thật</h3><ol>{report.manualVerifications.map(item=><li key={item}>{item}</li>)}</ol>
        <p className="admin-operation-muted">Một cấu hình có mặt không chứng minh nhà cung cấp thanh toán hoặc Gemini đã hoạt động. Chỉ đưa website lên môi trường thực khi đã kiểm thử tích hợp và xác minh dữ liệu.</p>
      </>}
    </section>
  </div>;
}
