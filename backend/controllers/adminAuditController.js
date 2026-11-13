const AdminAuditLog = require('../models/AdminAuditLog');
const { parsePaging, paged, bad } = require('../services/adminSupport');
const { sendControllerError } = require('../utils/controllerHelpers');

const listAudit = async (req, res) => {
  try {
    const paging = parsePaging(req.query);
    const filter = {};
    if (req.query.resource) {
      if (typeof req.query.resource !== 'string' || req.query.resource.length > 100) return bad(res, 'Bộ lọc không hợp lệ');
      filter.resource = req.query.resource;
    }
    const [items, total] = await Promise.all([
      AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).populate('actor', 'fullName email').lean(),
      AdminAuditLog.countDocuments(filter),
    ]);
    return res.json({ success: true, data: { items, pagination: paged(paging, total) } });
  } catch (error) { return sendControllerError(res, error, 'Không thể đọc nhật ký'); }
};
module.exports = { listAudit };
