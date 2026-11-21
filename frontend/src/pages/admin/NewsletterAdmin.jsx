import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Search, Send, X } from "lucide-react";
import axiosClient from "../../api/axiosClient";
import AdminPager from "../../components/admin/AdminPager";
import ConfirmActionModal from "../../components/admin/ConfirmActionModal";
import { formatCurrency } from "../../utils/formatters";

const MAX_PRODUCTS = 4;
const emptyDraft = { subject: "", content: "" };
const statusLabel = { sending: "Đang gửi", sent: "Đã gửi xong", partial: "Gửi được một phần", failed: "Gửi thất bại" };
const formatDateTime = (value) => value ? new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const errorOf = (error, fallback) => error.response?.data?.message || fallback;

function ProductPicker({ selected, onChange }) {
  const [query, setQuery] = useState(""), [results, setResults] = useState([]), [searching, setSearching] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    if (query.trim().length < 2) { setResults([]); return undefined; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try { const { data } = await axiosClient.get("/products", { params: { search: query.trim(), limit: 8 } }); setResults(data.data.products || []); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query]);
  const full = selected.length >= MAX_PRODUCTS;
  const add = (product) => { if (full || selected.some((item) => item._id === product._id)) return; onChange([...selected, product]); };
  return <div className="newsletter-picker">
    <label className="newsletter-label">Sản phẩm kèm theo <small>tối đa {MAX_PRODUCTS}, không bắt buộc</small></label>
    {selected.length > 0 && <ul className="newsletter-chosen">{selected.map((product) => <li key={product._id}>
      {product.images?.[0] && <img src={product.images[0]} alt="" />}
      <span><small>{product.brand}</small>{product.name}</span>
      <button type="button" aria-label={`Bỏ ${product.name}`} onClick={() => onChange(selected.filter((item) => item._id !== product._id))}><X size={15} /></button>
    </li>)}</ul>}
    <div className="newsletter-search"><Search size={16} /><input value={query} disabled={full} onChange={(event) => setQuery(event.target.value)} placeholder={full ? "Đã chọn đủ 4 sản phẩm" : "Gõ tên sản phẩm hoặc thương hiệu để tìm"} aria-label="Tìm sản phẩm kèm theo" /></div>
    {query.trim().length >= 2 && !full && <ul className="newsletter-results">
      {searching ? <li className="muted">Đang tìm...</li> : results.length ? results.map((product) => {
        const chosen = selected.some((item) => item._id === product._id);
        return <li key={product._id}><button type="button" disabled={chosen} onClick={() => add(product)}>
          {product.images?.[0] && <img src={product.images[0]} alt="" />}
          <span><small>{product.brand}</small>{product.name}</span>
          <b>{product.catalogSalePrice != null ? formatCurrency(product.catalogSalePrice) : "Chưa có giá"}</b>
          <em>{chosen ? "Đã chọn" : "Thêm"}</em>
        </button></li>;
      }) : <li className="muted">Không tìm thấy sản phẩm</li>}
    </ul>}
  </div>;
}

