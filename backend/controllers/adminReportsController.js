const Order = require('../models/Order');
const Variant = require('../models/Variant');
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const { csv, sendCsv, bad } = require('../services/adminSupport');
const { sendControllerError } = require('../utils/controllerHelpers');

// End date is inclusive in the form, exclusive in MongoDB range.
const parseRange = query => {
  const today = new Date();
  const fallbackTo = today.toISOString().slice(0, 10);
  const fallbackFrom = new Date(today.getTime() - 89 * 86400000).toISOString().slice(0, 10);
  const from = query.from || fallbackFrom; const to = query.to || fallbackTo;
  const isDate = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(new Date(`${x}T00:00:00.000Z`).valueOf()) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x;
  if (!isDate(from) || !isDate(to)) return null;
  const start = new Date(`${from}T00:00:00.000Z`); const end = new Date(`${to}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 1);
  if (start >= end || end - start > 366 * 86400000) return null;
  return { start, end, from, to, createdAt: { $gte: start, $lt: end } };
};
const eligibleRevenue = { orderStatus: 'completed', paymentStatus: { $nin: ['refunded', 'failed'] }, $or: [{ paymentStatus: 'paid' }, { paymentMethod: 'COD' }] };

const reportSummary = async (req, res) => {
  const range = parseRange(req.query);
  if (!range) return bad(res, 'Khoảng ngày không hợp lệ (tối đa 366 ngày)');
  try {
    const [totals, byStatus, byPayment, byDay, topItems, inventoryCounts, lowStock] = await Promise.all([
      Order.aggregate([{ $match: { createdAt: range.createdAt } }, { $group: { _id: null, orders: { $sum: 1 }, gross: { $sum: '$total' } } }]),
      Order.aggregate([{ $match: { createdAt: range.createdAt } }, { $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { createdAt: range.createdAt } }, { $group: { _id: '$paymentStatus', count: { $sum: 1 }, total: { $sum: '$total' } } }]),
      Order.aggregate([{ $match: { ...eligibleRevenue, createdAt: range.createdAt } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Order.aggregate([{ $match: { ...eligibleRevenue, createdAt: range.createdAt } }, { $unwind: '$items' }, { $group: { _id: '$items.sku', name: { $first: '$items.productName' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } }, { $sort: { quantity: -1 } }, { $limit: 10 }]),
      Variant.aggregate([{ $group: { _id: null, skus: { $sum: 1 }, units: { $sum: '$stock' }, outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } } } }]),
      Variant.find({ isActive: true, stock: { $lte: 5 } }).populate('product', 'name').sort({ stock: 1 }).limit(15).lean(),
    ]);
    return res.json({ success: true, data: { range: { from: range.from, to: range.to }, orders: totals[0] || { orders: 0, gross: 0 }, orderStatuses: byStatus, paymentStatuses: byPayment, dailyRevenue: byDay, revenue: byDay.reduce((s, r) => s + r.revenue, 0), topItems, inventory: inventoryCounts[0] || { skus: 0, units: 0, outOfStock: 0 }, lowStock } });
  } catch (error) { return sendControllerError(res, error, 'Không thể thống kê'); }
};

const exportReport = async (req, res) => {
  const range = parseRange(req.query);
  if (!range) return bad(res, 'Khoảng ngày không hợp lệ (tối đa 366 ngày)');
  const type = req.query.type;
  if (!['orders', 'inventory', 'movements'].includes(type)) return bad(res, 'Loại xuất dữ liệu không hợp lệ');
  try {
    let records, columns;
    if (type === 'orders') {
      records = await Order.find({ createdAt: range.createdAt }).sort({ createdAt: -1 }).limit(10001).populate('user', 'email fullName').lean();
      columns = [{ label: 'Ma don', get: o => o.orderCode || o._id }, { label: 'Ngay', get: o => o.createdAt?.toISOString() }, { label: 'Khach hang', get: o => o.user?.fullName }, { label: 'Email', get: o => o.user?.email }, { label: 'Trang thai', get: o => o.orderStatus }, { label: 'Thanh toan', get: o => o.paymentStatus }, { label: 'Phuong thuc', get: o => o.paymentMethod }, { label: 'Tong VND', get: o => o.total }];
    } else if (type === 'inventory') {
      records = await Variant.find().sort({ sku: 1 }).limit(10001).populate('product', 'name').lean();
      columns = [{ label: 'San pham', get: v => v.product?.name }, { label: 'Ma hang', get: v => v.sku }, { label: 'Phien ban', get: v => v.name }, { label: 'Gia VND', get: v => v.price }, { label: 'Gia giam VND', get: v => v.salePrice }, { label: 'Ton kho', get: v => v.stock }, { label: 'Dang hoat dong', get: v => v.isActive ? 'Co' : 'Khong' }];
    } else {
      records = await InventoryMovement.find({ createdAt: range.createdAt }).sort({ createdAt: -1 }).limit(10001).populate('variant', 'sku').populate('actor', 'fullName').lean();
      columns = [{ label: 'Ngay', get: r => r.createdAt?.toISOString() }, { label: 'Ma hang', get: r => r.variant?.sku }, { label: 'Loai', get: r => r.kind }, { label: 'Thay doi', get: r => r.delta }, { label: 'Truoc', get: r => r.before }, { label: 'Sau', get: r => r.after }, { label: 'Ly do', get: r => r.note }, { label: 'Nguoi sua', get: r => r.actor?.fullName }];
    }
    if (records.length > 10000) return bad(res, 'Bộ dữ liệu quá lớn, vui lòng chia nhỏ khoảng ngày (tối đa 10.000 dòng)', 413);
    return sendCsv(res, `sandwich-${type}-${range.from}-${range.to}.csv`, csv(records, columns));
  } catch (error) { return sendControllerError(res, error, 'Không thể xuất dữ liệu'); }
};

const catalogReadiness = async (_req, res) => {
  try {
    const [products, variants] = await Promise.all([Product.find().select('name slug images isActive isCatalogVisible ingredients skinTypes basePrice').lean(), Variant.find().select('product isActive price stock').lean()]);
    const grouped = new Map();
    for (const v of variants) grouped.set(String(v.product), [...(grouped.get(String(v.product)) || []), v]);
    const issues = products.map(p => {
      const ps = grouped.get(String(p._id)) || [];
      const missing = [];
      if (!p.images?.length) missing.push('Thiếu ảnh');
      if (!p.ingredients?.length) missing.push('Thiếu thành phần cho AI');
      if (!p.skinTypes?.length) missing.push('Thiếu loại da phù hợp');
      if (!ps.length) missing.push('Chưa có mã hàng');
      if (!ps.some(v => v.isActive && v.price > 0)) missing.push('Chưa có mã hàng hoạt động với giá hợp lệ');
      if (ps.some(v => !Number.isFinite(v.price) || v.price <= 0)) missing.push('Có phiên bản thiếu giá hợp lệ');
      if (!ps.some(v => v.isActive && v.price > 0 && v.stock > 0)) missing.push('Chưa có mã hàng đủ hàng để bán');
      if (!p.isCatalogVisible && !p.isActive) missing.push('Chưa công khai danh mục');
      return { id: p._id, name: p.name, isActive: p.isActive, issues: missing };
    }).filter(p => p.issues.length);
    return res.json({ success: true, data: { totalProducts: products.length, productsNeedingReview: issues.length, issues: issues.slice(0, 500) } });
  } catch (error) { return sendControllerError(res, error, 'Không thể kiểm tra chất lượng dữ liệu'); }
};
module.exports = { reportSummary, exportReport, catalogReadiness, parseRange };
