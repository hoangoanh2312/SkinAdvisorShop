const mongoose = require("mongoose");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pick = (source, fields) =>
  fields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) result[field] = source[field];
    return result;
  }, {});

const sendControllerError = (res, error, fallbackMessage) => {
  if (error?.code === 11000) {
    return res.status(409).json({ success: false, message: "Dữ liệu đã tồn tại" });
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
  }

  return res.status(500).json({ success: false, message: fallbackMessage });
};

module.exports = { isValidObjectId, escapeRegex, pick, sendControllerError };