export default function NewsletterAdmin() {
  const [status, setStatus] = useState("active"), [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const [subscribers, setSubscribers] = useState({ items: [], stats: null, pagination: null });
  const [campaigns, setCampaigns] = useState([]);
  const [draft, setDraft] = useState(emptyDraft), [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);

  const loadSubscribers = useCallback(async () => {
    try { const { data } = await axiosClient.get("/newsletter/admin", { params: { status, search, page }, sessionProtected: true }); setSubscribers(data.data); }
    catch (requestError) { setError(errorOf(requestError, "Không thể tải danh sách đăng ký")); }
  }, [status, search, page]);
  const loadCampaigns = useCallback(async () => {
    try { const { data } = await axiosClient.get("/newsletter/admin/campaigns", { sessionProtected: true }); setCampaigns(data.data.items); }
    catch (requestError) { setError(errorOf(requestError, "Không thể tải lịch sử gửi")); }
  }, []);
  useEffect(() => { setLoading(true); Promise.all([loadSubscribers(), loadCampaigns()]).finally(() => setLoading(false)); }, [loadSubscribers, loadCampaigns]);
  // Khi có lần gửi đang chạy, tải lại lịch sử mỗi 3 giây để thấy tiến độ
  const sending = campaigns.some((item) => item.status === "sending");
  useEffect(() => {
    if (!sending) return undefined;
    const id = setInterval(loadCampaigns, 3000);
    return () => clearInterval(id);
  }, [sending, loadCampaigns]);

  const payload = () => ({ subject: draft.subject.trim(), content: draft.content.trim(), productIds: products.map((item) => item._id) });
  const validate = () => {
    if (draft.subject.trim().length < 3) return "Tiêu đề cần ít nhất 3 ký tự";
    if (draft.content.trim().length < 10) return "Nội dung cần ít nhất 10 ký tự";
    return "";
  };
  const sendTest = async () => {
    const problem = validate(); if (problem) { setError(problem); return; }
    setBusy("test"); setError(""); setNotice("");
    try { const { data } = await axiosClient.post("/newsletter/admin/campaigns/test", payload(), { sessionProtected: true }); setNotice(data.message); }
    catch (requestError) { setError(errorOf(requestError, "Gửi thử thất bại")); }
    finally { setBusy(""); }
  };
  const openConfirm = () => { const problem = validate(); if (problem) { setError(problem); return; } setError(""); setConfirming(true); };
  const sendAll = async () => {
    setBusy("send"); setError(""); setNotice("");
    try {
      const { data } = await axiosClient.post("/newsletter/admin/campaigns", payload(), { sessionProtected: true });
      setNotice(data.message); setDraft(emptyDraft); setProducts([]); setConfirming(false); await loadCampaigns();
    } catch (requestError) { setError(errorOf(requestError, "Không thể gửi bản tin")); }
    finally { setBusy(""); }
  };

  const stats = subscribers.stats;
  const activeCount = stats?.active ?? 0;
  return <div className="newsletter-admin">
    <div className="stat-grid newsletter-stats">
      <article><div><small>Đang nhận bản tin</small><strong>{stats ? activeCount : "—"}</strong></div></article>
      <article><div><small>Đã hủy nhận</small><strong>{stats ? stats.unsubscribed : "—"}</strong></div></article>
      <article><div><small>Số lần đã gửi</small><strong>{campaigns.length}</strong></div></article>
      <article><div><small>Gửi email</small><strong className={stats?.mailConfigured ? "ok" : "warn"}>{stats ? (stats.mailConfigured ? "Đã cấu hình" : "Chưa cấu hình") : "—"}</strong></div></article>
    </div>
    {stats && !stats.mailConfigured && <div className="admin-state newsletter-warn">Máy chủ chưa có RESEND_API_KEY nên email chưa tới hộp thư thật, nội dung từng email sẽ in ra cửa sổ máy chủ. Lịch sử gửi vẫn được lưu và đánh dấu "Chỉ xem trước"</div>}

    <section className="admin-table-card newsletter-compose">
      <div className="table-title"><div><h3>Soạn bản tin</h3><p>Gửi tới {activeCount} người đang nhận, cuối mỗi email luôn có link hủy nhận bản tin</p></div></div>
      <label className="newsletter-label" htmlFor="nl-subject">Tiêu đề email</label>
      <input id="nl-subject" maxLength={150} value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} placeholder="Ví dụ: Ưu đãi serum cho da dầu mụn tháng 11" />
      <label className="newsletter-label" htmlFor="nl-content">Nội dung <small>xuống dòng hai lần để tách đoạn</small></label>
      <textarea id="nl-content" rows={7} maxLength={5000} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Viết lời nhắn gửi khách hàng" />
      <small className="newsletter-count">{draft.content.length}/5000 ký tự</small>
      <ProductPicker selected={products} onChange={setProducts} />
      {error && <div className="admin-state error" role="alert">{error}</div>}
      {notice && <div className="admin-state newsletter-ok" role="status">{notice}</div>}
      <div className="newsletter-actions">
        <button type="button" className="btn btn-light btn-small" disabled={!!busy} onClick={sendTest}><Mail size={16} />{busy === "test" ? "Đang gửi thử..." : "Gửi thử cho tôi"}</button>
        <button type="button" className="btn btn-dark btn-small" disabled={!!busy || sending || !activeCount} onClick={openConfirm}><Send size={16} />{sending ? "Đang có bản tin được gửi" : `Gửi cho ${activeCount} người`}</button>
      </div>
    </section>

    <section className="admin-table-card">
      <div className="table-title"><div><h3>Lịch sử gửi</h3><p>50 lần gửi gần nhất</p></div></div>
      {loading ? <div className="admin-state">Đang tải...</div> : campaigns.length ? <table><thead><tr><th>Thời gian</th><th>Tiêu đề</th><th>Sản phẩm</th><th>Kết quả</th><th>Trạng thái</th><th>Người gửi</th></tr></thead><tbody>
        {campaigns.map((item) => <tr key={item._id}>
          <td>{formatDateTime(item.createdAt)}</td>
          <td><strong>{item.subject}</strong><small className="newsletter-snippet">{item.content.slice(0, 90)}{item.content.length > 90 ? "…" : ""}</small></td>
          <td>{item.products?.length ? item.products.map((product) => <small key={product.product} className="newsletter-snippet">{product.name}</small>) : "Không có"}</td>
          <td>{item.sentCount}/{item.recipientCount} đã gửi{item.failedCount ? <small className="newsletter-snippet error-text" title={item.lastError || ""}>{item.failedCount} lỗi{item.lastError ? `: ${item.lastError}` : ""}</small> : null}</td>
          <td><span className={`newsletter-badge ${item.status}`}>{statusLabel[item.status] || item.status}</span>{item.previewOnly && <small className="newsletter-snippet">Chỉ xem trước</small>}</td>
          <td>{item.sentBy?.fullName || "—"}</td>
        </tr>)}
      </tbody></table> : <div className="empty">Chưa gửi bản tin nào</div>}
    </section>

    <section className="admin-table-card">
      <div className="table-title"><div><h3>Người đăng ký</h3><p>Email khách nhập ở chân trang website</p></div></div>
      <div className="newsletter-filters">
        <div className="newsletter-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={status === "active"} className={status === "active" ? "active" : ""} onClick={() => { setStatus("active"); setPage(1); }}>Đang nhận ({stats?.active ?? 0})</button>
          <button type="button" role="tab" aria-selected={status === "unsubscribed"} className={status === "unsubscribed" ? "active" : ""} onClick={() => { setStatus("unsubscribed"); setPage(1); }}>Đã hủy ({stats?.unsubscribed ?? 0})</button>
        </div>
        <div className="newsletter-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm email" aria-label="Tìm email người đăng ký" /></div>
      </div>
      {subscribers.items.length ? <table><thead><tr><th>Email</th><th>Ngày đăng ký</th><th>Email chào mừng</th>{status === "unsubscribed" && <th>Ngày hủy</th>}</tr></thead><tbody>
        {subscribers.items.map((item) => <tr key={item._id}><td>{item.email}</td><td>{formatDateTime(item.createdAt)}</td><td>{item.welcomeSentAt ? formatDateTime(item.welcomeSentAt) : "Chưa gửi"}</td>{status === "unsubscribed" && <td>{formatDateTime(item.unsubscribedAt)}</td>}</tr>)}
      </tbody></table> : <div className="empty">{loading ? "Đang tải..." : "Không có email nào"}</div>}
      <AdminPager pagination={subscribers.pagination} onPage={setPage} />
    </section>

    {confirming && <ConfirmActionModal title={`Gửi bản tin cho ${activeCount} người?`} description={`"${draft.subject.trim()}"${products.length ? ` kèm ${products.length} sản phẩm` : ""}, sau khi gửi không thể thu hồi email`} confirmLabel="Gửi ngay" busy={busy === "send"} error={error} onConfirm={sendAll} onClose={() => setConfirming(false)} />}
  </div>;
}
