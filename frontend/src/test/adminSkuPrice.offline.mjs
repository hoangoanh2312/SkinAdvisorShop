import assert from "node:assert/strict";
import { summarizeAdminSkuPrice as summary } from "../utils/adminProductSummary.js";

// Regression: price should remain visible to administrators even when SKU is disabled.
let result = summary([{ sku: "COCOON-310ML", price: 339000, stock: 0, isActive: false }]);
assert.match(result.main, /339\.000/);
assert.match(result.detail, /đang tắt/);
assert.doesNotMatch(result.main, /Chưa có giá/);

result = summary([{ price: 339000, isActive: true }]);
assert.match(result.main, /339\.000/);
assert.equal(result.detail, "Giá SKU");

result = summary([{ price: 0, isActive: false }, { price: 155000, isActive: true }]);
assert.match(result.main, /155\.000/);
assert.match(result.detail, /1\/2 SKU chưa có giá/);

result = summary([{ price: 0, isActive: false }]);
assert.equal(result.main, "Chưa có giá");
assert.equal(result.detail, "1/1 SKU chưa có giá");

result = summary([]);
assert.equal(result.main, "Chưa có giá");
assert.equal(result.detail, "Chưa có SKU");

result = summary([{ price: 250000, salePrice: 200000, isActive: false }]);
assert.match(result.main, /200\.000/);

result = summary([{ price: 120000, isActive: false }, { price: 190000, isActive: true }]);
assert.match(result.main, /Từ 120\.000/);
assert.equal(result.detail, "1 SKU có giá đang tắt");

console.log("SKINORA admin SKU price offline checks: 7/7 PASS");
