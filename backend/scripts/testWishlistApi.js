require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { startTestServer } = require("../utils/testServer");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const WishlistItem = require("../models/WishlistItem");

async function run() {
  let server;
  try {
    server = await startTestServer();
    const suffix = `${Date.now()}-${process.pid}`;
    const password = await bcrypt.hash(`Test-${suffix}`, 10);
    const [owner, stranger, admin] = await Promise.all([
      User.create({ fullName: "Wishlist owner", email: `wishlist-owner-${suffix}@example.test`, password, role: "customer" }),
      User.create({ fullName: "Wishlist stranger", email: `wishlist-stranger-${suffix}@example.test`, password, role: "customer" }),
      User.create({ fullName: "Wishlist admin", email: `wishlist-admin-${suffix}@example.test`, password, role: "admin" }),
    ]);
    const category = await Category.create({ name: `Wishlist category ${suffix}`, slug: `wishlist-category-${suffix}` });
    const product = await Product.create({ name: "Wishlist test product", slug: `wishlist-product-${suffix}`, brand: "Test", category: category._id, basePrice: 100000, isActive: true, images: ["https://example.test/product.jpg"] });
    await Variant.create({ product: product._id, name: "50 ml", sku: `WISH-${suffix}`, price: 90000, stock: 3 });
    const token = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const request = async (path, method = "GET", user, body) => {
      const response = await fetch(`${server.baseUrl}/api/wishlist${path}`, { method, headers: { ...(user ? { Authorization: `Bearer ${token(user)}` } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await request("/", "GET")).status, 401);
    assert.equal((await request("/", "GET", admin)).status, 403);
    assert.equal((await request(`/${product._id}`, "POST", owner)).status, 200);
    assert.equal((await request(`/${product._id}`, "POST", owner)).status, 200);
    assert.equal(await WishlistItem.countDocuments({ user: owner._id, product: product._id }), 1);
    const own = await request("/", "GET", owner);
    assert.equal(own.status, 200);
    assert.equal(own.body.data.products.length, 1);
    assert.equal(own.body.data.products[0].catalogSalePrice, 90000);
    assert.equal(own.body.data.products[0].inStock, true);
    assert.equal((await request("/", "GET", stranger)).body.data.products.length, 0);
    assert.equal((await request(`/${product._id}`, "DELETE", stranger)).status, 200);
    assert.equal(await WishlistItem.countDocuments({ user: owner._id }), 1);
    assert.equal((await request(`/${product._id}`, "DELETE", owner)).status, 200);
    assert.equal((await request("/", "GET", owner)).body.data.products.length, 0);
    console.log(`Wishlist API PASS (${server.databaseName}): JWT, role, ownership, dedupe, SKU price/stock, persistence, delete`);
  } finally {
    if (server) await server.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
