/* Offline ZaloPay checks: HMAC-SHA256 (RFC 4231-style known vector), create/query requests, callback + redirect verification,
   and the return flow (paid once, amount guard). No network, no MongoDB. */
const assert = require("node:assert/strict");
Object.assign(process.env, {
  ZALOPAY_APP_ID: "2553", ZALOPAY_KEY1: "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL", ZALOPAY_KEY2: "kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz",
  ZALOPAY_REDIRECT_URL: "http://localhost:5173/payment/result",
});
const mongoose = require("mongoose");
const zalopay = require("../services/zalopayService");
const Order = require("../models/Order");
const Variant = require("../models/Variant");
const ledger = require("../services/stockLedger");
const { paymentCapabilities } = require("../services/paymentCapabilities");

(async () => {
  // 1) HMAC-SHA256 hex, as in the official Node sample: CryptoJS.HmacSHA256(data, key1).toString().
  assert.equal(zalopay.hmac("key", "The quick brown fox jumps over the lazy dog"), "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");

  // 2) app_trans_id format yymmdd_xxx, <= 40 chars, unique.
  const id1 = zalopay.createAppTransId("665f1c2b9d3e4a0012345678", new Date("2026-11-13T16:30:00Z"));
  assert.match(id1, /^261113_/); assert.ok(id1.length <= 40);
  assert.notEqual(id1, zalopay.createAppTransId("665f1c2b9d3e4a0012345678", new Date("2026-11-13T16:30:00Z")));

  // 3) Create request is signed and sends the redirect url in embed_data.
  let sent;
  const created = await zalopay.createGatewayOrder({ orderId: "665f1c2b9d3e4a0012345678", amount: 150000, userId: "u1",
    fetchImpl: async (url, init) => { sent = { url, body: Object.fromEntries(new URLSearchParams(init.body)) }; return { ok: true, json: async () => ({ return_code: 1, order_url: "https://qcgateway.zalopay.vn/openinapp?order=abc" }) }; } });
  assert.equal(sent.url, "https://sb-openapi.zalopay.vn/v2/create");
  const b = sent.body;
  assert.equal(b.mac, zalopay.hmac(process.env.ZALOPAY_KEY1, [b.app_id, b.app_trans_id, b.app_user, b.amount, b.app_time, b.embed_data, b.item].join("|")));
  assert.equal(JSON.parse(b.embed_data).redirecturl, "http://localhost:5173/payment/result");
  assert.equal(created.orderUrl, "https://qcgateway.zalopay.vn/openinapp?order=abc");
  await assert.rejects(zalopay.createGatewayOrder({ orderId: "x", amount: 500 }), /ZALOPAY_INVALID_AMOUNT/);
  await assert.rejects(zalopay.createGatewayOrder({ orderId: "x", amount: 5000, fetchImpl: async () => ({ ok: true, json: async () => ({ return_code: 2, return_message: "fail" }) }) }), /ZALOPAY_CREATE_FAILED/);

  // 4) Query MAC = HMAC(key1, app_id|app_trans_id|key1); return_code 1/2/3 mapping.
  let querySent;
  const q = await zalopay.queryOrderStatus("261113_abc", async (url, init) => { querySent = Object.fromEntries(new URLSearchParams(init.body)); return { ok: true, json: async () => ({ return_code: 1, amount: 150000, zp_trans_id: 123 }) }; });
  assert.equal(querySent.mac, zalopay.hmac(process.env.ZALOPAY_KEY1, "2553|261113_abc|" + process.env.ZALOPAY_KEY1));
  assert.deepEqual([q.status, q.amount, q.zpTransId], ["paid", 150000, "123"]);
  assert.equal((await zalopay.queryOrderStatus("x", async () => ({ ok: true, json: async () => ({ return_code: 3 }) }))).status, "processing");

  // 5) Callback and redirect verification with key2.
  const data = JSON.stringify({ app_trans_id: "261113_abc", amount: 150000, zp_trans_id: 9 });
  assert.equal(zalopay.verifyCallback({ data, mac: zalopay.hmac(process.env.ZALOPAY_KEY2, data) }).valid, true);
  assert.equal(zalopay.verifyCallback({ data, mac: zalopay.hmac(process.env.ZALOPAY_KEY1, data) }).valid, false, "key1 must not validate callbacks");
  const redirect = { appid: "2553", apptransid: "261113_abc", pmcid: "38", bankcode: "", amount: "150000", discountamount: "0", status: "1" };
  redirect.checksum = zalopay.hmac(process.env.ZALOPAY_KEY2, Object.values(redirect).join("|"));
  assert.equal(zalopay.verifyRedirect(redirect), true);
  assert.equal(zalopay.verifyRedirect({ ...redirect, amount: "1" }), false);

  // 6) Capabilities: sandbox ok in dev, never in production; keys never exposed.
  assert.equal(paymentCapabilities(process.env).ZALOPAY.mode, "sandbox");
  assert.equal(paymentCapabilities({ ...process.env, NODE_ENV: "production" }).ZALOPAY.available, false);
  assert.equal(paymentCapabilities({ ...process.env, VNPAY_ENABLED: "false", VNP_TMN_CODE: "T", VNP_HASH_SECRET: "s", VNP_URL: "https://sandbox.vnpayment.vn/x", VNP_RETURN_URL: "https://x/r" }).VNPAY.available, false);

  // 7) Return flow: checksum -> authoritative query -> paid once; amount mismatch rejected.
  const order = { _id: "o1", total: 150000, paymentMethod: "ZALOPAY", orderStatus: "pending", paymentStatus: "unpaid", zalopayAppTransId: "261113_abc", items: [{ variant: "v1", quantity: 1 }], save: async () => {} };
  let decremented = 0;
  const chain = (v) => ({ select() { return this; }, session() { return Promise.resolve(v); }, then(r, j) { return Promise.resolve(v).then(r, j); } });
  Order.findOne = async () => order; Order.findById = () => chain(order);
  Variant.updateOne = async () => { decremented += 1; return { modifiedCount: 1 }; };
  ledger.recordStockMovement = async () => {};
  mongoose.startSession = async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} });
  let remote = { status: "paid", amount: 150000, zpTransId: "77" };
  zalopay.queryOrderStatus = async () => remote;
  const { zalopayReturn, zalopayCallback } = require("../controllers/paymentController");
  const res = () => ({ code: 0, body: null, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; } });
  let r = res(); await zalopayReturn({ query: redirect }, r);
  assert.equal(r.body.data.result, "success"); assert.equal(order.paymentStatus, "paid"); assert.equal(order.zalopayTransId, "77"); assert.equal(decremented, 1);
  r = res(); await zalopayReturn({ query: redirect }, r); assert.equal(decremented, 1, "reload must not deduct stock twice");
  r = res(); await zalopayCallback({ body: { data, mac: zalopay.hmac(process.env.ZALOPAY_KEY2, data) } }, r);
  assert.equal(decremented, 1, "late callback must not deduct again");
  r = res(); await zalopayReturn({ query: { ...redirect, checksum: "bad" } }, r);
  assert.equal(r.code, 200); assert.equal(r.body.data.orderId, "", "untrusted redirect never reveals the order id");
  assert.equal(decremented, 1, "bad checksum cannot cause extra stock deduction");
  r = res(); await zalopayReturn({ query: { ...redirect, apptransid: "x'; drop" } }, r); assert.equal(r.code, 400);
  Object.assign(order, { paymentStatus: "unpaid", stockDeducted: false }); remote = { status: "paid", amount: 1000, zpTransId: "x" };
  r = res(); await zalopayReturn({ query: redirect }, r); assert.equal(r.code, 400); assert.equal(order.paymentStatus, "unpaid", "amount mismatch never marks paid");
  remote = { status: "processing" };
  r = res(); await zalopayReturn({ query: redirect }, r); assert.equal(r.body.data.result, "pending");
  remote = { status: "failed" };
  r = res(); await zalopayReturn({ query: { ...redirect } }, r); assert.equal(order.paymentStatus, "failed"); assert.equal(r.body.data.result, "failed");

  console.log("ZALOPAY_OFFLINE_PASS: HMAC-SHA256, signed create/query, key2 callback+redirect, paid once, amount guard, sandbox gating");
})().catch((error) => { console.error(error); process.exit(1); });
