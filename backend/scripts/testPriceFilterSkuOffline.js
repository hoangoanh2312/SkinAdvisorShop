const assert = require("node:assert/strict");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { getProducts } = require("../controllers/productController");

async function main() {
  const oldFind = Product.find;
  const oldCount = Product.countDocuments;
  const oldVariantFind = Variant.find;
  const products = [
    { _id: "p1", name: "A", basePrice: 0, toObject() { return { _id: "p1", name: "A" }; } },
    { _id: "p2", name: "B", basePrice: 999999, toObject() { return { _id: "p2", name: "B" }; } },
    { _id: "p3", name: "C", basePrice: 400000, toObject() { return { _id: "p3", name: "C" }; } },
  ];
  const variants = [
    { product: "p1", price: 300000, salePrice: 250000, stock: 5, isActive: true },
    { product: "p2", price: 200000, salePrice: null, stock: 2, isActive: true },
    { product: "p3", price: 150000, salePrice: null, stock: 0, isActive: true },
  ];
  const query = (result) => ({
    populate() { return this; }, sort() { return this; }, skip() { return this; },
    limit() { return this; }, select() { return this; }, lean() { return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  });
  try {
    Product.find = () => query(products);
    Product.countDocuments = async () => 3;
    Variant.find = () => query(variants);
    const respond = async (params) => {
      const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await getProducts({ query: params }, res);
      return res;
    };
    const ascending = await respond({ sort: "price_asc", limit: "2" });
    assert.equal(ascending.code, 200);
    assert.deepEqual(ascending.body.data.products.map((item) => item._id), ["p3", "p2"]);
    assert.equal(ascending.body.data.pagination.total, 3);
    assert.deepEqual((await respond({ sort: "price_desc", limit: "2" })).body.data.products.map((item) => item._id), ["p1", "p2"]);
    const max = await respond({ maxPrice: "210000" });
    assert.equal(max.body.data.pagination.total, 2);
    assert.deepEqual(max.body.data.products.map((item) => item._id), ["p2", "p3"]);
    const minimum = await respond({ minPrice: "230000" });
    assert.deepEqual(minimum.body.data.products.map((item) => item._id), ["p1"]);
    assert.equal((await respond({ minPrice: "500000", maxPrice: "100000" })).code, 400);
    console.log("PASS: price filters, descending/ascending and pagination use actual active SKU prices");
  } finally { Product.find = oldFind; Product.countDocuments = oldCount; Variant.find = oldVariantFind; }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
