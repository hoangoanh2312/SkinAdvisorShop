import { ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";

export default function RecommendationCard({ product, reason }) {
  const hasDiscount = Number.isFinite(product.salePrice) && Number.isFinite(product.price) && product.salePrice < product.price;
  const displayPrice = hasDiscount ? product.salePrice : product.price;
  return (
    <div className="recommend-card">
      {product.image ? <img src={product.image} alt={product.name} /> : <div className="recommend-placeholder" aria-hidden="true" />}
      <div>
        <span>{product.brand}</span><strong>{product.name}</strong>
        {Number.isFinite(product.rating) && <small className="recommend-rating"><Star /> {product.rating.toFixed(1)} ({product.reviewCount || 0})</small>}
        {Number.isFinite(displayPrice) && <b>{formatCurrency(displayPrice)} {hasDiscount && <del>{formatCurrency(product.price)}</del>}</b>}
        {reason && <p>{reason}</p>}
        <div><Link to={`/products/${product.slug}`}><span>Xem sản phẩm</span> <ArrowRight /></Link></div>
      </div>
    </div>
  );
}
