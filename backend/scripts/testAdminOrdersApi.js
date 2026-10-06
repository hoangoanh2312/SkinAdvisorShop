require("dotenv").config({ quiet: true });

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Order = require("../models/Order");
const generateToken = require("../utils/generateToken");
const { adminOrderRouter } = require("../routes/orderRoutes");

mongoose.set("autoIndex", false);
const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const codePrefix = Math.random().toString(36).slice(2, 4).toUpperCase().padEnd(2, "X");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
let server;

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const category = await Category.create({ name: `Admin Orders ${tag}`, slug: `admin-orders-${tag}` });
    const product = await Product.create({ name: `Admin Serum ${tag}`, slug: `admin-serum-${tag}`, brand: "Skinora Test", category: category._id, basePrice: 150000 });
    const variant = await Variant.create({ product: product._id, name: "30 ml", sku: `ADMIN-${tag}`.toUpperCase(), size: "30", unit: "ml", price: 150000, stock: 40 });
    const password = await bcrypt.hash(`Admin-${tag}`, 12);
    const [admin, customer] = await User.create([
      { fullName: "Admin Workflow", email: `admin.workflow.${tag}@example.com`, password, role: "admin" },
      { fullName: `Customer Search ${tag}`, email: `customer.search.${tag}@example.com`, password },
    ]);

    const app = express();
    app.use(express.json());
    app.use("/api/admin/orders", adminOrderRouter);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/admin/orders`;
    const adminToken = generateToken(admin);
    const customerToken = generateToken(customer);
    const request = async (path = "", { method = "GET", token = adminToken, body } = {}) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    let sequence = 0;
    const makeOrder = async ({ paymentMethod = "BANK_TRANSFER", paymentStatus = "pending_verification", orderStatus = "pending", quantity = 2 } = {}) => {
      sequence += 1;
      return Order.create({
        orderCode: `SKN261005${codePrefix}${String(sequence).padStart(2, "0")}`,
        user: customer._id,
        items: [{ product: product._id, variant: variant._id, productName: product.name, variantName: variant.name, sku: variant.sku, image: "", quantity, unitPrice: 150000, subtotal: 150000 * quantity }],
        shippingAddress: { fullName: "Customer Search", phone: "0900000000", province: "HCM", ward: "Ben Nghe", address: "1 Snapshot Street" },
        subtotal: 150000 * quantity,
        total: 150000 * quantity,
        paymentMethod,
        paymentStatus,
        orderStatus,
        stockDeducted: paymentMethod === "COD",
      });
    };

    const searchable = await makeOrder();
    assert((await request("", { token: customerToken })).status === 403, "Customer accessed admin order list");
    assert((await request(`/${searchable._id}`, { token: customerToken })).status === 403, "Customer accessed admin order detail");
    assert((await request(`/${searchable._id}/payment/verify`, { method: "PUT", token: customerToken })).status === 403, "Customer verified payment");
    assert((await request(`?search=${encodeURIComponent(searchable.orderCode)}&paymentStatus=pending_verification&status=pending&limit=1`)).body.data.orders[0]._id === String(searchable._id), "Admin filters/orderCode search failed");
    const customerSearch = await request(`?search=${encodeURIComponent(customer.email)}&limit=5`);
    assert(customerSearch.status === 200 && customerSearch.body.data.orders.some((item) => item._id === String(searchable._id)), "Customer email search failed");
    const detail = await request(`/${searchable._id}`);
    assert(detail.status === 200 && detail.body.data.order.shippingAddress.address === "1 Snapshot Street", "Admin detail did not return shipping snapshot");

    const stockBefore = (await Variant.findById(variant._id)).stock;
    const verification = await request(`/${searchable._id}/payment/verify`, { method: "PUT", body: { amount: 1, paymentStatus: "refunded" } });
    assert(verification.status === 200 && verification.body.data.order.paymentStatus === "paid", "Pending bank transfer was not verified as paid");
    assert((await Variant.findById(variant._id)).stock === stockBefore - 2, "Verification did not deduct exact stock quantity");
    const repeated = await Promise.all([
      request(`/${searchable._id}/payment/verify`, { method: "PUT" }),
      request(`/${searchable._id}/payment/verify`, { method: "PUT" }),
    ]);
    assert(repeated.every((result) => result.status === 200 && result.body.data.order.paymentStatus === "paid"), "Repeated verification was not idempotent");
    assert((await Variant.findById(variant._id)).stock === stockBefore - 2, "Repeated verification deducted stock twice");

    const concurrentOrder = await makeOrder({ quantity: 3 });
    const concurrent = await Promise.all([
      request(`/${concurrentOrder._id}/payment/verify`, { method: "PUT" }),
      request(`/${concurrentOrder._id}/payment/verify`, { method: "PUT" }),
    ]);
    assert(concurrent.every((result) => result.status === 200 && result.body.data.order.paymentStatus === "paid"), "Concurrent pending verification was not safe/idempotent");
    assert((await Variant.findById(variant._id)).stock === stockBefore - 5, "Concurrent verification did not deduct stock exactly once");

    const insufficient = await makeOrder({ quantity: 1000 });
    const insufficientResult = await request(`/${insufficient._id}/payment/verify`, { method: "PUT" });
    assert(insufficientResult.status === 400, "Insufficient stock verification was accepted");
    assert((await Order.findById(insufficient._id)).paymentStatus === "pending_verification", "Failed verification mutated payment status");
    assert((await Variant.findById(variant._id)).stock === stockBefore - 5, "Failed verification partially changed stock");

    for (const [label, options] of [
      ["unpaid", { paymentStatus: "unpaid" }],
      ["cancelled", { orderStatus: "cancelled" }],
      ["completed", { orderStatus: "completed" }],
      ["COD", { paymentMethod: "COD" }],
      ["VNPAY", { paymentMethod: "VNPAY" }],
    ]) {
      const order = await makeOrder(options);
      const result = await request(`/${order._id}/payment/verify`, { method: "PUT" });
      assert(result.status === 400, `${label} order was accepted for bank verification`);
    }

    const bankUnpaid = await makeOrder({ paymentStatus: "unpaid" });
    assert((await request(`/${bankUnpaid._id}/status`, { method: "PUT", body: { orderStatus: "confirmed" } })).status === 400, "Unpaid bank order was confirmed");
    const vnpayUnpaid = await makeOrder({ paymentMethod: "VNPAY", paymentStatus: "unpaid" });
    assert((await request(`/${vnpayUnpaid._id}/status`, { method: "PUT", body: { orderStatus: "confirmed" } })).status === 400, "Unpaid VNPay order was confirmed");
    const cod = await makeOrder({ paymentMethod: "COD", paymentStatus: "unpaid" });
    assert((await request(`/${cod._id}/status`, { method: "PUT", body: { orderStatus: "confirmed" } })).status === 200, "COD confirmation regression");
    const bankPaid = await makeOrder({ paymentStatus: "paid" });
    assert((await request(`/${bankPaid._id}/status`, { method: "PUT", body: { orderStatus: "confirmed" } })).status === 200, "Paid bank order could not be confirmed");
    assert((await request(`/${bankPaid._id}/status`, { method: "PUT", body: { orderStatus: "shipping" } })).status === 200, "confirmed -> shipping failed");
    assert((await request(`/${bankPaid._id}/status`, { method: "PUT", body: { orderStatus: "completed" } })).status === 200, "shipping -> completed failed");
    assert((await request(`/${bankPaid._id}/status`, { method: "PUT", body: { orderStatus: "confirmed" } })).status === 400, "Terminal/reverse transition was accepted");

    console.log("Admin authorization, list filters/search/pagination and detail: passed");
    console.log("Bank verification atomic stock deduction and idempotency: passed");
    console.log("Verification rejection rules and payment-gated transitions: passed");
    console.log("All Phase 2.9C admin order tests passed");
  } catch (error) {
    console.error(`Admin order API test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  }
};

run();
