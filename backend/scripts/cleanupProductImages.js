require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Product = require("../models/Product");
const ImageCleanupTask = require("../models/ImageCleanupTask");
const cloudinary = require("../services/cloudinaryImageService");

const execute = process.argv.includes("--execute");
const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const tasks = await ImageCleanupTask.find({ status: { $in: ["pending", "failed"] }, nextAttemptAt: { $lte: new Date() }, attempts: { $lt: 5 } }).limit(100);
  for (const task of tasks) {
    if (await Product.exists({ "imageAssets.publicId": task.publicId })) {
      if (execute) { task.status = "still_referenced"; await task.save(); }
      console.log(`[${execute ? "SKIP" : "DRY-RUN"}] referenced cleanup task ${task._id}`);
      continue;
    }
    if (!execute) { console.log(`[DRY-RUN] cleanup task ${task._id}`); continue; }
    try { await cloudinary.destroy(task.publicId); task.status = "destroyed"; task.lastError = ""; }
    catch { task.attempts += 1; task.status = task.attempts >= 5 ? "failed" : "pending"; task.lastError = "Cloudinary cleanup failed"; task.nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** task.attempts) * 60 * 1000); }
    await task.save();
  }
  await mongoose.disconnect();
};
run().catch((error) => { console.error(`Cleanup failed: ${error.message}`); process.exitCode = 1; });
