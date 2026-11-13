/* No MongoDB access, no Gemini calls, no real payment requests. */
'use strict';
const assert = require('node:assert/strict');
const { paymentCapabilities } = require('../services/paymentCapabilities');
const { assertProductionSafety } = require('../config/productionSafety');
const { createAuthRateLimiter } = require('../middleware/authRateLimiter');
const SkinAnalysis = require('../models/SkinAnalysis');
const { listSkinAnalysisHistory, deleteSkinAnalysisHistory } = require('../controllers/skinAnalysisHistoryController');
const { launchReadiness } = require('../controllers/launchReadinessController');
const { createOrder } = require('../controllers/orderController');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const mongoose = require('mongoose');
const { createApp } = require('../app');
const original = { productFind: Product.find, variantFind: Variant.find,
  historyFind: SkinAnalysis.find, historyDelete: SkinAnalysis.findOneAndDelete };
const user = '507f1f77bcf86cd799439011';
const other = '507f191e810c19729de860ea';
const response = () => ({ statusCode: 200, headers: {}, set(k,v){this.headers[k]=v;return this;}, status(c){this.statusCode=c;return this;}, json(v){this.body=v;return this;} });
const env = { VNP_TMN_CODE: 'ABC', VNP_HASH_SECRET: 'secret', VNP_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html', VNP_RETURN_URL: 'http://localhost:5173/payment/result', BANK_CODE: 'VCB', BANK_ACCOUNT_NO: '123456789', BANK_ACCOUNT_NAME: 'SKINORA' };
const test = async () => {
  assert.equal(paymentCapabilities({}).COD.available, true);
  assert.equal(paymentCapabilities({}).BANK_TRANSFER.available, false);
  assert.equal(paymentCapabilities({}).VNPAY.available, false);
  assert.equal(paymentCapabilities(env).BANK_TRANSFER.available, true);
  assert.equal(paymentCapabilities(env).VNPAY.mode, 'sandbox');
  assert.equal(paymentCapabilities({ ...env, NODE_ENV: 'production' }).VNPAY.available, false, 'Sandbox forbidden in production');
  assert.equal(paymentCapabilities({ ...env, NODE_ENV: 'production', VNP_URL: 'https://pay.vnpay.vn', VNP_RETURN_URL: 'https://skinora.example/payment/result', VNP_IPN_URL: 'https://api.skinora.example/api/payments/vnpay/ipn' }).VNPAY.mode, 'live');
  assert.doesNotThrow(() => assertProductionSafety({ NODE_ENV: 'development' }));
  assert.throws(() => assertProductionSafety({ NODE_ENV: 'production', JWT_SECRET: 'short', CORS_ORIGINS: 'https://skinora.vn', MONGO_URI: 'mongodb://localhost:27017/skinora_prod' }), /JWT_SECRET/);
  assert.throws(() => assertProductionSafety({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), CORS_ORIGINS: 'http://skinora.vn', MONGO_URI: 'mongodb://localhost:27017/skinora_prod' }), /CORS/);
  assert.doesNotThrow(() => assertProductionSafety({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), CORS_ORIGINS: 'https://skinora.vn', MONGO_URI: 'mongodb://localhost:27017/skinora_prod' }));
  const limiter = createAuthRateLimiter({ windowMs: 60_000, max: 2 });
  let passed = 0; const fromIp = { ip: '198.51.100.4' };
  limiter(fromIp, response(), () => passed++); limiter(fromIp, response(), () => passed++);
  const throttled = response(); limiter(fromIp, throttled, () => passed++);
  assert.equal(passed, 2); assert.equal(throttled.statusCode, 429);
  const blocked = response();
  await createOrder({ body: { paymentMethod: 'BANK_TRANSFER', items: [{ variantId: user, quantity: 1 }], shippingAddress: {} } }, blocked);
  assert.equal(blocked.statusCode, 503, 'Must not open unconfigured payment order');

  let query;
  SkinAnalysis.find = filter => { query = filter; return { select(){return this;}, sort(){return this;}, limit(){return this;}, lean:async()=>[{ _id: other, result: { skinTypeLabel: 'Da khô' } }] }; };
  const read = response(); await listSkinAnalysisHistory({ user: { _id: user }, query: {} }, read);
  assert.equal(read.statusCode, 200); assert.equal(String(query.user), user);
  assert.equal(read.body.data.items.length, 1);
  let deletionFilter;
  SkinAnalysis.findOneAndDelete = async filter => { deletionFilter=filter; return null; };
  const forbidden = response(); await deleteSkinAnalysisHistory({ user: { _id: user }, params: { id: other } }, forbidden);
  assert.equal(forbidden.statusCode, 404, 'Must return 404 for unowned history');
  assert.deepEqual({ ...deletionFilter, user: String(deletionFilter.user) }, { _id: other, user });
  const invalid = response(); await deleteSkinAnalysisHistory({ user: { _id: user }, params: { id: 'bad' } }, invalid);
  assert.equal(invalid.statusCode, 400);

  Product.find = () => ({ select(){return this;}, lean:async()=>[{ _id: user, name: 'Real stock example', isActive: true, images: ['https://example.com/real.jpg'] }] });
  Variant.find = () => ({ select(){return this;}, lean:async()=>[{ product: user, price: 0, stock: 0, isActive: true }] });
  const report = response(); await launchReadiness({}, report);
  assert.equal(report.statusCode, 200); assert.equal(report.body.data.inventory.missingPrices, 1);
  assert.equal(report.body.data.inventory.sellableProducts, 0);
  assert(!JSON.stringify(report.body).includes(env.VNP_HASH_SECRET), 'No gateway secret leaks into readiness');

  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const methods = await fetch(`${base}/api/payments/methods`);
    assert.equal(methods.status, 200);
    const publicBody = await methods.json();
    assert.deepEqual(Object.keys(publicBody.data).sort(), ['BANK_TRANSFER','COD','VNPAY']);
    const unauthorized = await fetch(`${base}/api/ai/skin-analysis/history`);
    assert.equal(unauthorized.status, 401, 'AI history requires authentication');
    const adminDenied = await fetch(`${base}/api/admin/launch-readiness`);
    assert.equal(adminDenied.status, 401, 'Launch readiness is admin-only');
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('SKINORA_LIVE_RELEASE_OFFLINE_PASS: payment gating, sandbox isolation, private AI history, admin readiness, rate limits, production safety, route protections');
};
test().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  Product.find=original.productFind; Variant.find=original.variantFind;
  SkinAnalysis.find=original.historyFind; SkinAnalysis.findOneAndDelete=original.historyDelete;
});
