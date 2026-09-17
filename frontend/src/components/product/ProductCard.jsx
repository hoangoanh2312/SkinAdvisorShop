import { Heart, ShoppingBag, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPrice } from "../../data/mockData";
import { useCart } from "../../contexts/CartContext";
export default function ProductCard({ product }) {
  const { addToCart } = useCart(),
    discount = Math.round((1 - product.salePrice / product.price) * 100);
  return (
    <article className="product-card">
      <div className="product-image">
        <Link to={`/products/${product.id}`}>
          <img src={product.images[0]} alt={product.name} />
        </Link>
        <div className="badge-stack">
          {product.bestSeller && <span>BÁN CHẠY</span>}
          {product.featured && <span>AI GỢI Ý</span>}
        </div>
        <span className="discount">-{discount}%</span>
        <button className="icon-button heart" aria-label="Thêm vào yêu thích">
          <Heart />
        </button>
        <button className="quick-add" onClick={() => addToCart(product)}>
          <ShoppingBag /> THÊM NHANH
        </button>
      </div>
      <div className="product-info">
        <div className="brand">{product.brand}</div>
        <Link className="product-name" to={`/products/${product.id}`}>
          {product.name}
        </Link>
        <div className="rating">
          <Star fill="currentColor" /> {product.rating}{" "}
          <span>({product.reviewCount})</span>
        </div>
        <div className="price-row">
          <strong>{formatPrice(product.salePrice)}</strong>
          <del>{formatPrice(product.price)}</del>
        </div>
      </div>
    </article>
  );
}
