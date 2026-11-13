const Category = require("../models/Category");
const Product = require("../models/Product");
const { escapeRegex, isValidObjectId, pick, sendControllerError } = require("../utils/controllerHelpers");

const CATEGORY_FIELDS = ["name", "slug", "description", "image", "isActive"];

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    return res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể lấy danh sách danh mục");
  }
};

const getCategory = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "ID danh mục không hợp lệ" });
  }

  try {
    const category = await Category.findOne({ _id: req.params.id, isActive: true });
    if (!category) {
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    }
    return res.status(200).json({ success: true, data: { category } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể lấy danh mục");
  }
};

const createCategory = async (req, res) => {
  try {
    const data = pick(req.body, CATEGORY_FIELDS);
    if (!data.name?.trim() || !data.slug?.trim()) {
      return res.status(400).json({ success: false, message: "Tên và slug danh mục là bắt buộc" });
    }
    const category = await Category.create(data);
    return res.status(201).json({ success: true, message: "Tạo danh mục thành công", data: { category } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể tạo danh mục");
  }
};

const updateCategory = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "ID danh mục không hợp lệ" });
  }

  try {
    const category = await Category.findByIdAndUpdate(req.params.id, pick(req.body, CATEGORY_FIELDS), {
      new: true,
      runValidators: true,
    });
    if (!category) {
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    }
    return res.status(200).json({ success: true, message: "Cập nhật danh mục thành công", data: { category } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể cập nhật danh mục");
  }
};

const deleteCategory = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "ID danh mục không hợp lệ" });
  }

  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!category) {
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    }
    return res.status(200).json({ success: true, message: "Đã vô hiệu hóa danh mục", data: { category } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể vô hiệu hóa danh mục");
  }
};

const getAdminCategories = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1), limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    if (req.query.includeInactive !== "true") filter.isActive = true;
    if (req.query.search?.trim()) { const pattern = new RegExp(escapeRegex(req.query.search.trim()), "i"); filter.$or = [{ name: pattern }, { slug: pattern }]; }
    const [categories, total] = await Promise.all([Category.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(), Category.countDocuments(filter)]);
    const counts = await Product.aggregate([{ $match: { category: { $in: categories.map(item => item._id) } } }, { $group: { _id: "$category", count: { $sum: 1 } } }]);
    const map = new Map(counts.map(item => [String(item._id), item.count]));
    return res.json({ success: true, data: { categories: categories.map(item => ({ ...item, productCount: map.get(String(item._id)) || 0 })), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) { return sendControllerError(res, error, "Không thể lấy danh mục quản trị"); }
};

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory, getAdminCategories };
