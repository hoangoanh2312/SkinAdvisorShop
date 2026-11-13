const assert = require('node:assert/strict');
const { createOrder } = require('../controllers/orderController');
const { validateVariantValues } = require('../controllers/variantController');
const { isVnpayOrderPayable, publicOrderResult } = require('../controllers/paymentController');

function mockResponse() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}
const address = { fullName: 'Customer', phone: '0900000000', province: 'HCM', ward: 'A', address: '123' };
const id = '507f1f77bcf86cd799439011';
async function checkBadItems(items) {
  const res = mockResponse();
  await createOrder({ body: { items, paymentMethod: 'COD', shippingAddress: address } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Danh sách sản phẩm/);
}
(async () => {
  for (const items of [null, [], [null], [5], [{}], [{ variantId: id, quantity: 0 }],
    [{ variantId: id, quantity: 1.5 }], [{ variantId: id, quantity: Infinity }],
    [{ variantId: id, quantity: Number.MAX_SAFE_INTEGER }],
    [{ variantId: id, quantity: 700 }, { variantId: id, quantity: 700 }],
    Array(101).fill({ variantId: id, quantity: 1 })]) await checkBadItems(items);
  const noBody = mockResponse();
  await createOrder({}, noBody);
  assert.equal(noBody.statusCode, 400);

  assert.equal(validateVariantValues({ stock: 1.25 }), 'Tồn kho phải là số nguyên không âm');
  assert.equal(validateVariantValues({ stock: -1 }), 'Tồn kho phải là số nguyên không âm');
  assert.equal(validateVariantValues({ stock: 3 }), null);
  assert.equal(validateVariantValues({ price: 100, salePrice: 120 }), 'Giá giảm không hợp lệ hoặc lớn hơn giá gốc');
  assert.equal(validateVariantValues({ price: 100 }, { price: 150, salePrice: 120 }), 'Giá giảm không hợp lệ hoặc lớn hơn giá gốc');
  assert.equal(validateVariantValues({ price: 150 }, { price: 100, salePrice: 120 }), null);
  assert.equal(validateVariantValues({ isActive: 'false' }), 'Trạng thái phiên bản không hợp lệ');

  const order = { paymentMethod: 'VNPAY', orderStatus: 'pending', paymentStatus: 'unpaid' };
  assert.equal(isVnpayOrderPayable(order), true);
  for (const orderStatus of ['cancelled', 'confirmed', 'shipping', 'completed'])
    assert.equal(isVnpayOrderPayable({ ...order, orderStatus }), false);
  for (const paymentStatus of ['paid', 'failed', 'refunded', 'pending_verification'])
    assert.equal(isVnpayOrderPayable({ ...order, paymentStatus }), false);
  assert.equal(isVnpayOrderPayable({ ...order, paymentMethod: 'COD' }), false);
  assert.equal(publicOrderResult({ ...order, _id: id }, { vnp_ResponseCode: '00' }).result, 'pending');
  assert.equal(publicOrderResult({ ...order, _id: id, orderStatus: 'cancelled' }, { vnp_ResponseCode: '00' }).result, 'failed');
  console.log('Checkout/variant/VNPay guards offline PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
