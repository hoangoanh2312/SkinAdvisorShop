import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "../../assets/hero.png";

export default function EditorialHero() {
  return (
    <section className="responsive-hero" data-reveal>
      <div className="hero-ghost" aria-hidden="true">sandwich beauty</div>
      <div className="hero-content">
        <div className="hero-message">
          <span className="ai-pill"><Sparkles /> CHĂM SÓC DA CÙNG AI</span>
          <h1>Hiểu làn da<br /><em>Chọn đúng <span className="keep-together">điều da cần</span></em></h1>
          <p>Khám phá mỹ phẩm theo nhu cầu làn da và tham khảo gợi ý từ Trợ lý da AI để xây dựng chu trình chăm sóc phù hợp</p>
          <div className="hero-ctas">
            <Link className="btn btn-burgundy" to="/products">Khám phá sản phẩm <ArrowRight /></Link>
            <Link className="editorial-link" to="/skin-advisor"><Sparkles /> Tư vấn chăm sóc da <ArrowRight /></Link>
          </div>
          <div className="hero-trust">
            <div><strong>Danh mục</strong><span>Sản phẩm thực tế</span></div>
            <div><strong>Thành phần</strong><span>Thông tin minh bạch</span></div>
            <div><strong>AI</strong><span>Gợi ý tham khảo</span></div>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-art-frame"><img src={heroImage} alt="Hình minh họa phong cách chăm sóc da sandwich beauty" /></div>
          <div className="hero-ai-card">
            <div className="hero-ai-title"><Sparkles /> TRỢ LÝ DA AI</div>
            <span>Tư vấn theo nhu cầu</span>
            <strong>Chia sẻ thông tin về làn da</strong>
            <p>Gợi ý chỉ mang tính tham khảo và phụ thuộc vào dữ liệu bạn cung cấp</p>
            <Link to="/skin-advisor">Bắt đầu tư vấn <ArrowRight /></Link>
          </div>
          <span className="hero-art-caption">CHĂM SÓC DA VỚI THÔNG TIN MINH BẠCH</span>
        </div>
      </div>
    </section>
  );
}
