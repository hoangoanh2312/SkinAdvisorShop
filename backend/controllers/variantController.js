const mongoose = require("mongoose");
const Product = require("../models/Product");
const InventoryMovement = require("../models/InventoryMovement");
const { audit } = require("../services/adminSupport");
const Variant = require("../models/Variant");
const { isValidObjectId, pick, sendControllerError } = require("../utils/controllerHelpers");

const VARIANT_FIELDS = ["name", "sku", "size", "unit", "price", "salePrice", "stock", "image", "isActive"];

// Mongoose's Number casting alone permits fractional inventory and a discount
// greater than the original price. Validate the combined record on updates.
const validateVariantValues = (data, current = {}) => {
  const has = (field) => Object.prototype.hasOwnProperty.call(data, field);
  const positiveOrZero = (value) => value !== "" && value !== null && value !== undefined &&
    Number.isFinite(Number(value)) && Number(value) >= 0;
  if (has("price") && !positiveOrZero(data.price)) return "Giá phiên bản phải là số không âm";
  if (has("stock") && (data.stock === "" || data.stock == null ||
      !Number.isSafeInteger(Number(data.stock)) || Number(data.stock) < 0)) {
    return "Tồn kho phải là số nguyên không âm";
  }
  if (has("isActive") && typeof data.isActive !== "boolean") return "Trạng thái phiên bản không hợp lệ";
  const price = has("price") ? Number(data.price) : current.price;
  const salePrice = has("salePrice") ? data.salePrice : current.salePrice;
  if (salePrice != null && salePrice !== "" &&
      (!positiveOrZero(salePrice) || !Number.isFinite(price) || Number(salePrice) > price)) {
    return "Giá giảm không hợp lệ hoặc lớn hơn giá gốc";
  }
  return null;
};

const getProductVariants = async (req, res) => {
  if (!isValidObjectId(req.params.productId)) {
    return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  }
  try {
    const product = await Product.exists({ _id: req.params.productId, $or: [{ isActive: true }, { isCatalogVisible: true }] });
    if (!product) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    const variants = await Variant.find({ product: req.params.productId, isActive: true }).sort({ price: 1 });
    return res.status(200).json({ success: true, data: { variants } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể lấy danh sách phiên bản");
  }
};

const createVariant = async (req, res) => {
  if (!isValidObjectId(req.params.productId)) return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  const data = pick(req.body || {}, VARIANT_FIELDS);
  const validation = validateVariantValues(data);
  if (validation) return res.status(400).json({ success: false, message: validation });
  const initialStock = Number(data.stock || 0);
  if (initialStock > 0 && (typeof req.body?.stockChangeNote !== 'string' || req.body.stockChangeNote.trim().length < 6 || req.body.stockChangeNote.length > 500))
    return res.status(400).json({ success: false, message: 'Nhập lý do tồn kho ban đầu tối thiểu 6 ký tự' });
  const session = await mongoose.startSession();
  try {
    let variant;
    await session.withTransaction(async () => {
      if (!(await Product.exists({ _id: req.params.productId }).session(session))) throw new Error('PRODUCT_NOT_FOUND');
      [variant] = await Variant.create([{ ...data, product: req.params.productId }], { session });
      if (initialStock > 0) {
        await InventoryMovement.create([{ variant: variant._id, product: variant.product, actor: req.user._id, kind: 'receipt', delta: initialStock, before: 0, after: initialStock, note: req.body.stockChangeNote.trim() }], { session });
        await audit({ actor: req.user._id, action: 'inventory.initial', resource: 'inventory', resourceId: variant._id, method: 'POST', details: `+${initialStock} tồn ban đầu` }, session);
      }
    });
    return res.status(201).json({ success: true, message: "Tạo phiên bản thành công", data: { variant } });
  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    return sendControllerError(res, error, "Không thể tạo phiên bản");
  } finally { await session.endSession(); }
};

const updateVariant = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID phiên bản không hợp lệ" });
  const data = pick(req.body || {}, VARIANT_FIELDS);
  let current;
  try { current = await Variant.findById(req.params.id).select('price salePrice stock product').lean(); }
  catch (error) { return sendControllerError(res, error, 'Không thể đọc phiên bản'); }
  if (!current) return res.status(404).json({ success: false, message: "Không tìm thấy phiên bản" });
  const validation = validateVariantValues(data, current);
  if (validation) return res.status(400).json({ success: false, message: validation });
  const stockChange = Object.prototype.hasOwnProperty.call(data, 'stock') && Number(data.stock) !== current.stock;
  if (stockChange && (typeof req.body?.stockChangeNote !== 'string' || req.body.stockChangeNote.trim().length < 6 || req.body.stockChangeNote.length > 500))
    return res.status(400).json({ success: false, message: 'Vui lòng ghi lý do điều chỉnh tồn kho (tối thiểu 6 ký tự)' });
  try {
    if (!stockChange) {
      const variant = await Variant.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
      return res.status(200).json({ success: true, message: 'Cập nhật phiên bản thành công', data: { variant } });
    }
    const session = await mongoose.startSession();
    try {
      let variant;
      await session.withTransaction(async () => {
        const previous = await Variant.findById(req.params.id).session(session);
        if (!previous) throw new Error('SKU_NOT_FOUND');
        const refreshed = validateVariantValues(data, previous);
        if (refreshed) throw new Error('INVALID_VARIANT');
        const delta = Number(data.stock) - previous.stock;
        if (!Number.isSafeInteger(delta)) throw new Error('INVALID_VARIANT');
        variant = await Variant.findOneAndUpdate({ _id: req.params.id, stock: previous.stock }, data, { new: true, runValidators: true, session });
        if (!variant) throw new Error('STOCK_CHANGED');
        if (delta !== 0) {
          await InventoryMovement.create([{ variant: variant._id, product: variant.product, actor: req.user._id, kind: 'adjustment', delta, before: previous.stock, after: variant.stock, note: req.body.stockChangeNote.trim() }], { session });
          await audit({ actor: req.user._id, action: 'inventory.variant_edit', resource: 'inventory', resourceId: variant._id, method: 'PUT', details: `SKU ${variant.sku}: ${delta > 0 ? '+' : ''}${delta}` }, session);
        }
      });
      return res.status(200).json({ success: true, message: 'Cập nhật phiên bản và lịch sử kho thành công', data: { variant } });
    } finally { await session.endSession(); }
  } catch (error) {
    if (error.message === 'STOCK_CHANGED') return res.status(409).json({ success: false, message: 'Tồn kho đã thay đổi, vui lòng tải lại' });
    if (error.message === 'INVALID_VARIANT') return res.status(400).json({ success: false, message: 'Phiên bản không hợp lệ' });
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

module.exports = { getProductVariants, createVariant, updateVariant, deleteVariant, validateVariantValues };
