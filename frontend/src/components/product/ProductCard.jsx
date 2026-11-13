import { ShoppingBag, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";

export default function ProductCard({ product }) {
  const discount = product.price > product.salePrice && product.price > 0
    ? Math.round((1 - product.salePrice / product.price) * 100) : 0;
  const comingSoon = product.isActive === false;
  const soldOut = !comingSoon && product.inStock === false;
  const link = `/products/${product.slug || product.id}`;
  return <article className="product-card">
    <div className="product-image">
      <Link to={link}>{product.images?.[0] ? <img src={product.images[0]} alt={product.name} loading="lazy" /> : <span className="catalog-image-missing">Chưa có ảnh sản phẩm</span>}</Link>
      <div className="badge-stack">
        {comingSoon ? <span className="stock-badge">SẮP MỞ BÁN</span> : soldOut ? <span className="stock-badge">HẾT HÀNG</span> : <>{product.bestSeller && <span>BÁN CHẠY</span>}{product.featured && <span>NỔI BẬT</span>}</>}
      </div>
      {discount > 0 && <span className="discount">-{discount}%</span>}
      <Link className="quick-add" to={link}><ShoppingBag /> {soldOut || comingSoon ? "XEM CHI TIẾT" : "CHỌN PHIÊN BẢN"}</Link>
    </div>
    <div className="product-info">
      <div className="brand">{product.brand}</div>
      <Link className="product-name" to={link}>{product.name}</Link>
      <div className="rating">{product.reviewCount > 0 ? <><Star fill="currentColor" /> {product.rating} <span>({product.reviewCount})</span></> : <span>Chưa có đánh giá</span>}</div>
      <div className="price-row"><strong>{product.salePrice > 0 ? formatCurrency(product.salePrice) : "Đang cập nhật giá"}</strong>{discount > 0 && <del>{formatCurrency(product.price)}</del>}</div>
    </div>
  </article>;
}
