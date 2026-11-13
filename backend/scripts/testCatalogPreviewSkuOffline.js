const assert = require("node:assert/strict");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { getProducts, getProduct } = require("../controllers/productController");

const previous = {
  find: Product.find, count: Product.countDocuments, findOne: Product.findOne,
  variantFind: Variant.find,
};
const catalog = [
  { _id: "draft1", name: "Cocoon", slug: "cocoon", isActive: false, isCatalogVisible: true },
  { _id: "live1", name: "Live", slug: "live", isActive: true, isCatalogVisible: false },
];
const variants = [
  { product: "draft1", name: "310ml", price: 339000, stock: 0, isActive: false },
  { product: "live1", name: "Live active", price: 300000, stock: 4, isActive: true },
  { product: "live1", name: "Live hidden draft", price: 10000, stock: 0, isActive: false },
];
function promiseQuery(value) {
  return {
    populate() { return this; }, sort() { return this; }, skip() { return this; },
    limit() { return this; }, select() { return this; }, lean() { return Promise.resolve(value); },
    then(ok, err) { return Promise.resolve(value).then(ok, err); },
  };
}
const res = () => ({ code: 200, status(status) { this.code = status; return this; }, json(data) { this.body = data; return this; } });
(async () => {
  try {
    Product.find = () => promiseQuery(catalog);
    Product.countDocuments = async () => catalog.length;
    Variant.find = (query) => promiseQuery(variants.filter(v => {
      if (Array.isArray(query.product?.$in)) return query.product.$in.includes(v.product);
      if (v.product !== query.product) return false;
      if (query.isActive === true) return v.isActive === true;
      if (query.price?.$gt === 0) return v.price > 0;
      return true;
    }));
    const list = res();
    await getProducts({ query: { sort: "price_asc" } }, list);
    assert.equal(list.code, 200);
    assert.deepEqual(list.body.data.products.map(p => p._id), ["live1", "draft1"]);
    const [live, draft] = list.body.data.products;
    assert.equal(live.catalogPrice, 300000, "Live must not expose inactive SKU price");
    assert.equal(draft.catalogPrice, 339000, "Preview must show stored draft SKU price");
    assert.equal(draft.inStock, false);
    assert.equal(draft.availableVariantCount, 0);
    Product.findOne = () => promiseQuery(catalog[0]);
    const detail = res();
    await getProduct({ params: { idOrSlug: "cocoon" } }, detail);
    assert.equal(detail.code, 200);
    assert.equal(detail.body.data.variants.length, 1);
    assert.equal(detail.body.data.variants[0].isActive, false);
    assert.equal(detail.body.data.product.isActive, false);
    console.log("PASS: preview-only disabled SKU displays its price but is not marked sellable; live products hide inactive SKU prices");
  } finally {
    Product.find = previous.find;
    Product.countDocuments = previous.count;
    Product.findOne = previous.findOne;
    Variant.find = previous.variantFind;
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
