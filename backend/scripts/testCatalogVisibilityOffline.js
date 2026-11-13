const assert = require("node:assert/strict");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const {
  previewCatalogVisibility,
  bulkShowEligibleCatalog,
  setCatalogVisibility,
  completeProfile,
} = require("../controllers/catalogVisibilityController");

const ids = [
  "507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012",
  "507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014",
];
const product = (index, extras = {}) => ({
  _id: ids[index], name: `Sản phẩm ${index + 1}`, slug: `my-pham-${index + 1}`,
  brand: "Nhãn hiệu", category: ids[3], images: ["https://example.org/product.jpg"],
  isActive: false, isCatalogVisible: false, ...extras,
});
const candidates = [
  product(0), product(1),
  product(2, { images: [] }),
  product(3),
];
assert.equal(completeProfile(product(0)), true);
assert.equal(completeProfile(product(0, { images: [] })), false);
assert.equal(completeProfile(product(0, { images: ["javascript:alert(1)"] })), false);

const original = {
  find: Product.find,
  updateMany: Product.updateMany,
  findById: Product.findById,
  distinct: Variant.distinct,
  exists: Variant.exists,
};
const mockResponse = () => ({
  code: 200,
  body: null,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
});

let updates = 0;
let lastUpdate;
Product.find = () => ({ select: () => ({ lean: async () => candidates }) });
Variant.distinct = async (field, query) => {
  assert.equal(field, "product");
  assert.deepEqual(query.price, { $gt: 0 });
  assert.equal(Object.hasOwn(query, "isActive"), false, "Preview must allow disabled draft SKUs");
  return [ids[0], ids[1]]; // last candidate has no priced SKU
};
Product.updateMany = async (query, mutation) => {
  updates++;
  lastUpdate = { query, mutation };
  return { modifiedCount: query._id.$in.length };
};
Variant.exists = async (query) => {
  assert.deepEqual(query.price, { $gt: 0 });
  assert.equal(Object.hasOwn(query, "isActive"), false, "Single preview must allow disabled SKUs");
  return { _id: ids[0] };
};
Product.findById = async () => ({
  ...product(0), save: async function save() { this.saved = true; },
});

(async () => {
  try {
    const preview = mockResponse();
    await previewCatalogVisibility({}, preview);
    assert.equal(preview.code, 200);
    assert.equal(preview.body.data.total, 4);
    assert.equal(preview.body.data.eligible, 2);
    assert.equal(preview.body.data.skipped, 2);
    assert.equal(updates, 0, "Preview must not write to MongoDB");

    const missingConfirm = mockResponse();
    await bulkShowEligibleCatalog({ body: { action: "show-eligible" } }, missingConfirm);
    assert.equal(missingConfirm.code, 400);
    assert.equal(updates, 0, "Bulk mutation requires explicit confirmation");

    const apply = mockResponse();
    await bulkShowEligibleCatalog({
      body: { action: "show-eligible", confirm: "SHOW_ELIGIBLE_CATALOG" },
    }, apply);
    assert.equal(apply.code, 200);
    assert.equal(apply.body.data.updated, 2);
    assert.equal(updates, 1);
    assert.deepEqual(lastUpdate.mutation, { $set: { isCatalogVisible: true } });
    assert.deepEqual(lastUpdate.query._id.$in, [ids[0], ids[1]]);
    assert.equal(lastUpdate.query.isActive, false);
    assert.equal(Object.hasOwn(lastUpdate.mutation.$set, "stock"), false);
    assert.equal(Object.hasOwn(lastUpdate.mutation.$set, "isActive"), false);

    const single = mockResponse();
    await setCatalogVisibility({ params: { id: ids[0] }, body: { visible: true } }, single);
    assert.equal(single.code, 200);
    assert.equal(single.body.data.isCatalogVisible, true);

    Variant.exists = async () => null;
    const noPricedSku = mockResponse();
    await setCatalogVisibility({ params: { id: ids[0] }, body: { visible: true } }, noPricedSku);
    assert.equal(noPricedSku.code, 400, "Unpriced draft must remain private");

    Product.findById = async () => ({ ...product(0, { isActive: true }) });
    const hideActive = mockResponse();
    await setCatalogVisibility({ params: { id: ids[0] }, body: { visible: false } }, hideActive);
    assert.equal(hideActive.code, 400);

    console.log("SKINORA catalog visibility offline checks: PASS (draft SKU preview, positive price, explicit opt-in, no stock or sale changes)");
  } finally {
    Object.assign(Product, {
      find: original.find, updateMany: original.updateMany, findById: original.findById,
    });
    Variant.distinct = original.distinct;
    Variant.exists = original.exists;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
