export const normalizeProduct = (product = {}, variants = product.variants || []) => ({
  ...product,
  id: product._id || product.id,
  categoryName: product.category?.name || "",
  // A public listing must not quote Product.basePrice when its SKU price is unverified.
  price: Object.hasOwn(product, "catalogPrice") ? product.catalogPrice : (product.basePrice ?? product.price ?? null),
  salePrice: Object.hasOwn(product, "catalogSalePrice") ? product.catalogSalePrice : (product.salePrice ?? product.basePrice ?? product.price ?? null),
  rating: product.averageRating ?? product.rating ?? 0,
  featured: product.isFeatured ?? product.featured ?? false,
  bestSeller: product.isBestSeller ?? product.bestSeller ?? false,
  images: product.images || [], ingredients: product.ingredients || [], skinTypes: product.skinTypes || [], skinConcerns: product.skinConcerns || [], warnings: product.warnings || [], variants,
});
export const variantDisplayPrice = (variant) => {
  const price = Number(variant?.price) || 0;
  const promo = Number(variant?.salePrice);
  return promo > 0 && promo <= price ? promo : price;
};
