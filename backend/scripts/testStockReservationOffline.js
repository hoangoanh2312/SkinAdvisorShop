/* Offline: hạn giữ hàng, hoàn kho khi hủy/hết hạn, thông báo thiếu hàng, hạn giao dịch gửi sang ZaloPay/VNPay. */
const assert = require("node:assert/strict");
const Variant = require("../models/Variant");
const InventoryMovement = require("../models/InventoryMovement");
const R = require("../services/stockReservation");
const { stockMessage } = require("../controllers/orderController");

(async () => {
  // 1. Hạn giữ hàng theo phương thức thanh toán
  const now = new Date("2026-11-16T06:00:00Z");
  assert.equal(R.reservationDeadline("COD", now), null);
  assert.equal(R.reservationDeadline("ZALOPAY", now).getTime() - now.getTime(), 15 * 60 * 1000);
  assert.equal(R.reservationDeadline("VNPAY", now).getTime() - now.getTime(), 15 * 60 * 1000);
  assert.equal(R.reservationDeadline("BANK_TRANSFER", now).getTime() - now.getTime(), 24 * 3600 * 1000);
  process.env.PAYMENT_HOLD_MINUTES = "30";
  assert.equal(R.reservationDeadline("ZALOPAY", now).getTime() - now.getTime(), 30 * 60 * 1000);
  process.env.PAYMENT_HOLD_MINUTES = "abc";
  assert.equal(R.reservationDeadline("ZALOPAY", now).getTime() - now.getTime(), 15 * 60 * 1000);
  delete process.env.PAYMENT_HOLD_MINUTES;
  const filter = R.expiredFilter(now);
  assert.deepEqual(filter.paymentStatus.$in, ["unpaid", "failed"], "Đơn chuyển khoản đang chờ admin đối soát không bị tự hủy");
  assert.equal(filter.orderStatus, "pending");
  assert.equal(R.secondsLeft({ reservedUntil: new Date(now.getTime() + 90000) }, now), 90);
  assert.equal(R.secondsLeft({ reservedUntil: null }, now), null);
  console.log("PASS: hold 15 min online / 24h bank transfer / none for COD; pending_verification is never auto-cancelled");

  // 2. Hoàn kho + hủy đơn (kho giả lập trong bộ nhớ)
  const stock = { v1: 1 }; const movements = [];
  const origUpdate = Variant.updateOne, origFind = Variant.findById, origCreate = InventoryMovement.create;
  Variant.updateOne = async ({ _id }, { $inc }) => { stock[_id] += $inc.stock; return { modifiedCount: 1 }; };
  Variant.findById = (id) => ({ select: () => ({ session: async () => ({ stock: stock[id], product: "p1" }) }) });
  InventoryMovement.create = async ([m]) => { movements.push(m); return [m]; };
  try {
    const order = { orderCode: "SB-1", items: [{ variant: "v1", quantity: 5 }], stockDeducted: true, stockRestored: false, orderStatus: "pending", reservedUntil: now };
    assert.equal(await R.restockAndCancel(order, "Hết thời gian giữ hàng chờ thanh toán", null), true);
    assert.equal(stock.v1, 6, "5 sản phẩm được trả lại kho");
    assert.equal(order.orderStatus, "cancelled"); assert.equal(order.stockRestored, true); assert.equal(order.reservedUntil, null);
    assert.equal(movements[0].kind, "cancellation"); assert.equal(movements[0].before, 1); assert.equal(movements[0].after, 6);
    assert.equal(await R.restockAndCancel(order, "lần 2", null), false, "Không hoàn kho hai lần");
    assert.equal(stock.v1, 6);
  } finally { Variant.updateOne = origUpdate; Variant.findById = origFind; InventoryMovement.create = origCreate; }
  console.log("PASS: expired/failed order restocks exactly once and is cancelled with a reason");

  // 3. Thông báo khi không đủ hàng
  assert.equal(stockMessage({ productName: "Gel rửa mặt", variantName: "150 ml", available: 1, requested: 3 }),
    '"Gel rửa mặt – 150 ml" chỉ còn 1 sản phẩm, bạn đang đặt 3. Vui lòng giảm số lượng trong giỏ hàng.');
  assert.match(stockMessage({ productName: "Gel rửa mặt", variantName: "", available: 0, requested: 3 }), /"Gel rửa mặt" vừa hết hàng/);
  console.log("PASS: insufficient-stock message names the SKU and remaining quantity");

  // 4. Hạn giao dịch gửi sang cổng thanh toán
  Object.assign(process.env, { ZALOPAY_APP_ID: "2554", ZALOPAY_KEY1: "k1", ZALOPAY_KEY2: "k2", ZALOPAY_ENDPOINT: "https://sb-openapi.zalopay.vn/v2" });
  const zalopay = require("../services/zalopayService");
  let sent = null;
  const fetchImpl = async (_url, init) => { sent = Object.fromEntries(new URLSearchParams(init.body)); return { ok: true, json: async () => ({ return_code: 1, order_url: "https://pay" }) }; };
  await zalopay.createGatewayOrder({ orderId: "507f1f77bcf86cd799439011", amount: 100000, expireSeconds: 120, fetchImpl });
  assert.equal(sent.expire_duration_seconds, "300", "ZaloPay tối thiểu 300 giây");
  await zalopay.createGatewayOrder({ orderId: "507f1f77bcf86cd799439011", amount: 100000, expireSeconds: 840.6, fetchImpl });
  assert.equal(sent.expire_duration_seconds, "840");
  await zalopay.createGatewayOrder({ orderId: "507f1f77bcf86cd799439011", amount: 100000, fetchImpl });
  assert.equal(sent.expire_duration_seconds, undefined);
  Object.assign(process.env, { VNP_TMN_CODE: "T", VNP_HASH_SECRET: "S", VNP_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", VNP_RETURN_URL: "http://localhost/r" });
  const { createPaymentUrl } = require("../services/vnpayService");
  const t0 = new Date("2026-11-16T06:00:00Z");
  const url = createPaymentUrl({ orderId: "x", amount: 1000, now: t0, expireAt: new Date(t0.getTime() + 15 * 60 * 1000) }).paymentUrl;
  assert.match(url, /vnp_ExpireDate=20261116131500/);
  assert.doesNotMatch(createPaymentUrl({ orderId: "x", amount: 1000, now: t0 }).paymentUrl, /vnp_ExpireDate/);
  console.log("SKINORA_STOCK_RESERVATION_OFFLINE_PASS: gateways stop accepting payment when the hold expires");
})().catch((error) => { console.error(error); process.exitCode = 1; });
