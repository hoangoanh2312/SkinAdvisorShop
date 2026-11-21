const mongoose = require("mongoose");

const sanitizeErrorMessage = (message = "") =>
  message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[MongoDB URI hidden]")
    .replace(/\/\/([^:@/\s]+):([^@/\s]+)@/g, "//[credentials hidden]@");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MongoDB connection failed: MONGO_URI is not configured");
    process.exit(1);
  }

  try {
    // Fail in seconds rather than ~30s when Atlas is unreachable (IP not allowed, offline network).
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB connected successfully");
    mongoose.connection.on("disconnected", () => console.error("MongoDB disconnected — API sẽ trả 503 cho tới khi kết nối lại. Kiểm tra mạng / Atlas Network Access."));
    mongoose.connection.on("reconnected", () => console.log("MongoDB reconnected"));
  } catch (error) {
    const safeMessage = sanitizeErrorMessage(error.message);
    console.error(`MongoDB connection failed: ${safeMessage}`);
    if (/whitelist|ETIMEDOUT|ECONNREFUSED|Server selection timed out|ENOTFOUND|querySrv/i.test(error.message || "")) {
      console.error("Gợi ý: vào MongoDB Atlas > Network Access > Add Current IP Address, đợi trạng thái Active rồi chạy lại backend.");
    }
    process.exit(1);
  }
};

module.exports = connectDB;
