"use strict";
/**
 * Prepare a fresh, separate SKINORA *_test database for university demonstration.
 * Reads ONLY catalog/category/brand/SKU collections from the production DB.
 * NEVER copies real users, orders, reviews, vouchers or personal data.
 * Demo prices, placeholder images and stock are not real commercial inventory.
 * Fails closed if demo database already contains business data; never modifies production.
 */
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { defenseDemoConfig } = require("./defenseDemoConfig");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const User = require("../models/User");
const InventoryMovement = require("../models/InventoryMovement");

const APPLY_FLAG = "--apply";
const CONFIRM_FLAG = "--confirm=CREATE_ISOLATED_SKINORA_DEMO";
const SAMPLE_STOCK = 10;
const SAMPLE_PRICE = 199000;
const GUARDED_COLLECTIONS = [
  "categories", "brands", "products", "variants", "users", "orders", "reviews",
  "inventorymovements", "adminauditlogs", "returncases", "vouchers",
  "voucherredemptions", "skinanalyses"
];
const clean = (value, limit = 200) => String(value || "").trim().slice(0, limit);
const toPrice = (value) => Number.isFinite(value) && value > 0 ? Math.round(value) : SAMPLE_PRICE;

const demoImage = (name) => {
  const title = clean(name, 28).replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="560" viewBox="0 0 480 560"><rect width="480" height="560" fill="#eee9e2"/><rect x="110" y="124" width="260" height="294" rx="30" fill="#dbd3c7"/><text x="240" y="230" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" fill="#244735">SKINORA</text><text x="240" y="275" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#244735">DEMO</text><text x="240" y="310" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#244735">KHONG BAN THAT</text><text x="240" y="466" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#244735">${title}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

function buildFixture({ categories, brands, products, variants }) {
  const productMap = new Map(products.map(p => [String(p._id), p]));
  const categoryIds = new Set(categories.map(c => String(c._id)));
  const brandIds = new Set(brands.map(b => String(b._id)));
  const eligibleVariants = variants.filter(v =>
    v.product && productMap.has(String(v.product)) && v.sku &&
    !/^SKN-DEMO-/i.test(String(v.sku)) &&
    !/^TEST-/i.test(String(v.sku))
  );
  if (eligibleVariants.length === 0 || eligibleVariants.length > 300) throw new Error("SOURCE_SKU_COUNT_INVALID");
  const selectedProductIds = new Set(eligibleVariants.map(v => String(v.product)));
  const selectedProducts = products.filter(p => selectedProductIds.has(String(p._id)));
  if (selectedProducts.length > 200) throw new Error("SOURCE_PRODUCT_COUNT_INVALID");
  for (const p of selectedProducts) if (!categoryIds.has(String(p.category))) throw new Error("SOURCE_CATEGORY_MISSING");

  const formattedVariants = eligibleVariants.map(v => ({
    _id: v._id, product: v.product, name: clean(v.name || v.size || "Phiên bản demo", 100),
    sku: clean(v.sku, 100), size: clean(v.size, 40), unit: clean(v.unit, 20),
    price: toPrice(v.price), salePrice: null, stock: SAMPLE_STOCK,
    image: typeof v.image === "string" && /^https:\/\//i.test(v.image) ? v.image : "",
    isActive: true
  }));
  const byProduct = new Map();
  for (const v of formattedVariants) {
    const key = String(v.product);
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(v);
  }
  const formattedProducts = selectedProducts.map(p => {
    const validImages = (Array.isArray(p.images) ? p.images : []).filter(url =>
      typeof url === "string" && (/^https:\/\//i.test(url) || /^data:image\//i.test(url))
    );
    const fallback = demoImage(p.name);
    const images = validImages.length ? validImages : [fallback];
    return {
      _id: p._id, name: clean(p.name, 180), slug: clean(p.slug, 180),
      brand: clean(p.brand, 120), brandRef: p.brandRef && brandIds.has(String(p.brandRef)) ? p.brandRef : null,
      category: p.category,
      shortDescription: "DỮ LIỆU DEMO BẢO VỆ ĐỒ ÁN – KHÔNG NHẬN ĐƠN THẬT",
      description: `DỮ LIỆU DEMO BẢO VỆ ĐỒ ÁN – KHÔNG BÁN THẬT. Giá và tồn kho chỉ để kiểm thử.\n${clean(p.description, 5000)}`,
      images, imageAssets: [],
      skinTypes: Array.isArray(p.skinTypes) ? p.skinTypes : [],
      skinConcerns: Array.isArray(p.skinConcerns) ? p.skinConcerns : [],
      ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
      keyIngredients: Array.isArray(p.keyIngredients) ? p.keyIngredients : [],
      avoidFor: Array.isArray(p.avoidFor) ? p.avoidFor : [],
      usage: clean(p.usage, 2000), warnings: [...(Array.isArray(p.warnings) ? p.warnings : []), "DỮ LIỆU DEMO - KHÔNG DÙNG ĐỂ TƯ VẤN Y TẾ"],
      basePrice: Math.min(...byProduct.get(String(p._id)).map(v => v.price)),
      salePrice: null, averageRating: 0, reviewCount: 0, soldCount: 0,
      isFeatured: Boolean(p.isFeatured), isActive: true, isCatalogVisible: true
    };
  });
  const sourceSkuCountWithNoPrice = eligibleVariants.filter(v => !Number.isFinite(v.price) || v.price <= 0).length;
  const fallbackImages = formattedProducts.filter(p => p.images[0].startsWith("data:image")).length;
  return {
    categories: categories.map(c => ({ _id: c._id, name: c.name, slug: c.slug, description: c.description || "", image: c.image || "", isActive: true })),
    brands: brands.map(b => ({ _id: b._id, name: b.name, slug: b.slug, logo: b.logo || "", isActive: true })),
    products: formattedProducts,
    variants: formattedVariants,
    sourceSkuCountWithNoPrice,
    fallbackImages
  };
}

async function readCatalogFromSource(uri) {
  const source = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 2 }).asPromise();
  try {
    if (!/_prod$/i.test(source.name)) throw new Error("SOURCE_MUST_BE_PROD_NAMED_DB");
    // Read-only calls. Never open collections containing users, orders or payment details.
    const [categories, brands, products, variants] = await Promise.all([
      source.collection("categories").find({}).toArray(),
      source.collection("brands").find({}).toArray(),
      source.collection("products").find({}).toArray(),
      source.collection("variants").find({}).toArray()
    ]);
    return buildFixture({ categories, brands, products, variants });
  } finally {
    await source.close();
  }
}

