const assert = require("node:assert/strict");
const Product = require("../models/Product");
const { getProducts } = require("../controllers/productController");

const originalFind = Product.find;
const originalCount = Product.countDocuments;
let captured;
Product.find = (filter) => {
  captured = filter;
  return { populate() { return this; }, sort() { return this; },
    skip() { return this; }, async limit() { return []; } };
};
Product.countDocuments = async () => 0;
const mockRes = () => ({
  code: 200, body: null,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
});

(async () => {
  try {
    const res = mockRes();
    await getProducts({ query: { search: "draft", category: "" } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.data.products.length, 0);
    assert.equal(captured.$and.length, 2,
      "Search may not overwrite the public visibility guard");
    assert.deepEqual(captured.$and[0], { $or: [
      { isActive: true }, { isCatalogVisible: true },
    ] });
    assert.equal(captured.$and[1].$or.length, 2);
    assert.equal(captured.$and[1].$or[0].name.source, "draft");
    assert.equal(captured.$and[1].$or[1].brand.source, "draft");
    console.log("SKINORA private draft search guard: PASS");
  } finally {
    Product.find = originalFind;
    Product.countDocuments = originalCount;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
