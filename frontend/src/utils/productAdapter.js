export const normalizeProduct = (product = {}, variants = product.variants || []) => ({
  ...product,
  id: product._id || product.id,
  categoryName: product.category?.name || "",
  price: product.basePrice ?? product.price ?? 0,
  salePrice: product.salePrice ?? product.basePrice ?? product.price ?? 0,
  rating: product.averageRating ?? product.rating ?? 0,
  featured: product.isFeatured ?? product.featured ?? false,
  bestSeller: product.isBestSeller ?? product.bestSeller ?? false,
  images: product.images || [], ingredients: product.ingredients || [], skinTypes: product.skinTypes || [], skinConcerns: product.skinConcerns || [], warnings: product.warnings || [], variants,
});
export const variantDisplayPrice = (variant) => variant?.salePrice ?? variant?.price ?? 0;
