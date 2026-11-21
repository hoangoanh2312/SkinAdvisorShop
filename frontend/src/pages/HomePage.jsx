import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Camera, Leaf, RefreshCcw, ScanFace, Sparkles, Truck } from "lucide-react";
import axiosClient, { apiErrorMessage } from "../api/axiosClient";
import ProductCard from "../components/product/ProductCard";
import IngredientExplorer from "../components/product/IngredientExplorer";
import { normalizeProduct } from "../utils/productAdapter";
import { fetchHomeProducts } from "../utils/homeProductLoader.mjs";
import { STORE_INFO } from "../config/storeInfo";

// Trang chủ: kết hợp nét mềm của hồng phấn, sự rõ ràng kiểu khoa học và khối màu tươi trẻ
const CONCERNS = [
  ["oiliness", "Da dầu", "Kiềm dầu, thông thoáng lỗ chân lông", "butter"],
  ["acne", "Da mụn", "Làm sạch dịu nhẹ, giảm viêm", "peach"],
  ["dryness", "Da khô", "Cấp ẩm, giữ nước cho da", "sky"],
  ["sensitivity", "Da nhạy cảm", "Công thức dịu, ít kích ứng", "sage"],
  ["pigmentation", "Thâm sạm", "Làm đều màu, mờ vết thâm", "rose"],
  ["aging", "Lão hóa", "Săn chắc, mờ nếp nhăn", "lilac"],
];
const SAMPLE = [["Mụn", 62, "warn"], ["Dầu nhờn", 70, "warn"], ["Độ ẩm", 55, "ok"], ["Thâm sạm", 38, "ok"]];

