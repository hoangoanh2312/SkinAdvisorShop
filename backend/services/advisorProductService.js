const Product = require("../models/Product");
const Variant = require("../models/Variant");

const normalize = (value = "") => value.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const uniqueStrings = (values = []) => [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];

const mergeSkinProfile = (stored = {}, provided = {}) => ({
  skinType: stored.skinType || provided.skinType || undefined,
  skinConcerns: uniqueStrings([...(stored.skinConcerns || []), ...(provided.skinConcerns || [])]),
  allergies: uniqueStrings([...(stored.allergies || []), ...(provided.allergies || [])]),
  avoidIngredients: uniqueStrings([...(stored.avoidIngredients || []), ...(provided.avoidIngredients || [])]),
});

const getCandidateProducts = async (skinProfile) => {
  const preferences = [skinProfile.skinType, ...(skinProfile.skinConcerns || [])].filter(Boolean);
  const ingredientPreferences = [...(skinProfile.allergies || []), ...(skinProfile.avoidIngredients || [])];
  let products = await Product.find({ isActive: true })
    .sort({ averageRating: -1, soldCount: -1, createdAt: -1 })
    .limit(30)
    .lean();
  const avoid = new Set(ingredientPreferences.map(normalize));
  const profileTags = new Set(preferences.map(normalize));
  products = products.filter((product) => {
    const ingredients = product.ingredients || [];
    if (ingredients.some((item) => avoid.has(normalize(item.normalizedName || item.name)))) return false;
    if ((product.avoidFor || []).some((item) => profileTags.has(normalize(item)))) return false;
    if (skinProfile.skinType === "sensitive" && ingredients.some((item) => item.isPotentialIrritant)) return false;
    return true;
  }).map((product) => ({
    product,
    score:
      (skinProfile.skinType && product.skinTypes?.includes(skinProfile.skinType) ? 3 : 0) +
      (product.skinConcerns || []).filter((concern) => skinProfile.skinConcerns?.includes(concern)).length * 2,
  })).sort((left, right) => right.score - left.score).slice(0, 10).map(({ product }) => product);

  const variants = await Variant.find({ product: { $in: products.map((product) => product._id) }, isActive: true }).sort({ price: 1 }).lean();
  return products.map((product) => ({
    _id: product._id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    images: product.images,
    shortDescription: product.shortDescription,
    skinTypes: product.skinTypes,
    skinConcerns: product.skinConcerns,
    ingredients: (product.ingredients || []).map((item) => ({ name: item.name, normalizedName: item.normalizedName, benefits: item.benefits, isPotentialIrritant: item.isPotentialIrritant })),
    keyIngredients: product.keyIngredients,
    avoidFor: product.avoidFor,
    usage: product.usage,
    warnings: product.warnings,
    basePrice: product.basePrice,
    salePrice: product.salePrice,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    variants: variants.filter((variant) => String(variant.product) === String(product._id)).map((variant) => ({ _id: variant._id, name: variant.name, size: variant.size, unit: variant.unit, price: variant.price, salePrice: variant.salePrice, stock: variant.stock, image: variant.image })),
  }));
};

const mapRecommendations = (ids, candidates) => {
  const allowed = new Map(candidates.map((product) => [String(product._id), product]));
  return [...new Set(ids)].filter((id) => allowed.has(String(id))).map((id) => {
    const product = allowed.get(String(id));
    const availableVariants = product.variants.filter((variant) => variant.stock > 0);
    const lowest = availableVariants[0] || product.variants[0];
    const image = lowest?.image || product.images?.[0] || "";
    return {
      id: String(product._id),
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      image,
      images: image ? [image] : [],
      rating: product.averageRating,
      reviewCount: product.reviewCount,
      price: lowest?.price ?? product.basePrice ?? null,
      salePrice: lowest?.salePrice ?? product.salePrice ?? lowest?.price ?? product.basePrice ?? null,
      variants: product.variants,
    };
  });
};

module.exports = { mergeSkinProfile, getCandidateProducts, mapRecommendations, normalize };
