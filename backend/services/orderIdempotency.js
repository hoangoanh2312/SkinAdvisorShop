const { createHash } = require('node:crypto');

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;

const parseIdempotencyKey = (value) => {
  if (value == null || value === '') return null; // Older clients remain compatible.
  if (typeof value !== 'string' || !KEY_PATTERN.test(value)) {
    throw new Error('INVALID_IDEMPOTENCY_KEY');
  }
  return value;
};

const fingerprintOrder = ({ quantities, shippingAddress, voucherCode, paymentMethod, note }) => {
  const normalizedItems = [...quantities.entries()]
    .map(([variantId, quantity]) => [String(variantId), quantity])
    .sort(([a], [b]) => a.localeCompare(b));
  const normalized = {
    items: normalizedItems,
    shippingAddress,
    voucherCode: (voucherCode || '').trim().toUpperCase(),
    paymentMethod,
    note: typeof note === 'string' ? note : '',
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
};

const isIdempotencyCollision = (error) => error?.code === 11000 &&
  Boolean(error?.keyPattern?.idempotencyKey || error?.keyValue?.idempotencyKey);

module.exports = { parseIdempotencyKey, fingerprintOrder, isIdempotencyCollision };
