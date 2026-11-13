const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function main() {
  const { cartStorageKey, readCart } = await import(pathToFileURL(path.resolve(__dirname, "../../frontend/src/utils/cartStorage.js")).href);
  const guest = cartStorageKey(null);
  const alice = cartStorageKey({ _id: "user-alice" });
  const bob = cartStorageKey({ _id: "user-bob" });
  assert.notEqual(guest, alice);
  assert.notEqual(alice, bob);
  assert.equal(cartStorageKey({ _id: "user-alice" }, true), null);
  const db = new Map();
  const storage = { getItem: key => db.get(key) ?? null };
  db.set(alice, JSON.stringify([{ key: "p-v", productId: "p", variantId: "v", quantity: 9, stock: 2, displayPrice: 123 }]));
  db.set(bob, JSON.stringify([{ key: "bad", productId: "p", variantId: "v", quantity: -1, stock: 3, displayPrice: 123 }]));
  db.set("skinora_cart", JSON.stringify([{ productId: "previous-person", variantId: "v", quantity: 1 }]));
  assert.equal(readCart(alice, storage)[0].quantity, 2);
  assert.deepEqual(readCart(bob, storage), []);
  assert.deepEqual(readCart(guest, storage), []);
  assert.deepEqual(readCart(cartStorageKey({ _id: "user-charlie" }), storage), []);
  assert.deepEqual(readCart(null, storage), []);
  console.log("PASS: separate cart keys, no legacy owner leak, invalid and overstocked entries rejected/clamped");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
