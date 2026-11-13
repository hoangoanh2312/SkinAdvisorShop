const { analyzeWithGeminiVision } = require("./providers/geminiVisionProvider");
const { normalizeSkinAnalysis } = require("./skinAnalysisNormalizer");
const { recommendProducts, buildRoutine } = require("./recommendationService");
const { getIngredientGuidance } = require("./ingredientGuidanceService");

let providerOverride = null;
const analyzeSkin = async (image) => {
  const raw = providerOverride ? await providerOverride(image) : await analyzeWithGeminiVision(image);
  const analysis = normalizeSkinAnalysis(raw);
  Object.assign(analysis, getIngredientGuidance(analysis));
  const recommendations = await recommendProducts(analysis);
  return {
    analysis,
    recommendations,
    routine: buildRoutine(recommendations, analysis),
    disclaimer: "Kết quả chỉ mang tính tham khảo cho mục đích chăm sóc mỹ phẩm, không thay thế tư vấn y khoa.",
  };
};
const setSkinAnalysisProviderForTests = (provider) => { providerOverride = provider; };

module.exports = { analyzeSkin, setSkinAnalysisProviderForTests };
