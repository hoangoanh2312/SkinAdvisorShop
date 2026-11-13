const assert = require('node:assert/strict');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const { listAdminProducts } = require('../controllers/adminController');

const original = {
  find: Product.find, countDocuments: Product.countDocuments,
  variantFind: Variant.find, distinct: Variant.distinct,
};
const id1 = '507f1f77bcf86cd799439011';
const id2 = '507f1f77bcf86cd799439012';
let lastFilter, lastPage, lastLimit, lastVariantFilter;
const products = [{ _id: id1, name: 'Test serum', isActive: true, isCatalogVisible: true },
  { _id: id2, name: 'Test cleanser', isActive: false, isCatalogVisible: true }];
const variants = [{ product: id1, sku: 'SERUM-30', price: 120000, stock: 2, isActive: true }];
Product.find = filter => {
  lastFilter = filter;
  const query = {
    populate: () => query, sort: () => query,
    skip(value) { lastPage = value; return query; },
    limit(value) { lastLimit = value; return query; },
    lean: async () => products,
  };
  return query;
};
Product.countDocuments = async () => 48;
Variant.distinct = async (field, conditions) => {
  assert.equal(field, 'product');
  lastVariantFilter = conditions;
  return [id1];
};
Variant.find = () => {
  const query = { select: () => query, sort: () => query, lean: async () => variants };
  return query;
};
const response = () => ({
  code: 200, json(value) { this.body = value; return this; },
  status(code) { this.code = code; return this; },
});
const request = async (query) => {
  const res = response();
  await listAdminProducts({ query: { includeInactive: 'true', limit: '10', ...query } }, res);
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.pagination.total, 48);
  assert.equal(res.body.data.pagination.limit, 10);
  assert.equal(res.body.data.products[0].totalStock, 2);
  return res;
};
(async () => {
  try {
    await request({ status: 'draft', page: '2' });
    assert.equal(lastPage, 10);
    assert.equal(lastLimit, 10);
    assert.equal(lastFilter.isActive, false);
    assert.deepEqual(lastFilter.isCatalogVisible, { $ne: true });

    await request({ status: 'preview', imageStatus: 'present' });
    assert.equal(lastFilter.isActive, false);
    assert.equal(lastFilter.isCatalogVisible, true);
    assert.deepEqual(lastFilter['images.0'], { $exists: true });

    await request({ status: 'selling', search: 'Serum' });
    assert.equal(lastFilter.isActive, true);
    assert.deepEqual(lastFilter._id, { $in: [id1] });
    assert.deepEqual(lastVariantFilter, { isActive: true, price: { $gt: 0 }, stock: { $gt: 0 } });
    assert.ok(lastFilter.$or[0].name.test('SERUM'));

    await request({ status: 'out-of-stock' });
    assert.equal(lastFilter.isActive, true);
    assert.deepEqual(lastFilter._id, { $nin: [id1] });

    await request({ status: 'all' });
    assert.equal(Object.hasOwn(lastFilter, '_id'), false);
    assert.equal(Object.hasOwn(lastFilter, 'isActive'), false);

    console.log('SKINORA admin product table: offline checks PASS');
  } finally {
    Product.find = original.find;
    Product.countDocuments = original.countDocuments;
    Variant.find = original.variantFind;
    Variant.distinct = original.distinct;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
