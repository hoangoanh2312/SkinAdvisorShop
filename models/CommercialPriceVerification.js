const mongoose = require('mongoose');
// Records a human attestation. Does not independently verify suppliers or retail prices.
const schema = new mongoose.Schema({
  sku: { type: String, required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variant: { type: mongoose.Schema.Types.ObjectId, ref: 'Variant', required: true },
  oldPrice: { type: Number, required: true, min: 0 },
  confirmedPrice: { type: Number, required: true, min: 1 },
  source: { type: String, required: true, maxlength: 300 },
  reviewer: { type: String, required: true, maxlength: 100 },
  importKey: { type: String, required: true, unique: true },
}, { timestamps: true });
module.exports = mongoose.model('CommercialPriceVerification', schema);
