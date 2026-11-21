const crypto = require("crypto");
const mongoose = require("mongoose");

const newUnsubscribeToken = () => crypto.randomBytes(24).toString("hex");

// Email khách đăng ký nhận bản tin ở chân trang website.
// unsubscribeToken nằm trong link "Hủy nhận bản tin" ở mỗi email, bấm vào là ngừng nhận, không cần đăng nhập.
const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    source: { type: String, default: "footer", maxlength: 30 },
    isActive: { type: Boolean, default: true },
    unsubscribeToken: { type: String, default: newUnsubscribeToken, index: { unique: true, sparse: true } },
    welcomeSentAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
newsletterSubscriberSchema.index({ isActive: 1, createdAt: -1 });

const NewsletterSubscriber = mongoose.model("NewsletterSubscriber", newsletterSubscriberSchema);
NewsletterSubscriber.newUnsubscribeToken = newUnsubscribeToken;
module.exports = NewsletterSubscriber;
