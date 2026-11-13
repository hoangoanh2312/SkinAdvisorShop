const { audit } = require('../services/adminSupport');

// Best-effort metadata trail for legacy administration endpoints. Never record
// passwords, tokens, addresses, payment payloads or raw request bodies.
const adminAuditTrail = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const path = req.path;
  const tracked = /^\/api\/(admin|variants|products|categories|vouchers)\b/.test(path);
  // New inventory/returns handlers write their own audit inside transactions.
  if (!tracked || /^\/api\/admin\/(inventory|returns|audit|reports|readiness)/.test(path)) return next();
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || req.user?.role !== 'admin') return;
    const parts = path.split('/').filter(Boolean);
    const resource = parts[1] === 'admin' ? (parts[2] || 'admin') : parts[1];
    const resourceId = parts.find((part, index) => index > 1 && /^[a-f\d]{24}$/i.test(part)) || '';
    audit({ actor: req.user._id, action: `${req.method.toLowerCase()}.${resource}`, resource, resourceId, method: req.method, details: path.slice(0, 250) }).catch(err => {
      console.error('SKINORA admin audit write failed:', err.message);
    });
  });
  next();
};
module.exports = { adminAuditTrail };
