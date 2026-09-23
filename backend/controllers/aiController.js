const { generateAdvisorResponse, AiServiceError } = require("../services/aiService");
const {
  mergeSkinProfile,
  getCandidateProducts,
  mapRecommendations,
} = require("../services/advisorProductService");

const SKIN_TYPES = new Set(["normal", "dry", "oily", "combination", "sensitive"]);
const SKIN_CONCERNS = new Set([
  "acne", "dryness", "sensitivity", "aging", "pigmentation", "pores", "dullness", "oiliness",
]);
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_ITEMS = 12;
const MAX_PROFILE_ITEMS = 20;

const cleanStringArray = (value, allowedValues) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PROFILE_ITEMS) return null;
  const cleaned = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim() || item.trim().length > 100) return null;
    const normalized = item.trim();
    if (allowedValues && !allowedValues.has(normalized)) return null;
    cleaned.push(normalized);
  }
  return cleaned;
};

const validateHistory = (history) => {
  if (history === undefined) return [];
  if (!Array.isArray(history) || history.length > MAX_HISTORY_ITEMS) return null;
  const cleaned = [];
  for (const item of history) {
    if (!item || typeof item !== "object" || !["user", "assistant"].includes(item.role)) return null;
    if (typeof item.content !== "string" || !item.content.trim() || item.content.trim().length > MAX_MESSAGE_LENGTH) return null;
    cleaned.push({ role: item.role, content: item.content.trim() });
  }
  return cleaned;
};

const validateSkinProfile = (profile) => {
  if (profile === undefined) return {};
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  if (profile.skinType !== undefined && !SKIN_TYPES.has(profile.skinType)) return null;
  const skinConcerns = cleanStringArray(profile.skinConcerns, SKIN_CONCERNS);
  const allergies = cleanStringArray(profile.allergies);
  const avoidIngredients = cleanStringArray(profile.avoidIngredients);
  if (!skinConcerns || !allergies || !avoidIngredients) return null;
  return { skinType: profile.skinType, skinConcerns, allergies, avoidIngredients };
};

const advise = async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ success: false, message: "Tin nhắn phải có từ 1 đến 2000 ký tự" });
  }

  const history = validateHistory(req.body.history);
  if (!history) {
    return res.status(400).json({ success: false, message: "Lịch sử trò chuyện không hợp lệ" });
  }

  const providedProfile = validateSkinProfile(req.body.skinProfile);
  if (!providedProfile) {
    return res.status(400).json({ success: false, message: "Thông tin làn da không hợp lệ" });
  }

  try {
    const skinProfile = mergeSkinProfile(req.user.skinProfile?.toObject?.() || req.user.skinProfile || {}, providedProfile);
    const candidates = await getCandidateProducts(skinProfile);
    const result = await generateAdvisorResponse({
      messages: [...history, { role: "user", content: message }],
      skinProfile,
      products: candidates,
    });

    return res.status(200).json({
      success: true,
      data: {
        reply: result.reply,
        warnings: result.warnings,
        recommendations: mapRecommendations(result.recommendedProductIds, candidates),
      },
    });
  } catch (error) {
    if (error instanceof AiServiceError) {
      if (error.code === "AI_NOT_CONFIGURED") {
        return res.status(503).json({ success: false, message: "Trợ lý AI chưa được cấu hình. Vui lòng thử lại sau." });
      }
      const status = ["AI_RATE_LIMITED", "AI_QUOTA_EXCEEDED"].includes(error.code) ? 429 : 503;
      return res.status(status).json({ success: false, message: "Trợ lý tư vấn đang tạm thời bận. Vui lòng thử lại sau." });
    }
    console.error(`AI advisor request failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Không thể xử lý yêu cầu tư vấn lúc này" });
  }
};

module.exports = { advise, validateHistory, validateSkinProfile, MAX_MESSAGE_LENGTH, MAX_HISTORY_ITEMS };
