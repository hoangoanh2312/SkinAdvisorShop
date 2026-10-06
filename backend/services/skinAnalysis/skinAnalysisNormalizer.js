const SKIN_TYPE_LABELS = { oily: "Da dầu", dry: "Da khô", normal: "Da thường", combination: "Da hỗn hợp", unknown: "Chưa xác định" };
const CONCERN_LABELS = { acne: "Mụn", pigmentation: "Thâm sạm", redness: "Đỏ da", large_pores: "Lỗ chân lông to", dullness: "Da xỉn màu", dehydration: "Da thiếu ẩm" };
const ALLOWED_SKIN_TYPES = new Set(Object.keys(SKIN_TYPE_LABELS).filter((key) => key !== "unknown"));
const ALLOWED_CONCERNS = new Set(Object.keys(CONCERN_LABELS));
const confidence = (value) => typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;

const normalizeSkinAnalysis = (raw = {}) => {
  const skinConfidence = confidence(raw.confidence);
  const skinType = ALLOWED_SKIN_TYPES.has(raw.skinType) && skinConfidence >= 0.55 ? raw.skinType : "unknown";
  const concerns = Array.isArray(raw.concerns) ? raw.concerns.filter((item) => item && ALLOWED_CONCERNS.has(item.key))
    .map((item) => ({ key: item.key, label: CONCERN_LABELS[item.key], confidence: confidence(item.confidence) }))
    .filter((item) => item.confidence >= 0.5) : [];
  const ingredients = Array.isArray(raw.recommendedIngredients) ? [...new Set(raw.recommendedIngredients.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))].slice(0, 10) : [];
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 10) : [];
  if (skinType === "unknown" && !warnings.length) warnings.push("Chưa đủ độ tin cậy để xác định loại da từ ảnh này.");
  return { skinType, skinTypeLabel: SKIN_TYPE_LABELS[skinType], confidence: skinConfidence, concerns, recommendedIngredients: ingredients, warnings, analysisSource: typeof raw.analysisSource === "string" && raw.analysisSource.trim() ? raw.analysisSource.trim() : "unknown" };
};

module.exports = { normalizeSkinAnalysis, SKIN_TYPE_LABELS, CONCERN_LABELS };
