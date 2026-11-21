/* Offline: Vietnamese 10-digit mobile + password policy, enforced by register, address book and orders. */
const assert = require("node:assert/strict");
const { normalizeVnPhone, passwordProblems } = require("../utils/inputPolicy");
const User = require("../models/User");

// Phone: exactly 10 digits, 03/05/07/08/09, common formats normalised.
for (const [input, expected] of [["0912345678", "0912345678"], ["+84 912 345 678", "0912345678"], ["84912345678", "0912345678"], ["091.234.5678", "0912345678"],
  ["012346789922", null], ["0212345678", null], ["091234567", null], ["09123456789", null], ["", null], [null, null]]) {
  assert.equal(normalizeVnPhone(input), expected, String(input));
}
// Password: >= 8, 1 uppercase (incl. Vietnamese), 1 special.
assert.deepEqual(passwordProblems("Abcdef!1"), []);
assert.deepEqual(passwordProblems("Mật khẩu@2026"), []);
assert.ok(passwordProblems("mật khẩu@2026").includes("1 chữ in hoa"), "lowercase accented letters are not uppercase");
assert.ok(passwordProblems("Abcdefgh").some((p) => p.includes("đặc biệt")));
assert.ok(passwordProblems("Ab!1").includes("ít nhất 8 ký tự"));
assert.ok(passwordProblems("A!" + "a".repeat(80)).includes("tối đa 72 ký tự"));

const res = () => ({ code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
(async () => {
  const { register } = require("../controllers/authController");
  let r = res(); await register({ body: { fullName: "An Nguyễn", email: "a@b.vn", password: "123456" } }, r);
  assert.equal(r.code, 400); assert.match(r.body.message, /chữ in hoa/);

  const saved = []; const user = { addresses: Object.assign(saved, { id: () => null }), save: async () => {} };
  User.findById = async () => user;
  const { createAddress } = require("../controllers/addressController");
  const base = { fullName: "An", province: "Hải Phòng", ward: "Gia Viên", address: "123" };
  r = res(); await createAddress({ user: { _id: "u" }, body: { ...base, phone: "012346789922" } }, r);
  assert.equal(r.code, 400); assert.match(r.body.message, /10 chữ số/);
  r = res(); await createAddress({ user: { _id: "u" }, body: { ...base, phone: "+84 912 345 678" } }, r);
  assert.equal(r.code, 201); assert.equal(saved[0].phone, "0912345678", "stored in normalised form");

  const { createOrder } = require("../controllers/orderController");
  process.env.BANK_CODE = ""; // COD only
  r = res(); await createOrder({ user: { _id: "u" }, headers: {}, get: () => undefined, body: { items: [{ variantId: "507f1f77bcf86cd799439011", quantity: 1 }], paymentMethod: "COD", shippingAddress: { ...base, phone: "012346789922" } } }, r);
  assert.equal(r.code, 400); assert.match(r.body.message, /10 chữ số/);
  console.log("INPUT_POLICY_OFFLINE_PASS: 10-digit VN mobile + password (8+, uppercase, special) enforced in register, address book and orders");
})().catch((error) => { console.error(error); process.exit(1); });
