/**
 * Thêm dung tích khác (mã hàng mới, giá riêng) cho sản phẩm đã có.
 * Dữ liệu: data/catalogExtraSizes20261116.json, giá lấy từ trang bán lẻ chính hãng tại Việt Nam.
 *
 *   npm run sku:sizes:check      kiểm tra file dữ liệu, không cần MongoDB
 *   npm run sku:sizes:preview    đọc MongoDB, liệt kê sẽ thêm gì, KHÔNG ghi
 *   npm run sku:sizes:apply      ghi thật (mặc định nhập kho 10 mỗi mã, đổi bằng --stock=N)
 *
 * An toàn: không sửa mã hàng đã có, không đổi giá hay tồn kho của dung tích cũ,
 * chạy lại nhiều lần không tạo trùng. Hàng nhập kho được ghi vào sổ kho (InventoryMovement).
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DATA_FILE = path.join(__dirname, '../data/catalogExtraSizes20261116.json');
const CONFIRM = 'ADD_EXTRA_SIZES';
const loadRows = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).items;

function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('EMPTY_DATA');
  const skus = new Set();
  const sizesByProduct = new Map();
  for (const r of rows) {
    if (!/^[-a-z0-9]+$/.test(r.slug || '')) throw new Error(`INVALID_SLUG:${r.slug}`);
    if (!/^[A-Z0-9-]+$/.test(r.sku || '') || skus.has(r.sku)) throw new Error(`INVALID_OR_DUPLICATE_SKU:${r.sku}`);
    if (!/^\d+$/.test(r.size) || !['ml', 'g'].includes(r.unit) || r.name !== `${r.size}${r.unit}`) throw new Error(`INVALID_SIZE:${r.sku}`);
    if (!r.sku.endsWith(`-${r.size}${r.unit.toUpperCase()}`)) throw new Error(`SKU_SIZE_MISMATCH:${r.sku}`);
    if (r.name === String(r.existingSize).toLowerCase()) throw new Error(`SAME_AS_EXISTING_SIZE:${r.sku}`);
    if (!Number.isInteger(r.priceVND) || r.priceVND <= 0) throw new Error(`INVALID_PRICE:${r.sku}`);
    if (r.salePriceVND !== null && (!Number.isInteger(r.salePriceVND) || r.salePriceVND <= 0 || r.salePriceVND >= r.priceVND)) throw new Error(`INVALID_SALE_PRICE:${r.sku}`);
    if (!/^https:\/\//.test(r.sourceUrl || '') || !r.sourceName) throw new Error(`MISSING_SOURCE:${r.sku}`);
    const sizes = sizesByProduct.get(r.slug) || new Set();
    if (sizes.has(r.name)) throw new Error(`DUPLICATE_SIZE:${r.sku}`);
    sizes.add(r.name); sizesByProduct.set(r.slug, sizes);
    skus.add(r.sku);
  }
  return { newSkus: rows.length, products: sizesByProduct.size };
}

// Quyết định thêm hay bỏ qua từng dòng, tách riêng để kiểm thử không cần MongoDB
function planRows(rows, { products, variants }) {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const skuTaken = new Set(variants.map((v) => v.sku));
  const sizesOf = new Map();
  for (const v of variants) {
    const key = String(v.product);
    const set = sizesOf.get(key) || new Set();
    set.add(String(v.name || '').toLowerCase().replace(/\s+/g, ''));
    sizesOf.set(key, set);
  }
  const planned = []; const skipped = [];
  for (const r of rows) {
    const product = bySlug.get(r.slug);
    if (!product) { skipped.push({ sku: r.sku, reason: 'KHONG_TIM_THAY_SAN_PHAM' }); continue; }
    if (skuTaken.has(r.sku)) { skipped.push({ sku: r.sku, reason: 'MA_HANG_DA_CO' }); continue; }
    if (sizesOf.get(String(product._id))?.has(r.name)) { skipped.push({ sku: r.sku, reason: 'DUNG_TICH_DA_CO' }); continue; }
    planned.push({ ...r, productId: String(product._id), productName: product.name });
  }
  return { planned, skipped };
}

async function run({ apply = false, stock = 10 } = {}) {
  const rows = loadRows();
  const summary = validateRows(rows);
  if (!Number.isSafeInteger(stock) || stock < 0 || stock > 1000) throw new Error('INVALID_STOCK');
  require('dotenv').config({ quiet: true });
  const mongoose = require('mongoose');
  const Product = require('../models/Product');
  const Variant = require('../models/Variant');
  const InventoryMovement = require('../models/InventoryMovement');
  const { businessUriFrom, businessDatabaseName } = require('../config/businessDatabase');
  const db = businessDatabaseName(process.env);
  const uri = businessUriFrom(process.env.MONGO_URI, db);
  if (!uri) throw new Error('MISSING_MONGODB_URI');
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 12000 });
  try {
    const products = await Product.find({ slug: { $in: rows.map((r) => r.slug) } }).select('_id name slug').lean();
    const variants = await Variant.find({ $or: [{ product: { $in: products.map((p) => p._id) } }, { sku: { $in: rows.map((r) => r.sku) } }] }).select('product sku name').lean();
    const { planned, skipped } = planRows(rows, { products, variants });
    const report = { database: db, mode: apply ? 'GHI THẬT' : 'XEM TRƯỚC (không ghi)', ...summary, stockPerNewSku: stock, willCreate: planned.map((p) => `${p.productName} – ${p.name}: ${p.priceVND.toLocaleString('vi-VN')}đ${p.salePriceVND ? ` (giảm còn ${p.salePriceVND.toLocaleString('vi-VN')}đ)` : ''}`), skipped };
    if (!apply || !planned.length) return report;
    const session = await mongoose.startSession();
    const created = [];
    try {
      await session.withTransaction(async () => {
        created.length = 0;
        for (const p of planned) {
          const [variant] = await Variant.create([{ product: p.productId, name: p.name, sku: p.sku, size: p.size, unit: p.unit, price: p.priceVND, salePrice: p.salePriceVND, stock, isActive: true, image: '' }], { session });
          if (stock > 0) {
            await InventoryMovement.create([{ variant: variant._id, product: p.productId, kind: 'receipt', delta: stock, before: 0, after: stock, note: `Nhập kho dung tích mới ${p.name}, giá theo ${p.sourceName} ngày ${p.checkedOn}`, reference: p.sku }], { session });
          }
          created.push(p.sku);
        }
      });
    } finally { await session.endSession(); }
    return { ...report, created };
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const summary = validateRows(loadRows());
    console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
    console.log('SKINORA_EXTRA_SIZES_DATA_OK');
  } else {
    const apply = args.includes('--apply');
    if (apply && !args.includes(`--confirm=${CONFIRM}`)) { console.error(`Thiếu --confirm=${CONFIRM}`); process.exit(1); }
    const stockArg = args.find((a) => a.startsWith('--stock='));
    run({ apply, stock: stockArg ? Number(stockArg.split('=')[1]) : 10 })
      .then((report) => console.log(JSON.stringify(report, null, 2)))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}

module.exports = { validateRows, planRows, loadRows, CONFIRM };
