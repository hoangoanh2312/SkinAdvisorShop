import { Heart, ShoppingBag, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";
export default function ProductCard({ product }) {
  const discount = product.price > product.salePrice ? Math.round((1 - product.salePrice / product.price) * 100) : 0;
  return <article className="product-card"><div className="product-image">
    <Link to={`/products/${product.slug || product.id}`}><img src={product.images?.[0] || "https://placehold.co/600x700?text=SKINORA"} alt={product.name} /></Link>
    <div className="badge-stack">{product.bestSeller && <span>BÁN CHẠY</span>}{product.featured && <span>AI GỢI Ý</span>}</div>
    {discount > 0 && <span className="discount">-{discount}%</span>}
    <button className="icon-button heart" aria-label="Thêm vào yêu thích"><Heart /></button>
    <Link className="quick-add" to={`/products/${product.slug || product.id}`}><ShoppingBag /> CHỌN PHIÊN BẢN</Link>
  </div><div className="product-info"><div className="brand">{product.brand}</div><Link className="product-name" to={`/products/${product.slug || product.id}`}>{product.name}</Link><div className="rating"><Star fill="currentColor" /> {product.rating || 0} <span>({product.reviewCount || 0})</span></div><div className="price-row"><strong>{formatCurrency(product.salePrice)}</strong>{product.price > product.salePrice && <del>{formatCurrency(product.price)}</del>}</div></div></article>;
}
