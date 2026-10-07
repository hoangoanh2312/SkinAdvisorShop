require("dotenv").config({ quiet: true });

const assert = require("assert");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const generateToken = require("../utils/generateToken");
const {
  validateImageSignature,
  buildConsistentImageState,
  ProductImageService,
} = require("../services/productImageService");

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Buffer.from("RIFF0000WEBP", "ascii");

const testCloudinaryTimeoutWrapper = async () => {
  const { withTimeout } = require("../services/cloudinaryImageService");
  assert.strictEqual(await withTimeout(Promise.resolve("ok"), 50), "ok");
};

const runHttpIntegration = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const password = await bcrypt.hash(`Cloud-${tag}`, 12);
  const [admin, customer] = await User.create([{ fullName: "Cloud Admin", email: `cloud.admin.${tag}@example.com`, password, role: "admin" }, { fullName: "Cloud Customer", email: `cloud.customer.${tag}@example.com`, password }]);
  const category = await Category.create({ name: `Cloud ${tag}`, slug: `cloud-${tag}` });
  const product = await Product.create({ name: `Cloud Product ${tag}`, slug: `cloud-product-${tag}`, brand: "SKINORA", category: category._id, basePrice: 100000, images: ["https://legacy.test/original.jpg"] });
  const controller = require("../controllers/productImageController");
  controller.setCloudinaryAdapterForTests({ upload: async () => ({ url: `https://cdn.test/${tag}.jpg`, publicId: `skinora/products/${product._id}/${tag}`, format: "jpg", bytes: jpeg.length }), destroy: async () => ({ result: "ok" }) });
  const app = express(); app.use(express.json()); app.use("/api/products", require("../routes/productRoutes"));
  const server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/products/${product._id}/images`;
  const form = () => { const data = new FormData(); data.set("expectedVersion", String(product.__v)); data.set("images", new Blob([jpeg], { type: "image/jpeg" }), "product.jpg"); return data; };
  assert.strictEqual((await fetch(endpoint, { method: "POST", body: form() })).status, 401);
  assert.strictEqual((await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${generateToken(customer)}` }, body: form() })).status, 403);
  const invalid = new FormData(); invalid.set("expectedVersion", String(product.__v)); invalid.set("images", new Blob([Buffer.from("fake")], { type: "image/jpeg" }), "fake.jpg");
  assert.strictEqual((await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${generateToken(admin)}` }, body: invalid })).status, 400);
  const oversized = new FormData(); oversized.set("expectedVersion", String(product.__v)); oversized.set("images", new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: "image/png" }), "large.png");
  assert.strictEqual((await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${generateToken(admin)}` }, body: oversized })).status, 413);
  const adminResponse = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${generateToken(admin)}` }, body: form() });
  assert.strictEqual(adminResponse.status, 201);
  const stored = await Product.findById(product._id).lean();
  assert.deepStrictEqual(stored.images, ["https://legacy.test/original.jpg", `https://cdn.test/${tag}.jpg`]);
  assert.strictEqual(stored.imageAssets.length, 1);
  const genericUpdate = await fetch(`http://127.0.0.1:${server.address().port}/api/products/${product._id}`, { method: "PUT", headers: { Authorization: `Bearer ${generateToken(admin)}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: `${product.name} updated`, images: ["https://attacker.test/override.jpg"] }) });
  assert.strictEqual(genericUpdate.status, 200);
  const afterGenericUpdate = await Product.findById(product._id).lean();
  assert.deepStrictEqual(afterGenericUpdate.images, stored.images);
  assert.strictEqual(afterGenericUpdate.imageAssets.length, 1);
  await new Promise((resolve) => server.close(resolve)); controller.setCloudinaryAdapterForTests(null);
  await Promise.all([User.updateMany({ _id: { $in: [admin._id, customer._id] } }, { isActive: false }), Product.updateOne({ _id: product._id }, { isActive: false }), Category.updateOne({ _id: category._id }, { isActive: false })]);
  await mongoose.disconnect();
  console.log("Product image HTTP authentication, authorization, mock upload and legacy compatibility tests passed");
};

const run = async () => {
  await testCloudinaryTimeoutWrapper();
  assert(validateImageSignature(jpeg, "image/jpeg"));
  assert(validateImageSignature(png, "image/png"));
  assert(validateImageSignature(webp, "image/webp"));
  assert(!validateImageSignature(Buffer.from("fake"), "image/jpeg"));

  const state = buildConsistentImageState(
    ["https://legacy.test/a.jpg", "https://cdn.test/b.jpg"],
    [{ _id: "asset-b", url: "https://cdn.test/b.jpg", publicId: "products/b" }]
  );
  assert.deepStrictEqual(state.images, ["https://legacy.test/a.jpg", "https://cdn.test/b.jpg"]);
  assert.strictEqual(state.imageAssets.length, 1);

  const product = {
    _id: "product-1", __v: 2,
    images: ["https://legacy.test/a.jpg"], imageAssets: [],
  };
  const uploads = [];
  const destroyed = [];
  const cleanupTasks = [];
  const service = new ProductImageService({
    cloudinary: {
      upload: async () => { const asset = { url: "https://cdn.test/new.jpg", publicId: "products/new", format: "jpg", width: 100, height: 100, bytes: 4 }; uploads.push(asset); return asset; },
      destroy: async (publicId) => { destroyed.push(publicId); },
    },
    repository: {
      get: async () => product,
      save: async (_id, version, next) => { assert.strictEqual(version, product.__v); Object.assign(product, next, { __v: product.__v + 1 }); return product; },
      isPublicIdReferenced: async () => false,
    },
    cleanupRepository: { create: async (task) => { cleanupTasks.push(task); return task; } },
  });

  const uploaded = await service.upload("product-1", 2, [{ buffer: jpeg, mimetype: "image/jpeg" }]);
  assert.strictEqual(uploads.length, 1);
  assert.deepStrictEqual(uploaded.images, ["https://legacy.test/a.jpg", "https://cdn.test/new.jpg"]);
  assert.strictEqual(uploaded.imageAssets[0].publicId, "products/new");

  const key = String(uploaded.imageAssets[0]._id);
  const reordered = await service.reorder("product-1", 3, [key, "legacy:0"], key);
  assert.deepStrictEqual(reordered.images, ["https://cdn.test/new.jpg", "https://legacy.test/a.jpg"]);

  service.cloudinary.upload = async () => ({ url: "https://cdn.test/replacement.jpg", publicId: "products/replacement", format: "jpg", bytes: 4 });
  const replaced = await service.replace("product-1", 4, key, { buffer: jpeg, mimetype: "image/jpeg" });
  assert.deepStrictEqual(replaced.images, ["https://cdn.test/replacement.jpg", "https://legacy.test/a.jpg"]);
  assert.strictEqual(replaced.imageAssets[0].publicId, "products/replacement");
  assert.deepStrictEqual(destroyed, ["products/new"]);

  const replacementKey = String(replaced.imageAssets[0]._id);
  await service.remove("product-1", 5, replacementKey);
  assert.deepStrictEqual(product.images, ["https://legacy.test/a.jpg"]);
  assert.strictEqual(product.imageAssets.length, 0);
  assert.deepStrictEqual(destroyed, ["products/new", "products/replacement"]);

  const sharedProduct = { _id: "product-2", __v: 1, images: ["https://cdn.test/shared.jpg"], imageAssets: [{ _id: "shared", url: "https://cdn.test/shared.jpg", publicId: "products/shared" }] };
  const sharedService = new ProductImageService({
    cloudinary: { upload: async () => {}, destroy: async () => { throw new Error("must not destroy shared image"); } },
    repository: { get: async () => sharedProduct, save: async (_id, _version, next) => { Object.assign(sharedProduct, next, { __v: 2 }); return sharedProduct; }, isPublicIdReferenced: async () => true },
    cleanupRepository: { create: async () => { throw new Error("must not queue shared image"); } },
  });
  await sharedService.remove("product-2", 1, "shared");

  const failingProduct = { _id: "product-3", __v: 1, images: [], imageAssets: [] };
  const unsafeCleanup = new ProductImageService({
    cloudinary: { upload: async () => ({ url: "https://cdn.test/orphan.jpg", publicId: "products/orphan" }), destroy: async () => { throw new Error("cloud unavailable"); } },
    repository: { get: async () => failingProduct, save: async () => null, isPublicIdReferenced: async () => false },
    cleanupRepository: { create: async () => { throw new Error("database unavailable"); } },
  });
  await assert.rejects(
    () => unsafeCleanup.upload("product-3", 1, [{ buffer: jpeg, mimetype: "image/jpeg" }]),
    (error) => error.code === "CLEANUP_UNCONFIRMED"
  );

  const uncertainTasks = [];
  const uncertainUpload = new ProductImageService({
    cloudinary: { upload: async () => { throw Object.assign(new Error("timeout"), { publicId: "products/uncertain" }); }, destroy: async () => {} },
    repository: { get: async () => ({ _id: "product-4", __v: 1, images: [], imageAssets: [] }), save: async () => { throw new Error("must not save"); }, isPublicIdReferenced: async () => false },
    cleanupRepository: { create: async (task) => { uncertainTasks.push(task); return task; } },
  });
  await assert.rejects(() => uncertainUpload.upload("product-4", 1, [{ buffer: jpeg, mimetype: "image/jpeg" }]), /timeout/);
  assert.strictEqual(uncertainTasks[0].publicId, "products/uncertain");

  assert.strictEqual(cleanupTasks.length, 0);
  if (process.env.SKIP_PRODUCT_IMAGE_DB_TEST !== "true") await runHttpIntegration();
  console.log("Product image validation, consistency, lifecycle and cleanup safety tests passed");
};

run().catch((error) => { console.error(error); process.exitCode = 1; });
