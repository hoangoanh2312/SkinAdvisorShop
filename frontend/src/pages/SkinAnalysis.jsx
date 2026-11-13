import {
  AlertCircle, ArrowRight, Camera, Check, CheckCircle2, ChevronRight, Clock3,
  ImageUp, LoaderCircle, LockKeyhole, RefreshCcw, ScanFace, ShieldCheck,
  Sparkles, Sun, Moon, Trash2, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import axiosClient from "../api/axiosClient";
import RecommendationCard from "../components/ai/RecommendationCard";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CAPTURE_TIPS = [
  "Tẩy trang, bỏ kính và để tóc gọn ra sau.",
  "Nhìn thẳng, để lộ trán, hai má và cằm.",
  "Dùng ánh sáng tự nhiên; tránh bộ lọc làm đẹp.",
];

export default function SkinAnalysis() {
  const [mode, setMode] = useState("camera");
  const [status, setStatus] = useState("idle");
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [resultTab, setResultTab] = useState("analysis");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);
  const captureRef = useRef(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await axiosClient.get("/ai/skin-analysis/history?limit=10", { sessionProtected: true });
      setHistory(data?.data?.items || []);
      setHistoryError("");
    } catch (requestError) {
      setHistoryError(requestError.response?.data?.message || "Không thể tải lịch sử phân tích.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteHistoryItem = async (entry) => {
    if (!window.confirm("Xóa vĩnh viễn kết quả phân tích này khỏi tài khoản?")) return;
    try {
      await axiosClient.delete(`/ai/skin-analysis/history/${entry._id}`, { sessionProtected: true });
      setHistory((current) => current.filter((item) => item._id !== entry._id));
      setHistoryError("");
    } catch (requestError) {
      setHistoryError(requestError.response?.data?.message || "Không thể xóa kết quả.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };
  useEffect(() => () => stopCamera(), []);
  useEffect(() => { loadHistory(); }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    if (!privacyOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setPrivacyOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [privacyOpen]);

  const resetImage = () => {
    setImage(null);
    setPreviewUrl("");
    setResult(null);
    setError("");
    setResultTab("analysis");
  };
  const changeMode = (nextMode) => {
    if (status === "analyzing") return;
    stopCamera(); resetImage(); setMode(nextMode); setStatus("idle");
  };
  const startCamera = async () => {
    stopCamera(); resetImage(); setMode("camera"); setStatus("camera_loading");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt không hỗ trợ camera hoặc chưa chạy qua HTTPS/localhost.");
      setStatus("error"); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setStatus("camera_ready");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (cameraError) {
      const messages = {
        NotAllowedError: "Bạn chưa cho phép dùng camera. Có thể chọn Tải ảnh lên.",
        NotFoundError: "Thiết bị không tìm thấy camera.",
        NotReadableError: "Camera đang được ứng dụng khác sử dụng.",
      };
      setError(messages[cameraError.name] || "Không mở được camera. Vui lòng tải ảnh lên.");
      setStatus("error");
    }
  };
  const beginAction = (action) => {
    if (status === "analyzing") return;
    if (!privacyAccepted) {
      setPendingAction(action); setConsent(false); setPrivacyOpen(true); return;
    }
    if (action === "camera") startCamera();
    else { changeMode("upload"); fileInputRef.current?.click(); }
  };
  const acceptPrivacy = () => {
    if (!consent) return;
    setPrivacyAccepted(true); setPrivacyOpen(false);
    if (pendingAction === "camera") startCamera();
    if (pendingAction === "upload") {
      changeMode("upload"); fileInputRef.current?.click();
    }
    setPendingAction(null);
  };
  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) { setError("Camera chưa sẵn sàng. Vui lòng thử lại."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError("Không thể chụp ảnh."); return; }
      stopCamera();
      const file = new File([blob], "skin-capture.jpg", { type: "image/jpeg" });
      setImage(file); setPreviewUrl(URL.createObjectURL(file)); setStatus("captured"); setError("");
    }, "image/jpeg", 0.9);
  };
  const chooseUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    stopCamera(); resetImage(); setMode("upload");
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP."); setStatus("error"); return;
    }
    if (file.size > MAX_BYTES) {
      setError("Ảnh không được vượt quá 5 MB."); setStatus("error"); return;
    }
    setImage(file); setPreviewUrl(URL.createObjectURL(file)); setStatus("upload_preview");
  };
  const analyze = async () => {
    if (!image || !privacyAccepted || status === "analyzing") return;
    setStatus("analyzing"); setError(""); setResult(null);
    const form = new FormData();
    form.set("image", image); form.set("source", mode); form.set("consent", "true");
    try {
      const { data } = await axiosClient.post("/ai/skin-analysis", form, { sessionProtected: true });
      setResult(data.data); setStatus("success"); setResultTab("analysis");
      await loadHistory();
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể phân tích ảnh lúc này. Vui lòng thử lại.");
      setStatus("error");
    }
  };

  const hasPreview = Boolean(previewUrl);
  const analysis = result?.analysis || {};
  const concerns = analysis.concerns || [];
  const possibleConcerns = analysis.possibleConcerns || [];
  // Chỉ hiển thị những gì Gemini thực sự trả về, không tự đánh dấu mụn trên ảnh.
  const acneObserved = concerns.find((item) => item.key === "acne");
  const acneUncertain = possibleConcerns.find((item) => item.key === "acne");
  const ingredients = analysis.recommendedIngredients || [];
  const warnings = analysis.warnings || [];
  const recommendations = result?.recommendations || [];
  const morning = result?.routine?.morning || [];
  const evening = result?.routine?.evening || [];

  return (
    <main className="skin-analysis-page skin-analysis-experience">
      <div className="container">
        <header className="skin-analysis-hero">
          <span className="skin-ai-kicker"><Sparkles size={16} /> sandwich · SKIN ADVISOR</span>
          <h1>Hiểu làn da, chọn đúng điều da cần.</h1>
          <p>Phân tích ảnh khuôn mặt bằng Gemini AI, xem các dấu hiệu có thể quan sát và tham khảo chu trình chăm sóc từ sản phẩm sandwich.</p>
          <button className="skin-start-button" type="button" onClick={() => captureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Bắt đầu khám phá làn da <ArrowRight size={18}/>
          </button>
          <div className="skin-ai-stepper" aria-label="Các bước tư vấn">
            <span><b>01</b> Chụp hoặc tải ảnh</span><ChevronRight size={15}/>
            <span><b>02</b> Gemini phân tích</span><ChevronRight size={15}/>
            <span><b>03</b> Routine phù hợp</span>
          </div>
        </header>

        <section ref={captureRef} className="analysis-workspace" aria-label="Chuẩn bị ảnh phân tích">
          <div className="analysis-input-card">
            <div className="skin-section-title"><span>01 / CHUẨN BỊ ẢNH</span><h2>Góc nhìn rõ, tư vấn phù hợp hơn</h2></div>
            <div className="analysis-tabs" role="tablist" aria-label="Chọn nguồn ảnh">
              <button role="tab" type="button" aria-selected={mode === "camera"} className={mode === "camera" ? "active" : ""} disabled={status === "analyzing"} onClick={() => changeMode("camera")}><Camera /> Chụp trực tiếp</button>
              <button role="tab" type="button" aria-selected={mode === "upload"} className={mode === "upload" ? "active" : ""} disabled={status === "analyzing"} onClick={() => changeMode("upload")}><ImageUp /> Tải ảnh lên</button>
            </div>
            <div className="analysis-preview">
              {hasPreview ? <img src={previewUrl} alt="Ảnh khuôn mặt đã chọn; ảnh này sẽ được gửi đến Gemini nếu bạn xác nhận" />
                : mode === "camera" && ["camera_loading", "camera_ready"].includes(status)
                  ? <div className="camera-frame"><video ref={videoRef} muted playsInline aria-label="Hình ảnh trực tiếp từ camera"/><span aria-hidden="true"/></div>
                  : <div className="analysis-placeholder"><div className="skin-face-icon"><ScanFace size={62} strokeWidth={1.25}/></div><strong>{mode === "camera" ? "Sẵn sàng chụp chân dung" : "Chọn ảnh khuôn mặt rõ nét"}</strong><small>Không trang điểm đậm, không filter, ảnh đủ sáng.</small></div>}
              {status === "camera_loading" && <div className="analysis-overlay"><LoaderCircle className="spin"/> Đang mở camera...</div>}
              {status === "analyzing" && <div className="analysis-overlay skin-ai-working" role="status"><ScanFace size={46}/><strong>Gemini đang xem xét ảnh</strong><span>Đang phân tích các đặc điểm nhìn thấy, không phải chẩn đoán y khoa.</span><div className="skin-indeterminate" aria-hidden="true"><i/></div></div>}
            </div>
            <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseUpload} aria-label="Chọn ảnh khuôn mặt" />
            <div className="analysis-controls">
              {mode === "camera" ? (status === "camera_ready"
                ? <button className="btn btn-dark" type="button" onClick={capture}><Camera/> Chụp ảnh</button>
                : <button className="btn btn-dark" type="button" disabled={status === "analyzing"} onClick={() => beginAction("camera")}><Camera/> {hasPreview ? "Chụp lại" : "Mở camera"}</button>)
                : <button className="btn btn-light" type="button" disabled={status === "analyzing"} onClick={() => beginAction("upload")}><ImageUp/> {hasPreview ? "Chọn ảnh khác" : "Chọn ảnh"}</button>}
              {hasPreview && <button className="btn btn-light" type="button" disabled={status === "analyzing"} onClick={() => { stopCamera(); resetImage(); setStatus("idle"); }}><RefreshCcw/> Bỏ ảnh</button>}
            </div>
            {error && <div className="analysis-error" role="alert"><AlertCircle/> {error}</div>}
            {hasPreview && <button className="skin-analyze-button" type="button" onClick={analyze} disabled={!privacyAccepted || status === "analyzing"}>
              {status === "analyzing" ? <><LoaderCircle className="spin"/> Đang phân tích bằng Gemini...</> : <><ScanFace/> Phân tích da <ArrowRight size={18}/></>}
            </button>}
            <p className="analysis-privacy"><ShieldCheck size={16}/> Ảnh chỉ được gửi để phân tích sau khi bạn đồng ý. sandwich lưu kết quả trong tài khoản nhưng không lưu file ảnh gốc; bạn có thể xóa lịch sử. Nhận xét chỉ mang tính tham khảo.</p>
          </div>
          <aside className="analysis-guide">
            <div className="skin-guide-icon"><Sun size={25}/></div>
            <span className="skin-ai-kicker">MẸO CHỤP ẢNH</span>
            <h2>Một bức ảnh rõ sẽ hữu ích hơn</h2>
            <ol>{CAPTURE_TIPS.map((tip) => <li key={tip}>{tip}</li>)}</ol>
            <p><ShieldCheck/> Không dùng kết quả này để tự chẩn đoán hoặc điều trị bệnh da.</p>
          </aside>
        </section>

        {result && <section ref={resultsRef} className="analysis-results" aria-live="polite">
          <div className="skin-section-title"><span><CheckCircle2 size={17}/> GEMINI ĐÃ PHẢN HỒI</span><h2>Kết quả dành cho làn da của bạn</h2></div>
          <div className="skin-result-summary"><div><small>Loại da được AI ước lượng</small><h3>{analysis.skinTypeLabel || "Chưa xác định"}</h3><p>Đánh giá từ ảnh có thể bị ảnh hưởng bởi ánh sáng và chất lượng camera.</p></div><span><Sparkles size={22}/></span></div>
          <div className="skin-result-tabs" role="tablist" aria-label="Xem kết quả phân tích hoặc chu trình chăm sóc">
            <button role="tab" type="button" aria-selected={resultTab === "analysis"} className={resultTab === "analysis" ? "active" : ""} onClick={() => setResultTab("analysis")}>Phân tích da</button>
            <button role="tab" type="button" aria-selected={resultTab === "routine"} className={resultTab === "routine" ? "active" : ""} onClick={() => setResultTab("routine")}>Chu trình gợi ý</button>
          </div>
          {resultTab === "analysis" ? <div className="skin-tab-panel" role="tabpanel">
            <p className="analysis-disclaimer">Những nhận xét dưới đây được Gemini ước lượng từ ảnh, không phải kết luận y khoa. AI có thể bỏ sót nốt mụn nhỏ, vùng da bị che khuất hoặc nhầm dấu hiệu do ánh sáng.</p>
            <div className={`skin-acne-status ${acneObserved ? "is-observed" : acneUncertain ? "is-uncertain" : "is-unconfirmed"}`}>
              <div className="skin-acne-status-heading"><ScanFace size={22} aria-hidden="true"/><div><span>KIỂM TRA DẤU HIỆU MỤN</span><h3>{acneObserved ? "Có dấu hiệu gợi ý mụn" : acneUncertain ? "Có dấu hiệu nghi ngờ, cần kiểm tra lại" : "Chưa thấy bằng chứng đủ rõ về mụn"}</h3></div></div>
              <p>{acneObserved ? (acneObserved.evidence || "Gemini ghi nhận dấu hiệu có thể liên quan đến mụn trong ảnh.") : acneUncertain ? (acneUncertain.evidence || "Gemini nhận xét có dấu hiệu chưa rõ; cần ảnh sắc nét hơn để quan sát.") : "Gemini chưa báo cáo dấu hiệu mụn có thể đánh giá từ ảnh này. Điều đó KHÔNG có nghĩa là da không có mụn."}</p>
              <small>{acneObserved ? "Đây chỉ là dấu hiệu quan sát từ ảnh, không phải chẩn đoán mụn." : "Bạn có thể thử ảnh không bộ lọc, đủ sáng và nhìn rõ trán, hai má, cằm."}</small>
              <button type="button" className="skin-acne-retry" onClick={() => { setResult(null); setResultTab("analysis"); captureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><RefreshCcw size={15}/> Chụp hoặc tải ảnh rõ hơn</button>
            </div>
            <div className="result-grid"><article><h3>Đặc điểm quan sát được</h3><div className="concern-results">
              {concerns.length ? concerns.map((concern) => <div className="concern-detail" key={concern.key}><span><strong>{concern.label}</strong><b>{Math.round(concern.confidence * 100)}% ước lượng</b></span>{concern.evidence && <small>{concern.evidence}</small>}</div>) : <p>Chưa nhận diện được dấu hiệu đủ tin cậy. Điều này không có nghĩa là da không có mụn.</p>}
            </div>{possibleConcerns.length > 0 && <div className="possible-concerns"><h4><AlertCircle size={17}/> Dấu hiệu cần quan sát thêm</h4>{possibleConcerns.map((concern) => <p key={concern.key}><strong>Có thể có {concern.label?.toLowerCase()}</strong>{concern.evidence ? `: ${concern.evidence}` : ". Ảnh chưa đủ rõ để kết luận."}</p>)}<small>Hãy thử ảnh đủ sáng nếu muốn kiểm tra lại.</small></div>}</article>
              <article><h3>Thành phần nên ưu tiên</h3><div className="ingredient-results">{ingredients.length ? <>{ingredients.map((item) => <span key={item}>{item}</span>)}{analysis.ingredientGuidance?.map((entry) => <p key={entry.name} className="ingredient-explanation"><strong>{entry.name}:</strong> {entry.reason}</p>)}<p className="ingredient-source">Gợi ý tham khảo dựa trên kết quả AI và quy tắc chăm sóc mỹ phẩm; không phải thành phần AI nhìn thấy trong ảnh.</p></> : <p>Chưa có đủ thông tin để gợi ý thành phần cụ thể.</p>}</div></article></div>
            {warnings.map((warning) => <p className="analysis-warning" key={warning}>{warning}</p>)}
            <button className="skin-next-button" type="button" onClick={() => setResultTab("routine")}>Xem chu trình chăm sóc <ArrowRight size={18}/></button>
          </div> : <div className="skin-tab-panel" role="tabpanel">
            <p className="skin-routine-intro">Routine là gợi ý tham khảo từ dữ liệu sandwich và kết quả Gemini. Không bắt buộc phải dùng tất cả sản phẩm.</p>
            <div className="routine-grid"><article><h3><Sun size={20}/> Buổi sáng</h3>{morning.length ? morning.map((step) => <div key={step.step}><strong>{step.label}</strong>{step.description && <p className="routine-description">{step.description}</p>}{step.product && <small>Sản phẩm tham khảo: {step.product.name}</small>}</div>) : <p>Chưa có gợi ý phù hợp.</p>}</article><article><h3><Moon size={20}/> Buổi tối</h3>{evening.length ? evening.map((step) => <div key={step.step}><strong>{step.label}</strong>{step.description && <p className="routine-description">{step.description}</p>}{step.product && <small>Sản phẩm tham khảo: {step.product.name}</small>}</div>) : <p>Chưa có gợi ý phù hợp.</p>}</article></div>
            <h3 className="skin-products-heading">Sản phẩm phù hợp từ sandwich</h3>
            <div className="analysis-products">{recommendations.length ? recommendations.map((item) => <RecommendationCard key={item.product.id} product={item.product} reason={item.reasons.join(" · ")} />) : <p>Hiện chưa có sản phẩm có thể mua phù hợp với kết quả này.</p>}</div>
          </div>}
          <p className="analysis-disclaimer">{result.disclaimer || "Tư vấn mỹ phẩm không thay thế đánh giá của bác sĩ da liễu."}</p>
        </section>}

        <section className="analysis-history" aria-label="Lịch sử phân tích da">
          <div className="analysis-history-head"><div><span className="skin-ai-kicker"><Clock3 size={15}/> LỊCH SỬ CÁ NHÂN</span><h2>Lần phân tích trước</h2></div><button type="button" className="btn btn-light" disabled={historyLoading} onClick={loadHistory}>{historyLoading ? "Đang tải..." : "Tải lại"}</button></div>
          <p>Chỉ tài khoản của bạn được xem kết quả đã lưu. Bạn có thể xóa từng kết quả; sandwich không lưu ảnh gốc.</p>
          {historyError && <p role="alert" className="analysis-error">{historyError}</p>}
          {!historyLoading && !history.length && <p>Chưa có kết quả phân tích nào được lưu.</p>}
          <div className="analysis-history-list">{history.map((entry) => <article key={entry._id}><span><strong>{entry.result?.skinTypeLabel || "Chưa xác định loại da"}</strong><small>{new Date(entry.createdAt).toLocaleString("vi-VN")}</small></span><button type="button" className="btn btn-light" onClick={() => deleteHistoryItem(entry)}><Trash2 size={15}/> Xóa kết quả</button></article>)}</div>
        </section>
      </div>

      {privacyOpen && <div className="skin-privacy-backdrop" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="skin-privacy-heading" className="skin-privacy-modal">
        <button type="button" className="skin-privacy-close" aria-label="Đóng thông báo quyền riêng tư" onClick={() => setPrivacyOpen(false)}><X size={22}/></button>
        <div className="skin-privacy-mark"><LockKeyhole size={27}/></div>
        <span className="skin-ai-kicker">BẠN KIỂM SOÁT DỮ LIỆU</span>
        <h2 id="skin-privacy-heading">Quyền riêng tư của bạn</h2>
        <p>sandwich chỉ gửi ảnh đến dịch vụ Gemini khi bạn chủ động đồng ý. Kết quả được lưu vào tài khoản để bạn xem lại và có thể xóa; sandwich không lưu file ảnh gốc.</p>
        <div className="skin-privacy-points"><span><Check size={16}/> Chỉ phân tích ảnh bạn lựa chọn</span><span><Check size={16}/> Có thể xóa lịch sử kết quả</span><span><Check size={16}/> Không sử dụng để chẩn đoán bệnh</span></div>
        <label className="skin-privacy-accept"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/><span>Tôi hiểu thông tin trên và đồng ý gửi ảnh đến Gemini để nhận kết quả tư vấn chăm sóc da.</span></label>
        <button className="skin-analyze-button" type="button" disabled={!consent} onClick={acceptPrivacy}>Tôi đồng ý <ArrowRight size={18}/></button>
        <button className="skin-privacy-cancel" type="button" onClick={() => setPrivacyOpen(false)}>Để sau</button>
      </section></div>}
    </main>
  );
}
