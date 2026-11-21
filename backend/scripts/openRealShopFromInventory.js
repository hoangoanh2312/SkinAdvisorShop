/**
 * SKINORA GO-LIVE: Admin-authored actual inventory ONLY. This tool never invents stock.
 * template: read database and create an editable CSV. preview: validate without writes.
 * apply: explicitly approved, atomic transaction (Atlas replica set required).
 */
"use strict";
require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const InventoryMovement = require("../models/InventoryMovement");
const { businessDatabaseName, businessUriFrom } = require("../config/businessDatabase");
const { csvStringify, csvParse, validateImport } = require("../utils/storefrontGoLive");

const INPUT_PATH = path.resolve(__dirname, "../../NHAP_TON_KHO_MO_BAN_SKINORA.csv");
const mode = process.argv[2] || "preview";
if (!["template", "preview", "apply"].includes(mode)) throw new Error("UNKNOWN_COMMAND");
if (mode === "apply" && !process.argv.includes("--confirm=PUBLISH_WITH_REAL_STOCK")) {
  throw new Error("APPLY_REQUIRES_EXPLICIT_CONFIRMATION");
}
async function main() {
  if (process.env.NODE_ENV === "test") throw new Error("REFUSE_TEST_MODE_USE_EXISTING_TEST_HARNESS");
  const database = businessDatabaseName(process.env);
  if (database !== "skinora_prod") throw new Error(`REFUSED_DATABASE:${database}`);
  const uri = businessUriFrom(process.env.MONGO_URI, database);
  if (!uri) throw new Error("MONGO_URI_MISSING");
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  try {
    if (mongoose.connection.name !== database) throw new Error("CONNECTED_TO_UNEXPECTED_DATABASE");
    const products = await Product.find({}).select("_id name slug basePrice images isActive").lean();
    const variants = await Variant.find({ product: { $in: products.map(p => p._id) } })
      .select("_id product sku size unit price stock isActive").lean();
    const productMap = new Map(products.map(item => [String(item._id), item]));
    const variantMap = new Map(variants.map(variant => [variant.sku, { variant, product: productMap.get(String(variant.product)) }]));
    if (mode === "template") {
      if (fs.existsSync(INPUT_PATH)) throw new Error(`FILE_EXISTS_WILL_NOT_OVERWRITE:${INPUT_PATH}`);
      const rows = variants.sort((a,b)=> a.sku.localeCompare(b.sku)).map(variant => {
        const product = productMap.get(String(variant.product));
        return { sku: variant.sku, slug: product?.slug || "", ten_san_pham: product?.name || "",
          dung_tich: `${variant.size || ""}${variant.unit || ""}`, gia_hien_tai_vnd: variant.price,
          so_luong_thuc_te: "", xac_nhan_mo_ban: "" };
      });
      fs.writeFileSync(INPUT_PATH, csvStringify(rows), { encoding: "utf8", flag: "wx" });
      return { database, mode: "TEMPLATE_CREATED", path: INPUT_PATH, rows: rows.length,
        guide: "Nhập số tồn kho thực tế và MO_BAN chỉ ở các SKU muốn mở bán. Dòng để trống sẽ bị bỏ qua." };
    }
    if (!fs.existsSync(INPUT_PATH)) throw new Error(`CSV_NOT_FOUND_RUN_TEMPLATE_FIRST:${INPUT_PATH}`);
    const rows = csvParse(fs.readFileSync(INPUT_PATH, "utf8"));
    const result = validateImport(rows, productMap, variantMap);
    const response = { database, mode: mode === "apply" ? "APPLY" : "DRY_RUN", csv: INPUT_PATH,
      totalVariants: variants.length, csvRows: rows.length, plannedToPublish: result.planned.length,
      skipped: result.skipped.length, errors: result.errors, planned: result.planned };
    if (result.errors.length) throw new Error(`VALIDATION_FAILED_NO_WRITES:\n${result.errors.join("\n")}`);
    if (mode === "preview") return response;
    if (!result.planned.length) return { ...response, published: 0, message: "Không có dòng MO_BAN hợp lệ để áp dụng." };
    // All writes are in one transaction. If the catalog changed since preview,
    // rollback instead of producing a partially published storefront.
    await InventoryMovement.init();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const row of result.planned) {
          const variant = await Variant.findOneAndUpdate({ _id: row.variantId, product: row.productId,
            sku: row.sku, price: row.price, stock: 0 }, { $set: { stock: row.qty, isActive: true } }, { session, returnDocument: "after" });
          if (!variant) throw new Error(`SKU_CHANGED_ROLLBACK:${row.sku}`);
          await InventoryMovement.create([{ variant: variant._id, product: row.productId,
            kind: 'receipt', delta: row.qty, before: 0, after: row.qty,
            note: 'Nhập hàng đã kiểm kê theo CSV xác nhận mở bán', reference: 'PUBLISH_WITH_REAL_STOCK' }], { session });
          const product = await Product.findOneAndUpdate({ _id: row.productId, slug: productMap.get(row.productId).slug,
            isActive: false, basePrice: row.price, "images.0": { $exists: true } },
          { $set: { isActive: true } }, { session, returnDocument: "after" });
          if (!product) throw new Error(`PRODUCT_CHANGED_ROLLBACK:${row.sku}`);
        }
      });
    } finally { await session.endSession(); }
    return { ...response, published: result.planned.length, message: "Đã mở bán. Kiểm tra http://localhost:5173/products" };
  } finally { await mongoose.disconnect(); }
}
main().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(`SKINORA_GO_LIVE_STOPPED: ${error.message}`); process.exitCode = 1; });
