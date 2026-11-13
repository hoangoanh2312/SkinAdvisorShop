const assert = require("assert");
const { createIsolatedTestMongoUri, databaseName, resolveTestMongoUri } = require("../utils/testDatabase");
const { DEMO_PRODUCTS, seedDemoCatalog } = require("./seedDemoCatalog");
const { buildFixtureReport } = require("./cleanupTestFixtures");
const { createApp } = require("../app");
const { startTestServer } = require("../utils/testServer");

async function run() {
  assert.strictEqual(typeof createApp, "function");
  assert.strictEqual(typeof startTestServer, "function");
  assert.strictEqual(databaseName("mongodb://localhost:27017/skinora_test"), "skinora_test");
  assert.throws(() => resolveTestMongoUri({ TEST_MONGO_URI: "mongodb://localhost:27017/skinora" }), /REFUSING_NON_TEST_DATABASE/);
  assert.strictEqual(databaseName(resolveTestMongoUri({ MONGO_URI: "mongodb+srv://user:pass@example.test/skinora?retryWrites=true" })), "skinora_test");
  assert.strictEqual(databaseName(createIsolatedTestMongoUri({ MONGO_URI: "mongodb://localhost:27017/skinora" }, "catalog")), "skinora_catalog_test");

  assert.strictEqual(DEMO_PRODUCTS.length, 72);
  assert.strictEqual(new Set(DEMO_PRODUCTS.map(item => item.slug)).size, 72);
  assert.strictEqual(new Set(DEMO_PRODUCTS.map(item => item.sku)).size, 72);
  assert.deepStrictEqual(DEMO_PRODUCTS.map(item => item.sku), Array.from({ length: 72 }, (_, index) => `SKN-DEMO-${String(index + 1).padStart(3, "0")}`));
  for (const item of DEMO_PRODUCTS) {
    assert(item.skinTypes.length && item.skinConcerns.length && item.ingredients.length);
    assert(item.stock > 0 && item.price > 0);
  }

  const state = { categories: new Map(), products: new Map(), variants: new Map() };
  const repository = {
    findCategory: async slug => state.categories.get(slug), createCategory: async data => (state.categories.set(data.slug, { _id: `c-${state.categories.size}`, ...data }), state.categories.get(data.slug)),
    findProduct: async slug => state.products.get(slug), createProduct: async data => (state.products.set(data.slug, { _id: `p-${state.products.size}`, ...data }), state.products.get(data.slug)), updateProduct: async (_id, data) => (state.products.set(data.slug, { _id, ...data }), state.products.get(data.slug)),
    findVariant: async sku => state.variants.get(sku), createVariant: async data => (state.variants.set(data.sku, data), data), updateVariant: async (_id, data) => data,
  };
  const dry = await seedDemoCatalog({ repository, dryRun: true, logger: { log() {} } });
  assert.strictEqual(state.products.size, 0); assert.strictEqual(dry.productsPlanned, 72);
  await seedDemoCatalog({ repository, logger: { log() {} } });
  await seedDemoCatalog({ repository, logger: { log() {} } });
  assert.strictEqual(state.categories.size, 8); assert.strictEqual(state.products.size, 72); assert.strictEqual(state.variants.size, 72);

  const report = await buildFixtureReport({
    Category: { countDocuments: async query => query.$or ? 3 : 0 }, Product: { countDocuments: async () => 4 }, Variant: { countDocuments: async () => 5 }, Voucher: { countDocuments: async () => 1 }, Review: { countDocuments: async () => 2 }, Order: { countDocuments: async () => 6 }, User: { countDocuments: async () => 7 },
  });
  assert.deepStrictEqual(report, { categories: 3, products: 4, variants: 5, vouchers: 1, reviews: 2, orders: 6, users: 7 });
  console.log("Test database guard, demo seed idempotency, metadata and cleanup dry-run tests passed");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
