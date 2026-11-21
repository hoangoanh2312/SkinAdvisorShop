const { analyzeWithGeminiVision } = require("./providers/geminiVisionProvider");
const { normalizeSkinAnalysis } = require("./skinAnalysisNormalizer");
const { scoreSellableProducts, buildRoutine, buildStepRoutines } = require("./recommendationService");
const { getIngredientGuidance } = require("./ingredientGuidanceService");
const { detectAcne } = require("./acneDetector");
const { fuseAcneDetection, buildGeminiHint } = require("./acneFusion");

let providerOverride = null;
// Mô hình YOLO chạy trước (nhanh, trên server) để Gemini diễn giải nhất quán với số nốt đếm được.
const runAcneDetector = async (buffer) => {
  try { return await detectAcne(buffer); } catch (error) {
    console.warn("[acne-detector] Lỗi khi suy luận, chỉ dùng Gemini:", error.message);
    return { available: false, reason: "inference_failed" };
  }
};

const analyzeSkin = async (image) => {
  const detection = await runAcneDetector(image.buffer);
  const request = { ...image, detectorHint: buildGeminiHint(detection) };
  const geminiRaw = providerOverride ? await providerOverride(request) : await analyzeWithGeminiVision(request);
  const { raw, acneDetection } = fuseAcneDetection(geminiRaw, detection);
  const analysis = normalizeSkinAnalysis(raw);
  analysis.acneDetection = acneDetection;
  analysis.userContext = { age: image.context?.age ?? null, selfSkinType: image.context?.selfSkinType || null };
  Object.assign(analysis, getIngredientGuidance(analysis));
  // One catalog read serves both the classic list and the 4-step routine.
  const candidates = await scoreSellableProducts(analysis);
  const recommendations = candidates.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 6)
    .map(({ product, score, reasons }) => ({ product, score, reasons }));
  return {
    analysis,
    recommendations,
    routine: buildRoutine(recommendations, analysis),
    stepRoutine: buildStepRoutines(candidates, { ...analysis, selfSkinType: analysis.userContext.selfSkinType }),
    disclaimer: "Kết quả chỉ mang tính tham khảo cho mục đích chăm sóc mỹ phẩm, không thay thế tư vấn y khoa.",
  };
};
const setSkinAnalysisProviderForTests = (provider) => { providerOverride = provider; };

module.exports = { analyzeSkin, setSkinAnalysisProviderForTests };
