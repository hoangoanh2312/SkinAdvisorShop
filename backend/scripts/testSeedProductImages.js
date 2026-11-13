const assert = require("assert");
const path = require("path");
const { chooseAsset, isAutomatedTestProduct, seedProductImages } = require("./seedProductImages");
const mongoose = require("mongoose");
const { DEMO_PRODUCTS } = require("./seedDemoCatalog");

const assetsDir = path.join(__dirname, "..", "assets", "demo-products");
const makeProduct = (overrides = {}) => ({ _id: "product-1", __v: 0, name: "SKINORA Hydrating Serum", category: { name: "Serum" }, images: [], imageAssets: [], isActive: true, ...overrides });

async function run() {
  assert(mongoose.modelNames().includes("Category"), "seed script must register Category before populate");
  assert.strictEqual(path.basename(chooseAsset(makeProduct(), assetsDir)), "serum.png");
  assert.strictEqual(path.basename(chooseAsset(makeProduct({ name: "Kem chống nắng dịu nhẹ", category: { name: "Chống nắng" } }), assetsDir)), "sunscreen.png");
  assert.strictEqual(isAutomatedTestProduct(makeProduct({ name: "Commerce Serum 1790095728182-c7dciq" })), true);
  assert.strictEqual(isAutomatedTestProduct(makeProduct()), false);
  for (const demo of DEMO_PRODUCTS) {
    const selected = path.basename(chooseAsset({ ...makeProduct(), slug: demo.slug, name: demo.name }, assetsDir));
    assert.strictEqual(selected, demo.imageFile, `${demo.slug} must use ${demo.imageFile}`);
  }

  let uploads = 0, saves = 0;
  const repository = {
    list: async () => [makeProduct()],
    get: async () => makeProduct(),
    save: async (_id, _version, state) => { saves += 1; return { ...makeProduct(), ...state, __v: 1 }; },
    isPublicIdReferenced: async () => false,
  };
  const cloudinary = { upload: async () => { uploads += 1; return { url: "https://cdn.test/seed.jpg", publicId: "skinora/products/product-1/seed", format: "png", width: 1024, height: 1024, bytes: 100 }; }, destroy: async () => ({ result: "ok" }) };
  const cleanupRepository = { create: async task => task };

  const dry = await seedProductImages({ repository, cloudinary, cleanupRepository, assetsDir, dryRun: true, logger: { log() {} } });
  assert.deepStrictEqual(dry, { scanned: 1, eligible: 1, updated: 0, skipped: 0, failed: 0 });
  assert.strictEqual(uploads, 0); assert.strictEqual(saves, 0);

  const existing = makeProduct({ images: ["https://cdn.test/existing.jpg"], imageAssets: [{ url: "https://cdn.test/existing.jpg", publicId: "existing" }] });
  const skipped = await seedProductImages({ repository: { ...repository, list: async () => [existing] }, cloudinary, cleanupRepository, assetsDir, logger: { log() {} } });
  assert.strictEqual(skipped.skipped, 1); assert.strictEqual(uploads, 0);

  const seeded = await seedProductImages({ repository, cloudinary, cleanupRepository, assetsDir, logger: { log() {} } });
  assert.strictEqual(seeded.updated, 1); assert.strictEqual(uploads, 1); assert.strictEqual(saves, 1);

  let destroyed = "";
  const failingRepository = { ...repository, save: async () => { throw new Error("database failed"); } };
  await assert.rejects(() => seedProductImages({ repository: failingRepository, cloudinary: { ...cloudinary, destroy: async publicId => { destroyed = publicId; } }, cleanupRepository, assetsDir, logger: { log() {} } }), /database failed/);
  assert.strictEqual(destroyed, "skinora/products/product-1/seed");

  const fixturesOnly = await seedProductImages({ repository: { ...repository, list: async () => [makeProduct({ name: "Orders Serum 1790758717361-f0xcsu" })] }, cloudinary, cleanupRepository, assetsDir, logger: { log() {} } });
  assert.strictEqual(fixturesOnly.eligible, 0);

  uploads = 0; saves = 0;
  const limited = await seedProductImages({ repository: { ...repository, list: async () => [makeProduct(), makeProduct({ _id: "product-2", name: "SKINORA Toner" })] }, cloudinary, cleanupRepository, assetsDir, limit: 1, logger: { log() {} } });
  assert.strictEqual(limited.eligible, 1); assert.strictEqual(uploads, 1); assert.strictEqual(saves, 1);
  console.log("Product image seed dry-run, skip, upload, cleanup and fixture isolation tests passed");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
