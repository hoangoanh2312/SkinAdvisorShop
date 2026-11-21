/* Offline: forgot/reset password, e-mail verification, profile update, change password + token revocation,
   review purchase rule, voucher code and address length limits. No MongoDB, no real e-mail. */
const assert = require("node:assert/strict");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET = "test-secret";
const User = require("../models/User");
const Order = require("../models/Order");
const Review = require("../models/Review");
const Product = require("../models/Product");
const mail = require("../services/mailService");
const auth = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { createReview, getReviewEligibility } = require("../controllers/reviewController");
const { validateVoucher } = require("../controllers/voucherController");
const { createAddress } = require("../controllers/addressController");

const res = () => ({ code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, set() { return this; } });
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
const sent = [];
mail.setMailTransportForTests(async (m) => { sent.push(m); return { delivered: true }; });
const linkToken = (m) => m.text.match(/token=([a-f0-9]{64})/)[1];

(async () => {
  const user = { _id: "u1", fullName: "Trần Oanh", email: "oanh@test.vn", role: "customer", isActive: true, password: await bcrypt.hash("Old!pass1", 4), addresses: [], save: async function () { return this; } };
  const chain = (v) => ({ select() { return chain(v); }, then(r, j) { return Promise.resolve(v).then(r, j); } });
  User.findOne = (q) => chain(q.email ? (q.email === user.email ? user : null)
    : q.passwordResetTokenHash ? (q.passwordResetTokenHash === user.passwordResetTokenHash && user.passwordResetExpires > new Date() ? user : null)
    : q.emailVerifyTokenHash ? (q.emailVerifyTokenHash === user.emailVerifyTokenHash && user.emailVerifyExpires > new Date() ? user : null) : null);
  User.findById = () => chain(user);

  // Forgot password: generic answer for unknown e-mail, mail with one-time link for a real account.
  let r = res(); await auth.forgotPassword({ body: { email: "nobody@test.vn" } }, r);
  assert.equal(r.code, 200); assert.equal(sent.length, 0, "no mail for unknown account");
  r = res(); await auth.forgotPassword({ body: { email: "OANH@test.vn" } }, r);
  assert.equal(r.code, 200); assert.equal(sent.length, 1);
  const resetToken = linkToken(sent[0]);
  assert.equal(user.passwordResetTokenHash, sha(resetToken), "only the hash is stored");
  // Reset: weak password refused, then success, token single-use.
  r = res(); await auth.resetPassword({ body: { token: resetToken, password: "weakpass" } }, r); assert.equal(r.code, 400);
  r = res(); await auth.resetPassword({ body: { token: resetToken, password: "New!pass1" } }, r); assert.equal(r.code, 200);
  assert.ok(await bcrypt.compare("New!pass1", user.password)); assert.equal(user.emailVerified, true);
  r = res(); await auth.resetPassword({ body: { token: resetToken, password: "New!pass2" } }, r); assert.equal(r.code, 400, "reset link cannot be reused");
  // Expired reset link.
  user.passwordResetTokenHash = sha("a".repeat(64)); user.passwordResetExpires = new Date(Date.now() - 1000);
  r = res(); await auth.resetPassword({ body: { token: "a".repeat(64), password: "New!pass3" } }, r); assert.equal(r.code, 400);

  // Token issued before the reset is rejected by protect.
  const oldToken = jwt.sign({ id: "u1", role: "customer", iat: Math.floor(Date.now() / 1000) - 3600 }, process.env.JWT_SECRET);
  let nextCalled = false; r = res(); await protect({ headers: { authorization: `Bearer ${oldToken}` } }, r, () => { nextCalled = true; });
  assert.equal(nextCalled, false); assert.equal(r.code, 401);

  // E-mail verification: resend sends a link, verify consumes it.
  user.emailVerified = false; sent.length = 0;
  r = res(); await auth.resendVerification({ user }, r); assert.equal(r.code, 200); assert.equal(sent.length, 1);
  r = res(); await auth.verifyEmail({ body: { token: linkToken(sent[0]) } }, r); assert.equal(r.code, 200); assert.equal(user.emailVerified, true);
  r = res(); await auth.verifyEmail({ body: { token: "<script>" } }, r); assert.equal(r.code, 400);

  // Profile update: name rules, 10-digit phone, empty phone allowed.
  r = res(); await auth.updateMe({ user, body: { fullName: "A1", phone: "" } }, r); assert.equal(r.code, 400);
  r = res(); await auth.updateMe({ user, body: { fullName: "Trần Hoàng Oanh", phone: "012346789922" } }, r); assert.equal(r.code, 400);
  r = res(); await auth.updateMe({ user, body: { fullName: "  Trần  Hoàng Oanh ", phone: "+84 912 345 678" } }, r);
  assert.equal(r.code, 200); assert.equal(user.fullName, "Trần Hoàng Oanh"); assert.equal(user.phone, "0912345678");

  // Change password: needs current password, new policy, returns a token that still works.
  r = res(); await auth.changePassword({ user, body: { currentPassword: "wrong", newPassword: "Next!pass1" } }, r); assert.equal(r.code, 400);
  r = res(); await auth.changePassword({ user, body: { currentPassword: "New!pass1", newPassword: "New!pass1" } }, r); assert.equal(r.code, 400);
  r = res(); await auth.changePassword({ user, body: { currentPassword: "New!pass1", newPassword: "Next!pass1" } }, r); assert.equal(r.code, 200);
  nextCalled = false; await protect({ headers: { authorization: `Bearer ${r.body.data.token}` } }, res(), () => { nextCalled = true; });
  assert.equal(nextCalled, true, "the fresh token keeps the current session signed in");

  // Reviews: only after a completed order containing the product.
  const productId = "507f1f77bcf86cd799439011";
  Product.exists = async () => true;
  let completed = false; Order.exists = async (q) => (completed && q.orderStatus === "completed" ? { _id: "o" } : null);
  Review.findOne = () => chain(null);
  r = res(); await createReview({ user, params: { productId }, body: { rating: 5 } }, r); assert.equal(r.code, 403);
  r = res(); await getReviewEligibility({ user, params: { productId } }, r); assert.deepEqual([r.body.data.eligible, r.body.data.reason], [false, "not_purchased"]);
  completed = true;
  r = res(); await getReviewEligibility({ user, params: { productId } }, r); assert.equal(r.body.data.eligible, true);
  r = res(); await createReview({ user: { ...user, role: "admin" }, params: { productId }, body: { rating: 5 } }, r); assert.equal(r.code, 403);

  // Voucher code and address limits.
  r = res(); await validateVoucher({ user, body: { code: "X".repeat(31), orderValue: 100000 } }, r); assert.equal(r.code, 400);
  r = res(); await createAddress({ user, body: { fullName: "An", phone: "0912345678", province: "Hải Phòng", ward: "Gia Viên", address: "1".repeat(201) } }, r);
  assert.equal(r.code, 400); assert.match(r.body.message, /tối đa 200/);
  r = res(); await createAddress({ user, body: { fullName: "<b>An</b>", phone: "0912345678", province: "Hải Phòng", ward: "Gia Viên", address: "123" } }, r);
  assert.equal(r.code, 400);

  console.log("ACCOUNT_FEATURES_OFFLINE_PASS: forgot/reset (hashed, single-use, expiring), verify e-mail, profile, change password + token revocation, purchase-only reviews, length limits");
})().catch((error) => { console.error(error); process.exit(1); });
