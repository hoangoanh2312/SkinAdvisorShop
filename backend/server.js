require("dotenv").config({ quiet: true });
const connectDB = require("./config/db");
const { configureLiveDatabase } = require("./config/businessDatabase");
const { createApp } = require("./app");
const { assertProductionSafety } = require("./config/productionSafety");
const Order = require("./models/Order");
const InventoryMovement = require("./models/InventoryMovement");
const AdminAuditLog = require("./models/AdminAuditLog");
const ReturnCase = require("./models/ReturnCase");

const startServer = async ({ ensureOrderIdempotencyIndex = true } = {}) => {
  // npm run dev, npm start and the legacy start:business alias use the SAME DB.
  assertProductionSafety();
  const database = configureLiveDatabase();
  await connectDB();
  // Ensure the new collections exist BEFORE a checkout transaction writes to them.
  await Promise.all([InventoryMovement.init(), AdminAuditLog.init(), ReturnCase.init()]);
  if (ensureOrderIdempotencyIndex) {
    await Order.collection.createIndex(
      { user: 1, idempotencyKey: 1 },
      { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } }, name: "user_1_idempotencyKey_1" }
    );
  }
  const port = process.env.PORT || 5000;
  return createApp().listen(port, () => {
    console.log(`Business database: ${database}`);
    console.log(`Server running on port ${port}`);
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
