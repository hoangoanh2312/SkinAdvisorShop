const Product = require("../../models/Product");
const Variant = require("../../models/Variant");

const mongoose = require("mongoose");
const Category = require("../../models/Category");
const { METRICS } = require("./skinMetrics");

// Category slugs help place products in routine steps; without a DB connection (offline tests) names are used.
const loadCategorySlugs = async (products) => {
  const ids = [...new Set(products.map((product) => product.category).filter(Boolean).map(String))];
  if (!ids.length || mongoose.connection.readyState !== 1) return new Map();
  try {
    const categories = await Category.find({ _id: { $in: ids } }).select("slug").lean();
    return new Map(categories.map((category) => [String(category._id), category.slug]));
  } catch { return new Map(); }
};

const concernMap = { acne: "acne", pigmentation: "pigmentation", redness: "sensitivity", large_pores: "pores", dullness: "dullness", dehydration: "dryness" };
const normalize = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

// Mọi sản phẩm ĐANG BÁN (active, còn hàng, giá > 0) kèm điểm phù hợp; dùng cho cả gợi ý và chu trình 4 bước.
const scoreSellableProducts = async (analysis) => {
  const variants = await Variant.find({ isActive: true, stock: { $gt: 0 }, price: { $gt: 0 } }).sort({ salePrice: 1, price: 1 }).lean();
  const productIds = [...new Set(variants.map((variant) => String(variant.product)))];
  if (productIds.length === 0) return [];
  const products = await Product.find({ _id: { $in: productIds }, isActive: true }).lean();
  const categorySlugs = await loadCategorySlugs(products);
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
    return { product: { id: String(product._id), slug: product.slug, name: product.name, brand: product.brand, image: selected?.image || product.images?.[0] || "", images: product.images || [], isActive: product.isActive === true, rating: product.averageRating, reviewCount: product.reviewCount, price: selected?.price ?? product.basePrice, salePrice: selected?.salePrice ?? product.salePrice ?? selected?.price ?? product.basePrice, variants: available }, score, reasons,
      categorySlug: categorySlugs.get(String(product.category)) || "", skinConcerns: product.skinConcerns || [], skinTypes: product.skinTypes || [], ingredientNames: productIngredients.map(normalize) };
  });
};

const recommendProducts = async (analysis) => (await scoreSellableProducts(analysis))
  .filter((item) => item.score > 0).sort((left, right) => right.score - left.score).slice(0, 6)
  .map(({ product, score, reasons }) => ({ product, score, reasons }));

const buildRoutine = (recommendations, analysis = {}) => {
  const concerns = new Set((analysis.concerns || []).map(({ key }) => key));
  const isSensitive = concerns.has("redness") || analysis.skinType === "dry";
  const needsHydration = concerns.has("dehydration") || isSensitive;
  const serum = recommendations.find((item) => /serum|treatment|tinh chất|ampoule/i.test(item.product.name));
  const product = serum ? serum.product : null;
  const care = isSensitive ? {
    step: "treatment", label: "Ưu tiên phục hồi hàng rào da",
    description: "Chọn sản phẩm dưỡng ẩm, công thức dịu nhẹ; tránh sử dụng nhiều hoạt chất mới cùng lúc", product,
  } : concerns.has("acne") || concerns.has("large_pores") ? {
    step: "treatment", label: "Chăm sóc bề mặt da từ từ",
    description: "Ưu tiên dưỡng ẩm; nếu thêm hoạt chất mới, dùng từng loại và theo dõi kích ứng", product,
  } : {
    step: "treatment", label: "Tinh chất theo nhu cầu",
    description: "Ưu tiên sản phẩm phù hợp loại da và khả năng dung nạp; không bắt buộc dùng tinh chất", product,
  };
  return {
    morning: [
      { step: "cleanser", label: "Làm sạch dịu nhẹ", description: "Rửa mặt nhẹ nhàng, tránh chà xát hoặc làm sạch quá mức" },
      { step: "serum", label: needsHydration ? "Tinh chất bổ sung độ ẩm" : "Tinh chất phù hợp (không bắt buộc)", description: needsHydration ? "Ưu tiên thành phần giữ ẩm như Glycerin hoặc Panthenol, tùy khả năng dung nạp" : "Chỉ thêm khi có nhu cầu cụ thể và thử lần lượt từng sản phẩm", product },
      { step: "moisturizer", label: "Dưỡng ẩm", description: needsHydration ? "Ưu tiên kem dưỡng giúp hỗ trợ hàng rào da" : "Chọn kết cấu phù hợp cảm giác trên da" },
      { step: "sunscreen", label: "Chống nắng ban ngày", description: "Chọn sản phẩm chống nắng phổ rộng SPF 30+ phù hợp, dùng theo hướng dẫn trên bao bì" },
    ],
    evening: [
      { step: "cleanser", label: "Làm sạch", description: "Làm sạch nhẹ nhàng và tẩy trang khi cần" },
      care,
      { step: "moisturizer", label: "Dưỡng ẩm", description: "Chọn sản phẩm dưỡng ẩm phù hợp; giảm tần suất nếu có kích ứng" },
    ],
  };
};

