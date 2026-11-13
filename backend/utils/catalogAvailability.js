/**
 * Build customer-facing inventory and price labels from the active variants.
 * Listing values are informational; checkout always rechecks stock and prices
 * inside its existing MongoDB transaction.
 */
const numericPrice = (value) => Number.isFinite(value) && value > 0 ? value : null;

function summarizeCatalogVariants(variants = [], { previewOnly = false } = {}) {
  const available = previewOnly ? [] : variants.filter((variant) =>
    variant.isActive !== false && Number.isFinite(variant.stock) && variant.stock > 0 && numericPrice(variant.price) !== null
  );
  // A product that sells out must remain visible with its real SKU price.
  // For an informational (unpublished) product, a disabled yet positively
  // priced SKU may supply the DISPLAY price. This does NOT unlock checkout.
  const priced = variants.filter((variant) =>
    (previewOnly || variant.isActive !== false) && numericPrice(variant.price) !== null
  );
  const sellable = (available.length ? available : priced).map((variant) => {
    const price = numericPrice(variant.price);
    const sale = numericPrice(variant.salePrice);
    return { price, salePrice: sale !== null && price !== null && sale <= price ? sale : price };
  }).filter((variant) => variant.price !== null);
  const cheapest = sellable.sort((a, b) => a.salePrice - b.salePrice)[0];
  return {
    availableStock: available.reduce((sum, variant) => sum + variant.stock, 0),
    availableVariantCount: available.length,
    inStock: available.length > 0,
    catalogPrice: cheapest?.price ?? null,
    catalogSalePrice: cheapest?.salePrice ?? null,
  };
}

module.exports = { summarizeCatalogVariants };
