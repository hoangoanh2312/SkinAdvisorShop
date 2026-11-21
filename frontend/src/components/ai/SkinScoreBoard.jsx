import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

export const scoreTone = (score) => (score === null || score === undefined ? "unknown" : score >= 7 ? "good" : score >= 5 ? "watch" : "attention");
const TONE_TEXT = { good: "Tốt", watch: "Cần theo dõi", attention: "Cần chú ý", unknown: "Chưa đủ rõ" };

export function ScoreRing({ score, size = 64, label }) {
  const tone = scoreTone(score);
  const percent = score ? (score / 10) * 100 : 0;
  return <span className={`skin-score-ring tone-${tone}`} style={{ "--size": `${size}px`, "--p": percent }} aria-label={label ? `${label}: ${score ?? "chưa đủ rõ"}/10` : undefined}>
    <b>{score ?? "–"}</b>{score !== null && score !== undefined && <small>/10</small>}
  </span>;
}

export const ACNE_CLASS_COLORS = { papule: "#e0564f", pustule: "#e89b2f", comedone: "#6b5bd6", nodule: "#b0306a", acne: "#e0564f" };

/** Face photo with markers per metric; for "Mụn" with the YOLO detector, one box per detected lesion. */
export function SkinFaceMap({ imageUrl, metrics, selectedKey, onSelect, acneDetection }) {
  const boxes = selectedKey === "acne" ? acneDetection?.detections || [] : [];
  const shown = metrics.filter((m) => m.markers?.length && m.status !== "uncertain" && !(m.key === "acne" && boxes.length));
  return <div className="skin-face-map">
    <img src={imageUrl} alt="Ảnh đã phân tích, có đánh dấu vùng da" />
    {boxes.map((box, index) => <span key={`acne-box-${index}`} className="skin-acne-box"
      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%`, "--box": ACNE_CLASS_COLORS[box.classKey] || ACNE_CLASS_COLORS.acne }}
      title={`${box.label}, độ tin cậy ${Math.round(box.confidence * 100)}%`} aria-hidden="true" />)}
    {shown.map((metric) => metric.markers.map((marker, index) => {
      const active = !selectedKey || selectedKey === metric.key;
      const labelSide = marker.x > 0.5 ? "right" : "left";
      return <button type="button" key={`${metric.key}-${index}`} onClick={() => onSelect(metric.key)}
        className={`skin-marker tone-${scoreTone(metric.score)} ${active ? "is-active" : "is-dim"} label-${labelSide}`}
        style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
        aria-label={`${metric.label}${marker.region ? ` – ${metric.regionLabels?.[metric.regions.indexOf(marker.region)] || ""}` : ""}: ${metric.score}/10`}>
        <i aria-hidden="true" />{index === 0 && active && <span>{metric.label}</span>}
      </button>;
    }))}
    {boxes.length > 0 && <p className="skin-acne-box-count" aria-live="polite">{boxes.length} nốt được khoanh</p>}
    {!shown.length && !boxes.length && <p className="skin-face-map-empty">Không đặt được điểm đánh dấu trên ảnh này — xem điểm từng chỉ số bên cạnh</p>}
  </div>;
}

export function MetricPicker({ metrics, selectedKey, onSelect }) {
  const assessed = metrics.filter((m) => m.score !== null);
  const good = assessed.filter((m) => m.score >= 7);
  const attention = assessed.filter((m) => m.score < 7).sort((a, b) => a.score - b.score);
  const unclear = metrics.filter((m) => m.score === null && m.status !== "not_assessed");
  const button = (metric) => <button type="button" key={metric.key} className={`skin-metric-chip ${selectedKey === metric.key ? "is-selected" : ""}`} onClick={() => onSelect(metric.key)} aria-pressed={selectedKey === metric.key}>
    <ScoreRing score={metric.score} size={58} label={metric.label} /><span>{metric.label}</span>
  </button>;
  return <div className="skin-metric-picker">
    {attention.length > 0 && <div><h4 className="tone-attention"><AlertCircle size={16} /> Khu vực cần chú ý</h4><div className="skin-metric-row">{attention.map(button)}</div></div>}
    {good.length > 0 && <div><h4 className="tone-good"><CheckCircle2 size={16} /> Sức khỏe làn da</h4><div className="skin-metric-row">{good.map(button)}</div></div>}
    {unclear.length > 0 && <div><h4 className="tone-unknown"><HelpCircle size={16} /> Chưa đủ rõ để chấm</h4><div className="skin-metric-row">{unclear.map(button)}</div></div>}
  </div>;
}

function AcneBreakdown({ detection }) {
  const metrics = detection.model?.metrics;
  return <div className="skin-acne-breakdown">
    <strong>{detection.severityLabel}{detection.count ? `: ${detection.count} nốt` : ""}</strong>
    {detection.byClass?.length > 0 && <ul>{detection.byClass.map((group) => <li key={group.key}>
      <i style={{ "--box": ACNE_CLASS_COLORS[group.key] || ACNE_CLASS_COLORS.acne }} aria-hidden="true" />{group.label}<b>{group.count}</b></li>)}</ul>}
    <small>Đếm bằng mô hình phát hiện mụn YOLO tự huấn luyện trên bộ dữ liệu ACNE04{metrics?.map50 != null ? ` (mAP@50 = ${Math.round(metrics.map50 * 100)}% trên tập kiểm thử)` : ""}. Có thể bỏ sót nốt rất nhỏ hoặc nhầm với nốt ruồi, vết thâm.</small>
  </div>;
}

export function MetricDetail({ metric, acneDetection }) {
  if (!metric) return null;
  const tone = scoreTone(metric.score);
  return <article className={`skin-metric-detail tone-${tone}`} aria-live="polite">
    <div className="skin-metric-detail-head"><ScoreRing score={metric.score} size={76} /><div><span>{TONE_TEXT[tone]}</span><h3>{metric.label}</h3>
      {metric.score !== null && <div className="skin-score-bar" aria-hidden="true"><i style={{ width: `${metric.score * 10}%` }} /></div>}</div></div>
    <p>{metric.evidence || (metric.score === null ? "Ảnh chưa đủ rõ để đánh giá chỉ số này. Hãy thử ảnh đủ sáng, chính diện, không dùng bộ lọc làm đẹp." : "Không có mô tả chi tiết cho chỉ số này")}</p>
    {metric.key === "acne" && acneDetection && <AcneBreakdown detection={acneDetection} />}
    {metric.regionLabels?.length > 0 && <p className="skin-metric-regions"><strong>Vùng:</strong> {metric.regionLabels.join(", ")}</p>}
    <small>Độ tin cậy AI ước lượng: {Math.round((metric.confidence || 0) * 100)}%{metric.status === "low_confidence" ? " — thấp, chỉ để tham khảo" : ""}. Thang 10 = ít dấu hiệu nhất.</small>
  </article>;
}
