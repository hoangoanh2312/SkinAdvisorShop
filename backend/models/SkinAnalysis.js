const mongoose = require("mongoose");

const concernSchema = new mongoose.Schema({ key: { type: String, required: true }, label: { type: String, required: true }, confidence: { type: Number, min: 0, max: 1, required: true } }, { _id: false });
const recommendationSchema = new mongoose.Schema({ product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }, score: { type: Number, min: 0, required: true }, reasons: [{ type: String, trim: true }] }, { _id: false });

const skinAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  source: { type: String, enum: ["camera", "upload"], required: true },
  image: { url: { type: String, default: null }, publicId: { type: String, default: null } },
  result: {
    skinType: { type: String, enum: ["oily", "dry", "normal", "combination", "unknown"], required: true },
    skinTypeLabel: { type: String, required: true }, confidence: { type: Number, min: 0, max: 1, required: true },
    concerns: { type: [concernSchema], default: [] }, recommendedIngredients: [{ type: String, trim: true }],
    warnings: [{ type: String, trim: true }], analysisSource: { type: String, required: true },
  },
  recommendedProducts: { type: [recommendationSchema], default: [] },
}, { timestamps: true });

skinAnalysisSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model("SkinAnalysis", skinAnalysisSchema);
