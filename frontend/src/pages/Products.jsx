import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/product/ProductCard";
import { categories, productData } from "../data/mockData";
const ingredients = [
    "Niacinamide",
    "BHA",
    "AHA",
    "Retinol",
    "Vitamin C",
    "Hyaluronic Acid",
    "Ceramide",
  ],
  safety = ["Không cồn khô", "Không hương liệu", "Không Paraben"],
  skins = ["Da dầu", "Da khô", "Da nhạy cảm", "Da hỗn hợp", "Da thường"];
export default function Products() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || ""),
    [sort, setSort] = useState("new"),
    [filters, setFilters] = useState({
      category: params.get("category") ? [params.get("category")] : [],
      skin: [],
      ingredient: [],
      safety: [],
      max: 1000000,
    }),
    [mobile, setMobile] = useState(false);
  const toggle = (group, value) =>
    setFilters((f) => ({
      ...f,
      [group]: f[group].includes(value)
        ? f[group].filter((x) => x !== value)
        : [...f[group], value],
    }));
  const results = useMemo(() => {
    let list = productData.filter(
      (p) =>
        (!query ||
          `${p.name} ${p.brand} ${p.skinConcerns.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!filters.category.length || filters.category.includes(p.category)) &&
        (!filters.skin.length ||
          filters.skin.some((x) => p.skinTypes.includes(x))) &&
        (!filters.ingredient.length ||
          filters.ingredient.some((x) => p.ingredients.includes(x))) &&
        (!filters.safety.length ||
          filters.safety.every((x) => p.safety.includes(x))) &&
        p.salePrice <= filters.max,
    );
    return [...list].sort((a, b) =>
      sort === "low"
        ? a.salePrice - b.salePrice
        : sort === "high"
          ? b.salePrice - a.salePrice
          : sort === "best"
            ? Number(b.bestSeller) - Number(a.bestSeller)
            : sort === "rating"
              ? b.rating - a.rating
              : b.createdAt - a.createdAt,
    );
  }, [query, sort, filters]);
  const group = (title, key, values) => (
    <div className="filter-group">
      <h4>{title}</h4>
      {values.map((x) => (
        <label key={x}>
          <input
            type="checkbox"
            checked={filters[key].includes(x)}
            onChange={() => toggle(key, x)}
          />
          <span>{x}</span>
        </label>
      ))}
    </div>
  );
  return (
    <div className="container catalog-page">
      <div className="page-intro">
        <span className="eyebrow">BỘ SƯU TẬP CHĂM SÓC DA</span>
        <h1>Sản phẩm chăm sóc da</h1>
        <p>
          Chọn lọc công thức hiệu quả, minh bạch và phù hợp với làn da châu Á.
        </p>
      </div>
      <button className="btn filter-mobile" onClick={() => setMobile(true)}>
        <Filter /> Bộ lọc
      </button>
      <div className="catalog-layout">
        <aside className={mobile ? "filter-panel open" : "filter-panel"}>
          <div className="filter-title">
            <h3>
              <SlidersHorizontal size={19} /> Bộ lọc
            </h3>
            <button onClick={() => setMobile(false)}>
              <X />
            </button>
          </div>
          {group(
            "Danh mục",
            "category",
            categories.map((c) => c.name),
          )}
          {group("Loại da", "skin", skins)}
          {group("Thành phần", "ingredient", ingredients)}
          {group("Tiêu chí an toàn", "safety", safety)}
          <div className="filter-group">
            <h4>Khoảng giá</h4>
            <input
              type="range"
              min="100000"
              max="1000000"
              step="50000"
              value={filters.max}
              onChange={(e) =>
                setFilters({ ...filters, max: Number(e.target.value) })
              }
            />
            <div>
              Dưới {new Intl.NumberFormat("vi-VN").format(filters.max)}đ
            </div>
          </div>
          <button
            className="btn btn-light full"
            onClick={() =>
              setFilters({
                category: [],
                skin: [],
                ingredient: [],
                safety: [],
                max: 1000000,
              })
            }
          >
            Xóa bộ lọc
          </button>
        </aside>
        <section className="catalog-results">
          <div className="catalog-toolbar">
            <div className="catalog-search">
              <Search />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên, thương hiệu, vấn đề da..."
              />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="new">Mới nhất</option>
              <option value="low">Giá thấp đến cao</option>
              <option value="high">Giá cao đến thấp</option>
              <option value="best">Bán chạy</option>
              <option value="rating">Đánh giá cao</option>
            </select>
          </div>
          <p className="result-count">
            Tìm thấy <strong>{results.length}</strong> sản phẩm
          </p>
          {results.length ? (
            <div className="product-grid three">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>Chưa tìm thấy sản phẩm</h3>
              <p>Hãy thử thay đổi từ khóa hoặc bộ lọc.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
