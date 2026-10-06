import { AlertCircle, Camera, CheckCircle2, ImageUp, LoaderCircle, RefreshCcw, ScanFace, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import axiosClient from "../api/axiosClient";
import RecommendationCard from "../components/ai/RecommendationCard";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function SkinAnalysis() {
  const [mode, setMode] = useState("camera"); const [status, setStatus] = useState("idle");
  const [image, setImage] = useState(null); const [previewUrl, setPreviewUrl] = useState("");
  const [consent, setConsent] = useState(false); const [error, setError] = useState(""); const [result, setResult] = useState(null);
  const videoRef = useRef(null); const streamRef = useRef(null); const fileInputRef = useRef(null);
  const stopCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; if (videoRef.current) videoRef.current.srcObject = null; };
  useEffect(() => () => stopCamera(), []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const resetImage = () => { setImage(null); setResult(null); setError(""); setConsent(false); setPreviewUrl(""); };
  const changeMode = (nextMode) => { stopCamera(); resetImage(); setMode(nextMode); setStatus("idle"); };
  const startCamera = async () => {
    stopCamera(); resetImage(); setMode("camera"); setStatus("camera_loading");
    if (!navigator.mediaDevices?.getUserMedia) { setError("Trình duyệt này không hỗ trợ truy cập camera."); setStatus("error"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream; setStatus("camera_ready");
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); } });
    } catch (cameraError) {
      const messages = { NotAllowedError: "Bạn đã từ chối quyền sử dụng camera.", NotFoundError: "Không tìm thấy camera trên thiết bị.", NotReadableError: "Camera đang được ứng dụng khác sử dụng." };
      setError(messages[cameraError.name] || "Không thể mở camera. Vui lòng thử tải ảnh lên."); setStatus("error");
    }
  };
  const capture = () => {
    const video = videoRef.current; if (!video?.videoWidth) return setError("Camera chưa sẵn sàng để chụp ảnh.");
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (!blob) return setError("Không thể chụp ảnh từ camera."); stopCamera(); const file = new File([blob], "skin-capture.jpg", { type: "image/jpeg" }); setImage(file); setPreviewUrl(URL.createObjectURL(file)); setStatus("captured"); setError(""); }, "image/jpeg", 0.9);
  };
  const chooseUpload = (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    stopCamera(); setResult(null); setConsent(false);
    if (!ALLOWED_TYPES.has(file.type)) { setImage(null); setPreviewUrl(""); setError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP."); setStatus("error"); return; }
    if (file.size > MAX_BYTES) { setImage(null); setPreviewUrl(""); setError("Ảnh không được vượt quá 5 MB."); setStatus("error"); return; }
    setImage(file); setPreviewUrl(URL.createObjectURL(file)); setError(""); setStatus("upload_preview");
  };
  const analyze = async () => {
    if (!image || !consent || status === "analyzing") return;
    setStatus("analyzing"); setError(""); setResult(null);
    const form = new FormData(); form.set("image", image); form.set("source", mode); form.set("consent", "true");
    try { const { data } = await axiosClient.post("/ai/skin-analysis", form, { sessionProtected: true, headers: { "Content-Type": "multipart/form-data" } }); setResult(data.data); setStatus("success"); }
    catch (requestError) { setError(requestError.response?.data?.message || "Không thể phân tích ảnh lúc này. Vui lòng thử lại."); setStatus("error"); }
  };
  const hasPreview = Boolean(previewUrl);
  return <main className="skin-analysis-page"><div className="container"><header className="skin-analysis-hero"><span className="eyebrow"><ScanFace /> SKINORA AI</span><h1>Phân tích đặc điểm da</h1><p>Sử dụng camera hoặc ảnh có sẵn để nhận gợi ý chăm sóc mỹ phẩm phù hợp.</p></header>
    <section className="analysis-workspace"><div className="analysis-input-card"><div className="analysis-tabs" role="tablist"><button role="tab" aria-selected={mode === "camera"} className={mode === "camera" ? "active" : ""} onClick={() => changeMode("camera")}><Camera /> Camera trực tiếp</button><button role="tab" aria-selected={mode === "upload"} className={mode === "upload" ? "active" : ""} onClick={() => changeMode("upload")}><ImageUp /> Tải ảnh lên</button></div>
      <div className="analysis-preview">
        {hasPreview ? <img src={previewUrl} alt="Ảnh khuôn mặt được chọn để phân tích đặc điểm da" /> : mode === "camera" && ["camera_loading", "camera_ready"].includes(status) ? <div className="camera-frame"><video ref={videoRef} muted playsInline aria-label="Hình ảnh camera trực tiếp" /><span aria-hidden="true" /></div> : <div className="analysis-placeholder"><ScanFace /><strong>{mode === "camera" ? "Sẵn sàng mở camera" : "Chọn một ảnh khuôn mặt rõ nét"}</strong><small>Ánh sáng đều, nhìn thẳng và không dùng bộ lọc ảnh.</small></div>}
        {status === "camera_loading" && <div className="analysis-overlay"><LoaderCircle className="spin" /> Đang mở camera...</div>}
      </div>
      <div className="analysis-controls">{mode === "camera" ? <>{status === "idle" || status === "error" ? <button className="btn btn-dark" onClick={startCamera}><Camera /> Mở camera</button> : status === "camera_ready" ? <button className="btn btn-dark" onClick={capture}><Camera /> Chụp ảnh</button> : status === "captured" || (status === "error" && image) ? <button className="btn btn-light" onClick={startCamera}><RefreshCcw /> Chụp lại</button> : null}</> : <><input ref={fileInputRef} id="skin-image-upload" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseUpload} /><label className="btn btn-light" htmlFor="skin-image-upload"><ImageUp /> {hasPreview ? "Thay ảnh" : "Chọn ảnh"}</label></>}</div>
      {error && <div className="analysis-error" role="alert"><AlertCircle /> {error}</div>}
      {image && <><label className="analysis-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><ShieldCheck /> Tôi đồng ý sử dụng ảnh này để thực hiện phân tích đặc điểm da.</span></label><button className="btn btn-dark full" disabled={!consent || status === "analyzing"} onClick={analyze}>{status === "analyzing" ? <><LoaderCircle className="spin" /> Đang phân tích...</> : <><ScanFace /> Phân tích da</>}</button></>}
      <p className="analysis-privacy">Ảnh chỉ được xử lý cho yêu cầu hiện tại và không được lưu trong Phase 3.0.</p></div>
      <aside className="analysis-guide"><h2>Để kết quả rõ hơn</h2><ol><li>Đứng ở nơi đủ sáng, tránh ánh sáng quá gắt.</li><li>Nhìn thẳng vào camera và giữ khuôn mặt trong khung.</li><li>Không dùng ảnh đã chỉnh màu hoặc bộ lọc làm đẹp.</li></ol><p><ShieldCheck /> Kết quả chỉ phục vụ tư vấn chăm sóc mỹ phẩm.</p></aside></section>
    {result && <section className="analysis-results" aria-live="polite"><div className="result-heading"><div><span className="eyebrow"><CheckCircle2 /> KẾT QUẢ PHÂN TÍCH</span><h2>{result.analysis.skinTypeLabel}</h2></div><strong>{Math.round(result.analysis.confidence * 100)}% tin cậy</strong></div>
      <div className="result-grid"><article><h3>Đặc điểm quan tâm</h3><div className="concern-results">{result.analysis.concerns.length ? result.analysis.concerns.map((concern) => <span key={concern.key}>{concern.label}<b>{Math.round(concern.confidence * 100)}%</b></span>) : <p>Chưa ghi nhận đặc điểm đủ độ tin cậy.</p>}</div></article><article><h3>Thành phần nên ưu tiên</h3><div className="ingredient-results">{result.analysis.recommendedIngredients.length ? result.analysis.recommendedIngredients.map((item) => <span key={item}>{item}</span>) : <p>Chưa có gợi ý thành phần cụ thể.</p>}</div></article></div>
      {result.analysis.warnings.map((warning) => <p className="analysis-warning" key={warning}>{warning}</p>)}
      <h3>Sản phẩm phù hợp từ SKINORA</h3><div className="analysis-products">{result.recommendations.length ? result.recommendations.map((item) => <RecommendationCard key={item.product.id} product={item.product} reason={item.reasons.join(" · ")} />) : <p>Hiện chưa có sản phẩm phù hợp và còn hàng.</p>}</div>
      <div className="routine-grid"><article><h3>Routine buổi sáng</h3>{result.routine.morning.map((step) => <div key={step.step}><strong>{step.label}</strong>{step.product && <small>{step.product.name}</small>}</div>)}</article><article><h3>Routine buổi tối</h3>{result.routine.evening.map((step) => <div key={step.step}><strong>{step.label}</strong>{step.product && <small>{step.product.name}</small>}</div>)}</article></div>
      <p className="analysis-disclaimer">{result.disclaimer}</p></section>}
  </div></main>;
}
