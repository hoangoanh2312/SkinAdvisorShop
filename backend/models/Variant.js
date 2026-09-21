const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    size: { type: String, default: "" },
    unit: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    image: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Variant", variantSchema);
