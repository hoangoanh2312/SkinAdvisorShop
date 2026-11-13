const mongoose = require("mongoose");
const schema = new mongoose.Schema({ voucher: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", required: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true } }, { timestamps: true });
schema.index({ voucher: 1, order: 1 }, { unique: true });
schema.index({ voucher: 1, user: 1 });
module.exports = mongoose.model("VoucherRedemption", schema);
