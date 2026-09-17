import { ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPrice } from "../../data/mockData";
import { useCart } from "../../contexts/CartContext";
export default function RecommendationCard({ product, reason }) {
  const { addToCart } = useCart();
  return (
    <div className="recommend-card">
      <img src={product.images[0]} alt={product.name} />
      <div>
        <span>{product.brand}</span>
        <strong>{product.name}</strong>
        <b>{formatPrice(product.salePrice)}</b>
        <p>{reason}</p>
        <div>
          <Link to={`/products/${product.id}`}>Xem chi tiết</Link>
          <button onClick={() => addToCart(product)}>
            <ShoppingBag /> Thêm vào giỏ
          </button>
        </div>
      </div>
    </div>
  );
}
