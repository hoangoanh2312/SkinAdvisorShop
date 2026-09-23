const Voucher = require("../models/Voucher");
const { isValidObjectId, pick, sendControllerError } = require("../utils/controllerHelpers");
const { calculateVoucherDiscount } = require("../utils/commerceHelpers");

const FIELDS = ["code", "description", "discountType", "discountValue", "minOrderValue", "maxDiscount", "startDate", "endDate", "usageLimit", "isActive"];

const listVouchers = async (req, res) => {
  try {
    const vouchers = await Voucher.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { vouchers } });
  } catch (error) { return sendControllerError(res, error, "Không thể lấy voucher"); }
};

const createVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.create(pick(req.body, FIELDS));
    return res.status(201).json({ success: true, message: "Tạo voucher thành công", data: { voucher } });
  } catch (error) { return sendControllerError(res, error, "Không thể tạo voucher"); }
};

const updateVoucher = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID voucher không hợp lệ" });
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: "Không tìm thấy voucher" });
    Object.assign(voucher, pick(req.body, FIELDS));
    await voucher.save();
    return res.status(200).json({ success: true, message: "Cập nhật voucher thành công", data: { voucher } });
  } catch (error) { return sendControllerError(res, error, "Không thể cập nhật voucher"); }
};

const deleteVoucher = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID voucher không hợp lệ" });
  try {
    const voucher = await Voucher.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!voucher) return res.status(404).json({ success: false, message: "Không tìm thấy voucher" });
    return res.status(200).json({ success: true, message: "Đã vô hiệu hóa voucher", data: { voucher } });
  } catch (error) { return sendControllerError(res, error, "Không thể xóa voucher"); }
};

const validateVoucher = async (req, res) => {
  try {
    const code = typeof req.body.code === "string" ? req.body.code.trim().toUpperCase() : "";
    const orderValue = Number(req.body.orderValue);
    if (!code || !Number.isFinite(orderValue) || orderValue < 0) return res.status(400).json({ success: false, message: "Mã voucher hoặc giá trị đơn hàng không hợp lệ" });
    const voucher = await Voucher.findOne({ code });
    if (!voucher) return res.status(404).json({ success: false, message: "Voucher không tồn tại" });
    const discount = calculateVoucherDiscount(voucher, orderValue);
    return res.status(200).json({ success: true, data: { code, discount, finalValue: orderValue - discount } });
  } catch (error) {
    const messages = { VOUCHER_INVALID: "Voucher không hoạt động", VOUCHER_EXPIRED: "Voucher chưa có hiệu lực hoặc đã hết hạn", VOUCHER_LIMIT: "Voucher đã hết lượt sử dụng", VOUCHER_MIN_ORDER: "Đơn hàng chưa đạt giá trị tối thiểu" };
    if (messages[error.message]) return res.status(400).json({ success: false, message: messages[error.message] });
    return sendControllerError(res, error, "Không thể kiểm tra voucher");
  }
};

module.exports = { listVouchers, createVoucher, updateVoucher, deleteVoucher, validateVoucher };
