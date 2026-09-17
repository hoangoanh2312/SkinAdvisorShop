import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { productData } from "../../data/mockData";
import fallbackImage from "../../assets/hero.png";

export default function EditorialHero() {
  const product = productData[3];
  const fallback = (e) => {
    if (e.currentTarget.src !== fallbackImage)
      e.currentTarget.src = fallbackImage;
  };
  return (
    <section className="responsive-hero">
      <div className="hero-ghost" aria-hidden="true">
        SKINORA
      </div>
      <div className="hero-content">
        <div className="hero-message">
          <span className="ai-pill">
            <Sparkles /> CHĂM SÓC DA CÙNG AI
          </span>
          <h1>
            Hiểu làn da.
            <br />
            <em>
              Chọn đúng <span className="keep-together">điều da cần.</span>
            </em>
          </h1>
          <p>
            Mỹ phẩm được tuyển chọn theo nhu cầu làn da, kết hợp cùng Skin
            Advisor AI để giúp bạn xây dựng chu trình chăm sóc phù hợp.
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-burgundy" to="/products">
              Khám phá sản phẩm <ArrowRight />
            </Link>
            <Link className="editorial-link" to="/skin-advisor">
              <Sparkles /> Phân tích da với AI <ArrowRight />
            </Link>
          </div>
          <div className="hero-trust">
            <div>
              <strong>10K+</strong>
              <span>Khách hàng</span>
            </div>
            <div>
              <strong>4.9/5</strong>
              <span>Đánh giá</span>
            </div>
            <div>
              <strong>AI</strong>
              <span>Cá nhân hóa</span>
            </div>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-art-frame">
            <img
              src="https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=1400&q=90"
              onError={fallback}
              alt="Mỹ phẩm chăm sóc da SKINORA"
            />
          </div>
          <div className="hero-product-cut">
            <img
              src={product.images[0]}
              onError={fallback}
              alt={product.name}
            />
          </div>
          <div className="hero-ai-card">
            <div className="hero-ai-title">
              <Sparkles /> SKIN ADVISOR
            </div>
            <span>Hồ sơ làn da</span>
            <strong>Da dầu · Nhạy cảm</strong>
            <div className="match">
              <b>PHÙ HỢP 94%</b>
              <i />
            </div>
            <p>Barrier Repair Cream</p>
            <Link to="/skin-advisor">
              Xem chu trình <ArrowRight />
            </Link>
          </div>
          <span className="hero-art-caption">
            CÔNG THỨC KHOA HỌC · CHĂM SÓC CÁ NHÂN
          </span>
        </div>
      </div>
    </section>
  );
}
