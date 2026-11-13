const mongoose = require('mongoose');
const returnCaseSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  reason: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'received', 'refund_confirmed'], default: 'requested' },
  restocked: { type: Boolean, default: false },
  restockDecision: { type: String, enum: ['pending', 'restocked', 'damaged'], default: 'pending' },
  refundReference: { type: String, maxlength: 120, default: '' },
  refundNote: { type: String, maxlength: 500, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
returnCaseSchema.index({ createdAt: -1 });
module.exports = mongoose.model('ReturnCase', returnCaseSchema);
