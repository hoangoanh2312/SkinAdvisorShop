/* Offline: ảnh riêng cho từng dung tích — kiểm tra file, tải lên, thay ảnh xóa ảnh cũ, bỏ ảnh riêng */
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Variant = require("../models/Variant");
const AdminAuditLog = require("../models/AdminAuditLog");
const ctl = require("../controllers/variantImageController");
const res = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
(async () => {
  const id = String(new mongoose.Types.ObjectId());
  const row = { _id: id, product: "p1", sku: "COCOON-140ML", image: "", imagePublicId: "" };
  const orig = { findById: Variant.findById, findOneAndUpdate: Variant.findOneAndUpdate, create: AdminAuditLog.create };
  Variant.findById = () => ({ lean: async () => ({ ...row }) });
  Variant.findOneAndUpdate = (_f, u) => { Object.assign(row, u.$set); return { lean: async () => ({ ...row }) }; };
  AdminAuditLog.create = async () => ({});
  const uploads = [], destroyed = [];
  ctl.setVariantImageStorageForTests({ upload: async (_file, folder) => { uploads.push(folder); return { url: `https://res.cloudinary.com/x/${uploads.length}.jpg`, publicId: `pid${uploads.length}` }; }, destroy: async (pid) => { destroyed.push(pid); } });
  const jpg = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), mimetype: "image/jpeg" };
  const user = { _id: new mongoose.Types.ObjectId() };
  try {
    const noFile = res(); await ctl.uploadVariantImage({ params: { id }, user }, noFile); assert.equal(noFile.statusCode, 400);
    const fake = res(); await ctl.uploadVariantImage({ params: { id }, user, file: { buffer: Buffer.from("hello"), mimetype: "image/jpeg" } }, fake); assert.equal(fake.statusCode, 400, "chặn file giả đuôi ảnh");
    const badId = res(); await ctl.uploadVariantImage({ params: { id: "x" }, user, file: jpg }, badId); assert.equal(badId.statusCode, 400);
    const first = res(); await ctl.uploadVariantImage({ params: { id }, user, file: jpg }, first);
    assert.equal(first.statusCode, 200); assert.equal(row.image, "https://res.cloudinary.com/x/1.jpg"); assert.equal(uploads[0], `p1/variants/${id}`);
    const second = res(); await ctl.uploadVariantImage({ params: { id }, user, file: jpg }, second);
    await new Promise((r) => setImmediate(r));
    assert.equal(row.imagePublicId, "pid2"); assert.deepEqual(destroyed, ["pid1"], "thay ảnh thì xóa ảnh cũ trên Cloudinary");
    const removed = res(); await ctl.removeVariantImage({ params: { id }, user }, removed);
    await new Promise((r) => setImmediate(r));
    assert.equal(row.image, ""); assert.deepEqual(destroyed, ["pid1", "pid2"]);

    // Ảnh phụ: thêm, giới hạn 8, xóa đúng ảnh
    row.extraImages = [];
    Variant.findOneAndUpdate = (f, u) => {
      if (u.$push) { if (row.extraImages.length >= 8) return { lean: async () => null }; row.extraImages.push(u.$push.extraImages); }
      if (u.$pull) row.extraImages = row.extraImages.filter((x) => x.url !== u.$pull.extraImages.url);
      return { lean: async () => ({ ...row }) };
    };
    for (let i = 0; i < 8; i += 1) { const r = res(); await ctl.addVariantExtraImage({ params: { id }, user, file: jpg }, r); assert.equal(r.statusCode, 200); }
    const full = res(); await ctl.addVariantExtraImage({ params: { id }, user, file: jpg }, full); assert.equal(full.statusCode, 400, "tối đa 8 ảnh phụ");
    const target = row.extraImages[2];
    const del = res(); await ctl.removeVariantExtraImage({ params: { id }, user, query: { url: target.url } }, del);
    await new Promise((r) => setImmediate(r));
    assert.equal(del.statusCode, 200); assert.equal(row.extraImages.length, 7); assert.ok(destroyed.includes(target.publicId));
    const missing = res(); await ctl.removeVariantExtraImage({ params: { id }, user, query: { url: "https://x/khong-co.jpg" } }, missing); assert.equal(missing.statusCode, 404);
  } finally { Object.assign(Variant, { findById: orig.findById, findOneAndUpdate: orig.findOneAndUpdate }); AdminAuditLog.create = orig.create; }
  console.log("SKINORA_VARIANT_IMAGE_OFFLINE_PASS: per-size main and extra images: validates files, limits 8 extras, cleans up Cloudinary");
})().catch((e) => { console.error(e); process.exitCode = 1; });
