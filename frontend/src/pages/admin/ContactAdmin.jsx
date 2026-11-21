import { useCallback, useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import axiosClient from "../../api/axiosClient";
import AdminPager from "../../components/admin/AdminPager";

const formatDateTime = (value) => value ? new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const TABS = [["new", "Chưa xử lý"], ["handled", "Đã xử lý"], ["all", "Tất cả"]];

// Tin nhắn khách gửi từ trang Liên hệ
export default function ContactAdmin() {
  const [status, setStatus] = useState("new"), [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], newCount: 0, topics: {}, pagination: null });
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [busyId, setBusyId] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data: res } = await axiosClient.get("/contact/admin", { params: { status, page }, sessionProtected: true }); setData(res.data); setError(""); }
    catch (requestError) { setError(requestError.response?.data?.message || "Không thể tải tin nhắn"); }
    finally { setLoading(false); }
  }, [status, page]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (item) => {
    setBusyId(item._id);
    try { await axiosClient.patch(`/contact/admin/${item._id}`, { status: item.status === "new" ? "handled" : "new" }, { sessionProtected: true }); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Không thể cập nhật tin nhắn"); }
    finally { setBusyId(""); }
  };
  return <section className="admin-table-card contact-admin">
    <div className="table-title"><div><h3>Tin nhắn liên hệ</h3><p>{data.newCount} tin nhắn chưa xử lý, trả lời khách bằng nút Trả lời qua email</p></div></div>
    <div className="newsletter-tabs" role="tablist">{TABS.map(([value, label]) => <button type="button" role="tab" key={value} aria-selected={status === value} className={status === value ? "active" : ""} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}</div>
    {error && <div className="admin-state error" role="alert">{error} <button onClick={load}>Thử lại</button></div>}
    {loading ? <div className="admin-state">Đang tải...</div> : data.items.length ? <ul className="contact-admin-list">{data.items.map((item) => <li key={item._id} className={item.status}>
      <div className="contact-admin-head">
        <div><strong>{item.name}</strong><span className="newsletter-badge">{data.topics[item.topic] || item.topic}</span>{item.status === "new" && <span className="newsletter-badge sending">Mới</span>}</div>
        <time>{formatDateTime(item.createdAt)}</time>
      </div>
      <p className="contact-admin-message">{item.message}</p>
      <div className="contact-admin-foot">
        <a href={`mailto:${item.email}?subject=${encodeURIComponent("Phản hồi từ sandwich beauty")}`}><Mail size={15} /> {item.email}</a>
        {item.phone && <a href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}><Phone size={15} /> {item.phone}</a>}
        <button type="button" className="admin-row-button" disabled={busyId === item._id} onClick={() => toggle(item)}>{item.status === "new" ? "Đánh dấu đã xử lý" : "Chuyển về chưa xử lý"}</button>
      </div>
    </li>)}</ul> : <div className="empty">Không có tin nhắn nào</div>}
    <AdminPager pagination={data.pagination} onPage={setPage} />
  </section>;
}
