/** Explain why each hidden product is not eligible for an informational Catalog preview.
 *  READ ONLY: Never modifies Product, Variant, stock, price or publication state.
 */
"use strict";
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { businessDatabaseName, businessUriFrom } = require("../config/businessDatabase");

function reasons(product, variants) {
  const issues = [];
  if (!product.name?.trim()) issues.push("Thiếu tên");
  if (!product.slug?.trim()) issues.push("Thiếu slug");
  if (!product.brand?.trim()) issues.push("Thiếu thương hiệu");
  if (!product.category) issues.push("Thiếu danh mục");
  if (!product.images?.some(url => typeof url === "string" && /^https?:\/\//i.test(url))) {
    issues.push("Thiếu ảnh URL http(s) hợp lệ");
  }
  if (!variants.some(variant => Number.isFinite(variant.price) && variant.price > 0)) {
    issues.push("Chưa có SKU có giá dương");
  }
  return issues;
}

async function run() {
  const database = businessDatabaseName(process.env);
  if (database !== "skinora_prod") throw new Error(`REFUSED_DATABASE:${database}`);
  const uri = businessUriFrom(process.env.MONGO_URI, database);
  if (!uri) throw new Error("MISSING_MONGO_URI");
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  try {
    if (mongoose.connection.name !== database) throw new Error("DATABASE_CONNECTION_MISMATCH");
    const products = await Product.find({ isActive: false, isCatalogVisible: { $ne: true } })
      .select("_id name slug brand category images isActive isCatalogVisible").lean();
    const variants = await Variant.find({ product: { $in: products.map(x => x._id) } })
      .select("product price isActive stock").lean();
    const byProduct = new Map();
    for (const sku of variants) {
      const id = String(sku.product);
      if (!byProduct.has(id)) byProduct.set(id, []);
      byProduct.get(id).push(sku);
    }
    const rows = products.map(product => {
      const ownSkus = byProduct.get(String(product._id)) || [];
      const problems = reasons(product, ownSkus);
      return { name: product.name, slug: product.slug, eligible: problems.length === 0,
        skuCount: ownSkus.length, enabledSkuCount: ownSkus.filter(v => v.isActive === true).length,
        issues: problems };
    });
    const counts = {};
    for (const row of rows) for (const issue of row.issues) counts[issue] = (counts[issue] || 0) + 1;
    return { database, mode: "READ_ONLY", hiddenProducts: rows.length,
      eligibleForPreview: rows.filter(row => row.eligible).length,
      needReview: rows.filter(row => !row.eligible).length,
      reasonCounts: counts, needReviewDetails: rows.filter(row => !row.eligible),
      note: "SKU tắt vẫn có thể dùng làm thông tin xem trước nếu có giá dương. Không mở bán, không tạo tồn kho." };
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(`CATALOG_PREVIEW_AUDIT_STOPPED: ${error.message}`); process.exitCode = 1; });
module.exports = { run, reasons };
