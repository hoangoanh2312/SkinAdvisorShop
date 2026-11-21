import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axiosClient, { apiErrorMessage } from "../api/axiosClient";
import ProductCard from "../components/product/ProductCard";
import { normalizeProduct } from "../utils/productAdapter";

const skins = [["oily", "Da dầu"], ["dry", "Da khô"], ["sensitive", "Da nhạy cảm"], ["combination", "Da hỗn hợp"], ["normal", "Da thường"]];
// Values must equal Product.ingredients.normalizedName (filled from the catalog by applyIngredientEvidence.js).
const ingredients = ["niacinamide", "hyaluronic acid", "ceramide", "centella asiatica", "panthenol", "bha", "salicylic acid", "aha", "glycolic acid", "retinol", "azelaic acid", "tranexamic acid", "vitamin c"];

export default function Products() {
  const [urlParams, setUrlParams] = useSearchParams();
  const [query, setQuery] = useState(urlParams.get("q") || "");
  const [category, setCategory] = useState(urlParams.get("category") || "");
  const [brand, setBrand] = useState(urlParams.get("brand") || "");
  const [skinType, setSkinType] = useState(urlParams.get("skinType") || "");
  const [skinConcern, setSkinConcern] = useState(urlParams.get("skinConcern") || "");
  const [ingredient, setIngredient] = useState(urlParams.get("ingredient") || "");
  const [maxPrice, setMaxPrice] = useState("");
  const SORTS = ["newest", "popular", "price_asc", "price_desc", "rating"];
  const [sort, setSort] = useState(SORTS.includes(urlParams.get("sort")) ? urlParams.get("sort") : "newest");
  const [sellableOnly, setSellableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [mobile, setMobile] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setQuery(urlParams.get("q") || "");
    setCategory(urlParams.get("category") || "");
    setBrand(urlParams.get("brand") || "");
    setSkinType(urlParams.get("skinType") || "");
    setSkinConcern(urlParams.get("skinConcern") || "");
    setIngredient(urlParams.get("ingredient") || "");
    setPage(1);
  }, [urlParams]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([axiosClient.get("/categories"), axiosClient.get("/brands")]).then(([categoriesResult, brandsResult]) => {
      if (!active) return;
      setCategories(categoriesResult.status === "fulfilled" ? categoriesResult.value.data.data.categories || [] : []);
      setBrands(brandsResult.status === "fulfilled" ? brandsResult.value.data.data.brands || [] : []);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = { page, limit: 12, sort };
        if (maxPrice !== "") params.maxPrice = maxPrice;
        if (sellableOnly) params.sellableOnly = "true";
        if (query.trim()) params.search = query.trim();
        if (category) params.category = category;
        if (brand) params.brand = brand;
        if (skinType) params.skinType = skinType;
        if (skinConcern) params.skinConcern = skinConcern;
        if (ingredient) params.ingredient = ingredient;
        const { data } = await axiosClient.get("/products", { params });
        if (active) {
          setProducts((data.data.products || []).map(normalizeProduct));
          setPagination(data.data.pagination);
        }
      } catch (requestError) {
        if (active) {
          setError(apiErrorMessage(requestError, "Không thể tải sản phẩm"));
          setProducts([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, category, brand, skinType, skinConcern, ingredient, maxPrice, sort, page, sellableOnly]);

  const reset = () => {
    setUrlParams({});
    setCategory(""); setBrand(""); setSkinType(""); setIngredient("");
    setSkinConcern(""); setMaxPrice(""); setQuery(""); setSellableOnly(false); setPage(1);
  };
  const selectFilter = (setter) => (value) => { setter(value); setPage(1); };

  return <div className="container catalog-page">
    <div className="page-intro"><span className="eyebrow">BỘ SƯU TẬP CHĂM SÓC DA</span><h1>Sản phẩm chăm sóc da</h1><p>Chọn mỹ phẩm theo thương hiệu, thành phần và nhu cầu của làn da</p></div>
    <button className="btn filter-mobile" type="button" onClick={() => setMobile(true)}><Filter /> Bộ lọc</button>
    <div className="catalog-layout">
      <aside className={mobile ? "filter-panel open" : "filter-panel"} aria-label="Bộ lọc sản phẩm">
        <div className="filter-title"><h3><SlidersHorizontal size={19} /> Bộ lọc</h3><button type="button" aria-label="Đóng bộ lọc" onClick={() => setMobile(false)}><X /></button></div>
        <div className="filter-group"><h4>Danh mục</h4>{categories.map((item) => <label key={item._id}><input type="radio" name="category" checked={category === item._id} onChange={() => selectFilter(setCategory)(item._id)} /><span>{item.name}</span></label>)}</div>
        <div className="filter-group"><h4>Thương hiệu</h4>{brands.map((item) => <label key={item._id}><input type="radio" name="brand" checked={brand.toLowerCase() === item.name.toLowerCase()} onChange={() => selectFilter(setBrand)(item.name)} /><span>{item.name}</span></label>)}</div>
        <div className="filter-group"><h4>Loại da</h4>{skins.map(([value, label]) => <label key={value}><input type="radio" name="skin" checked={skinType === value} onChange={() => selectFilter(setSkinType)(value)} /><span>{label}</span></label>)}</div>
        <div className="filter-group"><h4>Thành phần</h4>{ingredients.map((value) => <label key={value}><input type="radio" name="ingredient" checked={ingredient === value} onChange={() => selectFilter(setIngredient)(value)} /><span>{value}</span></label>)}</div>
        <div className="filter-group"><h4>Trạng thái mua hàng</h4><label><input type="checkbox" checked={sellableOnly} onChange={(event) => { setSellableOnly(event.target.checked); setPage(1); }} /><span>Chỉ sản phẩm đang bán và còn hàng</span></label></div>
        <div className="filter-group"><h4>Giá tối đa</h4><select aria-label="Giá tối đa" value={maxPrice} onChange={(event) => selectFilter(setMaxPrice)(event.target.value)}><option value="">Không giới hạn</option><option value="200000">200.000đ</option><option value="500000">500.000đ</option><option value="1000000">1.000.000đ</option><option value="2000000">2.000.000đ</option></select></div>
        <button type="button" className="btn btn-light full" onClick={reset}>Xóa bộ lọc</button>
        {mobile && <button type="button" className="btn btn-dark full" onClick={() => setMobile(false)}>Xem kết quả</button>}
      </aside>
      <section className="catalog-results">
        <div className="catalog-toolbar"><div className="catalog-search"><Search /><input aria-label="Tìm sản phẩm" value={query} onChange={(event) => selectFilter(setQuery)(event.target.value)} placeholder="Tìm theo tên hoặc thương hiệu..." /></div><select aria-label="Sắp xếp sản phẩm" value={sort} onChange={(event) => selectFilter(setSort)(event.target.value)}><option value="newest">Mới nhất</option><option value="price_asc">Giá thấp đến cao</option><option value="price_desc">Giá cao đến thấp</option><option value="popular">Bán chạy</option><option value="rating">Đánh giá cao</option></select></div>
        {loading ? <div className="empty"><p>Đang tải sản phẩm...</p></div> : error ? <div className="empty" role="alert"><h3>Không thể tải sản phẩm</h3><p>{error}</p><button className="btn btn-light" onClick={() => window.location.reload()}>Thử lại</button></div> : <><p className="result-count">Tìm thấy <strong>{pagination.total}</strong> sản phẩm</p>{products.length ? <div className="product-grid three">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty"><h3>Chưa tìm thấy sản phẩm</h3><p>{sellableOnly ? "Hiện chưa có sản phẩm có thể đặt mua. Bạn có thể bỏ bộ lọc để xem danh mục tham khảo." : brand || category || skinType || skinConcern || ingredient || query ? "Hãy thử thay đổi từ khóa hoặc bộ lọc" : "sandwich beauty đang cập nhật các sản phẩm đã xác minh"}</p><button type="button" className="btn btn-light" onClick={reset}>Xem tất cả</button></div>}{pagination.totalPages > 1 && <div className="form-row"><button className="btn btn-light" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trang trước</button><span>{pagination.page}/{pagination.totalPages}</span><button className="btn btn-light" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau</button></div>}</>}
      </section>
    </div>
  </div>;
}
