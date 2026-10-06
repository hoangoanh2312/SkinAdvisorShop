const Product = require("../../models/Product");
const Variant = require("../../models/Variant");

const concernMap = { acne: "acne", pigmentation: "pigmentation", redness: "sensitivity", large_pores: "pores", dullness: "dullness", dehydration: "dryness" };
const normalize = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const recommendProducts = async (analysis) => {
  const variants = await Variant.find({ isActive: true, stock: { $gt: 0 } }).sort({ salePrice: 1, price: 1 }).lean();
  const productIds = [...new Set(variants.map((variant) => String(variant.product)))];
  const products = await Product.find({ _id: { $in: productIds }, isActive: true }).lean();
  const desiredConcerns = analysis.concerns.map((item) => concernMap[item.key]).filter(Boolean);
  const desiredIngredients = new Set(analysis.recommendedIngredients.map(normalize));
  return products.map((product) => {
    const reasons = []; let score = 0;
    if (analysis.skinType !== "unknown" && product.skinTypes?.includes(analysis.skinType)) { score += 40; reasons.push(`Phù hợp với ${analysis.skinTypeLabel.toLowerCase()}`); }
    const concernMatches = [...new Set((product.skinConcerns || []).filter((item) => desiredConcerns.includes(item)))];
    if (concernMatches.length) { score += Math.min(30, concernMatches.length * 15); reasons.push("Phù hợp với các nhu cầu chăm sóc da đã phân tích"); }
    const productIngredients = [...(product.keyIngredients || []), ...(product.ingredients || []).map((item) => item.name || item.normalizedName)].filter(Boolean);
    const ingredientMatches = productIngredients.filter((item) => desiredIngredients.has(normalize(item)));
    if (ingredientMatches.length) { score += 20; reasons.push(`Có ${ingredientMatches[0]}`); }
    score += Math.round(((product.averageRating || 0) / 5) * 10);
    const available = variants.filter((variant) => String(variant.product) === String(product._id));
    const selected = available[0];
    return { product: { id: String(product._id), slug: product.slug, name: product.name, brand: product.brand, image: selected?.image || product.images?.[0] || "", rating: product.averageRating, reviewCount: product.reviewCount, price: selected?.price ?? product.basePrice, salePrice: selected?.salePrice ?? product.salePrice ?? selected?.price ?? product.basePrice, variants: available }, score, reasons };
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score).slice(0, 6);
};

const buildRoutine = (recommendations) => {
  const serum = recommendations.find((item) => /serum|treatment/i.test(item.product.name));
  const product = serum ? serum.product : null;
  return {
    morning: [{ step: "cleanser", label: "Làm sạch dịu nhẹ" }, { step: "serum", label: "Tinh chất phù hợp", product }, { step: "moisturizer", label: "Dưỡng ẩm" }, { step: "sunscreen", label: "Chống nắng" }],
    evening: [{ step: "cleanser", label: "Làm sạch" }, { step: "treatment", label: "Chăm sóc mục tiêu", product }, { step: "moisturizer", label: "Dưỡng ẩm" }],
  };
};

module.exports = { recommendProducts, buildRoutine, concernMap };
