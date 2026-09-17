import {
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/product/ProductCard";
import { formatPrice, productData } from "../data/mockData";
import { useCart } from "../contexts/CartContext";
export default function ProductDetail() {
  const { id } = useParams(),
    product =
      productData.find((p) => p.id === id || p.slug === id) || productData[0],
    [image, setImage] = useState(0),
    [variant, setVariant] = useState(product.variants[0]),
    [qty, setQty] = useState(1),
    { addToCart } = useCart();
  const related = useMemo(
    () =>
      productData
        .filter((p) => p.category === product.category && p.id !== product.id)
        .slice(0, 4),
    [product],
  );
  return (
    <div className="container detail-page">
      <div className="breadcrumbs">
        <Link to="/">Trang chủ</Link>
        <ChevronRight />
        <Link to="/products">Sản phẩm</Link>
        <ChevronRight />
        <span>{product.name}</span>
      </div>
      <div className="detail-grid">
        <div className="gallery">
          <div className="thumbs">
            {product.images.map((im, i) => (
              <button
                className={i === image ? "active" : ""}
                key={im}
                onClick={() => setImage(i)}
              >
                <img src={im} />
              </button>
            ))}
          </div>
          <div className="main-image">
            <img src={product.images[image]} alt={product.name} />
          </div>
        </div>
        <div className="detail-info">
          <span className="brand">{product.brand}</span>
          <h1>{product.name}</h1>
          <div className="rating large">
            <Star fill="currentColor" /> {product.rating}{" "}
            <span>{product.reviewCount} đánh giá</span>
          </div>
          <p className="detail-description">{product.description}</p>
          <div className="detail-price">
            <strong>{formatPrice(variant.price)}</strong>
            {variant.size === "30ml" && <del>{formatPrice(product.price)}</del>}
          </div>
          <div className="variant-block">
            <div>
              <strong>Dung tích</strong>
              <span>Còn {variant.stock} sản phẩm</span>
            </div>
            <div className="variant-row">
              {product.variants.map((v) => (
                <button
                  className={v.size === variant.size ? "active" : ""}
                  key={v.size}
                  onClick={() => setVariant(v)}
                >
                  {v.size}
                  <small>{formatPrice(v.price)}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="purchase-row">
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))}>
                <Minus />
              </button>
              <span>{qty}</span>
              <button onClick={() => setQty(qty + 1)}>
                <Plus />
              </button>
            </div>
            <button
              className="btn btn-dark grow"
              onClick={() => {
                for (let i = 0; i < qty; i++) addToCart(product, variant);
              }}
            >
              <ShoppingBag /> Thêm vào giỏ hàng
            </button>
          </div>
          <div className="benefits">
            <span>
              <Truck /> Miễn phí giao hàng từ 500K
            </span>
            <span>
              <ShieldCheck /> Cam kết chính hãng 100%
            </span>
          </div>
        </div>
      </div>
      <div className="detail-sections">
        <article>
            <span className="eyebrow">CÂU CHUYỆN SẢN PHẨM</span>
          <h2>Công dụng</h2>
          <p>
            {product.description} Công thức được nghiên cứu để mang lại hiệu quả
            bền vững, đồng thời tôn trọng hàng rào tự nhiên của làn da.
          </p>
        </article>
        <article>
          <h3>Thành phần nổi bật</h3>
          <div className="tag-row">
            {product.ingredients.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
          <h3>Hướng dẫn sử dụng</h3>
          <p>{product.usage}</p>
        </article>
        <article>
          <h3>Phù hợp với</h3>
          {[...product.skinTypes, ...product.skinConcerns].map((x) => (
            <p className="check-line" key={x}>
              <Check /> {x}
            </p>
          ))}
          <h3>Lưu ý</h3>
          <p>{product.warning}</p>
        </article>
      </div>
      <section className="reviews">
        <h2>Đánh giá từ khách hàng</h2>
        <div className="review-summary">
          <strong>{product.rating}</strong>
          <div>
            <div className="stars">★★★★★</div>
            <span>Dựa trên {product.reviewCount} đánh giá</span>
          </div>
          <blockquote>
            “Kết cấu rất dễ chịu, da mình trông khỏe và đủ ẩm hơn sau vài tuần
            sử dụng.”<cite>— Minh Anh, khách hàng đã mua</cite>
          </blockquote>
        </div>
      </section>
      {related.length > 0 && (
        <section className="section">
          <h2>Sản phẩm liên quan</h2>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
