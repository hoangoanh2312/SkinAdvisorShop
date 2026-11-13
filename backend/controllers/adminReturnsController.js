const mongoose = require('mongoose');
const Order = require('../models/Order');
const Variant = require('../models/Variant');
const ReturnCase = require('../models/ReturnCase');
const InventoryMovement = require('../models/InventoryMovement');
const { audit, parsePaging, paged, validObjectId, bad } = require('../services/adminSupport');
const { sendControllerError } = require('../utils/controllerHelpers');

const listReturns = async (req, res) => {
  try {
    const paging = parsePaging(req.query);
    const filter = {};
    if (req.query.status) {
      if (!['requested', 'approved', 'rejected', 'received', 'refund_confirmed'].includes(req.query.status)) return bad(res, 'Trạng thái không hợp lệ');
      filter.status = req.query.status;
    }
    const [items, total] = await Promise.all([
      ReturnCase.find(filter).sort({ createdAt: -1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).populate('order', 'orderCode total paymentMethod paymentStatus orderStatus items').populate('createdBy', 'fullName').lean(),
      ReturnCase.countDocuments(filter),
    ]);
    return res.json({ success: true, data: { items, pagination: paged(paging, total) } });
  } catch (error) { return sendControllerError(res, error, 'Không thể tải yêu cầu trả hàng'); }
};

const createReturn = async (req, res) => {
  const { orderId, reason } = req.body || {};
  if (!validObjectId(orderId) || typeof reason !== 'string' || reason.trim().length < 8 || reason.trim().length > 500) return bad(res, 'Mã đơn hoặc lý do trả hàng không hợp lệ (tối thiểu 8 ký tự)');
  try {
    const order = await Order.findById(orderId).select('orderStatus');
    if (!order) return bad(res, 'Không tìm thấy đơn hàng', 404);
    if (order.orderStatus !== 'completed') return bad(res, 'Chỉ tiếp nhận trả hàng cho đơn đã hoàn thành', 409);
    const session = await mongoose.startSession();
    let record;
    try {
      await session.withTransaction(async () => {
        [record] = await ReturnCase.create([{ order: orderId, reason: reason.trim(), createdBy: req.user._id, updatedBy: req.user._id }], { session });
        await audit({ actor: req.user._id, action: 'returns.create', resource: 'return', resourceId: record._id, method: 'POST', details: 'Tạo hồ sơ trả toàn bộ đơn hàng' }, session);
      });
    } finally { await session.endSession(); }
    return res.status(201).json({ success: true, data: { item: record } });
  } catch (error) {
    if (error.code === 11000) return bad(res, 'Đơn hàng đã có hồ sơ trả hàng', 409);
    return sendControllerError(res, error, 'Không thể tạo hồ sơ trả hàng');
  }
};

const updateReturn = async (req, res) => {
  if (!validObjectId(req.params.id)) return bad(res, 'Mã hồ sơ không hợp lệ');
  const { action, restock, refundReference, confirmFundsSent, refundNote } = req.body || {};
  if (!['approve', 'reject', 'receive', 'confirm_refund'].includes(action)) return bad(res, 'Thao tác không hợp lệ');
  if (action === 'receive' && typeof restock !== 'boolean') return bad(res, 'Phải xác nhận hàng có nhập lại kho hay không');
  if (action === 'confirm_refund' && (confirmFundsSent !== true || typeof refundReference !== 'string' || refundReference.trim().length < 4 || refundReference.trim().length > 120)) return bad(res, 'Chỉ xác nhận khi đã hoàn tiền thực tế và có mã chứng từ (ít nhất 4 ký tự)');
  if (refundNote != null && (typeof refundNote !== 'string' || refundNote.length > 500)) return bad(res, 'Ghi chú hoàn tiền quá dài');
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const record = await ReturnCase.findById(req.params.id).session(session);
      if (!record) throw new Error('RETURN_NOT_FOUND');
      const next = { requested: { approve: 'approved', reject: 'rejected' }, approved: { receive: 'received' }, received: { confirm_refund: 'refund_confirmed' } }[record.status]?.[action];
      if (!next) throw new Error('INVALID_RETURN_TRANSITION');
      const order = await Order.findById(record.order).session(session);
      if (!order || order.orderStatus !== 'completed') throw new Error('ORDER_NOT_COMPLETED');
      if (action === 'receive') {
        record.restockDecision = restock ? 'restocked' : 'damaged';
        if (restock) {
          for (const item of order.items) {
            const before = await Variant.findById(item.variant).session(session);
            if (!before || !Number.isSafeInteger(before.stock + item.quantity)) throw new Error('VARIANT_UNAVAILABLE');
            const updated = await Variant.findOneAndUpdate({ _id: item.variant, stock: before.stock }, { $inc: { stock: item.quantity } }, { session, new: true, runValidators: true });
            if (!updated) throw new Error('STOCK_CHANGED');
            await InventoryMovement.create([{ variant: item.variant, product: item.product, actor: req.user._id, kind: 'return', delta: item.quantity, before: before.stock, after: updated.stock, note: `Nhập lại hàng hoàn trả đơn ${order.orderCode || order._id}`, reference: String(record._id) }], { session });
          }
          record.restocked = true;
        }
      }
      if (action === 'confirm_refund') {
        // This is a manual bookkeeping confirmation, NOT an API bank/VNPay refund.
        record.refundReference = refundReference.trim();
        record.refundNote = (refundNote || '').trim();
        // COD may still be recorded as unpaid even after completion, but
        // a documented full refund must always be excluded from revenue.
        order.paymentStatus = 'refunded';
        await order.save({ session });
      }
      record.status = next;
      record.updatedBy = req.user._id;
      await record.save({ session });
      await audit({ actor: req.user._id, action: `returns.${action}`, resource: 'return', resourceId: record._id, method: 'PATCH', details: action === 'receive' ? (restock ? 'Nhập lại kho toàn bộ' : 'Không nhập kho: hàng không bán lại') : action === 'confirm_refund' ? `Đã xác nhận hoàn tiền ngoài hệ thống: ${record.refundReference}` : '' }, session);
      result = record;
    });
    return res.json({ success: true, message: 'Cập nhật hồ sơ trả hàng thành công', data: { item: result } });
  } catch (error) {
    const messages = { RETURN_NOT_FOUND: ['Không tìm thấy hồ sơ trả hàng', 404], INVALID_RETURN_TRANSITION: ['Không thể chuyển trạng thái này hoặc thao tác đã hoàn tất', 409], ORDER_NOT_COMPLETED: ['Đơn hàng không còn ở trạng thái hoàn thành', 409], VARIANT_UNAVAILABLE: ['SKU không còn tồn tại hoặc tồn kho vượt giới hạn', 409], STOCK_CHANGED: ['Tồn kho đã thay đổi, vui lòng thử lại', 409] };
    if (messages[error.message]) return bad(res, ...messages[error.message]);
    return sendControllerError(res, error, 'Không thể cập nhật trả hàng');
  } finally { await session.endSession(); }
};
module.exports = { listReturns, createReturn, updateReturn };
