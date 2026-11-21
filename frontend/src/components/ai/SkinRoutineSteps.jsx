import { Check, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../contexts/CartContext";
import { formatCurrency } from "../../utils/formatters";
import { variantDisplayPrice } from "../../utils/productAdapter";
import { ScoreRing } from "./SkinScoreBoard";

const pickVariant = (product) => (product.variants || []).find((v) => v.isActive !== false && Number(v.price) > 0 && Number(v.stock) > 0) || null;

function RoutineProduct({ item }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  const { product } = item;
  const variant = pickVariant(product);
  const price = variant ? variantDisplayPrice(variant) : null;
  const add = () => {
    const ok = addToCart({ ...product, images: product.images?.length ? product.images : product.image ? [product.image] : [] }, variant, 1);
    setAdded(ok);
  };
  return <article className="skin-routine-product">
    <Link to={`/products/${product.slug || product.id}`} className="skin-routine-thumb">{product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <span>Chưa có ảnh</span>}</Link>
    <div><small>{product.brand}</small><Link to={`/products/${product.slug || product.id}`}><strong>{product.name}</strong></Link>
      {item.reasons?.length > 0 && <p>{item.reasons.join("; ")}</p>}
      {price && <b>{formatCurrency(price)}{Number(variant.price) > price && <del>{formatCurrency(variant.price)}</del>}</b>}</div>
    <button type="button" className="btn btn-dark btn-small" disabled={!variant || added} onClick={add}>{added ? <><Check size={15} /> Đã thêm</> : <><ShoppingBag size={15} /> Thêm vào giỏ</>}</button>
  </article>;
}

export default function SkinRoutineSteps({ stepRoutine }) {
  const options = stepRoutine?.focusOptions || [];
  const [focus, setFocus] = useState(stepRoutine?.defaultFocus || options[0]?.key);
  if (!stepRoutine || !options.length) return <p>Chưa có chu trình gợi ý</p>;
  const plan = stepRoutine.plans?.[focus] || [];
  const current = options.find((o) => o.key === focus);
  const hasAnyProduct = plan.some((step) => step.products.length);
  return <div className="skin-step-routine">
    <div className="skin-focus-head"><h3>Chu trình 4 bước của bạn</h3><p>Nhắm vào: <strong>{current?.label}</strong>. Chọn mục tiêu khác để xem gợi ý tương ứng.</p></div>
    <div className="skin-focus-options" role="tablist" aria-label="Mục tiêu chăm sóc">{options.map((option) => <button key={option.key} type="button" role="tab" aria-selected={focus === option.key} className={focus === option.key ? "is-active" : ""} onClick={() => setFocus(option.key)}>
      {option.score !== null && option.score !== undefined && <ScoreRing score={option.score} size={34} />}{option.label}</button>)}</div>
    {stepRoutine.sensitive && <p className="skin-routine-note">Da có dấu hiệu đỏ/nhạy cảm: sản phẩm chứa BHA, AHA, retinol được xếp sau. Thêm từng hoạt chất mới một và thử trên vùng da nhỏ trước.</p>}
    <ol className="skin-steps">{plan.map((step, index) => <li key={step.step}>
      <div className="skin-step-title"><span>{String(index + 1).padStart(2, "0")}</span><div><h4>{step.label}</h4><p>{step.purpose} <em>{step.when}</em></p></div></div>
      {step.products.length ? <div className="skin-step-products">{step.products.map((item) => <RoutineProduct key={item.product.id} item={item} />)}</div>
        : <p className="skin-step-empty">sandwich beauty hiện chưa có sản phẩm đang bán cho bước này</p>}
    </li>)}</ol>
    {hasAnyProduct && <Link to="/cart" className="btn btn-light skin-view-cart"><ShoppingBag size={17} /> Xem giỏ hàng</Link>}
  </div>;
}
