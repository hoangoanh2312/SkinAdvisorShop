require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { startTestServer } = require("../utils/testServer");
const generateToken = require("../utils/generateToken");
const User = require("../models/User");
const googleService = require("../services/googleOAuthService");

const originalVerifier = googleService.verifyGoogleCode;
const originalOrigins = process.env.GOOGLE_ALLOWED_ORIGINS;

async function run() {
  process.env.JWT_SECRET ||= "google-test-only-secret";
  process.env.GOOGLE_ALLOWED_ORIGINS = "http://localhost:5173";
  // These fixtures exercise account-linking policy. No call is presented as a live Google sign-in.
  let profile = { sub: "google-test-sub-new", email: "new-google@example.test", name: "Google Customer" };
  googleService.verifyGoogleCode = async (_code, origin) => {
    if (origin !== "http://localhost:5173") throw new Error("GOOGLE_ORIGIN_NOT_ALLOWED");
    return profile;
  };
  delete require.cache[require.resolve("../controllers/googleAuthController")];
  delete require.cache[require.resolve("../routes/authRoutes")];
  delete require.cache[require.resolve("../app")];
  const test = await startTestServer();
  try {
    assert.match(test.databaseName, /_test$/);
    const request = async (path, { token, origin = "http://localhost:5173", code = "test-code" } = {}) => {
      const response = await fetch(`${test.baseUrl}/api/auth${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ code }) });
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await request("/google", { origin: "https://evil.example" })).status, 403);
    const created = await request("/google");
    assert.equal(created.status, 200);
    assert.equal(created.body.data.user.role, "customer");
    assert.ok(created.body.data.token);
    const stored = await User.findOne({ email: profile.email }).select("+googleSub +password");
    assert.equal(stored.googleSub, profile.sub);
    assert.notEqual(stored.password, "test-code");
    assert.equal((await request("/google")).status, 200);
    const existing = await User.create({ fullName: "Existing Customer", email: "existing@example.test", password: await bcrypt.hash("test-password", 10), role: "customer" });
    profile = { sub: "google-test-existing", email: existing.email, name: "Existing Customer" };
    assert.equal((await request("/google")).status, 409, "existing email must not auto-link");
    assert.equal((await request("/google/link")).status, 401, "link requires a session");
    assert.equal((await request("/google/link", { token: generateToken(existing) })).status, 200);
    assert.equal((await User.findById(existing._id).select("+googleSub")).googleSub, profile.sub);
    const admin = await User.create({ fullName: "Admin Test", email: "admin-google@example.test", password: await bcrypt.hash("test-password", 10), role: "admin" });
    profile = { sub: "google-test-admin", email: admin.email, name: "Admin Test" };
    assert.equal((await request("/google")).status, 409);
    assert.equal((await request("/google/link", { token: generateToken(admin) })).status, 403);
    profile = { sub: "google-test-other", email: "other@example.test", name: "Other" };
    assert.equal((await request("/google/link", { token: generateToken(existing) })).status, 409, "link email must match session");
    stored.isActive = false; await stored.save();
    profile = { sub: "google-test-sub-new", email: "new-google@example.test", name: "Google Customer" };
    assert.equal((await request("/google")).status, 403, "inactive user must be blocked");
    console.log(`Google auth account and authorization policy PASS (${test.databaseName}; provider test double, no live Google call)`);
  } finally {
    await test.close();
    googleService.verifyGoogleCode = originalVerifier;
    if (originalOrigins === undefined) delete process.env.GOOGLE_ALLOWED_ORIGINS;
    else process.env.GOOGLE_ALLOWED_ORIGINS = originalOrigins;
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
