const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const variantRoutes = require("./routes/variantRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const voucherRoutes = require("./routes/voucherRoutes");
const { orderRouter, adminOrderRouter } = require("./routes/orderRoutes");
const aiRoutes = require("./routes/aiRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const userRoutes = require("./routes/userRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");
const contactRoutes = require("./routes/contactRoutes");
const brandRoutes = require("./routes/brandRoutes");
const publicBrandRoutes = require("./routes/publicBrandRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminOperationsRoutes = require("./routes/adminOperationsRoutes");
const { adminAuditTrail } = require("./middleware/adminAuditTrail");

const createApp = ({ requireDatabase = false } = {}) => {
  const app = express();
  // Development can use Vite's dynamic port. Production only accepts explicitly
  // configured browser origins; CORS never replaces JWT/role authorization.
  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const corsOptions = process.env.NODE_ENV === "production"
    ? { origin(origin, done) { done(null, !origin || allowedOrigins.includes(origin)); } }
    : {};
  app.use(cors(corsOptions));
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  // If MongoDB drops (e.g. Atlas Network Access no longer allows this IP), answer at once with a clear 503
  // instead of letting each query wait for server selection while the UI spins on "Đang tải...".
  app.use('/api', (req, res, next) => {
    // Only the real server enables this; offline tests call createApp() with mocked models.
    if (!requireDatabase || req.path === '/health' || mongoose.connection.readyState === 1) return next();
    return res.status(503).json({ success: false, code: 'DATABASE_UNAVAILABLE', message: 'Máy chủ chưa kết nối được cơ sở dữ liệu MongoDB. Kiểm tra mạng và mục Network Access trên MongoDB Atlas rồi thử lại.' });
  });
  app.use(adminAuditTrail);
  app.use("/api/auth", authRoutes); app.use("/api/categories", categoryRoutes); app.use("/api/products", productRoutes); app.use("/api/variants", variantRoutes); app.use("/api/reviews", reviewRoutes); app.use("/api/vouchers", voucherRoutes); app.use("/api/orders", orderRouter); app.use("/api/admin/orders", adminOrderRouter); app.use("/api/admin/brands", brandRoutes); app.use("/api/brands", publicBrandRoutes); app.use("/api/admin", adminOperationsRoutes); app.use("/api/admin", adminRoutes); app.use("/api/ai", aiRoutes); app.use("/api/payments", paymentRoutes); app.use("/api/users", userRoutes); app.use("/api/wishlist", wishlistRoutes); app.use("/api/newsletter", newsletterRoutes); app.use("/api/contact", contactRoutes);
  app.get("/", (_req, res) => res.status(200).json({ success: true, message: "Máy chủ sandwich beauty đang hoạt động" }));
  app.get("/api/health", (_req, res) => { const connected = mongoose.connection.readyState === 1; res.status(connected ? 200 : 503).json({ success: connected, message: connected ? "Máy chủ hoạt động" : "Máy chủ tạm thời gián đoạn", database: connected ? "connected" : "disconnected" }); });
  app.use((error, req, res, next) => { if (error instanceof SyntaxError && error.status === 400 && "body" in error) return res.status(400).json({ success: false, message: "Dữ liệu JSON không hợp lệ" }); return res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" }); });
  return app;
};
module.exports = { createApp };
