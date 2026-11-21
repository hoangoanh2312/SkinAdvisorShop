import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

const ZOOM = 2.5;

// Ảnh sản phẩm phóng to kiểu Watsons:
// - Máy tính: rê chuột lên ảnh hiện khung kính lúp, phần phóng to hiện ở khung bên phải
// - Bấm vào ảnh (hoặc chạm trên điện thoại): mở xem toàn màn hình, chuyển ảnh bằng mũi tên
export default function ZoomImage({ images, index, onIndexChange, alt }) {
  const boxRef = useRef(null);
  const [hover, setHover] = useState(null); // { x, y } theo phần trăm
  const [viewer, setViewer] = useState(false);
  const src = images[index];

  const move = (event) => {
    const rect = boxRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    setHover({ x, y });
  };
  const lensSize = 100 / ZOOM;
  const lensLeft = hover ? Math.min(100 - lensSize, Math.max(0, hover.x - lensSize / 2)) : 0;
  const lensTop = hover ? Math.min(100 - lensSize, Math.max(0, hover.y - lensSize / 2)) : 0;

  return <>
    <div
      ref={boxRef}
      className="zoom-box"
      onMouseMove={move}
      onMouseLeave={() => setHover(null)}
      onClick={() => setViewer(true)}
      role="button"
      tabIndex={0}
      aria-label="Xem ảnh phóng to"
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setViewer(true); } }}
    >
      <img key={src} className="main-image-fade" src={src} alt={alt} draggable={false} />
      {hover && <span className="zoom-lens" style={{ width: `${lensSize}%`, height: `${lensSize}%`, left: `${lensLeft}%`, top: `${lensTop}%` }} aria-hidden="true" />}
      <span className="zoom-hint" aria-hidden="true"><ZoomIn size={15} /> Rê chuột để phóng to, bấm để xem toàn màn hình</span>
      {hover && <div
        className="zoom-pane"
        aria-hidden="true"
        style={{
          backgroundImage: `url("${src}")`,
          backgroundSize: `${ZOOM * 100}% ${ZOOM * 100}%`,
          backgroundPosition: `${(lensLeft / (100 - lensSize)) * 100 || 0}% ${(lensTop / (100 - lensSize)) * 100 || 0}%`,
        }}
      />}
    </div>
    {viewer && <ImageViewer images={images} index={index} onIndexChange={onIndexChange} alt={alt} onClose={() => setViewer(false)} />}
  </>;
}

function ImageViewer({ images, index, onIndexChange, alt, onClose }) {
  const [zoomed, setZoomed] = useState(false), [origin, setOrigin] = useState("50% 50%");
  const go = useCallback((step) => { setZoomed(false); onIndexChange((index + step + images.length) % images.length); }, [index, images.length, onIndexChange]);
  useEffect(() => {
    const key = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && images.length > 1) go(1);
      if (event.key === "ArrowLeft" && images.length > 1) go(-1);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = overflow; };
  }, [go, images.length, onClose]);
  const track = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setOrigin(`${((event.clientX - rect.left) / rect.width) * 100}% ${((event.clientY - rect.top) / rect.height) * 100}%`);
  };
  return createPortal(
    <div className="image-viewer" role="dialog" aria-modal="true" aria-label="Xem ảnh sản phẩm" onClick={onClose}>
      <button type="button" className="image-viewer-close" aria-label="Đóng" onClick={onClose}><X /></button>
      {images.length > 1 && <button type="button" className="image-viewer-nav prev" aria-label="Ảnh trước" onClick={(event) => { event.stopPropagation(); go(-1); }}><ChevronLeft /></button>}
      <div className={`image-viewer-stage ${zoomed ? "zoomed" : ""}`} onClick={(event) => { event.stopPropagation(); track(event); setZoomed(!zoomed); }} onMouseMove={zoomed ? track : undefined}>
        <img src={images[index]} alt={alt} style={{ transformOrigin: origin }} draggable={false} />
      </div>
      {images.length > 1 && <button type="button" className="image-viewer-nav next" aria-label="Ảnh sau" onClick={(event) => { event.stopPropagation(); go(1); }}><ChevronRight /></button>}
      <div className="image-viewer-footer" onClick={(event) => event.stopPropagation()}>
        <span>{index + 1}/{images.length} · Bấm vào ảnh để phóng to, Esc để đóng</span>
        {images.length > 1 && <div className="image-viewer-thumbs">{images.map((item, position) => <button type="button" key={item} className={position === index ? "active" : ""} onClick={() => { setZoomed(false); onIndexChange(position); }}><img src={item} alt="" /></button>)}</div>}
      </div>
    </div>,
    document.body,
  );
}
