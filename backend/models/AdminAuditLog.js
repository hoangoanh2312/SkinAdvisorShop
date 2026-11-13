const mongoose = require('mongoose');
const adminAuditSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true, maxlength: 120 },
  resource: { type: String, required: true, maxlength: 100 },
  resourceId: { type: String, maxlength: 120, default: '' },
  method: { type: String, maxlength: 8, default: '' },
  details: { type: String, maxlength: 300, default: '' },
}, { timestamps: true });
adminAuditSchema.index({ createdAt: -1 });
module.exports = mongoose.model('AdminAuditLog', adminAuditSchema);
