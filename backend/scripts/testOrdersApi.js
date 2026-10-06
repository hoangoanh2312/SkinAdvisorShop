require("dotenv").config({ quiet: true });

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Order = require("../models/Order");
const { generateOrderCode, withOrderCodeRetry } = require("../services/orderCodeService");

mongoose.set("autoIndex", false);

const BASE = process.env.API_BASE_URL || "http://127.0.0.1:5000";
const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Orders-${tag}`;
const emails = {
  owner: `skinora.orders.owner.${tag}@example.com`,
  other: `skinora.orders.other.${tag}@example.com`,
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const request = async (path, method = "GET", body, token) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`${method} ${path} returned non-JSON ${response.status}`); }
  return { status: response.status, body: data };
};
const expectStatus = (result, status, label) => assert(result.status === status, `${label}: expected ${status}, received ${result.status}`);
const login = async (email) => {
  const result = await request("/api/auth/login", "POST", { email, password });
  expectStatus(result, 200, `Login ${email}`);
  return result.body.data.token;
};
const shippingAddress = { fullName: "Orders Owner", phone: "0901112233", province: "Ho Chi Minh City", ward: "Ben Nghe", address: "29 Skinora Street" };

const testOrderCodeRetry = async () => {
  assert(/^SKN\d{6}[A-Z0-9]{4}$/.test(generateOrderCode(new Date(2026, 8, 30))), "Generated order code format is invalid");
  let attempts = 0;
  const recovered = await withOrderCodeRetry(async (orderCode) => {
    attempts += 1;
    if (attempts < 3) throw { code: 11000, keyPattern: { orderCode: 1 } };
    return orderCode;
  }, { generate: () => "SKN260930TEST" });
  assert(recovered === "SKN260930TEST" && attempts === 3, "Order code collision did not retry and recover");

  attempts = 0;
  try {
    await withOrderCodeRetry(async () => {
      attempts += 1;
      throw { code: 11000, keyValue: { orderCode: "SKN260930FAIL" } };
    }, { generate: () => "SKN260930FAIL" });
    throw new Error("Order code collision retry unexpectedly succeeded");
  } catch (error) {
    assert(error.code === 11000 && attempts === 5, "Order code collision retry was not limited to five attempts");
  }
};

const run = async () => {
  try {
    await testOrderCodeRetry();
    await mongoose.connect(process.env.MONGO_URI);
    const hash = await bcrypt.hash(password, 12);
    const [owner, other, category] = await Promise.all([
      User.create({ fullName: "Orders Owner Test", email: emails.owner, password: hash }),
      User.create({ fullName: "Orders Other Test", email: emails.other, password: hash }),
      Category.create({ name: `Orders Category ${tag}`, slug: `orders-${tag}` }),
    ]);
    const product = await Product.create({ name: `Orders Serum ${tag}`, slug: `orders-serum-${tag}`, brand: `OrdersBrand-${tag}`, category: category._id, basePrice: 120000, skinTypes: ["normal"], skinConcerns: ["dryness"] });
    const variant = await Variant.create({ product: product._id, name: "50 ml", sku: `ORD-${tag}`.toUpperCase(), size: "50", unit: "ml", price: 120000, salePrice: 99000, stock: 20 });
    await mongoose.connection.close();

    const [ownerToken, otherToken] = await Promise.all([login(emails.owner), login(emails.other)]);
    const payload = { items: [{ variantId: variant._id, quantity: 1 }], shippingAddress, paymentMethod: "COD", orderCode: "CLIENT-CONTROLLED" };
    const firstResult = await request("/api/orders", "POST", payload, ownerToken);
    expectStatus(firstResult, 201, "Create first order");
    const first = firstResult.body.data.order;
    assert(/^SKN\d{6}[A-Z0-9]{4}$/.test(first.orderCode), `Generated orderCode has invalid format: ${first.orderCode}`);
    assert(first.orderCode !== payload.orderCode, "Client controlled orderCode");
    const shippingFields = Object.keys(first.shippingAddress).sort().join(",");
    assert(shippingFields === "address,fullName,phone,province,ward", `Shipping snapshot fields are invalid: ${shippingFields}`);

    const secondResult = await request("/api/orders", "POST", payload, ownerToken);
    expectStatus(secondResult, 201, "Create second order");
    const second = secondResult.body.data.order;
    assert(first.orderCode !== second.orderCode, "Two new orders received the same orderCode");

    const otherResult = await request("/api/orders", "POST", payload, otherToken);
    expectStatus(otherResult, 201, "Create other user's order");
    const otherOrder = otherResult.body.data.order;

    const ownerList = await request("/api/orders/my-orders?limit=100", "GET", undefined, ownerToken);
    expectStatus(ownerList, 200, "List owner orders");
    assert(ownerList.body.data.orders.some((order) => order._id === first._id), "Owner list omitted own order");
    assert(!ownerList.body.data.orders.some((order) => order._id === otherOrder._id), "Owner list exposed another user's order");
    expectStatus(await request(`/api/orders/${first._id}`, "GET", undefined, ownerToken), 200, "Owner order detail");
    expectStatus(await request(`/api/orders/${first._id}`, "GET", undefined, otherToken), 403, "Other user order detail");
    expectStatus(await request(`/api/orders/${first._id}/cancel`, "PUT", {}, otherToken), 403, "Other user cancel");

    await mongoose.connect(process.env.MONGO_URI);
    await Order.updateOne({ _id: second._id }, { $set: { orderStatus: "completed" } });
    const legacyInsert = await Order.collection.insertOne({
      user: owner._id,
      items: [{ product: product._id, variant: variant._id, productName: product.name, variantName: variant.name, sku: variant.sku, image: "", quantity: 1, unitPrice: 99000, subtotal: 99000 }],
      shippingAddress,
      subtotal: 99000,
      discount: 0,
      shippingFee: 0,
      total: 99000,
      voucher: null,
      voucherCode: "",
      paymentMethod: "COD",
      paymentStatus: "unpaid",
      orderStatus: "pending",
      note: "",
      stockDeducted: true,
      stockRestored: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await mongoose.connection.close();

    const completedList = await request("/api/orders/my-orders?status=completed&limit=100", "GET", undefined, ownerToken);
    expectStatus(completedList, 200, "Filter completed orders");
    assert(completedList.body.data.orders.length >= 1 && completedList.body.data.orders.every((order) => order.orderStatus === "completed"), "Status filter returned a non-completed order");
    const legacyResult = await request(`/api/orders/${legacyInsert.insertedId}`, "GET", undefined, ownerToken);
    expectStatus(legacyResult, 200, "Read legacy order without orderCode");
    assert(legacyResult.body.data.order.orderCode === undefined, "Legacy read unexpectedly generated orderCode");

    await mongoose.connect(process.env.MONGO_URI);
    const storedFirst = await Order.findById(first._id).lean();
    const storedSecond = await Order.findById(second._id).lean();
    assert(storedFirst.orderCode === first.orderCode, "Stored orderCode differs from API response");
    assert(storedFirst.shippingAddress.address === shippingAddress.address, "Shipping address snapshot changed");
    assert(storedSecond.orderCode === second.orderCode, "Second orderCode was not stored");
    const immutableOrder = await Order.findById(first._id);
    immutableOrder.orderCode = "SKN0000000000";
    await immutableOrder.save();
    const afterImmutableSave = await Order.findById(first._id).lean();
    assert(afterImmutableSave.orderCode === first.orderCode, "orderCode changed after a normal document save");
    console.log("All Phase 2.9B order API tests passed");
    console.log(`Test data retained: owner=${owner._id}, other=${other._id}, first=${first._id}, legacy=${legacyInsert.insertedId}`);
  } catch (error) {
    console.error(`Orders API test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  }
};

run();
