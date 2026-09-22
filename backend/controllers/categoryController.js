const Category = require("../models/Category");
const { isValidObjectId, pick, sendControllerError } = require("../utils/controllerHelpers");

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

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
