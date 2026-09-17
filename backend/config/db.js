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
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    const safeMessage = sanitizeErrorMessage(error.message);
    console.error(`MongoDB connection failed: ${safeMessage}`);
    process.exit(1);
  }
};

module.exports = connectDB;
