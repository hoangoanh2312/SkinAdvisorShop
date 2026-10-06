const mongoose = require("mongoose");
const User = require("../models/User");
const { sendControllerError } = require("../utils/controllerHelpers");

const REQUIRED_FIELDS = ["fullName", "phone", "province", "ward", "address"];

const normalizeAddressInput = (body) => {
  const address = Object.fromEntries(
    REQUIRED_FIELDS.map((field) => [field, typeof body?.[field] === "string" ? body[field].trim() : ""])
  );
  address.label = typeof body?.label === "string" ? body.label.trim() : "";
  return REQUIRED_FIELDS.every((field) => address[field]) ? address : null;
};

const invalidAddressId = (addressId) => !mongoose.Types.ObjectId.isValid(addressId);

const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("addresses");
    return res.status(200).json({ success: true, data: { addresses: user?.addresses || [] } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể lấy sổ địa chỉ");
  }
};

const createAddress = async (req, res) => {
  const input = normalizeAddressInput(req.body);
  if (!input) return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin địa chỉ" });

  try {
    const user = await User.findById(req.user._id);
    const makeDefault = user.addresses.length === 0 || req.body.isDefault === true;
    if (makeDefault) user.addresses.forEach((address) => { address.isDefault = false; });
    user.addresses.push({ ...input, isDefault: makeDefault });
    await user.save();
    const address = user.addresses[user.addresses.length - 1];
    return res.status(201).json({ success: true, message: "Thêm địa chỉ thành công", data: { address } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể thêm địa chỉ");
  }
};

const updateAddress = async (req, res) => {
  if (invalidAddressId(req.params.addressId)) return res.status(400).json({ success: false, message: "ID địa chỉ không hợp lệ" });
  const input = normalizeAddressInput(req.body);
  if (!input) return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin địa chỉ" });

  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ success: false, message: "Không tìm thấy địa chỉ" });
    REQUIRED_FIELDS.forEach((field) => { address[field] = input[field]; });
    address.label = input.label;
    await user.save();
    return res.status(200).json({ success: true, message: "Cập nhật địa chỉ thành công", data: { address } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể cập nhật địa chỉ");
  }
};

const deleteAddress = async (req, res) => {
  if (invalidAddressId(req.params.addressId)) return res.status(400).json({ success: false, message: "ID địa chỉ không hợp lệ" });

  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ success: false, message: "Không tìm thấy địa chỉ" });
    const wasDefault = address.isDefault;
    user.addresses.pull(address._id);
    if (wasDefault && user.addresses.length > 0) user.addresses[0].isDefault = true;
    await user.save();
    return res.status(200).json({ success: true, message: "Xóa địa chỉ thành công", data: { addresses: user.addresses } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể xóa địa chỉ");
  }
};

const setDefaultAddress = async (req, res) => {
  if (invalidAddressId(req.params.addressId)) return res.status(400).json({ success: false, message: "ID địa chỉ không hợp lệ" });

  try {
    const user = await User.findById(req.user._id);
    const selected = user.addresses.id(req.params.addressId);
    if (!selected) return res.status(404).json({ success: false, message: "Không tìm thấy địa chỉ" });
    user.addresses.forEach((address) => { address.isDefault = address._id.equals(selected._id); });
    await user.save();
    return res.status(200).json({ success: true, message: "Đã đặt địa chỉ mặc định", data: { address: selected } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể đặt địa chỉ mặc định");
  }
};

module.exports = { getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress };
