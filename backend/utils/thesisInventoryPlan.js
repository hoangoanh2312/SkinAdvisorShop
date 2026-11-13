"use strict";

/**
 * SKINORA school-project stock allocation. This is SIMULATED inventory,
 * intentionally not verified commercial stock.
 * Pure planner for safe offline tests and predictable review before any write.
 */
function buildThesisInventoryPlan(products, variants, qty = 10) {
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 100) {
    throw new Error("INVALID_THESIS_STOCK_QUANTITY");
  }
  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const eligible = [], skipped = [], alreadyEnabled = [];
  const seenSkus = new Set();

  for (const variant of variants) {
    const sku = String(variant.sku || "").trim();
    const product = productsById.get(String(variant.product));
    let reason = "";
    if (!sku || seenSkus.has(sku)) reason = "SKU_MISSING_OR_DUPLICATE";
    else if (!product) reason = "PRODUCT_NOT_FOUND";
    else if (!(Number.isFinite(variant.price) && variant.price > 0 &&
      Number.isFinite(product.basePrice) && Number(product.basePrice) === Number(variant.price))) reason = "PRICE_MISSING_OR_MISMATCH";
    else if (!Array.isArray(product.images) || !product.images.some((url) => typeof url === "string" && /^https:\/\//i.test(url))) reason = "HTTPS_IMAGE_MISSING";
    else if (!Number.isSafeInteger(variant.stock) || variant.stock < 0) reason = "INVALID_EXISTING_STOCK";
    else if (variant.stock > 0 && product.isActive === true && variant.isActive === true) {
      alreadyEnabled.push(sku);
    } else if (variant.stock > 0) reason = "EXISTING_STOCK_NOT_TOUCHED";
    else {
      eligible.push({ sku, productId: String(product._id), variantId: String(variant._id),
        productName: product.name, currentPrice: variant.price, beforeStock: 0, afterStock: qty,
        oldProductActive: !!product.isActive, oldCatalogVisible: !!product.isCatalogVisible,
        oldVariantActive: !!variant.isActive });
    }
    seenSkus.add(sku);
    if (reason) skipped.push({ sku, reason });
  }
  return { eligible, skipped, alreadyEnabled };
}

module.exports = { buildThesisInventoryPlan };