function SkinReportPreview() {
  return <aside className="hm-report" aria-label="Báo cáo làn da mẫu">
    <div className="hm-report-head"><span><ScanFace size={18} /> Báo cáo làn da</span><small>Ví dụ minh họa</small></div>
    {SAMPLE.map(([label, value, tone]) => <div className="hm-meter" key={label}>
      <span>{label}</span><div className={`hm-meter-bar ${tone}`}><i style={{ width: `${value}%` }} /></div><b>{(value / 10).toFixed(1)}</b>
    </div>)}
    <p className="hm-report-tip"><Sparkles size={15} /> Gợi ý: làm sạch dịu nhẹ, niacinamide buổi tối</p>
  </aside>;
}

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    fetchHomeProducts((url, options) => axiosClient.get(url, options))
      .then(({ products: items }) => { if (active) setProducts(items.map(normalizeProduct)); })
      .catch((requestError) => { if (active) { setProducts([]); setError(apiErrorMessage(requestError, "Không tải được sản phẩm, kiểm tra máy chủ rồi thử lại")); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retryKey]);

  useEffect(() => {
    let active = true;
    axiosClient.get("/brands")
      .then(({ data }) => { if (active) setBrands(Array.isArray(data?.data?.brands) ? data.data.brands : []); })
      .catch(() => { if (active) setBrands([]); });
    return () => { active = false; };
  }, []);

  const withImages = products.filter((item) => item.images?.[0]);
  const heroMain = withImages[0];
  const heroSide = withImages.find((item) => item !== heroMain && item.brand !== heroMain?.brand) || withImages[1];
  const shown = products.slice(0, 8);

  return <div className="hm">
    <section className="hm-hero hm-wrap">
      <div className="hm-hero-copy">
        <span className="hm-kicker">Mỹ phẩm chính hãng chọn theo làn da</span>
        <h1>Làn da khỏe bắt đầu từ <em>hiểu đúng</em></h1>
        <p className="hm-lead">Chụp một tấm ảnh, trợ lý AI đọc tình trạng da và gợi ý chu trình phù hợp từ những sản phẩm đang có trong cửa hàng</p>
        <div className="hm-cta">
          <Link className="hm-btn hm-btn-solid" to="/skin-analysis"><Camera size={18} /> Phân tích da miễn phí</Link>
          <Link className="hm-btn hm-btn-line" to="/products">Xem sản phẩm <ArrowRight size={18} /></Link>
        </div>
        <ul className="hm-facts">
          <li><b>Ảnh không lưu lại</b>Chỉ dùng để phân tích</li>
          <li><b>Giá theo từng dung tích</b>Có nguồn kiểm chứng</li>
        </ul>
      </div>
      <div className="hm-hero-art">
        <div className="hm-arch hm-arch-main">{heroMain ? <img src={heroMain.images[0]} alt={heroMain.name} /> : <span className="hm-arch-empty" />}</div>
        <div className="hm-arch hm-arch-side">{heroSide ? <img src={heroSide.images[0]} alt={heroSide.name} /> : <span className="hm-arch-empty" />}</div>
        <SkinReportPreview />
      </div>
    </section>

    <ul className="hm-strip hm-wrap" aria-label="Cam kết">
      <li><BadgeCheck /> Hàng chính hãng</li>
      <li><Sparkles /> Gợi ý theo làn da</li>
      <li><Truck /> Miễn phí giao hàng</li>
      <li><RefreshCcw /> Đổi trả trong {STORE_INFO.returnDays} ngày</li>
    </ul>

    <section className="hm-section hm-wrap" id="skin-concerns" aria-labelledby="hm-concerns-title">
      <div className="hm-head"><div><span className="hm-kicker">Chọn theo vấn đề da</span><h2 id="hm-concerns-title">Làn da bạn đang cần gì?</h2></div></div>
      <div className="hm-concerns">
        {CONCERNS.map(([key, title, text, tone]) => <Link key={key} className={`hm-concern ${tone}`} to={`/products?skinConcern=${key}`}>
          <b>{title}</b><span>{text}</span><ArrowRight className="hm-concern-arrow" size={20} />
        </Link>)}
      </div>
    </section>

    <section className="hm-section hm-wrap" aria-labelledby="hm-products-title">
      <div className="hm-head"><div><span className="hm-kicker">Gian hàng</span><h2 id="hm-products-title">Được chọn nhiều</h2></div><Link className="hm-more" to="/products?sort=popular">Tất cả sản phẩm <ArrowRight size={18} /></Link></div>
      {loading && <div className="hm-grid" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <div className="hm-skeleton" key={i} />)}</div>}
      {!loading && shown.length > 0 && <div className="hm-grid">{shown.map((product) => <ProductCard key={product._id || product.id} product={product} />)}</div>}
      {!loading && !shown.length && <div className="hm-empty" role="status"><p>{error || "Chưa có sản phẩm được công khai trên gian hàng"}</p>{error && <button type="button" className="hm-btn hm-btn-line" onClick={() => setRetryKey((v) => v + 1)}>Thử tải lại</button>}</div>}
    </section>

    <section className="hm-ai hm-wrap" aria-labelledby="hm-ai-title">
      <div className="hm-ai-panel">
        <div className="hm-ai-copy">
          <span className="hm-kicker light">Trợ lý da AI</span>
          <h2 id="hm-ai-title">Ba bước để biết da cần gì</h2>
          <p>Ảnh chỉ dùng để phân tích, không lưu lại. Kết quả gồm điểm từng vấn đề da và chu trình sáng tối với sản phẩm có sẵn</p>
          <div className="hm-cta"><Link className="hm-btn hm-btn-light" to="/skin-analysis"><Camera size={18} /> Bắt đầu phân tích</Link><Link className="hm-btn hm-btn-ghost-light" to="/skin-advisor">Hỏi trợ lý AI</Link></div>
        </div>
        <ol className="hm-steps">
          <li><span><Camera /></span><div><b>Chụp ảnh mặt mộc</b>Ánh sáng tự nhiên, nhìn thẳng</div></li>
          <li><span><ScanFace /></span><div><b>AI chấm điểm làn da</b>Mụn, dầu, khô, thâm và độ nhạy cảm</div></li>
          <li><span><Leaf /></span><div><b>Nhận chu trình riêng</b>Sáng và tối, từ sản phẩm đang bán</div></li>
        </ol>
      </div>
    </section>

    <div className="hm-ingredients"><IngredientExplorer /></div>

    {brands.length > 0 && <section className="hm-section hm-wrap hm-brands" aria-labelledby="hm-brands-title">
      <h2 id="hm-brands-title" className="hm-brands-title">Thương hiệu tại sandwich beauty</h2>
      <div>{brands.map((brand) => <Link key={brand._id || brand.slug || brand.name} to={`/products?brand=${encodeURIComponent(brand.name)}`}>{brand.name}</Link>)}</div>
    </section>}
  </div>;
}
