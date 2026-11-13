/**
 * Review the business catalog's REAL selling prices, with explicit manual verification.
 * Never creates product prices, never writes stock, never activates SKUs.
 * template: read-only MongoDB -> CSV; preview: read-only validation; apply: explicit transaction.
 */
'use strict';
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const Verification = require('../models/CommercialPriceVerification');
const { businessDatabaseName, businessUriFrom } = require('../config/businessDatabase');
const { makeTemplate, parseCsv, reviewRows } = require('../utils/commercialPriceReview');

const CSV = path.resolve(__dirname, '../../XAC_MINH_GIA_BAN_THAT_SKINORA.csv');
const mode = process.argv[2] || 'preview';
const confirmed = process.argv.includes('--confirm=APPLY_VERIFIED_REAL_PRICES');
if (!['template', 'preview', 'apply'].includes(mode)) throw Error('INVALID_COMMAND');
if (mode === 'apply' && !confirmed) throw Error('APPLY_REQUIRES_CONFIRMATION');
function importKey(row) {
  return crypto.createHash('sha256').update(JSON.stringify([row.sku, row.oldPrice, row.price, row.source, row.reviewer])).digest('hex');
}
async function main() {
  if (process.env.NODE_ENV === 'test') throw Error('REFUSE_TEST_MODE');
  const database = businessDatabaseName(process.env);
  if (database !== 'skinora_prod') throw Error(`REFUSED_DATABASE:${database}`);
  const uri = businessUriFrom(process.env.MONGO_URI, database);
  if (!uri) throw Error('MONGO_URI_MISSING');
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  try {
    if (mongoose.connection.name !== database) throw Error('CONNECTED_TO_UNEXPECTED_DATABASE');
    const [products, variants] = await Promise.all([
      Product.find({}).select('_id name slug basePrice salePrice isActive').lean(),
      Variant.find({}).select('_id product sku size unit price salePrice stock isActive').lean(),
    ]);
    if (mode === 'template') {
      if (fs.existsSync(CSV)) throw Error(`WILL_NOT_OVERWRITE_EXISTING_CSV:${CSV}`);
      fs.writeFileSync(CSV, makeTemplate(variants, new Map(products.map(p => [String(p._id), p]))), { encoding: 'utf8', flag: 'wx' });
      return { database, mode: 'TEMPLATE_CREATED', path: CSV, skus: variants.length,
        notes: 'Điền giá bán thực tế và nguồn đối chiếu. File gốc sẽ không bị tự ghi đè.' };
    }
    if (!fs.existsSync(CSV)) throw Error(`CSV_NOT_FOUND_RUN_TEMPLATE_FIRST:${CSV}`);
    const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
    const result = reviewRows(rows, products, variants);
    const output = { database, mode: mode === 'apply' ? 'APPLY' : 'READ_ONLY_PREVIEW',
      file: CSV, totalSkus: variants.length, approved: result.approved.length,
      unchangedPriceConfirmations: result.approved.filter(x => !x.changed).length,
      priceChanges: result.approved.filter(x => x.changed).length,
      skipped: result.skipped.length, errors: result.errors,
      approvedRows: result.approved.map(({sku,oldPrice,price,changed}) => ({sku,oldPrice,confirmedPrice:price,changed})) };
    if (result.errors.length) throw Error('VALIDATION_FAILED_NO_WRITES:\n' + result.errors.join('\n'));
    if (mode === 'preview' || !result.approved.length) return output;
    // Repeat the read + validate under a transaction to prevent racing with admin edits.
    await Verification.init();
    // Index is explicit because this service connects with autoIndex: false.
    await Verification.collection.createIndex({ importKey: 1 }, { unique: true });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const latestProducts = await Product.find({}).select('_id name slug basePrice salePrice isActive').session(session).lean();
        const latestVariants = await Variant.find({}).select('_id product sku size unit price salePrice stock isActive').session(session).lean();
        const latest = reviewRows(rows, latestProducts, latestVariants);
        if (latest.errors.length || latest.approved.length !== result.approved.length) throw Error('DATA_CHANGED_SINCE_PREVIEW_ROLLBACK');
        for (const row of latest.approved) {
          const previous = result.approved.find(x => x.sku === row.sku);
          if (!previous || JSON.stringify(row) !== JSON.stringify(previous)) throw Error('ROW_CHANGED_ROLLBACK');
          const key = importKey(row);
          if (await Verification.exists({ importKey: key }).session(session)) throw Error(`ALREADY_APPLIED:${row.sku}`);
          if (row.changed) {
            const variant = await Variant.updateOne({ _id: row.variantId, sku: row.sku, price: row.oldPrice, stock: 0, salePrice: null },
              { $set: { price: row.price } }, { session, runValidators: true });
            const product = await Product.updateOne({ _id: row.productId, basePrice: row.oldPrice, isActive: false, salePrice: null },
              { $set: { basePrice: row.price } }, { session, runValidators: true });
            if (variant.modifiedCount !== 1 || product.modifiedCount !== 1) throw Error(`CONCURRENT_UPDATE_ROLLBACK:${row.sku}`);
          }
          await Verification.create([{ sku: row.sku, product: row.productId, variant: row.variantId,
            oldPrice: row.oldPrice, confirmedPrice: row.price, source: row.source, reviewer: row.reviewer,
            importKey: key }], { session });
        }
      });
    } finally { await session.endSession(); }
    return { ...output, writtenVerifications: result.approved.length,
      notes: 'Chỉ cập nhật giá đã xác minh; KHÔNG sửa tồn kho, trạng thái sản phẩm/SKU hoặc đơn hàng.' };
  } finally { await mongoose.disconnect(); }
}
main().then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(e => { console.error(`SKINORA_PRICE_REVIEW_STOPPED: ${e.message}`); process.exitCode = 1; });
