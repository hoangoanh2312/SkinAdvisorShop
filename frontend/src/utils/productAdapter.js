// Ghi chú nội bộ lúc nhập dữ liệu (ví dụ "Bản nháp – chờ kiểm chứng giá...") không được hiện cho khách
const isInternalNote = (text) => /^\s*bản nháp\b|cần được người quản trị kiểm tra|người quản trị cần kiểm tra lại|nguồn tham khảo của thương hiệu/i.test(String(text || ""));
const sizeNumber = (variant) => {
  const match = /(\d+(?:[.,]\d+)?)/.exec(`${variant?.name || ""} ${variant?.size || ""}`);
  return match ? Number(match[1].replace(",", ".")) : Number.POSITIVE_INFINITY;
};
// Xếp các dung tích từ nhỏ đến lớn: 140ml, 310ml, 500ml
export const sortVariantsBySize = (variants = []) => [...variants].sort((a, b) => sizeNumber(a) - sizeNumber(b));
export const normalizeProduct = (product = {}, variants = product.variants || []) => ({
  ...product,
  shortDescription: isInternalNote(product.shortDescription) ? "" : (product.shortDescription || ""),
  description: isInternalNote(product.description) ? "" : (product.description || ""),
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
