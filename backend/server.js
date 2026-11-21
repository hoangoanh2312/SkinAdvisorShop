require("dotenv").config({ quiet: true });
const connectDB = require("./config/db");
const { configureLiveDatabase } = require("./config/businessDatabase");
const { createApp } = require("./app");
const { assertProductionSafety } = require("./config/productionSafety");
const Order = require("./models/Order");
const InventoryMovement = require("./models/InventoryMovement");
const AdminAuditLog = require("./models/AdminAuditLog");
const ReturnCase = require("./models/ReturnCase");
const WishlistItem = require("./models/WishlistItem");
const { getAcneDetectorStatus } = require("./services/skinAnalysis/acneDetector");
const { startReservationSweeper } = require("./services/stockReservation");

const startServer = async ({ ensureOrderIdempotencyIndex = true } = {}) => {
  // npm run dev, npm start and the legacy start:business alias use the SAME DB.
  assertProductionSafety();
  const database = configureLiveDatabase();
  await connectDB();
  // Ensure the new collections exist BEFORE a checkout transaction writes to them.
  await Promise.all([InventoryMovement.init(), AdminAuditLog.init(), ReturnCase.init()]);
  await WishlistItem.collection.createIndex({ user: 1, product: 1 }, { unique: true, name: "user_1_product_1" });
  if (ensureOrderIdempotencyIndex) {
    await Order.collection.createIndex(
      { user: 1, idempotencyKey: 1 },
      { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } }, name: "user_1_idempotencyKey_1" }
    );
  }
  const port = process.env.PORT || 5000;
  return createApp({ requireDatabase: true }).listen(port, () => {
    console.log(`Business database: ${database}`);
    console.log(`Server running on port ${port}`);
    {
      const { mailProvider, smtpConfig } = require("./services/mailService");
      const provider = mailProvider();
      console.log(provider === "smtp" ? `Gửi email: SMTP ${smtpConfig().host} (${smtpConfig().user})`
        : provider === "resend" ? "Gửi email: Resend (địa chỉ onboarding@resend.dev chỉ gửi được tới email chủ tài khoản Resend)"
        : "Gửi email: CHƯA CẤU HÌNH, email chỉ in ra cửa sổ này (điền SMTP_USER và SMTP_PASS trong .env)");
    }
    // Mỗi phút: hủy đơn online quá hạn giữ hàng mà chưa thanh toán và trả số lượng về kho.
    if (process.env.STOCK_RESERVATION_SWEEPER !== "false") startReservationSweeper();
    getAcneDetectorStatus().then((status) => console.log(status.available
      ? `Acne detector: ON (${status.names.length} lớp${status.metrics?.map50 != null ? `, mAP50=${status.metrics.map50}` : ""})`
      : `Acne detector: OFF (${status.reason}) — phân tích da chỉ dùng Gemini`));
  });
};

if (require.main === module) {
  startServer().catch(error => {
    // Do not log MongoDB connection URIs or secrets.
    console.error(`Server startup failed: ${error.code || error.message || "UNKNOWN"}`);
    process.exitCode = 1;
  });
}
module.exports = { startServer };
