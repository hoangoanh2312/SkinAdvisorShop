const Brand = require("../models/Brand");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { escapeRegex, isValidObjectId, pick, sendControllerError } = require("../utils/controllerHelpers");
const FIELDS = ["name", "slug", "logo", "description", "isActive"];
const listBrands = async (req, res) => { try { const page = Math.max(parseInt(req.query.page, 10) || 1, 1), limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100); const filter = {}; if (req.query.includeInactive !== "true") filter.isActive = true; if (req.query.search?.trim()) filter.$or = [{ name: new RegExp(escapeRegex(req.query.search.trim()), "i") }, { slug: new RegExp(escapeRegex(req.query.search.trim()), "i") }]; const [brands, total] = await Promise.all([Brand.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(), Brand.countDocuments(filter)]); const counts = await Product.aggregate([{ $match: { brandRef: { $in: brands.map(item => item._id) } } }, { $group: { _id: "$brandRef", count: { $sum: 1 } } }]); const map = new Map(counts.map(item => [String(item._id), item.count])); return res.json({ success: true, data: { brands: brands.map(item => ({ ...item, productCount: map.get(String(item._id)) || 0 })), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } }); } catch (error) { return sendControllerError(res, error, "Không thể lấy thương hiệu"); } };
const createBrand = async (req, res) => { try { const brand = await Brand.create(pick(req.body, FIELDS)); return res.status(201).json({ success: true, data: { brand } }); } catch (error) { return sendControllerError(res, error, "Không thể tạo thương hiệu"); } };
const updateBrand = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID không hợp lệ" });
  const changes = pick(req.body, FIELDS);
  const session = await mongoose.startSession();
  try {
    let brand;
    await session.withTransaction(async () => {
      const current = await Brand.findById(req.params.id).session(session);
      if (!current) return;
      const previousName = current.name;
      Object.assign(current, changes);
      await current.save({ session });
      if (changes.name && current.name !== previousName) {
        await Product.updateMany({ brandRef: current._id }, { $set: { brand: current.name } }, { session });
      }
      brand = current;
    });
    if (!brand) return res.status(404).json({ success: false, message: "Không tìm thấy thương hiệu" });
    return res.json({ success: true, data: { brand } });
  } catch (error) { return sendControllerError(res, error, "Không thể cập nhật thương hiệu"); }
  finally { await session.endSession(); }
};
module.exports = { createBrand, listBrands, updateBrand };
