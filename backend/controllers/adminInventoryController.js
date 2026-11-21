const mongoose = require('mongoose');
const Variant = require('../models/Variant');
const InventoryMovement = require('../models/InventoryMovement');
const { escapeRegex, sendControllerError } = require('../utils/controllerHelpers');
const { audit, parsePaging, paged, validObjectId, bad } = require('../services/adminSupport');

const listInventory = async (req, res) => {
  try {
    const paging = parsePaging(req.query);
    const term = String(req.query.search || '').trim().slice(0, 100);
    const filter = {};
    if (term) {
      const regex = new RegExp(escapeRegex(term), 'i');
      const Product = require('../models/Product');
      const products = await Product.find({ name: regex }).select('_id').limit(250).lean();
      filter.$or = [{ sku: regex }, { name: regex }, { product: { $in: products.map(p => p._id) } }];
    }
    if (req.query.low === 'true') filter.stock = { $lte: 5 };
    const [items, total] = await Promise.all([
      Variant.find(filter).populate('product', 'name slug isActive images').sort({ stock: 1, sku: 1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).lean(),
      Variant.countDocuments(filter),
    ]);
    return res.json({ success: true, data: { items, pagination: paged(paging, total) } });
  } catch (error) { return sendControllerError(res, error, 'Không thể tải tồn kho'); }
};

const listMovements = async (req, res) => {
  try {
    const paging = parsePaging(req.query);
    const filter = {};
    if (req.query.variant) {
      if (!validObjectId(req.query.variant)) return bad(res, 'Mã hàng không hợp lệ');
      filter.variant = req.query.variant;
    }
    const [items, total] = await Promise.all([
      InventoryMovement.find(filter).sort({ createdAt: -1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).populate('variant', 'sku name').populate('product', 'name').populate('actor', 'fullName').lean(),
      InventoryMovement.countDocuments(filter),
    ]);
    return res.json({ success: true, data: { items, pagination: paged(paging, total) } });
  } catch (error) { return sendControllerError(res, error, 'Không thể tải lịch sử kho'); }
};

const adjustInventory = async (req, res) => {
  const { variantId, delta, kind, note, reference } = req.body || {};
  if (!validObjectId(variantId) || !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 100000) return bad(res, 'Mã hàng hoặc số lượng nhập/xuất không hợp lệ');
  if (!['receipt', 'adjustment'].includes(kind) || (kind === 'receipt' && delta < 0)) return bad(res, 'Loại giao dịch kho không hợp lệ');
  if (typeof note !== 'string' || note.trim().length < 6 || note.trim().length > 500) return bad(res, 'Vui lòng nhập lý do từ 6 đến 500 ký tự');
  if (reference != null && (typeof reference !== 'string' || reference.length > 100)) return bad(res, 'Mã tham chiếu không hợp lệ');
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // Conditional atomic increment prevents stock from becoming negative during checkout.
      const before = await Variant.findById(variantId).session(session);
      if (!before) throw new Error('SKU_NOT_FOUND');
      const stockAfter = before.stock + delta;
      if (!Number.isSafeInteger(stockAfter) || stockAfter < 0) throw new Error('INSUFFICIENT_STOCK');
      const updated = await Variant.findOneAndUpdate({ _id: variantId, stock: before.stock }, { $inc: { stock: delta } }, { returnDocument: "after", session, runValidators: true });
      if (!updated) throw new Error('STOCK_CHANGED');
      const [movement] = await InventoryMovement.create([{ variant: variantId, product: before.product, actor: req.user._id, kind, delta, before: before.stock, after: updated.stock, note: note.trim(), reference: (reference || '').trim() }], { session });
      await audit({ actor: req.user._id, action: 'inventory.adjust', resource: 'inventory', resourceId: variantId, method: 'POST', details: `${kind}: ${delta > 0 ? '+' : ''}${delta} | ${note.trim().slice(0, 150)}` }, session);
      result = { variant: updated, movement };
    });
    return res.json({ success: true, message: 'Đã cập nhật kho và ghi nhận lịch sử', data: result });
  } catch (error) {
    if (error.message === 'SKU_NOT_FOUND') return bad(res, 'Không tìm thấy mã hàng', 404);
    if (error.message === 'INSUFFICIENT_STOCK') return bad(res, 'Không đủ hàng hoặc số tồn kho không hợp lệ', 409);
    if (error.message === 'STOCK_CHANGED') return bad(res, 'Tồn kho vừa thay đổi, vui lòng tải lại', 409);
    return sendControllerError(res, error, 'Không thể cập nhật kho. Yêu cầu kết nối MongoDB replica set hỗ trợ transaction.');
  } finally { await session.endSession(); }
};
module.exports = { listInventory, listMovements, adjustInventory };
