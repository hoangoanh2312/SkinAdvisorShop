import assert from 'node:assert/strict';
import { selectPreferredVariant } from '../src/utils/variantSelection.js';

const out = { _id: 'cheap', price: 100, stock: 0, isActive: true };
const enabled = { _id: 'available', price: 200, stock: 3, isActive: true };
const disabled = { _id: 'draft', price: 50, stock: 10, isActive: false };
assert.equal(selectPreferredVariant([out, enabled])._id, 'available');
assert.equal(selectPreferredVariant([disabled, out, enabled])._id, 'available');
assert.equal(selectPreferredVariant([enabled, out], 'out')._id, 'available');
assert.equal(selectPreferredVariant([out, enabled], 'available')._id, 'available');
assert.equal(selectPreferredVariant([out, disabled])._id, 'cheap');
assert.equal(selectPreferredVariant([out, enabled], null, false)._id, 'cheap');
assert.equal(selectPreferredVariant([]), null);
console.log('Preferred SKU selection offline PASS');
