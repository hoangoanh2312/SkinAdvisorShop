require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { createApp } = require("../app");
const User = require("../models/User");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const WishlistItem = require("../models/WishlistItem");

async function run() {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET ||= "wishlist-offline-only-secret";
  const ids = { a: "507f1f77bcf86cd799439011", b: "507f1f77bcf86cd799439012", admin: "507f1f77bcf86cd799439013", product: "507f1f77bcf86cd799439014" };
  const users = new Map([[ids.a, { _id: ids.a, role: "customer", isActive: true }], [ids.b, { _id: ids.b, role: "customer", isActive: true }], [ids.admin, { _id: ids.admin, role: "admin", isActive: true }]]);
  const product = { _id: ids.product, name: "Offline product", slug: "offline-product", isActive: true, images: ["https://example.test/image.jpg"] };
  const variant = { product: ids.product, name: "50 ml", sku: "OFFLINE-50", size: "50", unit: "ml", price: 80000, salePrice: null, stock: 2, isActive: true };
  const saved = [];
  const originals = { userFind: User.findById, productFind: Product.find, productFindOne: Product.findOne, variantFind: Variant.find, wishlistFind: WishlistItem.find, wishlistUpdate: WishlistItem.updateOne, wishlistDelete: WishlistItem.deleteOne };
  let server;
  try {
    User.findById = async id => users.get(String(id)) || null;
    Product.findOne = filter => ({ select: async () => String(filter._id) === ids.product ? product : null });
    Product.find = () => ({ lean: async () => [product] });
    Variant.find = () => ({ select: () => ({ lean: async () => [variant] }) });
    WishlistItem.find = filter => ({ sort: () => ({ lean: async () => saved.filter(item => item.user === String(filter.user)) }) });
    WishlistItem.updateOne = async filter => { if (!saved.some(item => item.user === String(filter.user) && item.product === String(filter.product))) saved.push({ user: String(filter.user), product: String(filter.product) }); };
    WishlistItem.deleteOne = async filter => { const index = saved.findIndex(item => item.user === String(filter.user) && item.product === String(filter.product)); if (index >= 0) saved.splice(index, 1); };
    server = createApp().listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/wishlist`;
    const request = async (path, method, id) => { const response = await fetch(`${base}${path}`, { method, headers: id ? { Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1h" })}` } : {} }); return { status: response.status, body: await response.json() }; };
    assert.equal((await request("/", "GET")).status, 401);
    assert.equal((await request("/", "GET", ids.admin)).status, 403);
    assert.equal((await request(`/${ids.product}`, "POST", ids.a)).status, 200);
    assert.equal((await request(`/${ids.product}`, "POST", ids.a)).status, 200);
    assert.equal(saved.length, 1);
    const own = await request("/", "GET", ids.a);
    assert.equal(own.status, 200);
    assert.equal(own.body.data.products[0].catalogSalePrice, 80000);
    assert.equal(own.body.data.products[0].inStock, true);
    assert.equal(own.body.data.products[0].displayVariant.sku, "OFFLINE-50");
    assert.equal((await request("/", "GET", ids.b)).body.data.products.length, 0);
    await request(`/${ids.product}`, "DELETE", ids.b);
    assert.equal(saved.length, 1);
    await request(`/${ids.product}`, "DELETE", ids.a);
    assert.equal(saved.length, 0);
    assert(WishlistItem.schema.indexes().some(([fields, options]) => fields.user === 1 && fields.product === 1 && options.unique === true));
    const invalidSource = new Product({ name: "Source check", slug: "source-check", brand: "Test", category: ids.a, basePrice: 0, contentSourceUrl: "javascript:alert(1)" });
    const invalidSourceError = await invalidSource.validate().catch(error => error);
    assert(invalidSourceError?.errors?.contentSourceUrl);
    console.log("Wishlist offline PASS: JWT, role, ownership, idempotency, current SKU fields, unique index declaration");
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    Object.assign(User, { findById: originals.userFind });
    Object.assign(Product, { find: originals.productFind, findOne: originals.productFindOne });
    Object.assign(Variant, { find: originals.variantFind });
    Object.assign(WishlistItem, { find: originals.wishlistFind, updateOne: originals.wishlistUpdate, deleteOne: originals.wishlistDelete });
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
