// Dependency-free offline regression check for the public catalog selling filter.
// Does not connect to MongoDB and never changes data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const productRows = [
  { _id: 'sellable', name: 'Có hàng', isActive: true, isCatalogVisible: true, basePrice: 200000 },
  { _id: 'preview', name: 'Sắp bán', isActive: false, isCatalogVisible: true, basePrice: 300000 },
  { _id: 'out-of-stock', name: 'Hết hàng', isActive: true, isCatalogVisible: true, basePrice: 500000 },
  { _id: 'private', name: 'Bản nháp', isActive: false, isCatalogVisible: false, basePrice: 400000 },
];
const variantRows = [
  { product: 'sellable', stock: 8, price: 200000, isActive: true },
  { product: 'preview', stock: 8, price: 300000, isActive: true },
  { product: 'out-of-stock', stock: 0, price: 500000, isActive: true },
  { product: 'private', stock: 4, price: 400000, isActive: true },
];

const matchingProducts = filter => productRows.filter(product => {
  const AND = filter.$and || [];
  return AND.every(condition => {
    if (condition.$or) return condition.$or.some(c =>
      ('isActive' in c && c.isActive === product.isActive) ||
      ('isCatalogVisible' in c && c.isCatalogVisible === product.isCatalogVisible));
    if ('isActive' in condition && condition.isActive !== product.isActive) return false;
    if (condition._id?.$in && !condition._id.$in.includes(product._id)) return false;
    return true;
  });
});
const query = (rows, { selectable = false } = {}) => {
  let skip = 0, limit = Infinity;
  const q = {
    populate: () => q, sort: () => q, select: () => q,
    skip: n => { skip = n; return q; }, limit: n => { limit = n; return q; },
    lean: () => Promise.resolve(rows.slice(skip, skip + limit)),
    then: (accept, reject) => Promise.resolve(rows.slice(skip, skip + limit)).then(accept, reject),
  };
  return q;
};
const deps = {
  '../models/Category': {},
  '../models/Product': { find: filter => query(matchingProducts(filter)), countDocuments: filter => matchingProducts(filter).length },
  '../models/Variant': {
    distinct: (_field, filter) => Promise.resolve(variantRows.filter(v => v.isActive && v.stock > 0 && v.price > 0).map(v => v.product)),
    find: ({ product }) => query(variantRows.filter(v => product.$in.includes(v.product))),
  },
  '../models/Brand': {},
  '../utils/controllerHelpers': { isValidObjectId: () => true, escapeRegex: text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), pick: () => ({}), sendControllerError: (_res, error) => { throw error; } },
  '../utils/catalogAvailability': { summarizeCatalogVariants: (rows, { previewOnly }) => ({ availableForSale: !previewOnly && rows.some(v => v.isActive && v.stock > 0 && v.price > 0), catalogSalePrice: rows[0]?.price ?? null }) },
};
const file = fs.readFileSync(path.join(__dirname, '../controllers/productController.js'), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, require: id => {
  if (!(id in deps)) throw new Error(`Unexpected dependency ${id}`);
  return deps[id];
} };
vm.runInNewContext(file, sandbox, { filename: 'productController.js' });
const getProducts = sandbox.module.exports.getProducts;
async function call(params) {
  const res = { status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  await getProducts({ query: params }, res);
  assert.equal(res.statusCode, 200);
  return res.body.data;
}
(async () => {
  const regular = await call({ limit: '20' });
  assert.deepEqual(Array.from(regular.products, row => row._id).sort(), ['out-of-stock', 'preview', 'sellable']);
  const live = await call({ sellableOnly: 'true', limit: '20' });
  assert.deepEqual(Array.from(live.products, row => row._id), ['sellable']);
  assert.equal(live.pagination.total, 1);
  const empty = await call({ sellableOnly: 'true', page: '2', limit: '1' });
  assert.equal(empty.products.length, 0);
  assert.equal(empty.pagination.total, 1);
  console.log('SKINORA_SELLABLE_CATALOG_OFFLINE_PASS: no drafts, no out-of-stock, accurate pagination');
})().catch(error => { console.error(error); process.exitCode = 1; });
