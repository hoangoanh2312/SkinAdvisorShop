import { useState } from "react";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import axiosClient, { apiErrorMessage } from "../../api/axiosClient";
import { STORE_INFO, mapHref, phoneHref, socialLinks, zaloHref } from "../../config/storeInfo";

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ busy: false, ok: "", error: "" });
  const submit = async (event) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setState({ busy: false, ok: "", error: "Vui lòng nhập email hợp lệ" });
    setState({ busy: true, ok: "", error: "" });
    try {
      const { data } = await axiosClient.post("/newsletter/subscribe", { email: email.trim() });
      setState({ busy: false, ok: data.message, error: "" });
      setEmail("");
    } catch (error) {
      setState({ busy: false, ok: "", error: apiErrorMessage(error, "Chưa đăng ký được, vui lòng thử lại sau") });
    }
  };
  return (
    <div className="footer-newsletter-form">
      <form onSubmit={submit} noValidate>
        <input type="email" placeholder="Email của bạn" aria-label="Email nhận bản tin" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
        <button type="submit" disabled={state.busy}>{state.busy ? "ĐANG GỬI" : "ĐĂNG KÝ"} <span aria-hidden="true">→</span></button>
      </form>
      <p className="footer-newsletter-status" role="status" aria-live="polite">{state.ok || state.error}</p>
    </div>
  );
}

export default function Footer() {
  const { hotline, email, address, workingHours } = STORE_INFO;
  const socials = socialLinks();
  return (
    <footer className="footer">
      <div className="container newsletter">
        <div>
          <span className="eyebrow light">BẢN TIN sandwich beauty</span>
          <h2>Hiểu da để chăm sóc đúng hơn</h2>
          <p>Nhận kiến thức chăm da, hoạt chất mới và ưu đãi được chọn riêng</p>
        </div>
        <NewsletterForm />
      </div>
      <div className="container footer-grid">
        <div>
          <Link to="/" className="logo logo-light sandwich-footer-logo" aria-label="sandwich beauty, về trang chủ"><BrandLogo light /></Link>
          <p>Chăm sóc da bắt đầu từ lựa chọn phù hợp với nhu cầu của bạn</p>
          {socials.length > 0 && <div className="social">{socials.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" aria-label={`sandwich beauty trên ${label}`}>{label}</a>)}</div>}
        </div>
        <div>
          <h4>MUA SẮM</h4>
          <Link to="/products">Tất cả sản phẩm</Link>
          <Link to="/products?sort=popular">Sản phẩm bán chạy</Link>
          <Link to="/#thanh-phan">Thành phần</Link>
          <Link to="/wishlist">Sản phẩm yêu thích</Link>
        </div>
        <div>
          <h4>KHÁM PHÁ</h4>
          <Link to="/skin-analysis">Phân tích da</Link>
          <Link to="/skin-advisor">Trợ lý da AI</Link>
          <Link to="/cau-chuyen">Câu chuyện sandwich beauty</Link>
          <Link to="/cam-ket">Cam kết của chúng tôi</Link>
        </div>
        <div>
          <h4>HỖ TRỢ</h4>
          <Link to="/giao-hang-doi-tra">Giao hàng và đổi trả</Link>
          <Link to="/cau-hoi-thuong-gap">Câu hỏi thường gặp</Link>
          <Link to="/orders">Đơn hàng của tôi</Link>
        </div>
        <div className="footer-contact">
          <h4>LIÊN HỆ</h4>
          {hotline && <p><Phone size={15} /> <a href={phoneHref(hotline)}>{hotline}</a></p>}
          {STORE_INFO.zalo && <p><MessageCircle size={15} /> <a href={zaloHref(STORE_INFO.zalo)} target="_blank" rel="noreferrer">{STORE_INFO.zalo === hotline ? "Nhắn Zalo" : `Zalo ${STORE_INFO.zalo}`}</a></p>}
          {email && <p><Mail size={15} /> <a href={`mailto:${email}`}>{email.split("@")[0]}@<wbr />{email.split("@")[1]}</a></p>}
          {address && <p><MapPin size={15} /> {mapHref() ? <a href={mapHref()} target="_blank" rel="noreferrer">{address}</a> : address}</p>}
          {workingHours && <p><Clock size={15} /> {workingHours}</p>}
          <Link to="/lien-he" className="footer-contact-cta">Gửi tin nhắn cho chúng tôi</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 sandwich beauty, bảo lưu mọi quyền</span>
      </div>
    </footer>
  );
}
