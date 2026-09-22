const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { isValidObjectId, pick, sendControllerError } = require("../utils/controllerHelpers");

const VARIANT_FIELDS = ["name", "sku", "size", "unit", "price", "salePrice", "stock", "image", "isActive"];

const getProductVariants = async (req, res) => {
  if (!isValidObjectId(req.params.productId)) {
    return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  }
  try {
    const product = await Product.exists({ _id: req.params.productId, isActive: true });
    if (!product) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    const variants = await Variant.find({ product: req.params.productId, isActive: true }).sort({ price: 1 });
    return res.status(200).json({ success: true, data: { variants } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể lấy danh sách phiên bản");
  }
};

const createVariant = async (req, res) => {
  if (!isValidObjectId(req.params.productId)) {
    return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  }
  try {
    if (!(await Product.exists({ _id: req.params.productId, isActive: true }))) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    const data = pick(req.body, VARIANT_FIELDS);
    const variant = await Variant.create({ ...data, product: req.params.productId });
    return res.status(201).json({ success: true, message: "Tạo phiên bản thành công", data: { variant } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể tạo phiên bản");
  }
};

const updateVariant = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "ID phiên bản không hợp lệ" });
  }
  try {
    const variant = await Variant.findByIdAndUpdate(req.params.id, pick(req.body, VARIANT_FIELDS), {
      new: true,
      runValidators: true,
    });
    if (!variant) return res.status(404).json({ success: false, message: "Không tìm thấy phiên bản" });
    return res.status(200).json({ success: true, message: "Cập nhật phiên bản thành công", data: { variant } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể cập nhật phiên bản");
  }
};

const deleteVariant = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "ID phiên bản không hợp lệ" });
  }
  try {
    const variant = await Variant.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!variant) return res.status(404).json({ success: false, message: "Không tìm thấy phiên bản" });
    return res.status(200).json({ success: true, message: "Đã vô hiệu hóa phiên bản", data: { variant } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể vô hiệu hóa phiên bản");
  }
};

module.exports = { getProductVariants, createVariant, updateVariant, deleteVariant };
