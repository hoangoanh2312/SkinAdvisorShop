/**
 * Gắn ảnh riêng cho nhiều dung tích một lần.
 * Đặt ảnh vào thư mục anh/dung-tich/ (ngang hàng thư mục backend), tên file là MÃ HÀNG, ví dụ:
 *   anh/dung-tich/COCOON-DAU-TAY-TRANG-HOA-HONG-140ML.jpg
 *
 *   npm run variant-images:preview   liệt kê ảnh nào khớp mã hàng nào, KHÔNG ghi
 *   npm run variant-images:apply     tải ảnh lên Cloudinary và gắn vào phiên bản
 *
 * Ảnh phụ (góc khác, ảnh dùng thực tế): thêm -2, -3... sau mã hàng, ví dụ
 *   anh/dung-tich/CERAVE-MOISTURIZING-CREAM-454G-2.avif
 * Nhận .jpg .png .webp .avif (AVIF tự đổi sang JPG).
 *
 * Mặc định bỏ qua ảnh đã gắn, thêm --replace để thay.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const FOLDER = path.join(__dirname, '../../anh/dung-tich');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
const CONFIRM = 'ATTACH_VARIANT_IMAGES';

// Ảnh lưu từ Watsons thường là .avif: đổi sang JPG chất lượng cao trước khi tải lên để trình duyệt nào cũng xem được
async function toJpegIfAvif(buffer, ext) {
  if (ext !== '.avif') return { buffer, mimetype: MIME[ext] };
  const sharp = require('sharp');
  const out = await sharp(buffer).rotate().flatten({ background: '#ffffff' }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return { buffer: out, mimetype: 'image/jpeg' };
}

// Đọc thư mục, trả về [{ sku, file, mimetype, buffer }]; tách riêng để kiểm thử không cần MongoDB
async function scanFolder(folder = FOLDER, { validateImageSignature }) {
  if (!fs.existsSync(folder)) return { found: [], invalid: [], missingFolder: true };
  const found = []; const invalid = [];
  for (const name of fs.readdirSync(folder)) {
    const file = path.join(folder, name);
    if (!fs.statSync(file).isFile()) continue;
    const ext = path.extname(name).toLowerCase();
    if (!MIME[ext]) continue;
    const sku = path.basename(name, path.extname(name)).trim().toUpperCase();
    let image;
    try { image = await toJpegIfAvif(fs.readFileSync(file), ext); }
    catch { invalid.push({ name, reason: 'KHONG_DOC_DUOC_ANH_AVIF' }); continue; }
    if (image.buffer.length > 5 * 1024 * 1024) { invalid.push({ name, reason: 'ANH_QUA_5MB' }); continue; }
    if (!validateImageSignature(image.buffer, image.mimetype)) { invalid.push({ name, reason: 'KHONG_PHAI_ANH_HOP_LE' }); continue; }
    found.push({ sku, name, file, mimetype: image.mimetype, buffer: image.buffer });
  }
  return { found, invalid, missingFolder: false };
}

async function run({ apply = false, replace = false } = {}) {
  const { validateImageSignature } = require('../services/productImageService');
  const scan = await scanFolder(FOLDER, { validateImageSignature });
  if (scan.missingFolder) return { error: `Chưa có thư mục ${FOLDER}, hãy tạo thư mục và đặt ảnh vào` };
  require('dotenv').config({ quiet: true });
  const mongoose = require('mongoose');
  const Variant = require('../models/Variant');
  const storage = require('../services/cloudinaryImageService');
  const { businessUriFrom, businessDatabaseName } = require('../config/businessDatabase');
  const db = businessDatabaseName(process.env);
  await mongoose.connect(businessUriFrom(process.env.MONGO_URI, db), { autoIndex: false, serverSelectionTimeoutMS: 12000 });
  try {
    // Tên file là mã hàng (ảnh chính) hoặc mã hàng + "-2", "-3"... (ảnh phụ)
    const candidates = new Set();
    for (const f of scan.found) { candidates.add(f.sku); const m = /^(.*)-(\d{1,2})$/.exec(f.sku); if (m) candidates.add(m[1]); }
    const variants = await Variant.find({ sku: { $in: [...candidates] } }).select('sku name product image imagePublicId extraImages').lean();
    const bySku = new Map(variants.map((v) => [v.sku, v]));
    const planned = []; const skipped = [...scan.invalid];
    for (const f of scan.found.sort((a, b) => a.name.localeCompare(b.name))) {
      let v = bySku.get(f.sku); let extra = false;
      if (!v) { const m = /^(.*)-(\d{1,2})$/.exec(f.sku); if (m && bySku.has(m[1])) { v = bySku.get(m[1]); extra = true; } }
      if (!v) { skipped.push({ name: f.name, reason: 'KHONG_CO_MA_HANG_NAY' }); continue; }
      const source = f.name.toLowerCase();
      const existing = extra ? (v.extraImages || []).find((item) => item.source === source) : null;
      if (!extra && v.image && !replace) { skipped.push({ name: f.name, reason: 'DA_CO_ANH_RIENG (thêm --replace để thay)' }); continue; }
      if (extra && existing && !replace) { skipped.push({ name: f.name, reason: 'DA_GAN_ANH_PHU_NAY (thêm --replace để thay)' }); continue; }
      planned.push({ ...f, variant: v, extra, source, existing });
    }
    const report = { database: db, mode: apply ? 'GHI THẬT' : 'XEM TRƯỚC (không ghi)', folder: FOLDER, willAttach: planned.map((p) => `${p.name} → ${p.variant.sku}${p.extra ? ' (ảnh phụ)' : ' (ảnh chính)'}`), skipped };
    if (!apply) return report;
    const done = []; const failed = [];
    for (const p of planned) {
      try {
        const uploaded = await storage.upload({ buffer: p.buffer, mimetype: p.mimetype }, `${p.variant.product}/variants/${p.variant._id}`);
        if (p.extra) {
          if (p.existing) await Variant.updateOne({ _id: p.variant._id }, { $pull: { extraImages: { source: p.source } } });
          const result = await Variant.updateOne({ _id: p.variant._id, 'extraImages.7': { $exists: false } }, { $push: { extraImages: { url: uploaded.url, publicId: uploaded.publicId, source: p.source } } });
          if (!result.modifiedCount) { await storage.destroy(uploaded.publicId).catch(() => {}); failed.push({ sku: p.variant.sku, reason: 'DA_DU_8_ANH_PHU' }); continue; }
          if (p.existing?.publicId) await storage.destroy(p.existing.publicId).catch(() => {});
        } else {
          await Variant.updateOne({ _id: p.variant._id }, { $set: { image: uploaded.url, imagePublicId: uploaded.publicId } });
          if (p.variant.imagePublicId) await storage.destroy(p.variant.imagePublicId).catch(() => {});
        }
        done.push(`${p.variant.sku}${p.extra ? ' (ảnh phụ)' : ''}`);
      } catch (error) { failed.push({ sku: p.variant.sku, reason: error.code || error.message }); }
    }
    return { ...report, attached: done, failed };
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  if (apply && !args.includes(`--confirm=${CONFIRM}`)) { console.error(`Thiếu --confirm=${CONFIRM}`); process.exit(1); }
  run({ apply, replace: args.includes('--replace') })
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { scanFolder, toJpegIfAvif, FOLDER, CONFIRM };
