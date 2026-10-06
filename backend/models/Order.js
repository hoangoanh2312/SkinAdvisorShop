const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", required: true },
    productName: { type: String, required: true, trim: true },
    variantName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    image: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    ward: { type: String, required: true, trim: true },
    address: {
      type: String,
      trim: true,
      required() {
        return !this.addressLine;
      },
    },
    // Legacy fields remain optional so existing orders stay readable.
    district: { type: String, trim: true },
    addressLine: { type: String, trim: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, immutable: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [orderItemSchema], required: true, validate: [(items) => items.length > 0, "Order requires items"] },
    shippingAddress: { type: shippingAddressSchema, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    voucher: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", default: null },
    voucherCode: { type: String, uppercase: true, trim: true, default: "" },
    paymentMethod: { type: String, enum: ["COD", "VNPAY", "BANK_TRANSFER"], required: true },
    paymentStatus: { type: String, enum: ["unpaid", "pending_verification", "paid", "failed", "refunded"], default: "unpaid" },
    vnpayTxnRef: { type: String, trim: true, default: undefined },
    vnpayTransactionNo: { type: String, trim: true, default: "" },
    vnpayBankCode: { type: String, trim: true, default: "" },
    vnpayResponseCode: { type: String, trim: true, default: "" },
    vnpayPayDate: { type: String, trim: true, default: "" },
    paidAt: { type: Date, default: null },
    orderStatus: { type: String, enum: ["pending", "confirmed", "shipping", "completed", "cancelled"], default: "pending" },
    note: { type: String, trim: true, maxlength: 1000, default: "" },
    stockDeducted: { type: Boolean, default: false, select: false },
    stockRestored: { type: Boolean, default: false, select: false },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ orderCode: 1 }, { unique: true, sparse: true });
orderSchema.index({ vnpayTxnRef: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Order", orderSchema);
