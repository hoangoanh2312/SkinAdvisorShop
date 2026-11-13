// Gợi ý thành phần mỹ phẩm tham khảo, không phải kết luận y khoa từ ảnh.
// Chỉ dùng với loại da / đặc điểm đã vượt ngưỡng tin cậy của normalizer.
const INGREDIENTS = {
  "Glycerin": "Chất hút ẩm, hỗ trợ duy trì độ ẩm cho da.",
  "Panthenol": "Thành phần dưỡng ẩm, thường được dùng trong sản phẩm chăm sóc dịu nhẹ.",
  "Ceramide": "Hỗ trợ hàng rào bảo vệ da trong quy trình dưỡng ẩm.",
  "Hyaluronic Acid": "Chất hút ẩm, phù hợp với mục tiêu bổ sung độ ẩm.",
  "Niacinamide": "Có thể hỗ trợ chăm sóc da không đều màu và bề mặt da; nên chọn nồng độ phù hợp.",
  "Centella Asiatica": "Thành phần thường dùng trong sản phẩm chăm sóc da dịu nhẹ.",
  "Squalane": "Thành phần làm mềm và hỗ trợ hạn chế mất nước trên da.",
};
const KEYED = {
  redness: ["Panthenol", "Ceramide", "Glycerin"],
  dehydration: ["Glycerin", "Hyaluronic Acid", "Ceramide"],
  large_pores: ["Niacinamide", "Glycerin"],
  pigmentation: ["Niacinamide", "Glycerin"],
  acne: ["Niacinamide", "Glycerin"],
  dullness: ["Glycerin", "Niacinamide"],
};
const SKIN_TYPE = {
  dry: ["Glycerin", "Ceramide", "Squalane"],
  oily: ["Glycerin", "Niacinamide"],
  combination: ["Glycerin", "Niacinamide"],
  normal: ["Glycerin"],
};
const ALIASES = { "hyaluronic acid": "Hyaluronic Acid", "sodium hyaluronate": "Hyaluronic Acid", "niacinamide": "Niacinamide", "vitamin b3": "Niacinamide", "panthenol": "Panthenol", "provitamin b5": "Panthenol", "glycerin": "Glycerin", "glycerol": "Glycerin", "ceramide": "Ceramide", "ceramides": "Ceramide", "squalane": "Squalane", "centella asiatica": "Centella Asiatica", "cica": "Centella Asiatica" };

const getIngredientGuidance = (analysis) => {
  // Không tự suy luận loại da hoặc thành phần cụ thể khi ảnh không đủ chắc chắn.
  const validConcerns = (analysis.concerns || []).filter((item) => item.confidence >= 0.5 && KEYED[item.key]);
  if (analysis.skinType === "unknown" && !validConcerns.length) {
    return { recommendedIngredients: [], ingredientGuidance: [], ingredientSuggestionSource: "insufficient_evidence" };
  }
  const options = [];
  const add = (name) => { if (INGREDIENTS[name] && !options.includes(name)) options.push(name); };
  // Ưu tiên làm dịu trước khi xét nhóm hỗ trợ bề mặt da.
  validConcerns.sort((a, b) => (a.key === "redness" ? -1 : b.key === "redness" ? 1 : b.confidence - a.confidence));
  validConcerns.forEach(({key}) => KEYED[key].forEach(add));
  (SKIN_TYPE[analysis.skinType] || []).forEach(add);
  const eligible = new Set(options);
  const fromGemini = (analysis.recommendedIngredients || []).map((value) => ALIASES[value.trim().toLowerCase()]).filter((name) => name && eligible.has(name));
  const final = [...new Set([...fromGemini, ...options])].slice(0, 5);
  return {
    recommendedIngredients: final,
    ingredientGuidance: final.map((name) => ({ name, reason: INGREDIENTS[name] })),
    ingredientSuggestionSource: fromGemini.length ? "gemini_vision_reviewed" : "reference_rules",
  };
};
module.exports = { getIngredientGuidance };
