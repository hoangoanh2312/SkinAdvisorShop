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
const { orderRouter } = require("../routes/orderRoutes");
const paymentRoutes = require("../routes/paymentRoutes");

mongoose.set("autoIndex", false);
const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const originalBank = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith("BANK_")));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
let server;

const run = async () => {
  try {
    process.env.BANK_CODE = "MB";
    process.env.BANK_ACCOUNT_NO = "0123456789";
    process.env.BANK_ACCOUNT_NAME = "SKINORA TEST";
    await mongoose.connect(process.env.MONGO_URI);

    const category = await Category.create({ name: `Bank Test ${tag}`, slug: `bank-test-${tag}` });
    const product = await Product.create({ name: `Bank Product ${tag}`, slug: `bank-product-${tag}`, brand: "Skinora Test", category: category._id, basePrice: 180000 });
    const variant = await Variant.create({ product: product._id, name: "30 ml", sku: `BANK-${tag}`.toUpperCase(), size: "30", unit: "ml", price: 180000, stock: 20 });
    const [owner, stranger] = await User.create([
      { fullName: "Bank Owner", email: `bank.owner.${tag}@example.com`, password: await bcrypt.hash(`Owner-${tag}`, 12) },
      { fullName: "Bank Stranger", email: `bank.stranger.${tag}@example.com`, password: await bcrypt.hash(`Stranger-${tag}`, 12) },
    ]);

    const app = express();
    app.use(express.json());
    app.use("/api/orders", orderRouter);
    app.use("/api/payments", paymentRoutes);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const ownerToken = generateToken(owner);
    const strangerToken = generateToken(stranger);
    const request = async (path, { method = "GET", token, body } = {}) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    const orderBody = (paymentMethod = "BANK_TRANSFER") => ({
      items: [{ variantId: String(variant._id), quantity: 2 }],
      paymentMethod,
      amount: 1,
      bankCode: "ATTACKER",
      accountNo: "0000000000",
      shippingAddress: { fullName: "Bank Owner", phone: "0900000000", province: "HCM", ward: "Ben Nghe", address: "1 Test" },
    });
    const createOrder = async (paymentMethod = "BANK_TRANSFER") => {
      const result = await request("/orders", { method: "POST", token: ownerToken, body: orderBody(paymentMethod) });
      assert(result.status === 201, `Create ${paymentMethod} order expected 201, received ${result.status}`);
      return result.body.data.order;
    };

    const stockBefore = (await Variant.findById(variant._id)).stock;
    const bankOrder = await createOrder();
    assert(bankOrder.total === 360000 && bankOrder.paymentStatus === "unpaid", "BANK_TRANSFER order did not use backend total/unpaid state");
    assert((await Variant.findById(variant._id)).stock === stockBefore, "BANK_TRANSFER creation changed stock");

    assert((await request(`/payments/bank-transfer/${bankOrder._id}`, { token: strangerToken })).status === 403, "Non-owner viewed bank transfer QR");
    assert((await request(`/payments/bank-transfer/${bankOrder._id}/confirm`, { method: "POST", token: strangerToken })).status === 403, "Non-owner confirmed bank transfer");

    const beforeGet = await Order.findById(bankOrder._id).lean();
    const instructions = await request(`/payments/bank-transfer/${bankOrder._id}`, { token: ownerToken });
    assert(instructions.status === 200, `Owner QR expected 200, received ${instructions.status}`);
    const payload = instructions.body.data;
    assert(payload.bankCode === "MB" && payload.accountNo === "0123456789" && payload.accountName === "SKINORA TEST", "Bank config was not server authoritative");
    assert(payload.amount === 360000 && payload.orderCode === bankOrder.orderCode, "QR payload did not use authoritative amount/orderCode");
    const qrUrl = new URL(payload.qrUrl);
    assert(qrUrl.origin === "https://img.vietqr.io" && qrUrl.pathname === "/image/MB-0123456789-compact2.png", "VietQR Quick Link path is invalid");
    assert(qrUrl.searchParams.get("amount") === "360000" && qrUrl.searchParams.get("addInfo") === bankOrder.orderCode && qrUrl.searchParams.get("accountName") === "SKINORA TEST", "VietQR query is invalid");
    const afterGet = await Order.findById(bankOrder._id).lean();
    assert(afterGet.paymentStatus === beforeGet.paymentStatus && afterGet.updatedAt.getTime() === beforeGet.updatedAt.getTime(), "GET bank transfer instructions mutated the order");

    process.env.BANK_ACCOUNT_NO = "invalid/account";
    const invalidConfig = await request(`/payments/bank-transfer/${bankOrder._id}`, { token: ownerToken });
    assert(invalidConfig.status === 503, `Invalid bank configuration expected 503, received ${invalidConfig.status}`);
    process.env.BANK_ACCOUNT_NO = "0123456789";

    const concurrent = await Promise.all([
      request(`/payments/bank-transfer/${bankOrder._id}/confirm`, { method: "POST", token: ownerToken, body: { paymentStatus: "paid" } }),
      request(`/payments/bank-transfer/${bankOrder._id}/confirm`, { method: "POST", token: ownerToken }),
    ]);
    assert(concurrent.every((result) => result.status === 200 && result.body.data.order.paymentStatus === "pending_verification"), "Concurrent confirms were not idempotent");
    const repeated = await request(`/payments/bank-transfer/${bankOrder._id}/confirm`, { method: "POST", token: ownerToken });
    assert(repeated.status === 200 && repeated.body.data.order.paymentStatus === "pending_verification", "Repeated confirm was not idempotent");
    assert((await Order.findById(bankOrder._id)).paymentStatus !== "paid", "Customer confirmation marked order paid");
    assert((await Variant.findById(variant._id)).stock === stockBefore, "Bank transfer confirmation changed stock");

    const paid = await createOrder();
    await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(paid._id) }, { $set: { paymentStatus: "paid" } });
    assert((await request(`/payments/bank-transfer/${paid._id}/confirm`, { method: "POST", token: ownerToken })).status === 400, "Paid order allowed bank confirmation");
    const cancelled = await createOrder();
    await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(cancelled._id) }, { $set: { orderStatus: "cancelled" } });
    assert((await request(`/payments/bank-transfer/${cancelled._id}/confirm`, { method: "POST", token: ownerToken })).status === 400, "Cancelled order allowed bank confirmation");
    const completed = await createOrder();
    await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(completed._id) }, { $set: { orderStatus: "completed" } });
    assert((await request(`/payments/bank-transfer/${completed._id}/confirm`, { method: "POST", token: ownerToken })).status === 400, "Completed order allowed bank confirmation");
    const failed = await createOrder();
    await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(failed._id) }, { $set: { paymentStatus: "failed" } });
    assert((await request(`/payments/bank-transfer/${failed._id}`, { token: ownerToken })).status === 400, "Failed order exposed bank instructions");
    const refunded = await createOrder();
    await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(refunded._id) }, { $set: { paymentStatus: "refunded" } });
    assert((await request(`/payments/bank-transfer/${refunded._id}`, { token: ownerToken })).status === 400, "Refunded order exposed bank instructions");
    const cod = await createOrder("COD");
    assert((await request(`/payments/bank-transfer/${cod._id}`, { token: ownerToken })).status === 400, "COD order exposed bank instructions");
    assert((await request(`/payments/bank-transfer/${cod._id}/confirm`, { method: "POST", token: ownerToken })).status === 400, "COD order allowed bank confirmation");

    console.log("VietQR authoritative amount, orderCode and bank configuration: passed");
    console.log("Bank transfer GET/POST ownership and read-only GET: passed");
    console.log("Pending verification transition, idempotency and rejection rules: passed");
    console.log("Bank transfer stock non-mutation: passed");
    console.log("All bank transfer API tests passed");
  } catch (error) {
    console.error(`Bank transfer API test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
    for (const key of Object.keys(process.env).filter((key) => key.startsWith("BANK_"))) delete process.env[key];
    Object.assign(process.env, originalBank);
  }
};

run();
