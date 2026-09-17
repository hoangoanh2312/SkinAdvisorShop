import { ArrowRight, Bot, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import ProductCard from "../components/product/ProductCard";
import SectionTitle from "../components/common/SectionTitle";
import { brands, formatPrice, productData } from "../data/mockData";
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
const ingredients = [
  [
    "NIACINAMIDE",
    "Kiểm soát dầu · Hỗ trợ làm sáng · Củng cố hàng rào da",
    "Phù hợp: Da dầu, da mụn, da xỉn màu",
    "N°01",
  ],
  [
    "BHA",
    "Làm sạch lỗ chân lông · Hỗ trợ giảm bít tắc",
    "Phù hợp: Da dầu, da dễ nổi mụn",
    "N°02",
  ],
  [
    "RETINOL",
    "Hỗ trợ cải thiện nếp nhăn · Chăm sóc dấu hiệu lão hóa",
    "Phù hợp: Da có dấu hiệu lão hóa",
    "N°03",
  ],
  [
    "VITAMIN C",
    "Chống oxy hóa · Hỗ trợ làm sáng và đều màu da",
    "Phù hợp: Da xỉn màu, không đều màu",
    "N°04",
  ],
  [
    "HYALURONIC ACID",
    "Cấp ẩm · Hỗ trợ duy trì làn da mềm mại và căng mịn",
    "Phù hợp: Mọi loại da, đặc biệt là da khô",
    "N°05",
  ],
  [
    "CERAMIDE",
    "Hỗ trợ phục hồi hàng rào bảo vệ da · Duy trì độ ẩm",
    "Phù hợp: Da khô, da nhạy cảm",
    "N°06",
  ],
];
const reviews = [
  [
    "“Sau khoảng 3 tuần, da mình ít bóng dầu hơn. Chu trình AI gợi ý dễ hiểu và không có quá nhiều bước.”",
    "Minh Anh",
    "Da dầu · Dễ nổi mụn",
    "MA",
  ],
  [
    "“Mình thích cách SKINORA giải thích từng thành phần. Da nhạy cảm nên cảm giác mua hàng yên tâm hơn hẳn.”",
    "Thu Hà",
    "Da khô · Nhạy cảm",
    "TH",
  ],
  [
    "“Giao diện đẹp, sản phẩm chọn lọc tốt. Serum Niacinamide thấm nhanh và hợp với chu trình buổi sáng của mình.”",
    "Gia Hân",
    "Da hỗn hợp",
    "GH",
  ],
];
export default function HomeContentVi() {
  const suggested = productData[0],
    featured = productData[3];
  return (
    <div className="new-home">
      <section className="manifesto">
        <div className="container manifesto-grid">
          <span className="eyebrow">TRIẾT LÝ SKINORA</span>
          <p>
            Không phải nhiều hơn.
            <br />
            Mà là <em>đúng hơn</em> cho <span className="keep-together">làn da.</span>
          </p>
          <div>
            <p>
              Chúng tôi kết hợp hoạt chất được nghiên cứu, sản phẩm chọn lọc và
              công nghệ AI để giúp bạn lựa chọn chu trình chăm sóc phù hợp và dễ
              áp dụng.
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
      <section className="editorial-products container">
        <SectionTitle
          eyebrow="SẢN PHẨM NỔI BẬT"
          title={<><span className="keep-together">Sản phẩm</span> được yêu thích</>}
          description="Khám phá những sản phẩm chăm sóc da nổi bật được nhiều khách hàng lựa chọn."
          action={
            <Link className="editorial-link" to="/products">
              Xem toàn bộ <ArrowRight />
            </Link>
          }
        />
        <div className="product-grid luxury-grid">
          {productData
            .filter((p) => p.featured)
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
      <section id="skin-concerns" className="concern-editorial">
        <div className="container">
          <div className="split-heading">
            <span className="eyebrow">CHỌN THEO VẤN ĐỀ DA</span>
            <h2>
              Làn da của bạn
              <br />
              <em className="keep-together">đang cần gì?</em>
            </h2>
            <p>
              Chọn vấn đề bạn đang quan tâm để tìm sản phẩm phù hợp dễ dàng hơn.
            </p>
          </div>
          <div className="concern-bento">
            {concerns.map(([name, text, id, size]) => (
              <Link
                to={`/products?q=${encodeURIComponent(name)}`}
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
      <section className="ai-signature">
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
              Chia sẻ loại da, vấn đề bạn đang gặp và nhu cầu chăm sóc. Skin
              Advisor AI sẽ phân tích thông tin và gợi ý sản phẩm phù hợp để bạn
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
              <i>● ĐANG HOẠT ĐỘNG</i>
            </div>
            <div className="mock-body">
              <div className="mock-msg user">
                Da mình dầu và thường nổi mụn ở vùng chữ T.
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
              <span className="recommended-label">GỢI Ý DÀNH CHO BẠN</span>
              <div className="mock-product">
                <img src={suggested.images[0]} alt={suggested.name} />
                <div>
                  <small>{suggested.brand}</small>
                  <strong>{suggested.name}</strong>
                  <span>
                    <b>★★★★★</b> {suggested.rating}
                  </span>
                  <em>{formatPrice(suggested.salePrice)}</em>
                </div>
                <button aria-label="Thêm sản phẩm">+</button>
              </div>
            </div>
            <div className="mock-input">
              Hỏi Skin Advisor...{" "}
              <span>
                <ArrowRight />
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="ingredient-section">
        <div className="container ingredient-grid">
          <div className="ingredient-intro">
            <span className="eyebrow">KHÁM PHÁ THEO THÀNH PHẦN</span>
            <h2>
              Hiểu thành phần để
              <br />
              <em>chọn đúng <span className="keep-together">sản phẩm.</span></em>
            </h2>
            <p>
              Tìm hiểu công dụng và loại da phù hợp của các thành phần chăm sóc
              da phổ biến.
            </p>
            <div className="ingredient-orb">
              <span>KHOA HỌC</span>
              <i>×</i>
              <span>LÀN DA</span>
            </div>
          </div>
          <div className="ingredient-list">
            {ingredients.map(([name, use, skin, num]) => (
              <Link to={`/products?q=${encodeURIComponent(name)}`} key={name}>
                <small>{num}</small>
                <div>
                  <h3>{name}</h3>
                  <p>{use}</p>
                  <span>{skin}</span>
                </div>
                <ArrowRight />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="featured-editorial">
        <div className="featured-image">
          <img src={featured.images[0]} alt={featured.name} />
          <span>CHĂM SÓC HÀNG RÀO DA</span>
        </div>
        <div className="featured-copy">
          <span className="eyebrow">BÁN CHẠY · CÔNG THỨC KHOA HỌC</span>
          <h2>
            Barrier Repair
            <br />
            <em>Ceramide Cream</em>
          </h2>
          <div className="featured-rating">
            <span>★★★★★</span> 4.9 · 186 đánh giá
          </div>
          <p>
            Công thức chứa Ceramide hỗ trợ hàng rào bảo vệ da và duy trì độ ẩm.
            Kết cấu mềm mượt, phù hợp với nhu cầu chăm sóc da khô và nhạy cảm.
          </p>
          <div className="ingredient-chips">
            <span>Ceramide</span>
            <span>Panthenol</span>
            <span>Hyaluronic Acid</span>
          </div>
          <div className="featured-buy">
            <strong>{formatPrice(featured.salePrice)}</strong>
            <del>{formatPrice(featured.price)}</del>
          </div>
          <Link className="btn btn-burgundy" to={`/products/${featured.id}`}>
            Khám phá sản phẩm <ArrowRight />
          </Link>
        </div>
      </section>
      <section className="routine-section container">
        <div className="split-heading">
          <span className="eyebrow">QUY TRÌNH TƯ VẤN</span>
          <h2>
            Tìm chu trình phù hợp
            <br />
            <em>chỉ với <span className="keep-together">vài bước</span></em>
          </h2>
          <p>
            Chia sẻ nhu cầu để nhận gợi ý sản phẩm và các bước chăm sóc phù hợp.
          </p>
        </div>
        <div className="routine-steps">
          {[
            [
              "01",
              "Chia sẻ về làn da",
              "Mô tả loại da, vấn đề và nhu cầu chăm sóc của bạn.",
            ],
            [
              "02",
              "AI phân tích nhu cầu",
              "Skin Advisor AI phân tích thông tin bạn cung cấp.",
            ],
            [
              "03",
              "Nhận gợi ý phù hợp",
              "Tham khảo sản phẩm, thành phần và các bước chăm sóc phù hợp.",
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
      <section className="reviews-section">
        <div className="container">
          <SectionTitle
            eyebrow="ĐÁNH GIÁ TỪ KHÁCH HÀNG"
            title={<>Khách hàng nói gì <span className="keep-together">về SKINORA?</span></>}
            description="Tham khảo trải nghiệm từ những khách hàng đã lựa chọn sản phẩm tại SKINORA."
          />
          <div className="review-editorial">
            {reviews.map(([quote, name, type, avatar]) => (
              <article key={name}>
                <div className="quote-mark">“</div>
                <div className="review-stars">★★★★★</div>
                <blockquote>{quote}</blockquote>
                <footer>
                  <span>{avatar}</span>
                  <div>
                    <strong>{name}</strong>
                    <small>{type}</small>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="brand-marquee">
        <span>THƯƠNG HIỆU ĐƯỢC TUYỂN CHỌN</span>
        {brands.map((b) => (
          <strong key={b}>{b}</strong>
        ))}
      </section>
    </div>
  );
}
