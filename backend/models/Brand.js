const mongoose = require("mongoose");
const brandSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true, trim: true }, slug: { type: String, required: true, unique: true, lowercase: true, trim: true }, logo: { type: String, default: "", trim: true }, description: { type: String, default: "", trim: true }, isActive: { type: Boolean, default: true } }, { timestamps: true });
module.exports = mongoose.model("Brand", brandSchema);
