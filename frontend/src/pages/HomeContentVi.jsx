import { ArrowRight, Bot, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import ProductCarousel from "../components/product/ProductCarousel";
import IngredientExplorer from "../components/product/IngredientExplorer";
import SectionTitle from "../components/common/SectionTitle";
import { formatCurrency } from "../utils/formatters";
const concerns = [
  [
    "DA MỤN",
    "Lựa chọn phù hợp cho làn da dễ nổi mụn",
    "photo-1556228720-195a672e8a03",
    "wide",
  ],
  [
    "DA DẦU",
    "Kiểm soát dầu thừa và hỗ trợ thông thoáng lỗ chân lông",
    "photo-1611930022073-b7a4ba5fcccd",
    "tall",
  ],
  ["DA KHÔ", "Bổ sung độ ẩm và duy trì làn da mềm mại", "photo-1598440947619-2c35fc9aa908", ""],
  ["DA NHẠY CẢM", "Ưu tiên công thức dịu nhẹ, hạn chế kích ứng", "photo-1601049541289-9b1b7bbbfe19", ""],
  ["THÂM SẠM", "Hỗ trợ làm sáng và cải thiện da không đều màu", "photo-1571781926291-c477ebfd024b", "wide"],
  ["LÃO HÓA", "Chăm sóc nếp nhăn và độ đàn hồi của da", "photo-1612817288484-6f916006741a", ""],
];
export default function HomeContentVi({ products = [], brands = [], loading, error, productSource = "featured", onRetry }) {
  // Spotlight a product that has a photo; a half-screen "Chưa có ảnh" panel reads as empty space.
  const featured = products.find((item) => item.images?.[0]);
  return (
    <div className="new-home">
      <section className="manifesto" data-reveal>
        <div className="container manifesto-grid">
          <span className="eyebrow">TRIẾT LÝ sandwich beauty</span>
          <p>
            Không phải nhiều hơn
            <br />
            Mà là <em>đúng hơn</em> cho <span className="keep-together">làn da</span>
          </p>
          <div>
            <p>
              Chúng tôi kết hợp hoạt chất được nghiên cứu, sản phẩm chọn lọc và
              công nghệ AI để giúp bạn lựa chọn chu trình chăm sóc phù hợp và dễ
              áp dụng
            </p>
            <div>
              <span>
                <ShieldCheck /> Chính hãng
              </span>
              <span>
                <Check /> Thành phần minh bạch
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="editorial-products container" data-reveal>
        <SectionTitle
          eyebrow={productSource === "featured" ? "SẢN PHẨM NỔI BẬT" : "GỢI Ý TỪ GIAN HÀNG"}
          title={productSource === "featured"
            ? <><span className="keep-together">Sản phẩm</span> nổi bật</>
            : <><span className="keep-together">Khám phá</span> sản phẩm</>}
          description="Khám phá những sản phẩm mỹ phẩm đã được đưa lên gian hàng sandwich beauty"
          action={
            <Link className="editorial-link" to="/products">
              Xem toàn bộ <ArrowRight />
            </Link>
          }
        />
        <div>
          {!!products.length && <ProductCarousel products={products} />}
          {loading && <div className="home-featured-feedback" role="status">Đang tải sản phẩm từ gian hàng…</div>}
          {!loading && !products.length && (
            <div className="home-featured-feedback" role="status">
              <p>{error || "Chưa có sản phẩm được công khai trên gian hàng"}</p>
              {error && <button type="button" onClick={onRetry}>Thử tải lại</button>}
              <Link to="/products">Xem tất cả sản phẩm</Link>
            </div>
          )}
        </div>
      </section>
      <section id="skin-concerns" className="concern-editorial" data-reveal>
        <div className="container">
          <div className="split-heading">
            <span className="eyebrow">CHỌN THEO VẤN ĐỀ DA</span>
            <h2>
              Làn da của bạn
              <br />
              <em className="keep-together">đang cần gì?</em>
            </h2>
            <p>
              Chọn vấn đề bạn đang quan tâm để tìm sản phẩm phù hợp dễ dàng hơn
            </p>
          </div>
          <div className="concern-bento">
            {concerns.map(([name, text, id, size]) => (
              <Link
                to={`/products?skinConcern=${encodeURIComponent(({"DA MỤN":"acne","DA DẦU":"oiliness","DA KHÔ":"dryness","DA NHẠY CẢM":"sensitivity","THÂM SẠM":"pigmentation","LÃO HÓA":"aging"})[name])}`}
                className={`concern-tile ${size}`}
                key={name}
              >
                <img
                  src={`https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=85`}
                  alt=""
                />
                <div>
                  <span>{text}</span>
                  <h3>{name}</h3>
                  <b>
                    Khám phá <ArrowRight />
                  </b>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="ai-signature" data-reveal>
        <div className="container ai-signature-grid">
          <div className="ai-editorial-copy">
            <span className="eyebrow light">
              <Sparkles /> SKIN ADVISOR AI
            </span>
            <h2>
              Tìm sản phẩm phù hợp
              <br />
              <em>với <span className="keep-together">làn da của bạn</span></em>
            </h2>
            <p>
              Chia sẻ loại da, vấn đề bạn đang gặp và nhu cầu chăm sóc. Trợ lý
              da AI sẽ phân tích thông tin và gợi ý sản phẩm phù hợp để bạn
              tham khảo.
            </p>
            <div className="ai-chip-row">
              <span>Da dầu</span>
              <span>Mụn</span>
              <span>Niacinamide</span>
            </div>
            <Link className="btn btn-ivory" to="/skin-advisor">
              Bắt đầu tư vấn <ArrowRight />
            </Link>
          </div>
          <div className="ai-chat-mock">
            <div className="mock-top">
              <span>
                <Bot /> SKIN ADVISOR AI
              </span>
              <i>VÍ DỤ MINH HỌA</i>
            </div>
            <div className="mock-body">
              <div className="mock-msg user">
                Da mình dầu và thường nổi mụn ở vùng chữ T
              </div>
              <div className="mock-msg ai">
                <span>
                  <Sparkles />
                </span>
                <p>
                  Dựa trên tình trạng bạn mô tả, mình khuyên ưu tiên{" "}
                  <strong>Niacinamide và BHA</strong> ở nồng độ phù hợp...
                </p>
              </div>
              <Link className="recommended-label" to="/skin-advisor">Trải nghiệm tư vấn với thông tin của bạn →</Link>
            </div>
            <div className="mock-input">
              Hỏi Trợ lý da AI...{" "}
              <span>
                <ArrowRight />
              </span>
            </div>
          </div>
        </div>
      </section>
      <IngredientExplorer />
      {featured && <section className="featured-editorial" data-reveal>
        <div className="featured-image">
          <img src={featured.images[0]} alt={featured.name} />
          <span>{featured.brand}</span>
        </div>
        <div className="featured-copy">
          <span className="eyebrow">GIỚI THIỆU SẢN PHẨM</span>
          <h2>{featured.name}</h2>
          {featured.reviewCount > 0 && <div className="featured-rating">{featured.rating}/5 ({featured.reviewCount} đánh giá)</div>}
          {featured.description && <p>{featured.description}</p>}
          {!!featured.ingredients?.length && <div className="ingredient-chips">
            {featured.ingredients.slice(0, 3).map(item => <span key={item.normalizedName || item.name}>{item.name}</span>)}
          </div>}
          <div className="featured-buy">
            <strong>{Number(featured.salePrice) > 0 ? formatCurrency(featured.salePrice) : "Đang cập nhật giá"}</strong>
            {Number(featured.salePrice) > 0 && featured.price > featured.salePrice && <del>{formatCurrency(featured.price)}</del>}
          </div>
          <Link className="btn btn-burgundy" to={`/products/${featured.slug || featured.id}`}>
            Khám phá sản phẩm <ArrowRight />
          </Link>
        </div>
      </section>}
      <section className="routine-section container" data-reveal>
        <div className="split-heading">
          <span className="eyebrow">QUY TRÌNH TƯ VẤN</span>
          <h2>
            Tìm chu trình phù hợp
            <br />
            <em>chỉ với <span className="keep-together">vài bước</span></em>
          </h2>
          <p>
            Chia sẻ nhu cầu để nhận gợi ý sản phẩm và các bước chăm sóc phù hợp
          </p>
        </div>
        <div className="routine-steps">
          {[
            [
              "01",
              "Chia sẻ về làn da",
              "Mô tả loại da, vấn đề và nhu cầu chăm sóc của bạn",
            ],
            [
              "02",
              "AI phân tích nhu cầu",
              "Trợ lý da AI phân tích thông tin bạn cung cấp",
            ],
            [
              "03",
              "Nhận gợi ý phù hợp",
              "Tham khảo sản phẩm, thành phần và các bước chăm sóc phù hợp",
            ],
          ].map(([n, t, d], i) => (
            <article key={n}>
              <span>{n}</span>
              <i>{i < 2 ? "→" : "✓"}</i>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      {brands.length > 0 && <section className="brand-marquee" data-reveal>
        <span>KHÁM PHÁ THƯƠNG HIỆU</span>
        {brands.map(brand => <Link key={brand._id || brand.slug} to={`/products?brand=${encodeURIComponent(brand.name)}`}>{brand.name}</Link>)}
      </section>}
    </div>
  );
}
