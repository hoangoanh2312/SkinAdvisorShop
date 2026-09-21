const mongoose = require("mongoose");

const SKIN_TYPES = [
  "normal",
  "dry",
  "oily",
  "combination",
  "sensitive",
];

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

const skinProfileSchema = new mongoose.Schema(
  {
    skinType: {
      type: String,
      enum: SKIN_TYPES,
    },
    skinConcerns: [{ type: String, enum: SKIN_CONCERNS }],
    allergies: [{ type: String, trim: true }],
    avoidIngredients: [{ type: String, trim: true }],
    lastUpdated: Date,
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    province: { type: String, trim: true },
    district: { type: String, trim: true },
    ward: { type: String, trim: true },
    addressLine: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    phone: { type: String, trim: true, default: "" },
    avatar: { type: String, default: "" },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },
    isActive: { type: Boolean, default: true },
    skinProfile: { type: skinProfileSchema, default: () => ({}) },
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
