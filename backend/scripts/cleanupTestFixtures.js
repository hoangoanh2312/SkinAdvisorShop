require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const models = { Category: require("../models/Category"), Product: require("../models/Product"), Variant: require("../models/Variant"), Voucher: require("../models/Voucher"), Review: require("../models/Review"), Order: require("../models/Order"), User: require("../models/User") };
const tag = "\\d{13}-[a-z0-9]+";
const queries = {
  Category: { $or: [{ name: { $regex: `^(Commerce Category|Address Category|Orders Category|Bank Test|Admin Orders|Cloud|AI Test|Skin Analysis|Payment Test) ${tag}$`, $options: "i" } }, { slug: { $regex: `^(commerce|address|orders|bank-test|admin-orders|cloud|ai-test|skin-analysis|payment-test)-${tag}$`, $options: "i" } }] },
  Product: { name: { $regex: `^(Commerce Serum|Address Serum|Orders Serum|Bank Product|Admin Serum|Cloud Product|Payment Product|AI |Niacinamide Serum |Inactive Analysis |Out Of Stock Analysis ).*${tag}$`, $options: "i" } },
  Variant: { sku: { $regex: `^(COM|ADDR|ORD|BANK|ADMIN|PAY|AI|SKINA|SKINI|SKINO)-${tag}$`, $options: "i" } },
  Voucher: { code: { $regex: `^(COM|ORD|PAY|TEST).*${tag}$`, $options: "i" } },
  Review: { _id: null }, Order: { "items.sku": { $regex: `^(COM|ADDR|ORD|BANK|ADMIN|PAY)-${tag}$`, $options: "i" } },
  User: { $and: [{ email: { $ne: "admin@skinora.com" } }, { $or: [{ email: { $regex: `^(skinora\\.|cloud\\.).*${tag}@example\\.com$`, $options: "i" } }, { fullName: { $regex: "(Test|Cloud Admin|Cloud Customer)$", $options: "i" } }] }] },
};
const isProtectedUser = user => String(user?.email || "").toLowerCase() === "admin@skinora.com";
const rows = (Model, query, fields) => Model.find(query).select(fields).lean();
async function collectFixtureRecords(source = models) {
  const [categories, products, variants, vouchers, orders, users] = await Promise.all([rows(source.Category, queries.Category, "_id name slug"), rows(source.Product, queries.Product, "_id name slug"), rows(source.Variant, queries.Variant, "_id sku product"), rows(source.Voucher, queries.Voucher, "_id code"), rows(source.Order, queries.Order, "_id orderCode items.sku"), rows(source.User, queries.User, "_id email fullName")]);
  const safeUsers = users.filter(user => !isProtectedUser(user));
  const reviews = await rows(source.Review, { $or: [{ product: { $in: products.map(item => item._id) } }, { user: { $in: safeUsers.map(item => item._id) } }] }, "_id user product");
  return { categories, products, variants, vouchers, reviews, orders, users: safeUsers };
}
async function buildFixtureReport(source = models) { const report = {}; for (const [key, label] of [["Category", "categories"], ["Product", "products"], ["Variant", "variants"], ["Voucher", "vouchers"], ["Review", "reviews"], ["Order", "orders"], ["User", "users"]]) report[label] = await source[key].countDocuments(queries[key]); return report; }
async function buildCleanupManifest(source = models) { const records = await collectFixtureRecords(source); return { version: 1, generatedAt: new Date().toISOString(), mode: "dry-run", protectedUsers: ["admin@skinora.com"], records, counts: Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.length])) }; }
async function main() {
  if (process.argv.includes("--help")) { console.log("Usage: node scripts/cleanupTestFixtures.js --dry-run [--manifest <path>]\nThis phase does not support destructive cleanup."); return; }
  if (!process.argv.includes("--dry-run")) throw new Error("ONLY_DRY_RUN_SUPPORTED");
  await mongoose.connect(process.env.MONGO_URI);
  try { const manifest = await buildCleanupManifest(); const flag = process.argv.indexOf("--manifest"); if (flag >= 0) { const target = process.argv[flag + 1]; if (!target) throw new Error("MANIFEST_PATH_REQUIRED"); fs.writeFileSync(path.resolve(target), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" }); } console.log(JSON.stringify(manifest, null, 2)); } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(`Fixture cleanup stopped: ${error.message}`); process.exitCode = 1; });
module.exports = { buildCleanupManifest, buildFixtureReport, collectFixtureRecords, isProtectedUser, queries };
