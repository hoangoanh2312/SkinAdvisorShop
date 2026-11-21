const mongoose = require("mongoose");

// Mỗi lần quản trị viên gửi bản tin là một bản ghi: nội dung đã gửi, sản phẩm kèm theo và kết quả gửi.
const campaignProductSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  slug: { type: String, default: "" },
  brand: { type: String, default: "" },
  image: { type: String, default: "" },
  price: { type: Number, default: 0 },
  originalPrice: { type: Number, default: null },
}, { _id: false });

const newsletterCampaignSchema = new mongoose.Schema({
  subject: { type: String, required: true, trim: true, maxlength: 150 },
  content: { type: String, required: true, trim: true, maxlength: 5000 },
  products: { type: [campaignProductSchema], default: [] },
  status: { type: String, enum: ["sending", "sent", "partial", "failed"], default: "sending" },
  recipientCount: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  // true khi máy chủ chưa cấu hình RESEND_API_KEY: email chỉ in ra cửa sổ máy chủ, không tới hộp thư thật.
  previewOnly: { type: Boolean, default: false },
  // Lỗi gần nhất Resend trả về, giúp quản trị viên biết vì sao email không tới
  lastError: { type: String, default: "", maxlength: 300 },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  finishedAt: { type: Date, default: null },
}, { timestamps: true });
newsletterCampaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model("NewsletterCampaign", newsletterCampaignSchema);
