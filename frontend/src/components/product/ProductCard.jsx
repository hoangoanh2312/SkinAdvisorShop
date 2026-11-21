import { ShoppingBag, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";
import WishlistButton from "./WishlistButton";

export default function ProductCard({ product, showAvailability = false }) {
  const discount = product.price > product.salePrice && product.price > 0
    ? Math.round((1 - product.salePrice / product.price) * 100) : 0;
  const comingSoon = product.isActive === false;
  const soldOut = !comingSoon && product.inStock === false;
  const link = `/products/${product.slug || product.id}`;
  // Rê chuột lên thẻ thì đổi sang ảnh thứ hai (ảnh dùng thực tế, góc khác hoặc ảnh của dung tích khác)
  const hoverCandidate = product.hoverImage ?? product.images?.[1];
  const hoverImage = hoverCandidate && hoverCandidate !== product.images?.[0] ? hoverCandidate : "";
  return <article className="product-card">
    <div className="product-image">
      <Link to={link}>{product.images?.[0] ? <><img className="product-primary-image" src={product.images[0]} alt={product.name} loading="lazy" />{hoverImage && <img className={`product-secondary-image fit-${product.hoverFit === "cover" ? "cover" : "contain"}`} src={hoverImage} alt="" loading="lazy" aria-hidden="true" />}</> : <span className="catalog-image-missing">Chưa có ảnh sản phẩm</span>}</Link>
      <WishlistButton productId={product.id || product._id} />
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
      {showAvailability && product.displayVariant && <p className="wishlist-sku">{[product.displayVariant.name, product.displayVariant.size, product.displayVariant.unit].filter(Boolean).join(" ")}, SKU {product.displayVariant.sku}</p>}
      {showAvailability && <p className="wishlist-stock">{comingSoon ? "Chưa mở bán" : soldOut ? "Hết hàng" : "Còn hàng"}</p>}
    </div>
  </article>;
}
