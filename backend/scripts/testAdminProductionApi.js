require("dotenv").config({ quiet: true });
const assert = require("assert");
const bcrypt = require("bcryptjs");
const { startTestServer } = require("../utils/testServer");
const generateToken = require("../utils/generateToken");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Order = require("../models/Order");

async function run() {
  process.env.JWT_SECRET ||= "admin-production-test-secret";
  const test = await startTestServer();
  try {
    const password = await bcrypt.hash(`test-only-${require("node:crypto").randomUUID()}`, 10);
    const [admin, customer] = await User.create([{ fullName: "Admin", email: "admin.production@example.com", password, role: "admin" }, { fullName: "Real Customer", email: "customer.production@example.com", password }]);
    const adminToken = generateToken(admin), customerToken = generateToken(customer);
    const request = async (path, { method = "GET", token = adminToken, body } = {}) => { const response = await fetch(`${test.baseUrl}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json() }; };

    assert.strictEqual((await request("/api/admin/brands", { token: customerToken })).status, 403);
    assert.strictEqual((await request("/api/admin/brands", { token: null })).status, 401);
    const brandResponse = await request("/api/admin/brands", { method: "POST", body: { name: "CeraVe", slug: "cerave" } });
    assert.strictEqual(brandResponse.status, 201);
    const brand = brandResponse.body.data.brand;
    const category = await Category.create({ name: "Sữa rửa mặt", slug: "sua-rua-mat" });
    const productResponse = await request("/api/products", { method: "POST", body: { name: "Hydrating Cleanser", slug: "hydrating-cleanser", brand: "CLIENT OVERRIDE", brandRef: brand._id, category: category._id, basePrice: 300000 } });
    assert.strictEqual(productResponse.status, 201);
    assert.strictEqual(productResponse.body.data.product.brand, "CeraVe");
    assert.strictEqual(productResponse.body.data.product.brandRef, brand._id);
    const product = await Product.findById(productResponse.body.data.product._id);
    const renamed = await request(`/api/admin/brands/${brand._id}`, { method: "PATCH", body: { name: "CeraVe Vietnam" } });
    assert.strictEqual(renamed.status, 200);
    assert.strictEqual((await Product.findById(product._id)).brand, "CeraVe Vietnam");
    const variant = await Variant.create({ product: product._id, name: "100 ml", sku: "REAL-001", price: 300000, stock: 3 });
    await Order.create({ orderCode: "SKN261009AB12", user: customer._id, items: [{ product: product._id, variant: variant._id, productName: product.name, variantName: variant.name, sku: variant.sku, quantity: 1, unitPrice: 300000, subtotal: 300000 }], shippingAddress: { fullName: customer.fullName, phone: "0900000000", province: "HCM", ward: "Ward", address: "Street" }, subtotal: 300000, total: 300000, paymentMethod: "COD", paymentStatus: "unpaid", orderStatus: "completed", createdAt: new Date("2026-10-05") });

    const summary = await request("/api/admin/dashboard/summary");
    assert.strictEqual(summary.status, 200); assert.strictEqual(summary.body.data.activeProducts, 1); assert.strictEqual(summary.body.data.revenue, 300000); assert.strictEqual(summary.body.data.lowStock.length, 1);
    assert.strictEqual(summary.body.data.activeBrands, 1);
    const customers = await request("/api/admin/customers?search=real&page=1&limit=10");
    assert.strictEqual(customers.status, 200); assert.strictEqual(customers.body.data.customers[0].orderCount, 1); assert.strictEqual(customers.body.data.customers[0].totalSpent, 300000); assert.strictEqual(customers.body.data.customers[0].password, undefined);
    const detail = await request(`/api/admin/customers/${customer._id}?page=1&limit=1`);
    assert.strictEqual(detail.status, 200); assert.strictEqual(detail.body.data.orders.length, 1); assert.strictEqual(detail.body.data.pagination.total, 1); assert.strictEqual(detail.body.data.customer.password, undefined);
    assert.strictEqual((await request(`/api/admin/customers/${customer._id}`, { token: customerToken })).status, 403);
    assert.strictEqual((await request(`/api/admin/customers/${admin._id}/status`, { method: "PATCH", body: { isActive: false } })).status, 400);
    const categories = await request("/api/admin/categories?includeInactive=true&search=sua");
    assert.strictEqual(categories.status, 200); assert.strictEqual(categories.body.data.categories[0].productCount, 1);
    const products = await request("/api/admin/products?includeInactive=true&search=hydrating");
    assert.strictEqual(products.status, 200); assert.strictEqual(products.body.data.products[0].totalStock, 3);
    assert.strictEqual(products.body.data.products[0].variants[0].sku, "REAL-001");
    assert.strictEqual(products.body.data.products[0].variants[0].price, 300000);
    const orders = await request("/api/admin/orders?from=2026-10-01&to=2026-10-06");
    assert.strictEqual(orders.status, 200); assert.strictEqual(orders.body.data.orders.length, 1);
    assert.strictEqual((await request("/api/admin/orders?from=2026-10-10&to=2026-10-01")).status, 400);
    console.log("Admin production API authorization, aggregation and compatibility tests passed");
  } finally { await test.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
