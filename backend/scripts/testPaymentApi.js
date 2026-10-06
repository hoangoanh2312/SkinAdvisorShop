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
const { signParams } = require("../services/vnpayService");

mongoose.set("autoIndex", false);
const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const originalVnp = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith("VNP_")));
const testSecret = `payment-test-${tag}`;
let server;

const signedQuery = (params) => new URLSearchParams({
  ...params,
  vnp_SecureHash: signParams(params, testSecret),
}).toString();

const run = async () => {
  try {
    process.env.VNP_TMN_CODE = "TESTCODE";
    process.env.VNP_HASH_SECRET = testSecret;
    process.env.VNP_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    process.env.VNP_RETURN_URL = "http://localhost:5173/payment/result";
    await mongoose.connect(process.env.MONGO_URI);

    const category = await Category.create({ name: `Payment Test ${tag}`, slug: `payment-test-${tag}` });
    const product = await Product.create({ name: `Payment Product ${tag}`, slug: `payment-product-${tag}`, brand: "Skinora Test", category: category._id, basePrice: 150000 });
    const variant = await Variant.create({ product: product._id, name: "30 ml", sku: `PAY-${tag}`.toUpperCase(), size: "30", unit: "ml", price: 150000, stock: 20 });
    const [owner, stranger] = await User.create([
      { fullName: "Payment Owner", email: `payment.owner.${tag}@example.com`, password: await bcrypt.hash(`Owner-${tag}`, 12) },
      { fullName: "Payment Stranger", email: `payment.stranger.${tag}@example.com`, password: await bcrypt.hash(`Stranger-${tag}`, 12) },
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
    const orderBody = (paymentMethod) => ({
      items: [{ variantId: String(variant._id), quantity: 2 }], paymentMethod,
      shippingAddress: { fullName: "Payment Owner", phone: "0900000000", province: "HCM", ward: "Ben Nghe", address: "1 Test" },
    });

    assert((await request("/payments/vnpay/create", { method: "POST", body: { orderId: String(new mongoose.Types.ObjectId()) } })).status === 401, "Create payment without token must return 401");
    assert((await request("/payments/vnpay/create", { method: "POST", token: ownerToken, body: { orderId: "invalid" } })).status === 400, "Invalid order ID must return 400");

    const stockBeforeCod = (await Variant.findById(variant._id)).stock;
    const cod = await request("/orders", { method: "POST", token: ownerToken, body: orderBody("COD") });
    assert(cod.status === 201 && cod.body.data.order.paymentMethod === "COD", "COD order regression failed");
    assert((await Variant.findById(variant._id)).stock === stockBeforeCod - 2, "COD stock was not deducted once");

    const vnpay = await request("/orders", { method: "POST", token: ownerToken, body: orderBody("VNPAY") });
    assert(vnpay.status === 201, "VNPay order creation failed");
    const orderId = vnpay.body.data.order._id;
    assert((await request("/payments/vnpay/create", { method: "POST", token: strangerToken, body: { orderId } })).status === 403, "Non-owner payment request must be forbidden");
    const create = await request("/payments/vnpay/create", { method: "POST", token: ownerToken, body: { orderId, amount: 1 } });
    assert(create.status === 200 && create.body.data.paymentUrl, "Payment URL generation failed");
    const paymentUrl = new URL(create.body.data.paymentUrl);
    assert(paymentUrl.searchParams.get("vnp_Amount") === "30000000", "Payment amount did not come from order total");
    assert(paymentUrl.searchParams.get("vnp_SecureHash")?.length === 128, "HMAC-SHA512 signature was not generated");
    assert(!JSON.stringify(create.body).includes(testSecret), "Hash secret leaked in create response");
    const savedOrder = await Order.findById(orderId);
    const ref = savedOrder.vnpayTxnRef;
    const successParams = {
      vnp_Amount: String(savedOrder.total * 100), vnp_BankCode: "NCB", vnp_PayDate: "20260923120000",
      vnp_ResponseCode: "00", vnp_TmnCode: "TESTCODE", vnp_TransactionNo: "12345678",
      vnp_TransactionStatus: "00", vnp_TxnRef: ref,
    };

    const validReturn = await request(`/payments/vnpay/return?${signedQuery(successParams)}`);
    assert(validReturn.status === 200 && validReturn.body.data.result === "pending", "Valid signed return was not verified safely");
    const invalidReturn = await request(`/payments/vnpay/return?${new URLSearchParams({ ...successParams, vnp_SecureHash: "bad" })}`);
    assert(invalidReturn.status === 400, "Invalid callback signature was accepted");
    const tamperedParams = { ...successParams, vnp_Amount: String((savedOrder.total + 1) * 100) };
    const tampered = await request(`/payments/vnpay/ipn?${signedQuery(tamperedParams)}`);
    assert(tampered.body.RspCode === "04", "Tampered callback amount was accepted");

    const stockBeforeIpn = (await Variant.findById(variant._id)).stock;
    const ipn = await request(`/payments/vnpay/ipn?${signedQuery(successParams)}`);
    assert(ipn.body.RspCode === "00", "Successful IPN failed");
    const paidOrder = await Order.findById(orderId).select("+stockDeducted");
    assert(paidOrder.paymentStatus === "paid" && paidOrder.stockDeducted, "Successful IPN did not mark order paid");
    assert((await Variant.findById(variant._id)).stock === stockBeforeIpn - 2, "Successful IPN did not deduct stock exactly once");
    const duplicate = await request(`/payments/vnpay/ipn?${signedQuery(successParams)}`);
    assert(duplicate.body.RspCode === "02", "Duplicate IPN was not idempotent");
    assert((await Variant.findById(variant._id)).stock === stockBeforeIpn - 2, "Duplicate IPN deducted stock twice");
    assert((await request("/payments/vnpay/create", { method: "POST", token: ownerToken, body: { orderId } })).status === 400, "Already-paid order allowed another payment");

    const failedCreate = await request("/orders", { method: "POST", token: ownerToken, body: { ...orderBody("VNPAY"), items: [{ variantId: String(variant._id), quantity: 1 }] } });
    const failedId = failedCreate.body.data.order._id;
    await request("/payments/vnpay/create", { method: "POST", token: ownerToken, body: { orderId: failedId } });
    const failedOrder = await Order.findById(failedId);
    const failedParams = { ...successParams, vnp_Amount: String(failedOrder.total * 100), vnp_ResponseCode: "24", vnp_TransactionStatus: "02", vnp_TxnRef: failedOrder.vnpayTxnRef };
    const stockBeforeFailure = (await Variant.findById(variant._id)).stock;
    assert((await request(`/payments/vnpay/ipn?${signedQuery(failedParams)}`)).body.RspCode === "00", "Failed-payment IPN was not acknowledged");
    assert((await Order.findById(failedId)).paymentStatus === "failed", "Failed payment status was not saved");
    assert((await Variant.findById(variant._id)).stock === stockBeforeFailure, "Failed payment changed stock");
    await Order.findByIdAndUpdate(failedId, { orderStatus: "cancelled" });
    assert((await request("/payments/vnpay/create", { method: "POST", token: ownerToken, body: { orderId: failedId } })).status === 400, "Cancelled order allowed payment");

    console.log("Payment auth, ownership and validation tests: passed");
    console.log("COD regression and server-authoritative amount: passed");
    console.log("VNPay URL and HMAC-SHA512 signature tests: passed");
    console.log("Return/IPN signature and amount tampering tests: passed");
    console.log("Successful, failed and duplicate IPN stock consistency: passed");
    console.log("All payment API tests passed (simulated VNPay Sandbox callbacks)");
  } catch (error) {
    console.error(`Payment API test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState !== 0) {
      await Promise.all([
        User.updateMany({ email: new RegExp(`^payment\\.(owner|stranger)\\.${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }, { isActive: false }),
        Product.updateMany({ slug: `payment-product-${tag}` }, { isActive: false }),
        Variant.updateMany({ sku: `PAY-${tag}`.toUpperCase() }, { isActive: false }),
        Category.updateMany({ slug: `payment-test-${tag}` }, { isActive: false }),
      ]);
      await mongoose.connection.close();
    }
    for (const key of Object.keys(process.env).filter((key) => key.startsWith("VNP_"))) delete process.env[key];
    Object.assign(process.env, originalVnp);
  }
};

run();
