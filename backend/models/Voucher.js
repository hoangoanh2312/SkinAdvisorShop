const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true, default: "" },
    discountType: { type: String, enum: ["percent", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: null, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    usageLimit: { type: Number, default: null, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

voucherSchema.pre("validate", function validateVoucher() {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate("endDate", "endDate must be later than startDate");
  }
  if (this.discountType === "percent" && !(this.discountValue > 0 && this.discountValue <= 100)) {
    this.invalidate("discountValue", "Percent discount must be greater than 0 and at most 100");
  }
  if (this.discountType === "fixed" && !(this.discountValue > 0)) {
    this.invalidate("discountValue", "Fixed discount must be greater than 0");
  }
});

module.exports = mongoose.model("Voucher", voucherSchema);
