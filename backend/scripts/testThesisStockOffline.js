"use strict";
const assert = require("node:assert/strict");
const { buildThesisInventoryPlan } = require("../utils/thesisInventoryPlan");
const prod = (id, price, images = ["https://example.test/item.jpg"], isActive = false) =>
  ({ _id: id, name: id, basePrice: price, images, isActive, isCatalogVisible: true });
const variant = (id, product, price, stock = 0, isActive = false) =>
  ({ _id: id, product, sku: id, price, stock, isActive });
const products = [prod("p1", 339000), prod("p2", 0), prod("p3", 50000, []), prod("p4", 100000, undefined, true), prod("p5", 70000)];
// Default args do not override the image array, which is correct for p4.
const variants = [variant("SKU1", "p1", 339000), variant("SKU2", "p2", 0), variant("SKU3", "p3", 50000),
  variant("SKU4", "p4", 100000, 8, true), variant("SKU5", "p5", 70000, 5)];
const plan = buildThesisInventoryPlan(products, variants, 10);
assert.equal(plan.eligible.length, 1);
assert.equal(plan.eligible[0].sku, "SKU1");
assert.equal(plan.eligible[0].afterStock, 10);
assert.equal(plan.skipped.length, 3);
assert.deepEqual(plan.alreadyEnabled, ["SKU4"]);
assert(plan.skipped.some(row => row.sku === "SKU2" && row.reason === "PRICE_MISSING_OR_MISMATCH"));
assert(plan.skipped.some(row => row.sku === "SKU5" && row.reason === "EXISTING_STOCK_NOT_TOUCHED"));
assert.throws(() => buildThesisInventoryPlan(products, variants, 0), /INVALID_THESIS_STOCK_QUANTITY/);
assert.throws(() => buildThesisInventoryPlan(products, variants, 10000), /INVALID_THESIS_STOCK_QUANTITY/);
assert.equal(buildThesisInventoryPlan([prod("x", 120000)], [variant("Y", "x", 100000)]).eligible.length, 0);
console.log("SKINORA_THESIS_STOCK_OFFLINE_PASS: priced-only, stock guard, image guard, no duplicate, no overwrite");
