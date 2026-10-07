const mongoose = require("mongoose");

const imageCleanupTaskSchema = new mongoose.Schema({
  publicId: { type: String, required: true, trim: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ["pending", "destroyed", "still_referenced", "failed"], default: "pending", index: true },
  attempts: { type: Number, default: 0, min: 0 },
  lastError: { type: String, default: "" }, nextAttemptAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("ImageCleanupTask", imageCleanupTaskSchema);
