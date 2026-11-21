const { normalizeMetrics, normalizeImageQuality, toBox, overallScore, concernsFromMetrics, focusOptions } = require("./skinMetrics");

const SKIN_TYPE_LABELS = { oily: "Da dầu", dry: "Da khô", normal: "Da thường", combination: "Da hỗn hợp", unknown: "Chưa xác định" };
const CONCERN_LABELS = { acne: "Mụn", pigmentation: "Thâm sạm", redness: "Đỏ da", large_pores: "Lỗ chân lông to", dullness: "Da xỉn màu", dehydration: "Da thiếu ẩm" };
const ALLOWED_SKIN_TYPES = new Set(Object.keys(SKIN_TYPE_LABELS).filter((key) => key !== "unknown"));
const ALLOWED_CONCERNS = new Set(Object.keys(CONCERN_LABELS));
const confidence = (value) => {
  // Gemini có thể trả điểm dưới dạng chuỗi như "0.75" hoặc "75%".
  const input = typeof value === "string" ? value.trim() : value;
  const parsed = typeof input === "number" ? input : (typeof input === "string" && /^(?:\d+(?:\.\d+)?|\.\d+)\s*%?$/.test(input) ? Number(input.replace("%", "")) : NaN);
  if (!Number.isFinite(parsed)) return 0;
  const ratio = (typeof input === "string" && input.endsWith("%")) || (parsed > 1 && parsed <= 100) ? parsed / 100 : parsed;
  return Math.min(Math.max(ratio, 0), 1);
};
const normalizeConcernKey = (value) => {
  if (typeof value !== "string") return "";
  const key = value.trim().toLowerCase();
  // Quy về key nội bộ, bao gồm biến thể Gemini đôi khi trả về bằng tiếng Việt.
  if (["acne", "pimples", "pimple", "acne spots", "acne vulgaris", "blemishes", "breakouts",
    "mụn", "mụn trứng cá", "mụn ẩn", "mụn viêm", "mụn đầu trắng", "mụn đầu đen"].includes(key)) return "acne";
  return key;
};
const normalizeConcern = (item) => {
  if (!item || !ALLOWED_CONCERNS.has(normalizeConcernKey(item.key))) return null;
  const key = normalizeConcernKey(item.key);
  return {
    key,
    label: CONCERN_LABELS[key],
    confidence: confidence(item.confidence),
    evidence: typeof item.evidence === "string" ? item.evidence.trim().slice(0, 180) : "",
  };
};
const normalizeSkinAnalysis = (raw = {}) => {
  const skinConfidence = confidence(raw.confidence);
  const skinType = ALLOWED_SKIN_TYPES.has(raw.skinType) && skinConfidence >= 0.55 ? raw.skinType : "unknown";
  const imageQuality = normalizeImageQuality(raw.imageQuality);
  const faceBox = toBox(raw.faceBox);
  const metrics = imageQuality.faceDetected ? normalizeMetrics(raw.metrics, faceBox) : [];
  // Chỉ số kém + đủ tin cậy cũng là "concern" để gợi ý thành phần/sản phẩm nhất quán với điểm số.
  const candidateConcerns = [...(Array.isArray(raw.concerns) ? raw.concerns : []), ...concernsFromMetrics(metrics)].map(normalizeConcern).filter(Boolean);
  // Giữ duy nhất nhận xét có điểm cao nhất theo mỗi key, tránh hiển thị trùng.
  const strongest = [...new Map(candidateConcerns.sort((a, b) => a.confidence - b.confidence).map((c) => [c.key, c])).values()];
  const concerns = strongest.filter((item) => item.confidence >= 0.5);
  // Chỉ phản ánh dấu hiệu AI đã THẬT SỰ nêu, không tự thêm nhãn mụn.
  // Không bỏ qua dấu hiệu dưới ngưỡng 0.35 nếu Gemini thực sự đưa bằng chứng quan sát.
  // Chỉ hiển thị ở nhóm 'chưa chắc chắn'; KHÔNG dùng để chọn mỹ phẩm điều trị.
  const possibleConcerns = strongest.filter((item) => item.confidence > 0 && item.confidence < 0.5 && item.evidence);
  const ingredients = Array.isArray(raw.recommendedIngredients) ? [...new Set(raw.recommendedIngredients.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))].slice(0, 10) : [];
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 10) : [];
  if (!imageQuality.faceDetected) warnings.unshift("Không thấy rõ khuôn mặt trong ảnh. Hãy chụp chính diện, đủ sáng, để lộ trán, hai má và cằm.");
  if (skinType === "unknown" && !warnings.length) warnings.push("Chưa đủ độ tin cậy để xác định loại da từ ảnh này.");
  return { skinType, skinTypeLabel: SKIN_TYPE_LABELS[skinType], confidence: skinConfidence, concerns, possibleConcerns, recommendedIngredients: ingredients, warnings, metrics, overallScore: overallScore(metrics), focusOptions: focusOptions(metrics), faceBox, imageQuality, summary: typeof raw.summary === "string" ? raw.summary.trim().slice(0, 400) : "", analysisSource: typeof raw.analysisSource === "string" && raw.analysisSource.trim() ? raw.analysisSource.trim() : "unknown" };
};

module.exports = { normalizeSkinAnalysis, normalizeConcernKey, SKIN_TYPE_LABELS, CONCERN_LABELS };
