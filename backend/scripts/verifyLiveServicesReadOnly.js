/** SKINORA LIVE CHECK - Mongo READ ONLY. Optional --gemini-ping makes ONE real provider request.
 * Never logs JWT, Mongo URI, Gemini key, bank account or customer data.
 */
'use strict';
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { businessDatabaseName, businessUriFrom } = require('../config/businessDatabase');
const { paymentCapabilities } = require('../services/paymentCapabilities');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const { generateAdvisorResponse } = require('../services/aiService');

async function run() {
  const database = businessDatabaseName(process.env);
  const uri = businessUriFrom(process.env.MONGO_URI, database);
  const report = { mode: 'READ_ONLY', database, checkedAt: new Date().toISOString(), checks: {}, notes: [] };
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  try {
    if (mongoose.connection.name !== database) throw new Error('DATABASE_NAME_MISMATCH');
    const products = await Product.find().select('_id images isActive').lean();
    const variants = await Variant.find().select('product price stock isActive').lean();
    const byId = new Map(products.map(p => [String(p._id), p]));
    const sellable = new Set(variants.filter(v => v.isActive && v.price > 0 && v.stock > 0 && byId.get(String(v.product))?.isActive && byId.get(String(v.product))?.images?.length).map(v => String(v.product)));
    report.checks.mongodb = 'CONNECTED';
    report.checks.products = products.length;
    report.checks.skus = variants.length;
    report.checks.missingPrices = variants.filter(v => !(v.price > 0)).length;
    report.checks.stockedSkus = variants.filter(v => v.stock > 0).length;
    report.checks.sellableProducts = sellable.size;
    report.checks.payments = paymentCapabilities();
    report.checks.geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL);
    if (process.argv.includes('--gemini-ping')) {
      if (!report.checks.geminiConfigured) throw new Error('GEMINI_NOT_CONFIGURED');
      try {
        const response = await generateAdvisorResponse({ messages: [{ role: 'user', content: 'Trả lời ngắn gọn: chào SKINORA' }], skinProfile: {}, products: [] });
        report.checks.geminiLive = response.reply.length > 0 ? 'RESPONSE_RECEIVED' : 'INVALID_RESPONSE';
        report.notes.push('Đã gọi Gemini API thật, không gửi ảnh hay dữ liệu cá nhân. Cần kiểm thử ảnh với sự đồng ý riêng.');
      } catch (error) {
        report.checks.geminiLive = `FAILED_${error.code || 'UNKNOWN'}`;
      }
    } else report.checks.geminiLive = 'NOT_TESTED_USE_--gemini-ping';
    report.notes.push('Không tự xác minh giá nguồn hàng, tồn kho kiểm kê, giao hàng hoặc thanh toán từ mã nguồn.');
    console.log(JSON.stringify(report, null, 2));
    if (report.checks.sellableProducts === 0 || report.checks.missingPrices > 0 || report.checks.geminiLive.startsWith('FAILED_')) process.exitCode = 2;
  } finally { await mongoose.disconnect(); }
}
run().catch(error => {
  // Errors may include credentials in upstream connection messages; report only the error code.
  console.error(`LIVE_READ_ONLY_CHECK_FAILED:${error.code || (error.message === 'DATABASE_NAME_MISMATCH' ? error.message : 'CONNECTION_OR_PROVIDER')}`);
  process.exitCode = 1;
});
