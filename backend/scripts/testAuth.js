require("dotenv").config({ quiet: true });

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");

mongoose.set("autoIndex", false);

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:5000";
const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const testEmail = `skinora.auth.test.${uniquePart}@example.com`;
const testPassword = `Test-${uniquePart}`;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const hasPassword = (value) =>
  Boolean(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "password"));

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json();
  return { status: response.status, body };
};

const run = async () => {
  try {
    console.log(`Test email: ${testEmail}`);

    const register = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Skinora Auth Test",
        email: testEmail.toUpperCase(),
        password: testPassword,
        role: "admin",
      }),
    });
    assert(register.status === 201, `Register expected 201, received ${register.status}`);
    assert(register.body.data?.user?.role === "customer", "Register role is not customer");
    assert(Boolean(register.body.data?.token), "Register token is missing");
    assert(!hasPassword(register.body.data?.user), "Register response contains password");
    console.log("Register: passed (HTTP 201, customer role, token present)");

    const login = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert(login.status === 200, `Login expected 200, received ${login.status}`);
    assert(Boolean(login.body.data?.token), "Login token is missing");
    assert(!hasPassword(login.body.data?.user), "Login response contains password");
    console.log("Login: passed (HTTP 200, token present)");

    const wrongPassword = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: `${testPassword}-wrong` }),
    });
    assert(wrongPassword.status === 401, `Wrong password expected 401, received ${wrongPassword.status}`);
    console.log("Wrong password: passed (HTTP 401)");

    const meWithoutToken = await request("/api/auth/me");
    assert(meWithoutToken.status === 401, `GET /me without token expected 401, received ${meWithoutToken.status}`);
    console.log("GET /me without token: passed (HTTP 401)");

    const me = await request("/api/auth/me", {
      headers: { Authorization: `Bearer ${login.body.data.token}` },
    });
    assert(me.status === 200, `GET /me expected 200, received ${me.status}`);
    assert(me.body.data?.user?.email === testEmail, "GET /me returned the wrong email");
    assert(!hasPassword(me.body.data?.user), "GET /me response contains password");
    console.log("GET /me with token: passed (HTTP 200, correct user)");

    const duplicate = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Duplicate Auth Test",
        email: testEmail,
        password: testPassword,
      }),
    });
    assert(duplicate.status === 409, `Duplicate email expected 409, received ${duplicate.status}`);
    console.log("Duplicate email: passed (HTTP 409)");

    await mongoose.connect(process.env.MONGO_URI);
    const collections = await mongoose.connection.db.listCollections({ name: "users" }).toArray();
    const storedUser = await User.findOne({ email: testEmail }).select("+password").lean();

    assert(collections.length === 1, "users collection was not found");
    assert(Boolean(storedUser), "Test user was not found in MongoDB");
    assert(await bcrypt.compare(testPassword, storedUser.password), "Stored password is not a valid bcrypt hash");
    assert(storedUser.role === "customer", "Stored role is not customer");
    assert(!Object.prototype.hasOwnProperty.call(storedUser, "token"), "Token was stored in MongoDB");
    assert(storedUser.createdAt && storedUser.updatedAt, "User timestamps are missing");
    console.log("MongoDB user verification: passed (bcrypt hash, customer role, no token, timestamps present)");
    console.log("All authentication tests passed");
  } catch (error) {
    console.error(`Authentication test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
};

run();
