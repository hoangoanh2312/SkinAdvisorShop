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
const password = `Address-${tag}`;
const emails = {
  owner: `skinora.address.owner.${tag}@example.com`,
  other: `skinora.address.other.${tag}@example.com`,
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
const validAddress = (suffix, overrides = {}) => ({
  fullName: `Address Owner ${suffix}`,
  phone: `09000000${suffix}`,
  province: "Ho Chi Minh City",
  ward: `Ward ${suffix}`,
  address: `${suffix} Skinora Street`,
  label: suffix === "01" ? "Nhà" : "Công ty",
  ...overrides,
});

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const hash = await bcrypt.hash(password, 12);
    const [owner, other, category] = await Promise.all([
      User.create({ fullName: "Address Owner Test", email: emails.owner, password: hash }),
      User.create({ fullName: "Address Other Test", email: emails.other, password: hash }),
      Category.create({ name: `Address Category ${tag}`, slug: `address-${tag}` }),
    ]);
    const product = await Product.create({ name: `Address Serum ${tag}`, slug: `address-serum-${tag}`, brand: `AddressBrand-${tag}`, category: category._id, basePrice: 100000, skinTypes: ["normal"], skinConcerns: ["dryness"] });
    const variant = await Variant.create({ product: product._id, name: "30 ml", sku: `ADDR-${tag}`.toUpperCase(), size: "30", unit: "ml", price: 100000, stock: 10 });
    await mongoose.connection.close();

    const [ownerToken, otherToken] = await Promise.all([login(emails.owner), login(emails.other)]);
    expectStatus(await request("/api/users/me/addresses"), 401, "GET addresses without token");

    const firstCreate = await request("/api/users/me/addresses", "POST", { ...validAddress("01"), district: "Must not persist", addressLine: "Must not persist" }, ownerToken);
    expectStatus(firstCreate, 201, "Create first address");
    const first = firstCreate.body.data.address;
    assert(first._id, "First address is missing _id");
    assert(first.isDefault === true, "First address was not made default");
    assert(first.district === undefined && first.addressLine === undefined, "Legacy input fields were persisted");

    const secondCreate = await request("/api/users/me/addresses", "POST", validAddress("02"), ownerToken);
    expectStatus(secondCreate, 201, "Create second address");
    const second = secondCreate.body.data.address;
    assert(second._id && second.isDefault === false, "Second address must not become default automatically");
    const list = await request("/api/users/me/addresses", "GET", undefined, ownerToken);
    expectStatus(list, 200, "List addresses");
    assert(list.body.data.addresses.length === 2, "Address list should contain two entries");

    const setDefault = await request(`/api/users/me/addresses/${second._id}/default`, "PUT", {}, ownerToken);
    expectStatus(setDefault, 200, "Set second address default");
    assert(setDefault.body.data.address.isDefault === true, "Second address is not default");
    const afterDefault = await request("/api/users/me/addresses", "GET", undefined, ownerToken);
    assert(afterDefault.body.data.addresses.filter((address) => address.isDefault).length === 1, "User has more than one default address");

    const updatedValue = validAddress("22", { label: "Khác" });
    const updated = await request(`/api/users/me/addresses/${second._id}`, "PUT", updatedValue, ownerToken);
    expectStatus(updated, 200, "Update address");
    assert(updated.body.data.address.address === updatedValue.address, "Address update was not persisted");
    assert(updated.body.data.address.isDefault === true, "Updating fields changed default state");
    expectStatus(await request(`/api/users/me/addresses/${second._id}`, "PUT", { fullName: "Missing fields" }, ownerToken), 400, "Update with missing required fields");
    expectStatus(await request("/api/users/me/addresses", "POST", { fullName: "Missing fields" }, ownerToken), 400, "Create with missing required fields");
    expectStatus(await request("/api/users/me/addresses/not-an-object-id", "DELETE", undefined, ownerToken), 400, "Invalid address id");
    expectStatus(await request(`/api/users/me/addresses/${new mongoose.Types.ObjectId()}`, "DELETE", undefined, ownerToken), 404, "Missing address id");

    const otherCreate = await request("/api/users/me/addresses", "POST", validAddress("03"), otherToken);
    expectStatus(otherCreate, 201, "Create other user's address");
    const otherAddressId = otherCreate.body.data.address._id;
    expectStatus(await request(`/api/users/me/addresses/${otherAddressId}`, "PUT", validAddress("04"), ownerToken), 404, "Owner cannot update another user's address");
    expectStatus(await request(`/api/users/me/addresses/${otherAddressId}`, "DELETE", undefined, ownerToken), 404, "Owner cannot delete another user's address");
    expectStatus(await request(`/api/users/me/addresses/${otherAddressId}/default`, "PUT", {}, ownerToken), 404, "Owner cannot default another user's address");

    const snapshotAddress = { fullName: updated.body.data.address.fullName, phone: updated.body.data.address.phone, province: updated.body.data.address.province, ward: updated.body.data.address.ward, address: updated.body.data.address.address };
    const orderCreate = await request("/api/orders", "POST", { items: [{ variantId: variant._id, quantity: 1 }], shippingAddress: snapshotAddress, paymentMethod: "COD" }, ownerToken);
    expectStatus(orderCreate, 201, "Create order snapshot");
    const orderId = orderCreate.body.data.order._id;
    expectStatus(await request(`/api/users/me/addresses/${second._id}`, "PUT", validAddress("32", { label: "Nhà" }), ownerToken), 200, "Change saved address after order");
    const oldOrder = await request(`/api/orders/${orderId}`, "GET", undefined, ownerToken);
    expectStatus(oldOrder, 200, "Read order after saved address changed");
    const storedSnapshot = oldOrder.body.data.order.shippingAddress;
    assert(["fullName", "phone", "province", "ward", "address"].every((field) => storedSnapshot[field] === snapshotAddress[field]), "Order shipping snapshot changed with the user's saved address");

    expectStatus(await request(`/api/users/me/addresses/${first._id}`, "DELETE", undefined, ownerToken), 200, "Delete non-default address");
    const thirdCreate = await request("/api/users/me/addresses", "POST", validAddress("05"), ownerToken);
    expectStatus(thirdCreate, 201, "Create replacement address");
    assert(thirdCreate.body.data.address.isDefault === false, "Replacement address unexpectedly became default");
    expectStatus(await request(`/api/users/me/addresses/${second._id}`, "DELETE", undefined, ownerToken), 200, "Delete default address");
    const afterDefaultDelete = await request("/api/users/me/addresses", "GET", undefined, ownerToken);
    expectStatus(afterDefaultDelete, 200, "List after deleting default");
    assert(afterDefaultDelete.body.data.addresses.length === 1, "Exactly one address should remain");
    assert(afterDefaultDelete.body.data.addresses[0].isDefault === true, "Remaining address was not made default");
    expectStatus(await request(`/api/users/me/addresses/${thirdCreate.body.data.address._id}`, "DELETE", undefined, ownerToken), 200, "Delete final address");
    const emptyList = await request("/api/users/me/addresses", "GET", undefined, ownerToken);
    assert(emptyList.body.data.addresses.length === 0, "Deleting final address did not leave an empty list");

    console.log("All address book and order snapshot tests passed");
    console.log(`Test data retained: owner=${owner._id}, other=${other._id}, order=${orderId}`);
  } catch (error) {
    console.error(`Address API test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  }
};

run();