async function checkDemoEmpty() {
  const found = [];
  for (const name of GUARDED_COLLECTIONS) {
    const count = await mongoose.connection.db.collection(name).countDocuments({}, { limit: 1 });
    if (count) found.push(name);
  }
  return found;
}

async function applyFixture(fixture) {
  const emailAdmin = "admin.demo@skinora.example";
  const emailCustomer = "khach.demo@skinora.example";
  const adminPassword = crypto.randomBytes(18).toString("base64url");
  const customerPassword = crypto.randomBytes(18).toString("base64url");
  const admin = new User({ fullName: "SKINORA Admin Demo", email: emailAdmin, password: await bcrypt.hash(adminPassword, 12), role: "admin", isActive: true });
  const customer = new User({ fullName: "Khách hàng Demo", email: emailCustomer, password: await bcrypt.hash(customerPassword, 12), role: "customer", isActive: true });
  await Promise.all([Category.init(), Brand.init(), Product.init(), Variant.init(), User.init(), InventoryMovement.init()]);
  // Recheck after indexes are created, before any mutation to real business data (none).
  const occupied = await checkDemoEmpty();
  if (occupied.length) throw new Error(`DEMO_DB_NOT_EMPTY:${occupied.join(",")}`);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Category.insertMany(fixture.categories, { session });
      await Brand.insertMany(fixture.brands, { session });
      await Product.insertMany(fixture.products, { session });
      await Variant.insertMany(fixture.variants, { session });
      await User.insertMany([admin, customer], { session });
      await InventoryMovement.insertMany(fixture.variants.map(v => ({
        variant: v._id, product: v.product, actor: admin._id,
        kind: "receipt", delta: SAMPLE_STOCK, before: 0, after: SAMPLE_STOCK,
        note: "Khởi tạo 10 sản phẩm giả lập cho buổi bảo vệ đồ án; KHÔNG phải hàng thật",
        reference: "BAO-VE-DEMO-ONLY"
      })), { session });
    });
  } finally { await session.endSession(); }
  return { admin: { email: emailAdmin, password: adminPassword }, customer: { email: emailCustomer, password: customerPassword } };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes(APPLY_FLAG);
  if (apply && !args.includes(CONFIRM_FLAG)) throw new Error("EXPLICIT_DEMO_CONFIRMATION_REQUIRED");
  if (args.some(arg => !["--preview", APPLY_FLAG, CONFIRM_FLAG].includes(arg))) throw new Error("UNKNOWN_ARGUMENT");
  const { sourceName, demoName, productionUri, demoUri } = defenseDemoConfig();
  const fixture = await readCatalogFromSource(productionUri);
  process.env.NODE_ENV = "test";
  await mongoose.connect(demoUri, { serverSelectionTimeoutMS: 15000, autoIndex: !apply });
  try {
    if (mongoose.connection.name !== demoName || !demoName.endsWith("_test")) throw new Error("DEMO_CONNECTION_MISMATCH");
    const occupied = await checkDemoEmpty();
    const report = {
      mode: apply ? "DEMO_APPLY" : "DEMO_PREVIEW_NO_WRITES", sourceDatabaseReadOnly: sourceName,
      targetDatabase: demoName, targetHasExistingData: occupied,
      categories: fixture.categories.length, brands: fixture.brands.length,
      products: fixture.products.length, variants: fixture.variants.length,
      stockPerSkuSample: SAMPLE_STOCK, priceFallbackSample: SAMPLE_PRICE,
      skusGivenSamplePrice: fixture.sourceSkuCountWithNoPrice, productsWithPlaceholderImage: fixture.fallbackImages,
      realUsersOrdersReviewsPaymentsCopied: 0
    };
    console.log(JSON.stringify(report, null, 2));
    if (!apply) return;
    if (occupied.length) throw new Error("DEMO_DB_NOT_EMPTY_CHOOSE_A_NEW_SKINORA_*_TEST_NAME");
    const accounts = await applyFixture(fixture);
    console.log("DEMO_SEED_OK: Demo catalog and accounts created in test database ONLY.");
    console.log("DEMO_LOGIN_CREDENTIALS_DISPLAYED_ONCE_COPY_THEM_PRIVATELY:");
    console.log(JSON.stringify(accounts, null, 2));
    console.log("WARNING: NEVER use this catalog to sell real products. Run node scripts/startDefenseDemo.js for the demo backend.");
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main().catch(error => {
  const safe = String(error.code || error.message || "UNKNOWN")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[DATABASE_URI_REDACTED]");
  console.error(`DEMO_SETUP_FAILED: ${safe}`);
  process.exitCode = 1;
});
module.exports = { buildFixture, demoImage, SAMPLE_STOCK, SAMPLE_PRICE };
