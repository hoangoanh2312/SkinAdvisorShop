"use strict";
const assert = require("node:assert/strict");
const { csvParse, csvStringify, validateImport } = require("../utils/storefrontGoLive");
const product = { _id: "p1", slug: "cerave-cleanser", name: 'Sữa rửa mặt "Dưỡng ẩm"', basePrice: 345000,
  isActive: false, images: ["https://res.cloudinary.com/image.jpg"] };
const variant = { _id: "v1", sku: "CERAVE-CLEANSER-355ML", size: "355", unit: "ml", price: 345000, stock: 0, isActive: false };
const productMap = new Map([["p1", product]]);
const variantMap = new Map([[variant.sku, { product, variant }]]);
const row = { sku: variant.sku, slug: product.slug, ten_san_pham: product.name, dung_tich: "355ml",
  gia_hien_tai_vnd: "345000", so_luong_thuc_te: "", xac_nhan_mo_ban: "" };
const parsed = csvParse(csvStringify([row]));
assert.deepEqual(parsed, [row]);
let result = validateImport(parsed, productMap, variantMap);
assert.equal(result.planned.length, 0);
assert.equal(result.skipped.length, 1);
let approved = { ...row, so_luong_thuc_te: "3", xac_nhan_mo_ban: "MO_BAN" };
result = validateImport([approved], productMap, variantMap);
assert.equal(result.planned.length, 1);
assert.deepEqual(result.errors, []);
for (const qty of ["0", "-2", "2.5", "abc", "1000001", "", "01"]) {
  result = validateImport([{ ...approved, so_luong_thuc_te: qty }], productMap, variantMap);
  assert.equal(result.planned.length, 0);
  assert.equal(result.errors.length, 1);
}
assert.equal(validateImport([{ ...approved, gia_hien_tai_vnd: "1" }], productMap, variantMap).errors.length, 1);
assert.equal(validateImport([approved, approved], productMap, variantMap).errors.length, 1);
assert.equal(validateImport([{ ...approved, xac_nhan_mo_ban: "YES" }], productMap, variantMap).errors.length, 1);
assert.equal(validateImport([approved], productMap, new Map()).errors.length, 1);
assert.equal(validateImport([approved], new Map(), variantMap).errors.length, 1);
assert.equal(validateImport([approved], productMap, new Map([[variant.sku, {product: {...product, isActive: true}, variant}]])).errors.length, 1);
assert.equal(validateImport([approved], productMap, new Map([[variant.sku, {product, variant: {...variant, stock: 5}}]])).errors.length, 1);
assert.equal(validateImport([approved], productMap, new Map([[variant.sku, {product: {...product, images: []}, variant}]])).errors.length, 1);
assert.throws(() => csvParse('sku,name\nfoo,bar'), /CSV_HEADERS_INVALID/);
console.log("SKINORA_REAL_SHOP_OFFLINE_PASS: opt-in stock, exact SKU/price/size, no publish without valid real quantity, idempotent guard");
