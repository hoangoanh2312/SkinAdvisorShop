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
    stock: { type: Number, default: 0, min: 0, validate: {
      validator: Number.isSafeInteger,
      message: "Tồn kho phải là số nguyên không âm",
    } },
    image: { type: String, default: "" },
    // Mã ảnh trên Cloudinary khi ảnh phiên bản được tải lên từ trang quản trị (để xóa ảnh cũ khi thay)
    imagePublicId: { type: String, default: "" },
    // Ảnh phụ của phiên bản (góc khác, ảnh dùng thực tế), hiện sau ảnh chính khi khách chọn dung tích này
    extraImages: {
      type: [{ _id: false, url: { type: String, required: true }, publicId: { type: String, default: "" }, source: { type: String, default: "" } }],
      default: [],
      validate: { validator: (value) => value.length <= 8, message: "Tối đa 8 ảnh phụ cho mỗi phiên bản" },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Variant", variantSchema);
