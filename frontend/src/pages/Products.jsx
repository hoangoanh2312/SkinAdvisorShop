import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import ProductCard from "../components/product/ProductCard";
import { normalizeProduct } from "../utils/productAdapter";
const skins = [["oily", "Da dầu"], ["dry", "Da khô"], ["sensitive", "Da nhạy cảm"], ["combination", "Da hỗn hợp"], ["normal", "Da thường"]];
const ingredients = ["niacinamide", "bha", "aha", "retinol", "vitamin c", "hyaluronic acid", "ceramide"];
export default function Products() {
  const [urlParams] = useSearchParams();
  const [query, setQuery] = useState(urlParams.get("q") || ""); const [category, setCategory] = useState(urlParams.get("category") || ""); const [skinType, setSkinType] = useState(""); const [ingredient, setIngredient] = useState(""); const [maxPrice, setMaxPrice] = useState(1000000); const [sort, setSort] = useState("newest"); const [page, setPage] = useState(1); const [mobile, setMobile] = useState(false);
  const [categories, setCategories] = useState([]); const [products, setProducts] = useState([]); const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 }); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { axiosClient.get("/categories").then(({ data }) => setCategories(data.data.categories)).catch(() => setCategories([])); }, []);
  useEffect(() => {
    const timer = setTimeout(async () => { setLoading(true); setError(""); try { const params = { page, limit: 12, sort, maxPrice }; if (query.trim()) params.search = query.trim(); if (category) params.category = category; if (skinType) params.skinType = skinType; if (ingredient) params.ingredient = ingredient; const { data } = await axiosClient.get("/products", { params }); setProducts(data.data.products.map(normalizeProduct)); setPagination(data.data.pagination); } catch (requestError) { setError(requestError.response?.data?.message || "Không thể tải sản phẩm."); setProducts([]); } finally { setLoading(false); } }, 250);
    return () => clearTimeout(timer);
  }, [query, category, skinType, ingredient, maxPrice, sort, page]);
  const reset = () => { setCategory(""); setSkinType(""); setIngredient(""); setMaxPrice(1000000); setPage(1); };
  return <div className="container catalog-page"><div className="page-intro"><span className="eyebrow">BỘ SƯU TẬP CHĂM SÓC DA</span><h1>Sản phẩm chăm sóc da</h1><p>Chọn lọc công thức hiệu quả, minh bạch và phù hợp với làn da châu Á.</p></div>
    <button className="btn filter-mobile" onClick={() => setMobile(true)}><Filter /> Bộ lọc</button><div className="catalog-layout"><aside className={mobile ? "filter-panel open" : "filter-panel"}><div className="filter-title"><h3><SlidersHorizontal size={19} /> Bộ lọc</h3><button onClick={() => setMobile(false)}><X /></button></div>
      <div className="filter-group"><h4>Danh mục</h4>{categories.map((item) => <label key={item._id}><input type="radio" name="category" checked={category === item._id} onChange={() => { setCategory(item._id); setPage(1); }} /><span>{item.name}</span></label>)}</div>
      <div className="filter-group"><h4>Loại da</h4>{skins.map(([value, label]) => <label key={value}><input type="radio" name="skin" checked={skinType === value} onChange={() => { setSkinType(value); setPage(1); }} /><span>{label}</span></label>)}</div>
      <div className="filter-group"><h4>Thành phần</h4>{ingredients.map((value) => <label key={value}><input type="radio" name="ingredient" checked={ingredient === value} onChange={() => { setIngredient(value); setPage(1); }} /><span>{value}</span></label>)}</div>
      <div className="filter-group"><h4>Khoảng giá</h4><input type="range" min="0" max="1000000" step="50000" value={maxPrice} onChange={(e) => { setMaxPrice(Number(e.target.value)); setPage(1); }} /></div><button className="btn btn-light full" onClick={reset}>Xóa bộ lọc</button>
    </aside><section className="catalog-results"><div className="catalog-toolbar"><div className="catalog-search"><Search /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Tìm theo tên hoặc thương hiệu..." /></div><select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="newest">Mới nhất</option><option value="price_asc">Giá thấp đến cao</option><option value="price_desc">Giá cao đến thấp</option><option value="popular">Bán chạy</option><option value="rating">Đánh giá cao</option></select></div>
      {loading ? <div className="empty"><p>Đang tải sản phẩm...</p></div> : error ? <div className="empty"><h3>Không thể tải sản phẩm</h3><p>{error}</p></div> : <><p className="result-count">Tìm thấy <strong>{pagination.total}</strong> sản phẩm</p>{products.length ? <div className="product-grid three">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty"><h3>Chưa tìm thấy sản phẩm</h3><p>Hãy thử thay đổi từ khóa hoặc bộ lọc.</p></div>}{pagination.totalPages > 1 && <div className="form-row"><button className="btn btn-light" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trang trước</button><span>{pagination.page}/{pagination.totalPages}</span><button className="btn btn-light" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau</button></div>}</>}
    </section></div></div>;
}
