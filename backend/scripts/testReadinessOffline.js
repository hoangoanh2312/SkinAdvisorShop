/* Offline regression checks: never open MongoDB or call Gemini/Cloudinary. */
const assert = require("node:assert/strict");
const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const InventoryMovement = require("../models/InventoryMovement");
const AdminAuditLog = require("../models/AdminAuditLog");
const { createVariant } = require("../controllers/variantController");
const { updateProduct } = require("../controllers/productController");
const { mapRecommendations, getCandidateProducts } = require("../services/advisorProductService");
const { parseProductImages } = require("../middleware/productImageUpload");

async function main() {
  const id = String(new mongoose.Types.ObjectId());
  const mockResult = { _id: id, name: "100ml", sku: "SKU-100", price: 200000, stock: 4, isActive: true };
  const exists = Product.exists, create = Variant.create, startSession = mongoose.startSession, movementCreate = InventoryMovement.create, auditCreate = AdminAuditLog.create;
  let checkedFilter, movement;
  try {
    mongoose.startSession = async () => ({ withTransaction: async fn => fn(), endSession: async () => {} });
    Product.exists = filter => ({ session: async () => { checkedFilter = filter; return { _id: filter._id }; } });
    Variant.create = async ([payload]) => [{ ...mockResult, ...payload }];
    InventoryMovement.create = async ([payload]) => { movement = payload; return [payload]; };
    AdminAuditLog.create = async ([payload]) => [payload];
    const result = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    const req = { user: { _id: id }, params: { productId: id }, body: { name: "100ml", sku: "SKU-100", price: 200000, stock: 4, stockChangeNote: 'Hàng đã kiểm kê thực tế' } };
    await createVariant(req, result);
    assert.equal(result.statusCode, 201, "Admin should add a variant to a draft product with audited initial stock");
    assert.deepEqual(checkedFilter, { _id: id }, "Draft product must not be restricted to isActive=true");
    assert.equal(movement.before, 0);
    assert.equal(movement.after, 4);
    assert.equal(movement.kind, 'receipt');
  } finally { Product.exists = exists; Variant.create = create; mongoose.startSession = startSession; InventoryMovement.create = movementCreate; AdminAuditLog.create = auditCreate; }

  // A draft cannot be published without a real image and stock.
  const oldFind = Product.findById, oldUpdate = Product.findByIdAndUpdate, oldVariantExists = Variant.exists;
  try {
    let sample = { basePrice: 200000, salePrice: null, isActive: false, images: [] };
    let isStocked = false;
    Product.findById = () => ({ select() { return this; }, async lean() { return sample; } });
    Variant.exists = async () => isStocked ? { _id: id } : null;
    Product.findByIdAndUpdate = () => ({ async populate() { return { ...sample, isActive: true }; } });
    const run = async () => {
      const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await updateProduct({ params: { id }, body: { isActive: true } }, res);
      return res;
    };
    assert.equal((await run()).statusCode, 400, "No image = cannot activate product");
    sample = { ...sample, images: ["https://res.cloudinary.com/demo/image.jpg"] };
    assert.equal((await run()).statusCode, 400, "No stocked variant = cannot activate product");
    isStocked = true;
    assert.equal((await run()).statusCode, 200, "Image and stocked variant = can activate product");
  } finally { Product.findById = oldFind; Product.findByIdAndUpdate = oldUpdate; Variant.exists = oldVariantExists; }

  const available = { _id: "available", slug: "product-available", name: "Serum", brand: "COSRX", images: [], skinTypes: ["dry"], skinConcerns: [], ingredients: [] };
  const unavailable = { ...available, _id: "unavailable", slug: "product-unavailable" };
  const productsFind = Product.find, variantsFind = Variant.find;
  try {
    Product.find = () => ({ sort() { return this; }, limit() { return this; }, async lean() { return [unavailable, available]; } });
    Variant.find = () => ({ sort() { return this; }, async lean() { return [{ product: "available", _id: "variant-1", stock: 2, price: 200000, salePrice: null }]; } });
    const candidates = await getCandidateProducts({ skinType: "dry", skinConcerns: [], allergies: [], avoidIngredients: [] });
    assert.deepEqual(candidates.map(p => p._id), ["available"], "Out-of-stock items should not enter AI context");
    assert.deepEqual(mapRecommendations(["unavailable", "available"], [
      { ...unavailable, variants: [{ _id: "v2", stock: 0, price: 10 }] },
      { ...available, variants: [{ _id: "v1", stock: 1, price: 11 }] },
    ]).map(p => p.id), ["available"], "Out-of-stock items should never be returned as purchasable AI recommendations");
  } finally { Product.find = productsFind; Variant.find = variantsFind; }

  const app = express();
  app.post("/upload", parseProductImages, (req, res) => res.json({ count: req.files.length, field: req.files[0].fieldname, version: req.body.expectedVersion }));
  const server = await new Promise(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  try {
    const form = new FormData();
    form.append("images", new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "image.png");
    form.append("expectedVersion", "0");
    const response = await fetch(`http://127.0.0.1:${server.address().port}/upload`, { method: "POST", body: form });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { count: 1, field: "images", version: "0" });
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log("PASS offline: draft variant, activation safety, AI inventory filtering, multipart parser");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
