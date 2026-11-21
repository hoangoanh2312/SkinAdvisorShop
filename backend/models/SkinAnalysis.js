const mongoose = require("mongoose");

const concernSchema = new mongoose.Schema({ key: { type: String, required: true }, label: { type: String, required: true }, confidence: { type: Number, min: 0, max: 1, required: true }, evidence: { type: String, maxlength: 180, default: "" } }, { _id: false });
const recommendationSchema = new mongoose.Schema({ product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }, score: { type: Number, min: 0, required: true }, reasons: [{ type: String, trim: true }] }, { _id: false });

const markerSchema = new mongoose.Schema({ x: { type: Number, min: 0, max: 1 }, y: { type: Number, min: 0, max: 1 }, region: { type: String, default: null } }, { _id: false });
const metricSchema = new mongoose.Schema({
  key: { type: String, required: true }, label: { type: String, required: true },
  status: { type: String, enum: ["assessed", "low_confidence", "uncertain", "not_assessed"], required: true },
  score: { type: Number, min: 1, max: 10, default: null }, confidence: { type: Number, min: 0, max: 1, default: 0 },
  regions: [{ type: String }], regionLabels: [{ type: String }], markers: { type: [markerSchema], default: [] },
  evidence: { type: String, maxlength: 200, default: "" },
}, { _id: false });

const skinAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  source: { type: String, enum: ["camera", "upload"], required: true },
  image: { url: { type: String, default: null }, publicId: { type: String, default: null } },
  result: {
    skinType: { type: String, enum: ["oily", "dry", "normal", "combination", "unknown"], required: true },
    skinTypeLabel: { type: String, required: true }, confidence: { type: Number, min: 0, max: 1, required: true },
    concerns: { type: [concernSchema], default: [] }, possibleConcerns: { type: [concernSchema], default: [] }, recommendedIngredients: [{ type: String, trim: true }],
    ingredientGuidance: { type: [{ name: String, reason: String }], default: [] },
    ingredientSuggestionSource: { type: String, default: "insufficient_evidence" },
    warnings: [{ type: String, trim: true }], analysisSource: { type: String, required: true },
    metrics: { type: [metricSchema], default: [] }, overallScore: { type: Number, min: 1, max: 10, default: null },
    summary: { type: String, maxlength: 400, default: "" },
    imageQuality: { type: mongoose.Schema.Types.Mixed, default: null },
    acneDetection: { type: mongoose.Schema.Types.Mixed, default: null },
    userContext: { age: { type: Number, default: null }, selfSkinType: { type: String, default: null } },
  },
  recommendedProducts: { type: [recommendationSchema], default: [] },
}, { timestamps: true });

skinAnalysisSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model("SkinAnalysis", skinAnalysisSchema);
