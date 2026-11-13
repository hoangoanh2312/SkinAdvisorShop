const mongoose = require('mongoose');
const AdminAuditLog = require('../models/AdminAuditLog');

const parsePaging = (query = {}) => ({
  page: Math.min(Math.max(Number.parseInt(query.page, 10) || 1, 1), 10000),
  limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100),
});
const paged = (paging, total) => ({ ...paging, total, totalPages: Math.ceil(total / paging.limit) });
const validObjectId = id => typeof id === 'string' && mongoose.isValidObjectId(id);
const audit = async ({ actor, action, resource, resourceId = '', method = '', details = '' }, session) => {
  await AdminAuditLog.create([{ actor, action, resource, resourceId: String(resourceId), method, details }], session ? { session } : {});
};
const safeCsvCell = value => {
  const text = String(value == null ? '' : value).replace(/\r?\n/g, ' ').trim();
  // Excel treats +,-,=,@ and whitespace before those prefixes as formulas.
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
const csv = (rows, columns) => '\uFEFF' + [columns.map(c => safeCsvCell(c.label)).join(','), ...rows.map(row => columns.map(c => safeCsvCell(c.get(row))).join(','))].join('\r\n');
const sendCsv = (res, filename, contents) => res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' }).status(200).send(contents);
const bad = (res, message, code = 400) => res.status(code).json({ success: false, message });
module.exports = { audit, parsePaging, paged, validObjectId, csv, sendCsv, bad };
