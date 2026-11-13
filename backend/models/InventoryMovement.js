const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema({
  variant: { type: mongoose.Schema.Types.ObjectId, ref: 'Variant', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  kind: { type: String, enum: ['receipt', 'adjustment', 'return', 'sale', 'cancellation'], required: true },
  delta: { type: Number, required: true, validate: Number.isSafeInteger },
  before: { type: Number, required: true, min: 0 },
  after: { type: Number, required: true, min: 0 },
  note: { type: String, required: true, maxlength: 500 },
  reference: { type: String, maxlength: 100, default: '' },
}, { timestamps: true });
inventoryMovementSchema.index({ createdAt: -1 });
module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);
