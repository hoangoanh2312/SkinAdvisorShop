import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef } from "react";
import ProductCard from "./ProductCard";

export default function ProductCarousel({ products }) {
  const trackRef = useRef(null);
  const move = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector(".product-card");
    const distance = card ? card.getBoundingClientRect().width + 20 : track.clientWidth * 0.8;
    track.scrollBy({ left: direction * distance, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  return <div className="sandwich-carousel">
    <div className="sandwich-carousel-controls" aria-label="Điều khiển sản phẩm">
      <button type="button" aria-label="Sản phẩm trước" onClick={() => move(-1)}><ArrowLeft aria-hidden="true" /></button>
      <button type="button" aria-label="Sản phẩm tiếp theo" onClick={() => move(1)}><ArrowRight aria-hidden="true" /></button>
    </div>
    <div className="sandwich-carousel-track" ref={trackRef} aria-label="Sản phẩm nổi bật">
      {products.map(product => <ProductCard key={product.id} product={product} />)}
    </div>
  </div>;
}
