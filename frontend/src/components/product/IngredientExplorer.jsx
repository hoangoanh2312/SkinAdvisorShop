import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { catalogIngredients } from "../../utils/ingredientCatalog";

export default function IngredientExplorer() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [selected, setSelected] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    axiosClient.get("/products", { params: { limit: 100 } }).then(({ data }) => {
      if (!active) return;
      setProducts(Array.isArray(data?.data?.products) ? data.data.products : []);
      setStatus("ready");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [retry]);
  const ingredients = useMemo(() => catalogIngredients(products), [products]);
  const active = ingredients.find(item => item.key === selected) || ingredients[0];
  return <section id="thanh-phan" className="ingredient-explorer container" data-reveal aria-labelledby="ingredient-explorer-title">
    <div className="ingredient-explorer-heading"><span className="eyebrow">DỮ LIỆU TỪ DANH MỤC</span><h2 id="ingredient-explorer-title">Khám phá thành phần</h2><p>Thông tin dưới đây lấy từ hồ sơ sản phẩm hiện có; không phải chẩn đoán hay kết quả kiểm định độc lập</p></div>
    {status === "loading" && <p role="status">Đang tải thành phần…</p>}
    {status === "error" && <div role="alert">Không tải được dữ liệu thành phần <button type="button" onClick={() => { setStatus("loading"); setRetry(value => value + 1); }}>Thử lại</button></div>}
    {status === "ready" && !ingredients.length && <p>Chưa có thông tin thành phần được công bố trong danh mục</p>}
    {status === "ready" && active && <div className="ingredient-explorer-body">
      <div className="ingredient-explorer-options" aria-label="Chọn thành phần">{ingredients.map(item => <button type="button" key={item.key} className={active.key === item.key ? "is-active" : ""} aria-pressed={active.key === item.key} onClick={() => setSelected(item.key)}>{item.name}</button>)}</div>
      <article className="ingredient-explorer-detail" aria-live="polite">
        {active.image && <img src={active.image} alt={`Minh họa thành phần ${active.name}`} loading="lazy" />}
        <div><span className="eyebrow">THÀNH PHẦN TRONG DANH MỤC</span><h3>{active.name}</h3><p>{active.detail || "Thông tin công dụng đang cập nhật"}</p><div className="ingredient-explorer-links">{active.detail && active.sourceUrl && <a href={active.sourceUrl} target="_blank" rel="noopener noreferrer">Nguồn tham khảo khoa học</a>}<Link to={`/products?ingredient=${encodeURIComponent(active.key)}`}>Xem sản phẩm có thành phần này</Link></div></div>
      </article>
    </div>}
  </section>;
}
