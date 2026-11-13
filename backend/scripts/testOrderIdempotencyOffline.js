const assert = require("node:assert/strict");
const { parseIdempotencyKey, fingerprintOrder, isIdempotencyCollision } = require("../services/orderIdempotency");

const key = "skn_3e452ef9-32f4-4e9c-a21c-01702ee799aa";
assert.equal(parseIdempotencyKey(key), key);
assert.equal(parseIdempotencyKey(null), null);
for (const invalid of ["", "x", "spaces not allowed", "a".repeat(129)]) {
  if (invalid === "") assert.equal(parseIdempotencyKey(invalid), null);
  else assert.throws(() => parseIdempotencyKey(invalid), /INVALID_IDEMPOTENCY_KEY/);
}
const shippingAddress = { fullName: "Test", phone: "0900000000", province: "TP.HCM", ward: "X", address: "123" };
const a = fingerprintOrder({ quantities: new Map([["b", 2], ["a", 1]]), shippingAddress, voucherCode: "welcome10", paymentMethod: "COD" });
const b = fingerprintOrder({ quantities: new Map([["a", 1], ["b", 2]]), shippingAddress, voucherCode: "WELCOME10", paymentMethod: "COD" });
assert.equal(a, b, "order of cart lines/case of voucher should not change fingerprint");
assert.notEqual(a, fingerprintOrder({ quantities: new Map([["a", 3], ["b", 2]]), shippingAddress, voucherCode: "WELCOME10", paymentMethod: "COD" }));
assert.equal(isIdempotencyCollision({ code: 11000, keyPattern: { idempotencyKey: 1 } }), true);
assert.equal(isIdempotencyCollision({ code: 11000, keyPattern: { orderCode: 1 } }), false);
console.log("Order idempotency offline checks PASS");
