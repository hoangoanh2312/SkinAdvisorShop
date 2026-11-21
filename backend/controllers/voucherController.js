const Voucher = require("../models/Voucher");
const { isValidObjectId, pick, sendControllerError } = require("../utils/controllerHelpers");
const { calculateVoucherDiscount, assertPerUserEligibility } = require("../services/voucherEligibilityService");

const FIELDS = ["code", "description", "discountType", "discountValue", "minOrderValue", "maxDiscount", "startDate", "endDate", "usageLimit", "perUserLimit", "isActive"];

const listVouchers = async (req, res) => {
  try {
    const vouchers = await Voucher.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { vouchers } });
  } catch (error) { return sendControllerError(res, error, "Không thể lấy mã giảm giá"); }
};

const createVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.create(pick(req.body, FIELDS));
    return res.status(201).json({ success: true, message: "Tạo mã giảm giá thành công", data: { voucher } });
  } catch (error) { return sendControllerError(res, error, "Không thể tạo mã giảm giá"); }
};

const updateVoucher = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID mã giảm giá không hợp lệ" });
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: "Không tìm thấy mã giảm giá" });
    Object.assign(voucher, pick(req.body, FIELDS));
    await voucher.save();
    return res.status(200).json({ success: true, message: "Cập nhật mã giảm giá thành công", data: { voucher } });
  } catch (error) { return sendControllerError(res, error, "Không thể cập nhật mã giảm giá"); }
};

const deleteVoucher = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID mã giảm giá không hợp lệ" });
  try {
    const voucher = await Voucher.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: "after" });
    if (!voucher) return res.status(404).json({ success: false, message: "Không tìm thấy mã giảm giá" });
    return res.status(200).json({ success: true, message: "Đã vô hiệu hóa mã giảm giá", data: { voucher } });
  } catch (error) { return sendControllerError(res, error, "Không thể xóa mã giảm giá"); }
};

const validateVoucher = async (req, res) => {
  try {
    const code = typeof req.body.code === "string" ? req.body.code.trim().toUpperCase() : "";
    if (code.length > 30 || !/^[A-Z0-9_-]*$/.test(code)) return res.status(400).json({ success: false, message: "Mã giảm giá không hợp lệ" });
    const orderValue = Number(req.body.orderValue);
    if (!code || !Number.isFinite(orderValue) || orderValue < 0) return res.status(400).json({ success: false, message: "Mã giảm giá hoặc giá trị đơn hàng không hợp lệ" });
    const voucher = await Voucher.findOne({ code });
    if (!voucher) return res.status(404).json({ success: false, message: "Mã giảm giá không tồn tại" });
    const discount = calculateVoucherDiscount(voucher, orderValue);
    await assertPerUserEligibility(voucher, req.user._id);
    return res.status(200).json({ success: true, data: { code, discount, finalValue: orderValue - discount } });
  } catch (error) {
    const messages = { VOUCHER_INVALID: "Mã giảm giá không hoạt động", VOUCHER_EXPIRED: "Mã giảm giá chưa có hiệu lực hoặc đã hết hạn", VOUCHER_LIMIT: "Mã giảm giá đã hết lượt sử dụng", VOUCHER_USER_LIMIT: "Bạn đã sử dụng hết lượt cho mã giảm giá này", VOUCHER_MIN_ORDER: "Đơn hàng chưa đạt giá trị tối thiểu" };
    if (messages[error.message]) return res.status(400).json({ success: false, message: messages[error.message] });
    return sendControllerError(res, error, "Không thể kiểm tra mã giảm giá");
  }
};

module.exports = { listVouchers, createVoucher, updateVoucher, deleteVoucher, validateVoucher };
