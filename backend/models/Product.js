const mongoose = require("mongoose");

const PRODUCT_SKIN_TYPES = ["normal", "dry", "oily", "combination", "sensitive"];

const SKIN_CONCERNS = [
  "acne",
  "dryness",
  "sensitivity",
  "aging",
  "pigmentation",
  "pores",
  "dullness",
  "oiliness",
];

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, lowercase: true, trim: true },
    benefits: [{ type: String, trim: true }],
    concerns: [{ type: String, enum: SKIN_CONCERNS }],
    description: { type: String, default: "" },
    isPotentialIrritant: { type: Boolean, default: false },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    brand: { type: String, required: true, trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    shortDescription: { type: String, default: "" },
    description: { type: String, default: "" },
    images: [{ type: String }],
    skinTypes: [{ type: String, enum: PRODUCT_SKIN_TYPES }],
    skinConcerns: [{ type: String, enum: SKIN_CONCERNS }],
    ingredients: { type: [ingredientSchema], default: [] },
    keyIngredients: [{ type: String, trim: true }],
    avoidFor: [{ type: String, trim: true }],
    usage: { type: String, default: "" },
    warnings: [{ type: String, trim: true }],
    basePrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ skinTypes: 1 });
productSchema.index({ skinConcerns: 1 });
productSchema.index({ "ingredients.normalizedName": 1 });

module.exports = mongoose.model("Product", productSchema);