// ---- Chu trình 4 bước (kiểu SkinCam), chỉ dùng sản phẩm đang bán ----
const STEPS = [
  { step: "cleanse", label: "Làm sạch", purpose: "Loại bỏ bụi bẩn, dầu thừa và lớp trang điểm", when: "Sáng & tối",
    categories: ["sua-rua-mat", "tay-trang"], pattern: /cleans|wash|foam|micellar|moussant|h2o|nettoyant|rửa mặt|sữa rửa|tẩy trang|cleanser/i },
  { step: "treat", label: "Đặc trị", purpose: "Tinh chất/toner nhắm vào vấn đề cần chú ý", when: "Ưu tiên buổi tối",
    categories: ["serum-tinh-chat", "tay-te-bao-chet", "toner-nuoc-can-bang", "cham-soc-phuc-hoi"], pattern: /serum|essence|ampoule|toner|liquid|exfoliant|treatment|tinh chất|spot|peel|solution/i },
  { step: "moisturize", label: "Dưỡng ẩm", purpose: "Giữ ẩm và hỗ trợ hàng rào bảo vệ da", when: "Sáng & tối",
    categories: ["kem-duong"], pattern: /cream|moistur|lotion|emulsion|balm|gel-cream|kem dưỡng|dưỡng ẩm/i },
  { step: "protect", label: "Chống nắng", purpose: "Bảo vệ da khỏi tia UV — bước quan trọng nhất ban ngày", when: "Buổi sáng",
    categories: ["kem-chong-nang"], pattern: /sunscreen|sun |sunblock|spf|uv |chống nắng|anessa/i },
];
const FOCUS_INGREDIENTS = {
  acne: ["salicylic acid", "bha", "betaine salicylate", "niacinamide", "azelaic acid", "zinc pca"],
  pores: ["niacinamide", "bha", "salicylic acid", "betaine salicylate", "zinc pca"],
  pigmentation: ["niacinamide", "tranexamic acid", "azelaic acid", "vitamin c", "aha", "glycolic acid"],
  texture: ["aha", "glycolic acid", "retinol", "niacinamide", "hyaluronic acid"],
  redness: ["centella asiatica", "panthenol", "ceramide", "ceramides"],
  oiliness: ["niacinamide", "zinc pca", "bha", "salicylic acid"],
  overall: ["hyaluronic acid", "ceramide", "ceramides", "panthenol", "niacinamide"],
};
const STRONG_ACTIVES = ["retinol", "aha", "glycolic acid", "bha", "salicylic acid"];
const stepOf = (item) => {
  const bySlug = STEPS.find((step) => step.categories.includes(item.categorySlug));
  if (bySlug) return bySlug.step;
  const name = item.product.name || "";
  return (STEPS.find((step) => step.step === "protect" && step.pattern.test(name)) || STEPS.find((step) => step.pattern.test(name)))?.step || null;
};

/** Pure: candidates = output of scoreSellableProducts. Returns { focusOptions, plans: { [focus]: steps[] } }. */
const buildStepRoutines = (candidates, analysis = {}) => {
  const metrics = analysis.metrics || [];
  const sensitive = metrics.some((m) => m.key === "redness" && m.status === "assessed" && m.score <= 5)
    || (analysis.concerns || []).some((c) => c.key === "redness") || analysis.selfSkinType === "sensitive";
  const options = [...(analysis.focusOptions || []), { key: "overall", label: "Chăm sóc tổng quát", score: analysis.overallScore ?? null }];
  const plans = {};
  for (const option of options) {
    const productConcerns = option.key === "overall" ? [] : METRICS[option.key]?.productConcerns || [];
    const wanted = new Set(FOCUS_INGREDIENTS[option.key] || []);
    plans[option.key] = STEPS.map((step) => {
      const products = candidates.filter((item) => stepOf(item) === step.step).map((item) => {
        let score = item.score; const reasons = [...item.reasons];
        const concernHit = item.skinConcerns.filter((c) => productConcerns.includes(c));
        if (concernHit.length) { score += 35; reasons.unshift(`Hướng tới: ${option.label.toLowerCase()}`); }
        const ingredientHit = item.ingredientNames.find((name) => wanted.has(name));
        if (ingredientHit) { score += 25; reasons.push(`Có ${ingredientHit}`); }
        const strong = item.ingredientNames.find((name) => STRONG_ACTIVES.includes(name));
        if (sensitive && strong) { score -= 40; reasons.push(`Chứa ${strong} — da đang đỏ/nhạy cảm nên thử từ từ`); }
        return { product: item.product, score, reasons: [...new Set(reasons)].slice(0, 3) };
      }).sort((a, b) => b.score - a.score).slice(0, 3);
      return { step: step.step, label: step.label, purpose: step.purpose, when: step.when, products };
    });
  }
  return { focusOptions: options, defaultFocus: options[0].key, plans, sensitive };
};

module.exports = { recommendProducts, scoreSellableProducts, buildRoutine, buildStepRoutines, concernMap, STEPS };
