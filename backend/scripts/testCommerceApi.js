require("dotenv").config({ quiet: true });

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");

mongoose.set("autoIndex", false);
const BASE = process.env.API_BASE_URL || "http://127.0.0.1:5000";
const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Commerce-${tag}`;
const emails = {
  admin: `skinora.commerce.admin.${tag}@example.com`,
  customer: `skinora.commerce.customer.${tag}@example.com`,
  other: `skinora.commerce.other.${tag}@example.com`,
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const request = async (path, method = "GET", body, token) => {
  const response = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`${method} ${path} returned non-JSON ${response.status}`); }
  return { status: response.status, body: data };
};
const expect = (result, status, label) => assert(result.status === status, `${label}: expected ${status}, received ${result.status}`);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const hash = await bcrypt.hash(password, 12);
    const [admin, customer, other, category] = await Promise.all([
      User.create({ fullName: "Commerce Admin Test", email: emails.admin, password: hash, role: "admin" }),
      User.create({ fullName: "Commerce Customer Test", email: emails.customer, password: hash }),
      User.create({ fullName: "Commerce Other Test", email: emails.other, password: hash }),
      Category.create({ name: `Commerce Category ${tag}`, slug: `commerce-${tag}` }),
    ]);
    const product = await Product.create({ name: `Commerce Serum ${tag}`, slug: `commerce-serum-${tag}`, brand: `CommerceBrand-${tag}`, category: category._id, basePrice: 100000, skinTypes: ["oily"], skinConcerns: ["acne"] });
    const variant = await Variant.create({ product: product._id, name: "30 ml", sku: `COM-${tag}`.toUpperCase(), size: "30", unit: "ml", price: 100000, salePrice: 90000, stock: 10 });
    await mongoose.connection.close();

    const login = async (email) => {
      const result = await request("/api/auth/login", "POST", { email, password });
      expect(result, 200, `Login ${email}`);
      return result.body.data.token;
    };
    const [adminToken, customerToken, otherToken] = await Promise.all([login(emails.admin), login(emails.customer), login(emails.other)]);

    expect(await request(`/api/products/${product._id}/reviews`), 200, "Public reviews");
    expect(await request(`/api/products/${product._id}/reviews`, "POST", { rating: 4 }), 401, "Review without token");
    const reviewCreate = await request(`/api/products/${product._id}/reviews`, "POST", { rating: 4, comment: "Commerce test review" }, customerToken);
    expect(reviewCreate, 201, "Create review");
    const reviewId = reviewCreate.body.data.review._id;
    expect(await request(`/api/products/${product._id}/reviews`, "POST", { rating: 4 }, customerToken), 409, "Duplicate review");
    expect(await request(`/api/products/${product._id}/reviews`, "POST", { rating: 6 }, otherToken), 400, "Invalid rating");
    expect(await request(`/api/reviews/${reviewId}`, "PUT", { rating: 5, comment: "Updated" }, customerToken), 200, "Update review");
    let productResult = await request(`/api/products/${product._id}`);
    assert(productResult.body.data.product.averageRating === 5 && productResult.body.data.product.reviewCount === 1, "Product rating was not updated");
    expect(await request(`/api/reviews/${reviewId}`, "DELETE", {}, customerToken), 200, "Delete review");
    productResult = await request(`/api/products/${product._id}`);
    assert(productResult.body.data.product.averageRating === 0 && productResult.body.data.product.reviewCount === 0, "Product rating was not reset");
    console.log("Review tests: passed");

    expect(await request("/api/vouchers", "POST", {}, customerToken), 403, "Customer voucher CRUD");
    const now = Date.now();
    const voucherPayload = { code: `COM${tag}`.replace(/[^A-Z0-9]/gi, "").toUpperCase(), description: "Commerce test", discountType: "percent", discountValue: 50, minOrderValue: 100000, maxDiscount: 10000, startDate: new Date(now - 60000), endDate: new Date(now + 86400000), usageLimit: 10 };
    const voucherCreate = await request("/api/vouchers", "POST", voucherPayload, adminToken);
    expect(voucherCreate, 201, "Create voucher");
    const voucherId = voucherCreate.body.data.voucher._id;
    expect(await request("/api/vouchers", "POST", voucherPayload, adminToken), 409, "Duplicate voucher");
    const validVoucher = await request("/api/vouchers/validate", "POST", { code: voucherPayload.code, orderValue: 100000 }, customerToken);
    expect(validVoucher, 200, "Validate voucher");
    assert(validVoucher.body.data.discount === 10000 && validVoucher.body.data.finalValue === 90000, "Voucher maxDiscount calculation is wrong");
    const vouchersAfterValidation = await request("/api/vouchers", "GET", undefined, adminToken);
    const unchangedVoucher = vouchersAfterValidation.body.data.vouchers.find((item) => item._id === voucherId);
    assert(unchangedVoucher?.usedCount === 0, "Voucher validation changed usedCount");
    expect(await request("/api/vouchers/validate", "POST", { code: voucherPayload.code, orderValue: 50000 }, customerToken), 400, "Voucher minimum order");
    const expiredCode = `EXP${tag}`.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    expect(await request("/api/vouchers", "POST", { ...voucherPayload, code: expiredCode, startDate: new Date(now - 120000), endDate: new Date(now - 60000) }, adminToken), 201, "Create expired voucher");
    expect(await request("/api/vouchers/validate", "POST", { code: expiredCode, orderValue: 200000 }, customerToken), 400, "Expired voucher");
    console.log("Voucher tests: passed");

    const address = { fullName: "Commerce Customer", phone: "0900000000", province: "Ha Noi", district: "Ba Dinh", ward: "Cong Vi", addressLine: "1 Test Street" };
    const orderPayload = { items: [{ variantId: variant._id, quantity: 2, unitPrice: 1, subtotal: 1 }], shippingAddress: address, voucherCode: voucherPayload.code, paymentMethod: "COD", total: 1, discount: 999999 };
    const orderCreate = await request("/api/orders", "POST", orderPayload, customerToken);
    expect(orderCreate, 201, "Create COD order");
    const order = orderCreate.body.data.order;
    assert(order.items[0].unitPrice === 90000 && order.subtotal === 180000 && order.discount === 10000 && order.total === 170000, "Server-side order calculation is wrong");
    let variants = (await request(`/api/products/${product._id}/variants`)).body.data.variants;
    assert(variants.find((item) => item._id === String(variant._id)).stock === 8, "Stock was not deducted");
    expect(await request("/api/orders", "POST", { ...orderPayload, items: [{ variantId: variant._id, quantity: 999 }] }, customerToken), 400, "Insufficient stock");
    expect(await request("/api/orders/my-orders", "GET", undefined, customerToken), 200, "My orders");
    expect(await request(`/api/orders/${order._id}`, "GET", undefined, customerToken), 200, "Owner order detail");
    expect(await request(`/api/orders/${order._id}`, "GET", undefined, otherToken), 403, "Other user order detail");
    expect(await request(`/api/orders/${order._id}/cancel`, "PUT", {}, customerToken), 200, "Cancel pending order");
    variants = (await request(`/api/products/${product._id}/variants`)).body.data.variants;
    assert(variants.find((item) => item._id === String(variant._id)).stock === 10, "Stock was not restored");
    expect(await request(`/api/orders/${order._id}/cancel`, "PUT", {}, customerToken), 400, "Second cancel");
    variants = (await request(`/api/products/${product._id}/variants`)).body.data.variants;
    assert(variants.find((item) => item._id === String(variant._id)).stock === 10, "Stock was restored twice");
    console.log("Order calculation, stock and cancellation tests: passed");

    expect(await request("/api/admin/orders", "GET", undefined, customerToken), 403, "Customer admin orders");
    expect(await request("/api/admin/orders", "GET", undefined, adminToken), 200, "Admin orders list");
    const secondOrder = await request("/api/orders", "POST", { ...orderPayload, voucherCode: "", items: [{ variantId: variant._id, quantity: 1 }] }, customerToken);
    expect(secondOrder, 201, "Second order");
    const secondId = secondOrder.body.data.order._id;
    expect(await request(`/api/admin/orders/${secondId}/status`, "PUT", { orderStatus: "confirmed" }, adminToken), 200, "Confirm order");
    expect(await request(`/api/admin/orders/${secondId}/status`, "PUT", { orderStatus: "shipping" }, adminToken), 200, "Ship order");
    expect(await request(`/api/admin/orders/${secondId}/status`, "PUT", { orderStatus: "pending" }, adminToken), 400, "Invalid reverse transition");
    expect(await request(`/api/admin/orders/${secondId}/status`, "PUT", { orderStatus: "completed" }, adminToken), 200, "Complete order");
    console.log("Authorization and order status transition tests: passed");

    console.log(`Test data retained: admin=${admin._id}, customer=${customer._id}, other=${other._id}, category=${category._id}, product=${product._id}, variant=${variant._id}, voucher=${voucherId}, cancelledOrder=${order._id}, completedOrder=${secondId}`);
    console.log("All commerce API tests passed");
  } catch (error) {
    console.error(`Commerce API test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  }
};

run();
