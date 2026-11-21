import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import axiosClient from "../api/axiosClient";
import { STORE_INFO, mapHref, phoneHref, socialLinks, zaloHref } from "../config/storeInfo";

const TOPICS = [["order", "Đơn hàng"], ["product", "Sản phẩm"], ["skin", "Tư vấn da"], ["partnership", "Hợp tác"], ["other", "Khác"]];
const empty = { name: "", email: "", phone: "", topic: "order", message: "" };

function ContactForm() {
  const [form, setForm] = useState(empty);
  const [state, setState] = useState({ busy: false, ok: "", error: "" });
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    if (state.busy) return;
    setState({ busy: true, ok: "", error: "" });
    try {
      const { data } = await axiosClient.post("/contact", form);
      setForm(empty);
      setState({ busy: false, ok: data.message, error: "" });
    } catch (error) {
      setState({ busy: false, ok: "", error: error.response?.data?.message || "Chưa gửi được tin nhắn, vui lòng thử lại sau" });
    }
  };
  return (
    <form className="contact-form" onSubmit={submit}>
      <h2>Gửi tin nhắn cho chúng tôi</h2>
      <p>Chúng tôi trả lời qua email trong giờ làm việc</p>
      <div className="contact-form-row">
        <label>Họ tên<input name="name" required minLength={2} maxLength={80} value={form.name} onChange={change} autoComplete="name" /></label>
        <label>Email<input name="email" type="email" required maxLength={254} value={form.email} onChange={change} autoComplete="email" /></label>
      </div>
      <div className="contact-form-row">
        <label>Số điện thoại<input name="phone" type="tel" maxLength={20} value={form.phone} onChange={change} autoComplete="tel" placeholder="Không bắt buộc" /></label>
        <label>Chủ đề<select name="topic" value={form.topic} onChange={change}>{TOPICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <label>Nội dung<textarea name="message" required minLength={10} maxLength={3000} rows={6} value={form.message} onChange={change} placeholder="Ví dụ: mã đơn hàng, sản phẩm bạn quan tâm hoặc tình trạng da của bạn" /></label>
      {state.error && <p className="contact-status error" role="alert">{state.error}</p>}
      {state.ok && <p className="contact-status ok" role="status">{state.ok}</p>}
      <button className="btn btn-dark" disabled={state.busy}><Send size={16} /> {state.busy ? "Đang gửi..." : "Gửi tin nhắn"}</button>
    </form>
  );
}

export default function ContactPage() {
  const { hotline, email, address, workingHours, zalo } = STORE_INFO;
  const map = mapHref();
  const socials = socialLinks().filter(([label]) => label !== "Zalo");
  const cards = [
    hotline && { icon: Phone, title: "Hotline", value: hotline, href: phoneHref(hotline), action: "Gọi ngay" },
    zalo && { icon: MessageCircle, title: "Zalo", value: zalo, href: zaloHref(zalo), action: "Nhắn Zalo", external: true },
    email && { icon: Mail, title: "Email", value: email, href: `mailto:${email}`, action: "Gửi email" },
    address && { icon: MapPin, title: "Cửa hàng", value: address, href: map, action: "Xem bản đồ", external: true },
  ].filter(Boolean);
  return (
    <main className="container info-page contact-page">
      <nav className="info-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span>Liên hệ</span></nav>
      <header className="info-head"><span className="eyebrow">LIÊN HỆ</span><h1>Chúng tôi luôn sẵn lòng lắng nghe</h1><p>Hỏi về đơn hàng, sản phẩm hay cách chăm sóc làn da của bạn</p></header>
      {cards.length > 0 && <div className="contact-cards">{cards.map(({ icon: Icon, title, value, href, action, external }) => (
        <a key={title} className="contact-card" href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
          <Icon size={20} /><span>{title}</span><strong>{value}</strong><em>{action}</em>
        </a>
      ))}</div>}
      <div className="contact-layout">
        <ContactForm />
        <aside className="contact-side">
          {workingHours && <p><Clock size={16} /> <span><b>Giờ hỗ trợ</b>{workingHours}</span></p>}
          <p><span><b>Đơn hàng</b>Xem trạng thái và hủy đơn tại <Link to="/orders">Đơn hàng của tôi</Link></span></p>
          <p><span><b>Câu hỏi nhanh</b>Nhiều thắc mắc đã có lời đáp ở <Link to="/cau-hoi-thuong-gap">Câu hỏi thường gặp</Link></span></p>
          {socials.length > 0 && <div><b>Theo dõi chúng tôi</b><div className="contact-socials">{socials.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}</a>)}</div></div>}
        </aside>
      </div>
    </main>
  );
}
