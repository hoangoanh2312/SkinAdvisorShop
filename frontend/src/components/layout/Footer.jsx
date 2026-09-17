import { Camera, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
export default function Footer() {
  return (
    <footer className="footer">
      <div className="container newsletter">
        <div>
          <span className="eyebrow light">BẢN TIN SKINORA</span>
          <h2>Hiểu da để chăm sóc đúng hơn.</h2>
          <p>
            Nhận kiến thức chăm da, hoạt chất mới và ưu đãi được chọn riêng.
          </p>
        </div>
        <form>
          <input type="email" placeholder="Email của bạn" aria-label="Email" />
          <button>
            ĐĂNG KÝ <span>→</span>
          </button>
        </form>
      </div>
      <div className="container footer-grid">
        <div>
          <Link to="/" className="logo logo-light">
            SKINORA<span>.</span>
          </Link>
          <p>
            Chăm sóc da bắt đầu từ lựa chọn phù hợp với nhu cầu của bạn.
          </p>
          <div className="social">
            <Camera />
            <span>@skinora.vn</span>
          </div>
        </div>
        <div>
          <h4>MUA SẮM</h4>
          <Link to="/products">Tất cả sản phẩm</Link>
          <Link to="/products">Sản phẩm bán chạy</Link>
          <Link to="/products">Thành phần</Link>
        </div>
        <div>
          <h4>KHÁM PHÁ</h4>
          <Link to="/skin-advisor">Skin Advisor AI</Link>
          <a href="#">Câu chuyện SKINORA</a>
          <a href="#">Cam kết của chúng tôi</a>
        </div>
        <div>
          <h4>HỖ TRỢ</h4>
          <a href="#">Giao hàng và đổi trả</a>
          <a href="#">Câu hỏi thường gặp</a>
          <p>
            <Mail size={15} /> hello@skinora.vn
          </p>
        </div>
        <div>
          <h4>THEO DÕI</h4>
          <a href="#">Instagram</a>
          <a href="#">TikTok</a>
          <p>
            <Phone size={15} /> 1900 6868
          </p>
          <p>
            <MapPin size={15} /> TP. Hồ Chí Minh
          </p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 SKINORA. Bảo lưu mọi quyền.</span>
        <span>Quyền riêng tư · Điều khoản · Khả năng truy cập</span>
      </div>
    </footer>
  );
}
