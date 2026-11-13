// Prefer a variant that is actually available for purchase. A cheaper
// out-of-stock SKU must not be auto-selected ahead of an in-stock SKU.
export const selectPreferredVariant = (variants = [], currentId = null, productActive = true) => {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const eligible = (variant) => variant.isActive !== false &&
    Number(variant.price) > 0 && Number.isInteger(Number(variant.stock)) && Number(variant.stock) > 0;
  const retained = variants.find((variant) => variant._id === currentId);
  if (retained && (!productActive || eligible(retained))) return retained;
  return (productActive ? variants.find(eligible) : null) || retained || variants[0];
};
