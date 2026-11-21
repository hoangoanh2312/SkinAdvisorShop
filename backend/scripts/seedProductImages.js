require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("../models/Category");
const Product = require("../models/Product");
const ImageCleanupTask = require("../models/ImageCleanupTask");
const cloudinaryImageService = require("../services/cloudinaryImageService");
const { ProductImageService } = require("../services/productImageService");

const DEFAULT_ASSETS_DIR = path.join(__dirname, "..", "assets", "demo-products");
const TEST_PRODUCT_PATTERN = /^(Commerce Serum|Address Serum|Orders Serum|Bank Product|Admin Serum|Cloud Product) \d{13}-[a-z0-9]+$/i;
const GROUPS = [
  { file: "makeup-remover.png", terms: ["tay trang", "micellar", "makeup remover"] },
  { file: "cleanser.png", terms: ["sua rua mat", "rua mat", "cleanser", "cleansing foam"] },
  { file: "sunscreen.png", terms: ["chong nang", "sunscreen", "sun cream", "spf"] },
  { file: "acne-oily.png", terms: ["tri mun", "cham soc da dau", "da dau", "acne", "blemish", "oil control"] },
  { file: "moisturizer.png", terms: ["kem duong", "duong am", "moisturizer", "cream"] },
  { file: "toner.png", terms: ["toner", "nuoc hoa hong"] },
  { file: "mask.png", terms: ["mat na", "mask"] },
  { file: "serum.png", terms: ["serum", "essence", "tinh chat"] },
];

const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
const isAutomatedTestProduct = product => TEST_PRODUCT_PATTERN.test(String(product.name || ""));
const chooseAsset = (product, assetsDir = DEFAULT_ASSETS_DIR) => {
  const exactPrefix = String(product.slug || "").replace(/^skinora-/, "").replaceAll("-", "_");
  if (exactPrefix) {
    const exact = fs.readdirSync(assetsDir).find(file => /^\d{2}_.+\.(?:jpe?g|png|webp)$/i.test(file) && file.replace(/^\d{2}_/, "").replace(/\.(?:jpe?g|png|webp)$/i, "") === exactPrefix);
    if (exact) return path.join(assetsDir, exact);
  }
  const categoryName = typeof product.category === "object" ? product.category?.name : "";
  const haystack = normalize(`${product.name} ${categoryName}`);
  const group = GROUPS.find(item => item.terms.some(term => haystack.includes(term))) || GROUPS.find(item => item.file === "moisturizer.png");
  return path.join(assetsDir, group.file);
};
const mimeFor = filePath => filePath.endsWith(".webp") ? "image/webp" : filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") ? "image/jpeg" : "image/png";

const defaultRepository = {
  list: () => Product.find({ isActive: true }).populate("category", "name").sort({ createdAt: 1 }),
  get: id => Product.findById(id).select("images imageAssets __v"),
  save: (id, version, state) => Product.findOneAndUpdate({ _id: id, __v: Number(version) }, { $set: state, $inc: { __v: 1 } }, { returnDocument: "after", runValidators: true }).select("images imageAssets __v"),
  isPublicIdReferenced: publicId => Product.exists({ "imageAssets.publicId": publicId }),
};
const defaultCleanupRepository = { create: task => ImageCleanupTask.create(task) };

async function seedProductImages({ repository = defaultRepository, cloudinary = cloudinaryImageService, cleanupRepository = defaultCleanupRepository, assetsDir = DEFAULT_ASSETS_DIR, dryRun = false, force = false, limit = 0, logger = console } = {}) {
  const products = await repository.list();
  const summary = { scanned: products.length, eligible: 0, updated: 0, skipped: 0, failed: 0 };
  const service = new ProductImageService({ cloudinary, repository, cleanupRepository });
  for (const product of products) {
    if (isAutomatedTestProduct(product)) continue;
    if ((product.imageAssets || []).length && !force) { summary.skipped += 1; logger.log(`[skip] ${product.name}: already has managed images`); continue; }
    if (limit && summary.eligible >= limit) continue;
    summary.eligible += 1;
    const assetPath = chooseAsset(product, assetsDir);
    if (!fs.existsSync(assetPath)) throw new Error(`Missing demo asset: ${assetPath}`);
    if (dryRun) { logger.log(`[dry-run] ${product.name} <- ${path.basename(assetPath)}`); continue; }
    try {
      const file = { buffer: fs.readFileSync(assetPath), mimetype: mimeFor(assetPath), originalname: path.basename(assetPath) };
      const uploaded = await service.upload(String(product._id), product.__v, [file]);
      const newest = uploaded.imageAssets[uploaded.imageAssets.length - 1];
      if (uploaded.images[0] !== newest.url) {
        const keys = uploaded.imageAssets.map(asset => String(asset._id));
        const legacyKeys = uploaded.images.filter(url => !uploaded.imageAssets.some(asset => asset.url === url)).map((_, index) => `legacy:${index}`);
        await service.reorder(String(product._id), uploaded.__v, [...keys, ...legacyKeys], String(newest._id));
      }
      summary.updated += 1; logger.log(`[updated] ${product.name} <- ${path.basename(assetPath)}`);
    } catch (error) { summary.failed += 1; logger.log(`[failed] ${product.name}: ${error.code || error.message}`); throw error; }
  }
  return summary;
}

const parseArgs = argv => {
  const args = { dryRun: argv.includes("--dry-run"), force: argv.includes("--force"), limit: 0 };
  const inline = argv.find(value => value.startsWith("--limit="));
  const index = argv.indexOf("--limit");
  const raw = inline?.split("=")[1] ?? (index >= 0 ? argv[index + 1] : undefined);
  if (raw !== undefined) { args.limit = Number.parseInt(raw, 10); if (!Number.isInteger(args.limit) || args.limit < 1) throw new Error("--limit must be a positive integer"); }
  return args;
};

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
  const { resolveTestMongoUri } = require("../utils/testDatabase");
  await mongoose.connect(resolveTestMongoUri());
  try { const summary = await seedProductImages(parseArgs(process.argv.slice(2))); console.log(`Seed summary: ${JSON.stringify(summary)}`); }
  finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch(error => { console.error(`Product image seed failed: ${error.code || error.message}`); process.exitCode = 1; });
module.exports = { GROUPS, chooseAsset, isAutomatedTestProduct, parseArgs, seedProductImages };
