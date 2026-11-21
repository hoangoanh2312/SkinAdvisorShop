const mongoose = require("mongoose");

// Tin nhắn khách gửi từ trang Liên hệ
const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, default: "", trim: true, maxlength: 20 },
  topic: { type: String, enum: ["order", "product", "skin", "partnership", "other"], default: "other" },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ["new", "handled"], default: "new" },
  handledAt: { type: Date, default: null },
  // Kết quả chuyển tiếp tin nhắn vào hộp thư cửa hàng
  forwarded: { type: Boolean, default: false },
}, { timestamps: true });
contactMessageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
