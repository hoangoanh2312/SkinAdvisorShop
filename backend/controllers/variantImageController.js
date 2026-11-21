const mongoose = require("mongoose");
const Variant = require("../models/Variant");
const { validateImageSignature } = require("../services/productImageService");
const { audit } = require("../services/adminSupport");

// Ảnh riêng cho từng phiên bản (ví dụ chai 140ml khác chai 310ml)
let storage = require("../services/cloudinaryImageService");
const setVariantImageStorageForTests = (value) => { storage = value; };

// POST /api/variants/:id/image (multipart, trường "image")
const uploadVariantImage = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Phiên bản không hợp lệ" });
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, message: "Chưa chọn ảnh" });
  if (!validateImageSignature(file.buffer, file.mimetype)) return res.status(400).json({ success: false, message: "Ảnh phải là JPG, PNG hoặc WEBP hợp lệ" });
  try {
    const variant = await Variant.findById(id).lean();
    if (!variant) return res.status(404).json({ success: false, message: "Không tìm thấy phiên bản" });
    let uploaded;
    try { uploaded = await storage.upload(file, `${variant.product}/variants/${variant._id}`); }
    catch (error) { return res.status(502).json({ success: false, message: "Chưa tải ảnh lên được, kiểm tra kết nối Cloudinary rồi thử lại" }); }
    const updated = await Variant.findOneAndUpdate({ _id: id }, { $set: { image: uploaded.url, imagePublicId: uploaded.publicId } }, { returnDocument: "after" }).lean();
    if (variant.imagePublicId) storage.destroy(variant.imagePublicId).catch(() => {});
    await audit({ actor: req.user._id, action: "variant.image.upload", resource: "variant", resourceId: String(id), method: "POST", details: `Ảnh phiên bản ${variant.sku}` }).catch(() => {});
    return res.status(200).json({ success: true, message: "Đã cập nhật ảnh phiên bản", data: { variant: updated } });
  } catch (error) {
    console.error(`Variant image upload failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Không thể cập nhật ảnh phiên bản" });
  }
};

// DELETE /api/variants/:id/image — bỏ ảnh riêng, phiên bản quay về dùng ảnh chung của sản phẩm
const removeVariantImage = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Phiên bản không hợp lệ" });
  try {
    const variant = await Variant.findById(id).lean();
    if (!variant) return res.status(404).json({ success: false, message: "Không tìm thấy phiên bản" });
    const updated = await Variant.findOneAndUpdate({ _id: id }, { $set: { image: "", imagePublicId: "" } }, { returnDocument: "after" }).lean();
    if (variant.imagePublicId) storage.destroy(variant.imagePublicId).catch(() => {});
    await audit({ actor: req.user._id, action: "variant.image.remove", resource: "variant", resourceId: String(id), method: "DELETE", details: `Bỏ ảnh phiên bản ${variant.sku}` }).catch(() => {});
    return res.status(200).json({ success: true, message: "Phiên bản sẽ dùng ảnh chung của sản phẩm", data: { variant: updated } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể bỏ ảnh phiên bản" });
  }
};

const MAX_EXTRA = 8;

// POST /api/variants/:id/extra-images (multipart, trường "image") — thêm ảnh phụ
const addVariantExtraImage = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Phiên bản không hợp lệ" });
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, message: "Chưa chọn ảnh" });
  if (!validateImageSignature(file.buffer, file.mimetype)) return res.status(400).json({ success: false, message: "Ảnh phải là JPG, PNG hoặc WEBP hợp lệ" });
  try {
    const variant = await Variant.findById(id).lean();
    if (!variant) return res.status(404).json({ success: false, message: "Không tìm thấy phiên bản" });
    if ((variant.extraImages || []).length >= MAX_EXTRA) return res.status(400).json({ success: false, message: `Mỗi phiên bản tối đa ${MAX_EXTRA} ảnh phụ` });
    let uploaded;
    try { uploaded = await storage.upload(file, `${variant.product}/variants/${variant._id}`); }
    catch (error) { return res.status(502).json({ success: false, message: "Chưa tải ảnh lên được, kiểm tra kết nối Cloudinary rồi thử lại" }); }
    const updated = await Variant.findOneAndUpdate(
      { _id: id, [`extraImages.${MAX_EXTRA - 1}`]: { $exists: false } },
      { $push: { extraImages: { url: uploaded.url, publicId: uploaded.publicId, source: "admin" } } },
      { returnDocument: "after" },
    ).lean();
    if (!updated) { storage.destroy(uploaded.publicId).catch(() => {}); return res.status(400).json({ success: false, message: `Mỗi phiên bản tối đa ${MAX_EXTRA} ảnh phụ` }); }
    await audit({ actor: req.user._id, action: "variant.extraImage.add", resource: "variant", resourceId: String(id), method: "POST", details: `Thêm ảnh phụ cho ${variant.sku}` }).catch(() => {});
    return res.status(200).json({ success: true, message: "Đã thêm ảnh phụ", data: { variant: updated } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể thêm ảnh phụ" });
  }
};

// DELETE /api/variants/:id/extra-images?url=... — xóa một ảnh phụ
const removeVariantExtraImage = async (req, res) => {
  const { id } = req.params;
  const url = typeof req.query.url === "string" ? req.query.url : "";
  if (!mongoose.isValidObjectId(id) || !/^https:\/\//.test(url)) return res.status(400).json({ success: false, message: "Yêu cầu không hợp lệ" });
  try {
    const variant = await Variant.findById(id).lean();
    const target = variant?.extraImages?.find((item) => item.url === url);
    if (!target) return res.status(404).json({ success: false, message: "Không tìm thấy ảnh phụ" });
    const updated = await Variant.findOneAndUpdate({ _id: id }, { $pull: { extraImages: { url } } }, { returnDocument: "after" }).lean();
    if (target.publicId) storage.destroy(target.publicId).catch(() => {});
    await audit({ actor: req.user._id, action: "variant.extraImage.remove", resource: "variant", resourceId: String(id), method: "DELETE", details: `Xóa ảnh phụ của ${variant.sku}` }).catch(() => {});
    return res.status(200).json({ success: true, message: "Đã xóa ảnh phụ", data: { variant: updated } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể xóa ảnh phụ" });
  }
};

module.exports = { uploadVariantImage, removeVariantImage, addVariantExtraImage, removeVariantExtraImage, setVariantImageStorageForTests, MAX_EXTRA };
