"use strict";
/**
 * SKINORA SCHOOL PROJECT ONLY: assigns SIMULATED stock to existing, priced SKUs.
 * Do NOT use to represent physical inventory or accept genuine customer orders.
 * - READ-ONLY by default
 * - --apply requires explicit confirmation; only if there are ZERO orders
 * - Backs up Product/Variant flags, prices and stock to a local JSON file
 * - Updates SKU + Product and writes inventory movements in ONE transaction
 * - Does not touch SKU with 0 price, positive existing stock or invalid images
 */
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Order = require("../models/Order");
const InventoryMovement = require("../models/InventoryMovement");
const { businessDatabaseName, businessUriFrom } = require("../config/businessDatabase");
const { buildThesisInventoryPlan } = require("../utils/thesisInventoryPlan");
const isApply = process.argv.includes("--apply");
const qty = 10;
const confirmation = "--confirm=TON_KHO_GIA_LAP_DO_AN";

async function run() {
  if (isApply && !process.argv.includes(confirmation)) throw new Error("CAN_XAC_NHAN_TON_KHO_GIA_LAP");
  if (process.env.NODE_ENV === "test") throw new Error("KHONG_CHAY_VOI_NODE_ENV_TEST");
  const database = businessDatabaseName(process.env);
  if (database !== "skinora_prod") throw new Error(`TU_CHOI_DATABASE_KHAC:${database}`);
  const uri = businessUriFrom(process.env.MONGO_URI, database);
  if (!uri) throw new Error("THIEU_MONGO_URI_TRONG_BACKEND_ENV");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, autoIndex: false });
  try {
    if (mongoose.connection.name !== database) throw new Error("DATABASE_NAME_KHONG_KHOP");
    const [products, variants, orderCount] = await Promise.all([
      Product.find({}).select("_id name slug basePrice images isActive isCatalogVisible").lean(),
      Variant.find({}).select("_id product name sku size unit price stock isActive").lean(),
      Order.countDocuments({}),
    ]);
    const plan = buildThesisInventoryPlan(products, variants, qty);
    const response = {
      database, mode: isApply ? "APPLY_SIMULATED_STOCK" : "READ_ONLY_PREVIEW",
      notice: "TON KHO GIA LAP CHO DO AN - KHONG PHAI HANG THUC TE",
      quantityPerEligibleSku: qty,
      products: products.length, skus: variants.length, existingOrders: orderCount,
      willOpen: plan.eligible.length,
      alreadyOpen: plan.alreadyEnabled.length,
      skipped: plan.skipped.length,
      skippedReasons: plan.skipped.reduce((out, row) => { out[row.reason] = (out[row.reason] || 0) + 1; return out; }, {}),
      exampleSku: plan.eligible.slice(0, 3).map(row => row.sku),
    };
    if (!isApply) return response;
    if (orderCount > 0) throw new Error("CO_DON_HANG: KHONG_TU_DONG_SUA_TON_KHO_TREN_DB_DA_CO_GIAO_DICH");
    if (!plan.eligible.length) return { ...response, activated: 0, note: "Khong co SKU moi can mo ban" };

    const productIds = new Set(plan.eligible.map(row => row.productId));
    const backup = {
      generatedAt: new Date().toISOString(), database,
      warning: "MO PHONG CHO DO AN, KHONG PHAI KIEM KE THUC TE",
      products: products.filter(p => productIds.has(String(p._id))).map(p => ({
        _id: String(p._id), slug: p.slug, isActive: p.isActive, isCatalogVisible: p.isCatalogVisible,
      })),
      variants: variants.filter(v => plan.eligible.some(row => row.variantId === String(v._id))).map(v => ({
        _id: String(v._id), sku: v.sku, price: v.price, stock: v.stock, isActive: v.isActive,
      })),
    };
    const backupPath = path.join(__dirname, "../../SAO_LUU_TRUOC_MO_BAN_GIA_LAP_" +
      new Date().toISOString().replace(/[:.]/g, "-") + ".json");
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });

    await InventoryMovement.init();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Recheck order count INSIDE transaction: do not seed while orders exist.
        if ((await Order.countDocuments({}).session(session)) !== 0) throw new Error("ORDER_APPEARED_ABORT");
        for (const row of plan.eligible) {
          const updatedSku = await Variant.updateOne({ _id: row.variantId, sku: row.sku,
            price: row.currentPrice, stock: 0 }, { $set: { stock: qty, isActive: true } }, { session });
          if (updatedSku.matchedCount !== 1) throw new Error(`SKU_CHANGED_ROLLBACK:${row.sku}`);
          const updatedProduct = await Product.updateOne({ _id: row.productId, basePrice: row.currentPrice,
            "images.0": { $exists: true } }, { $set: { isActive: true, isCatalogVisible: true } }, { session });
          if (updatedProduct.matchedCount !== 1) throw new Error(`PRODUCT_CHANGED_ROLLBACK:${row.sku}`);
          await InventoryMovement.create([{ variant: row.variantId, product: row.productId,
            kind: "adjustment", delta: qty, before: 0, after: qty,
            note: "TON KHO GIA LAP PHUC VU DO AN - KHONG PHAI HANG THUC TE",
            reference: "THESIS_STOCK_SIMULATION" }], { session });
        }
      });
    } finally { await session.endSession(); }

    const sellable = await Variant.countDocuments({ isActive: true, stock: { $gt: 0 }, price: { $gt: 0 } });
    return { ...response, activated: plan.eligible.length, sellableSkus: sellable,
      backupFile: backupPath,
      next: "Khoi dong lai backend neu can, mo http://localhost:5173/products va nhan Ctrl+F5",
      WARNING: "Gia va ton kho mo phong. KHONG SU DUNG WEBSITE NAY CHO DON HANG THUC TE." };
  } finally { await mongoose.disconnect(); }
}
run().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error("SKINORA_STOCK_STOPPED:", error.message); process.exitCode = 1; });
