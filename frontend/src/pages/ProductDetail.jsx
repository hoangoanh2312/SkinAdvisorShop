import { Check, ChevronRight, Minus, Plus, ShoppingBag, Star, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { formatCurrency, formatDate } from "../utils/formatters";
import { normalizeProduct, variantDisplayPrice } from "../utils/productAdapter";
import { selectPreferredVariant } from "../utils/variantSelection";
import "../cart-feedback.css";
export default function ProductDetail() {
  const { id } = useParams(); const { user } = useAuth(); const { addToCart, items: cartItems } = useCart();
  const [product, setProduct] = useState(null); const [variants, setVariants] = useState([]); const [variant, setVariant] = useState(null); const [image, setImage] = useState(0); const [qty, setQty] = useState(1); const [reviews, setReviews] = useState([]); const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" }); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [reviewError, setReviewError] = useState("");
  // Synchronous guard: the first click locks immediately, even before React rerenders.
  const addedRef = useRef(false);
  const [wasAdded, setWasAdded] = useState(false);
  const [cartFeedback, setCartFeedback] = useState(null);
  const resetAddState = () => { addedRef.current = false; setWasAdded(false); setCartFeedback(null); };
  useEffect(() => { addedRef.current = false; setWasAdded(false); setCartFeedback(null); }, [id]);
  const handleAddToCart = () => {
    if (!product || !variant || addedRef.current) return;
    const existing = cartItems.find((item) => item.productId === product.id && item.variantId === variant._id);
    const inCart = existing?.quantity || 0;
    if (inCart + qty > Number(variant.stock)) {
      setCartFeedback({ kind: "error", message: `Giỏ hàng đã có ${inCart} sản phẩm. Chỉ còn ${Math.max(0, variant.stock - inCart)} sản phẩm có thể thêm.` });
      return;
    }
    // addToCart updates local cart state and returns false for invalid / unavailable SKUs.
    addedRef.current = true;
    const success = addToCart(product, variant, qty);
    if (success) {
      setWasAdded(true);
      setCartFeedback({ kind: "success", message: `Đã thêm ${qty} sản phẩm vào giỏ hàng!` });
    } else {
      addedRef.current = false;
      setCartFeedback({ kind: "error", message: "Không thể thêm sản phẩm vào giỏ. Vui lòng thử lại." });
    }
  };
  const loadProduct = useCallback(async () => { const { data } = await axiosClient.get(`/products/${id}`); const normalized = normalizeProduct(data.data.product, data.data.variants); setProduct(normalized); setVariants(data.data.variants); setVariant((current) => selectPreferredVariant(data.data.variants, current?._id, normalized.isActive)); return normalized; }, [id]);
  const loadReviews = useCallback(async (productId) => { const { data } = await axiosClient.get(`/products/${productId}/reviews`); setReviews(data.data.reviews); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    loadProduct().then(async (value) => {
      try { await loadReviews(value.id); }
      catch { if (active) setReviews([]); } // Review API failure must not hide an available product.
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || "Không thể tải sản phẩm.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadProduct, loadReviews]);
  const submitReview = async (event) => { event.preventDefault(); setReviewError(""); try { await axiosClient.post(`/products/${product.id}/reviews`, { rating: Number(reviewForm.rating), comment: reviewForm.comment }, { sessionProtected: true }); setReviewForm({ rating: 5, comment: "" }); await Promise.all([loadProduct(), loadReviews(product.id)]); } catch (requestError) { setReviewError(requestError.response?.data?.message || "Không thể gửi đánh giá."); } };
  if (loading) return <div className="container empty"><p>Đang tải sản phẩm...</p></div>;
  if (error || !product) return <div className="container empty"><h2>Không thể hiển thị sản phẩm</h2><p>{error}</p><Link to="/products">Quay lại sản phẩm</Link></div>;
  const selectedPrice = variant ? variantDisplayPrice(variant) : null;
  const purchasable = Boolean(product.isActive && variant && variant.isActive !== false && Number(variant.price) > 0 && Number(variant.stock) > 0);
  return <div className="container detail-page"><div className="breadcrumbs"><Link to="/">Trang chủ</Link><ChevronRight /><Link to="/products">Sản phẩm</Link><ChevronRight /><span>{product.name}</span></div>
    <div className="detail-grid"><div className="gallery"><div className="thumbs">{product.images.map((src, index) => <button className={index === image ? "active" : ""} key={src} onClick={() => setImage(index)}><img src={src} alt="" /></button>)}</div><div className="main-image">{product.images[image] ? <img src={product.images[image]} alt={product.name} /> : <span className="catalog-image-missing">Chưa có ảnh sản phẩm</span>}</div></div>
      <div className="detail-info"><span className="brand">{product.brand}</span><h1>{product.name}</h1><div className="rating large">{product.reviewCount > 0 ? <><Star fill="currentColor" /> {product.rating} <span>{product.reviewCount} đánh giá</span></> : <span>Chưa có đánh giá</span>}</div><p className="detail-description">{product.description}</p><div className="detail-price"><strong>{Number(selectedPrice) > 0 ? formatCurrency(selectedPrice) : "Đang cập nhật giá"}</strong></div>
        <div className="variant-block"><div><strong>Phiên bản</strong><span>{variant ? (purchasable ? `Còn ${variant.stock} sản phẩm` : (product.isActive ? "Hết hàng hoặc phiên bản chưa đủ điều kiện" : "Sắp mở bán")) : "Chưa có phiên bản khả dụng"}</span></div><div className="variant-row">{variants.map((item) => <button type="button" className={item._id === variant?._id ? "active" : ""} key={item._id} onClick={() => { setVariant(item); setQty(1); resetAddState(); }}>{item.name || `${item.size} ${item.unit}`}<small>{Number(item.price) > 0 ? formatCurrency(variantDisplayPrice(item)) : "Chưa có giá"}</small></button>)}</div></div>
        <div className="purchase-row"><div className="qty"><button type="button" aria-label="Giảm số lượng" onClick={() => { if (qty > 1) { setQty(qty - 1); resetAddState(); } }}><Minus /></button><span>{qty}</span><button type="button" aria-label="Tăng số lượng" disabled={!purchasable || qty >= variant.stock} onClick={() => { setQty(qty + 1); resetAddState(); }}><Plus /></button></div><button type="button" className="btn btn-dark grow" disabled={!purchasable || wasAdded} onClick={handleAddToCart}>{wasAdded ? <Check /> : <ShoppingBag />} {wasAdded ? "Đã thêm vào giỏ" : purchasable ? "Thêm vào giỏ hàng" : "Chưa thể đặt mua"}</button></div>
        {cartFeedback && <div className={`sandwich-cart-notice ${cartFeedback.kind === "error" ? "is-error" : "is-success"}`} role={cartFeedback.kind === "error" ? "alert" : "status"} aria-live="polite"><div className="sandwich-cart-notice-icon">{cartFeedback.kind === "success" ? <Check aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />}</div><div className="sandwich-cart-notice-copy"><strong>{cartFeedback.message}</strong>{cartFeedback.kind === "success" && <span>Bạn có thể kiểm tra giỏ hàng trước khi thanh toán.</span>}</div>{cartFeedback.kind === "success" && <Link to="/cart" className="sandwich-cart-notice-link">Xem giỏ hàng <ChevronRight aria-hidden="true" /></Link>}<button type="button" className="sandwich-cart-notice-dismiss" onClick={() => setCartFeedback(null)} aria-label="Đóng thông báo"><X aria-hidden="true" /></button></div>}
      </div></div>
    <div className="detail-sections"><article><span className="eyebrow">CÂU CHUYỆN SẢN PHẨM</span><h2>Công dụng</h2><p>{product.description || product.shortDescription}</p></article><article><h3>Thành phần nổi bật</h3><div className="tag-row">{product.ingredients.map((item) => <span key={item.normalizedName || item.name}>{item.name}</span>)}</div><h3>Hướng dẫn sử dụng</h3><p>{product.usage || "Đang cập nhật."}</p></article><article><h3>Phù hợp với</h3>{[...product.skinTypes, ...product.skinConcerns].map((item) => <p className="check-line" key={item}><Check /> {item}</p>)}<h3>Lưu ý</h3><p>{product.warnings.join(" · ") || "Đọc kỹ hướng dẫn trước khi sử dụng."}</p></article></div>
    <section className="reviews"><h2>Đánh giá từ khách hàng</h2><div className="review-summary">{product.reviewCount > 0 ? <><strong>{product.rating}/5</strong><span>Dựa trên {product.reviewCount} đánh giá đã ghi nhận</span></> : <span>Chưa có đánh giá thực tế cho sản phẩm này.</span>}</div>
      {user?.role === "customer" && product.isActive ? <form onSubmit={submitReview}><div className="form-grid"><label>Điểm đánh giá<select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} sao</option>)}</select></label><label>Bình luận<textarea value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} maxLength="2000" /></label></div>{reviewError && <p className="form-error">{reviewError}</p>}<button className="btn btn-dark">Gửi đánh giá</button></form> : !user && product.isActive ? <p><Link to="/login">Đăng nhập</Link> để đánh giá sản phẩm đã mua.</p> : null}
      <div className="order-cards">{reviews.length ? reviews.map((review) => <article key={review._id}><div><strong>{review.user?.fullName || "Khách hàng sandwich"}</strong><span>{formatDate(review.createdAt)}</span></div><b>{"★".repeat(review.rating)}</b><p>{review.comment || "Không có bình luận."}</p></article>) : <div className="empty"><p>Chưa có đánh giá nào.</p></div>}</div>
    </section></div>;
}
