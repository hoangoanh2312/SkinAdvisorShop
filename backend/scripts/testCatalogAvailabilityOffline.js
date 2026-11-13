const assert = require("node:assert/strict");
const { summarizeCatalogVariants } = require("../utils/catalogAvailability");

assert.deepEqual(summarizeCatalogVariants([]), {
  inStock: false, availableStock: 0, availableVariantCount: 0,
  catalogPrice: null, catalogSalePrice: null,
});
const stock = summarizeCatalogVariants([
  { isActive: true, price: 350000, salePrice: 300000, stock: 3 },
  { isActive: true, price: 250000, salePrice: null, stock: 5 },
  { isActive: true, price: 100000, salePrice: null, stock: 0 },
  { isActive: false, price: 50000, salePrice: 20000, stock: 7 },
]);
assert.deepEqual(stock, {
  inStock: true, availableStock: 8, availableVariantCount: 2,
  catalogPrice: 250000, catalogSalePrice: 250000,
});
assert.equal(summarizeCatalogVariants([{ price: 200000, salePrice: 100000, stock: 1 }]).catalogSalePrice, 100000);
assert.equal(summarizeCatalogVariants([{ price: 200000, salePrice: 500000, stock: 1 }]).catalogSalePrice, 200000);
assert.equal(summarizeCatalogVariants([{ price: 0, stock: 0 }]).inStock, false);
assert.equal(summarizeCatalogVariants([{ isActive: true, price: 0, stock: 5 }]).inStock, false);
assert.deepEqual(summarizeCatalogVariants([{ isActive: true, price: 470000, stock: 0 }]), {
  inStock: false, availableStock: 0, availableVariantCount: 0,
  catalogPrice: 470000, catalogSalePrice: 470000,
});
assert.equal(summarizeCatalogVariants([{ isActive: false, price: 100000, stock: 5 }]).inStock, false);
assert.deepEqual(summarizeCatalogVariants([{ isActive: false, price: 339000, stock: 0 }], { previewOnly: true }), {
  inStock: false, availableStock: 0, availableVariantCount: 0,
  catalogPrice: 339000, catalogSalePrice: 339000,
});
assert.deepEqual(summarizeCatalogVariants([{ isActive: false, price: 0, stock: 12 }], { previewOnly: true }), {
  inStock: false, availableStock: 0, availableVariantCount: 0,
  catalogPrice: null, catalogSalePrice: null,
});
// Even a draft SKU with positive stock must not appear buyable on a preview-only product.
assert.equal(summarizeCatalogVariants([{ isActive: true, price: 200000, stock: 5 }], { previewOnly: true }).inStock, false);
console.log("Catalog availability & sellable variant pricing: PASS");
