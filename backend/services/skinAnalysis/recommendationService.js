const Product = require("../../models/Product");
const Variant = require("../../models/Variant");

const concernMap = { acne: "acne", pigmentation: "pigmentation", redness: "sensitivity", large_pores: "pores", dullness: "dullness", dehydration: "dryness" };
const normalize = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const recommendProducts = async (analysis) => {
  const variants = await Variant.find({ isActive: true, stock: { $gt: 0 }, price: { $gt: 0 } }).sort({ salePrice: 1, price: 1 }).lean();
  const productIds = [...new Set(variants.map((variant) => String(variant.product)))];
  if (productIds.length === 0) return [];
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

const buildRoutine = (recommendations, analysis = {}) => {
  const concerns = new Set((analysis.concerns || []).map(({ key }) => key));
  const isSensitive = concerns.has("redness") || analysis.skinType === "dry";
  const needsHydration = concerns.has("dehydration") || isSensitive;
  const serum = recommendations.find((item) => /serum|treatment|tinh chất|ampoule/i.test(item.product.name));
  const product = serum ? serum.product : null;
  const care = isSensitive ? {
    step: "treatment", label: "Ưu tiên phục hồi hàng rào da",
    description: "Chọn sản phẩm dưỡng ẩm, công thức dịu nhẹ; tránh sử dụng nhiều hoạt chất mới cùng lúc.", product,
  } : concerns.has("acne") || concerns.has("large_pores") ? {
    step: "treatment", label: "Chăm sóc bề mặt da từ từ",
    description: "Ưu tiên dưỡng ẩm; nếu thêm hoạt chất mới, dùng từng loại và theo dõi kích ứng.", product,
  } : {
    step: "treatment", label: "Tinh chất theo nhu cầu",
    description: "Ưu tiên sản phẩm phù hợp loại da và khả năng dung nạp; không bắt buộc dùng tinh chất.", product,
  };
  return {
    morning: [
      { step: "cleanser", label: "Làm sạch dịu nhẹ", description: "Rửa mặt nhẹ nhàng, tránh chà xát hoặc làm sạch quá mức." },
      { step: "serum", label: needsHydration ? "Tinh chất bổ sung độ ẩm" : "Tinh chất phù hợp (không bắt buộc)", description: needsHydration ? "Ưu tiên thành phần giữ ẩm như Glycerin hoặc Panthenol, tùy khả năng dung nạp." : "Chỉ thêm khi có nhu cầu cụ thể và thử lần lượt từng sản phẩm.", product },
      { step: "moisturizer", label: "Dưỡng ẩm", description: needsHydration ? "Ưu tiên kem dưỡng giúp hỗ trợ hàng rào da." : "Chọn kết cấu phù hợp cảm giác trên da." },
      { step: "sunscreen", label: "Chống nắng ban ngày", description: "Chọn sản phẩm chống nắng phổ rộng SPF 30+ phù hợp, dùng theo hướng dẫn trên bao bì." },
    ],
    evening: [
      { step: "cleanser", label: "Làm sạch", description: "Làm sạch nhẹ nhàng và tẩy trang khi cần." },
      care,
      { step: "moisturizer", label: "Dưỡng ẩm", description: "Chọn sản phẩm dưỡng ẩm phù hợp; giảm tần suất nếu có kích ứng." },
    ],
  };
};

module.exports = { recommendProducts, buildRoutine, concernMap };
