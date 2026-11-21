// Nhập kho bằng file Excel/CSV: mỗi dòng là một mã hàng.
// - Mã hàng đã có: cộng số lượng nhập vào tồn kho, có thể đổi giá bán / giá giảm
// - Mã hàng mới: tạo dung tích mới cho sản phẩm đã có (cần cột Sản phẩm, Dung tích, Giá bán)
// Luôn xem trước rồi mới ghi; có dòng lỗi thì không ghi dòng nào.
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const InventoryMovement = require("../models/InventoryMovement");

const MAX_ROWS = 500;
const MAX_QTY = 100000;
const MAX_PRICE = 100000000;

const fold = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const HEADERS = {
  sku: ["ma hang", "sku", "ma sku", "ma"],
  qty: ["so luong nhap", "so luong", "sl", "sl nhap", "nhap"],
  price: ["gia ban", "gia", "gia niem yet", "gia goc"],
  salePrice: ["gia giam", "gia khuyen mai", "gia km", "gia sale"],
  product: ["san pham", "duong dan san pham", "ten san pham", "slug"],
  size: ["dung tich", "quy cach", "khoi luong", "phien ban"],
  note: ["ghi chu", "note"],
};

// Số trong Excel có thể là "177000", "177.000", "177,000", "177 000đ"
const toInt = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text) && text.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(text)) return Number.NaN; // số lẻ
  const digits = text.replace(/[\s.,đ₫dD]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
};
const parseSize = (value) => {
  const m = /^(\d+(?:[.,]\d+)?)\s*(ml|g|l|kg|mieng|vien|goi)?$/i.exec(fold(value).replace(/\s+/g, ""));
  if (!m) return null;
  const unit = (m[2] || "ml").toLowerCase();
  const size = m[1].replace(",", ".");
  return { size, unit, name: `${size}${unit}` };
};

function mapHeader(row) {
  const map = {};
  row.forEach((cell, index) => {
    const key = fold(cell);
    for (const [field, names] of Object.entries(HEADERS)) if (names.includes(key) && map[field] === undefined) map[field] = index;
  });
  return map;
}

// Đọc các dòng thành dữ liệu thô + lỗi định dạng (chưa cần cơ sở dữ liệu)
function parseRows(rows) {
  const headerIndex = rows.findIndex((row) => { const m = mapHeader(row); return m.sku !== undefined; });
  if (headerIndex < 0) return { error: "Không tìm thấy dòng tiêu đề có cột Mã hàng, hãy dùng file mẫu" };
  const columns = mapHeader(rows[headerIndex]);
  if (columns.qty === undefined && columns.price === undefined && columns.salePrice === undefined) return { error: "File cần ít nhất một cột Số lượng nhập, Giá bán hoặc Giá giảm" };
  const body = rows.slice(headerIndex + 1).map((row, i) => ({ row, line: headerIndex + i + 2 })).filter(({ row }) => row.some((cell) => String(cell ?? "").trim()));
  if (!body.length) return { error: "File chưa có dòng dữ liệu nào" };
  if (body.length > MAX_ROWS) return { error: `Mỗi lần chỉ nhập tối đa ${MAX_ROWS} dòng` };
  const seen = new Map();
  const items = body.map(({ row, line }) => {
    const get = (field) => (columns[field] === undefined ? "" : String(row[columns[field]] ?? "").trim());
    const item = { line, sku: get("sku").toUpperCase(), qty: toInt(get("qty")) ?? 0, price: toInt(get("price")), salePrice: toInt(get("salePrice")), product: get("product"), sizeText: get("size"), note: get("note").slice(0, 200), errors: [] };
    if (!/^[A-Z0-9][A-Z0-9-]{2,63}$/.test(item.sku)) item.errors.push("Mã hàng chỉ gồm chữ không dấu, số và dấu gạch ngang");
    if (!Number.isSafeInteger(item.qty) || item.qty < 0 || item.qty > MAX_QTY) item.errors.push(`Số lượng nhập phải là số nguyên từ 0 đến ${MAX_QTY}`);
    if (item.price !== null && (!Number.isSafeInteger(item.price) || item.price <= 0 || item.price > MAX_PRICE)) item.errors.push("Giá bán không hợp lệ");
    if (item.salePrice !== null && (!Number.isSafeInteger(item.salePrice) || item.salePrice < 0 || item.salePrice > MAX_PRICE)) item.errors.push("Giá giảm không hợp lệ (để 0 nếu muốn bỏ giảm giá)");
    if (seen.has(item.sku)) item.errors.push(`Mã hàng bị trùng với dòng ${seen.get(item.sku)}`);
    else seen.set(item.sku, line);
    return item;
  });
  return { items };
}

// Đối chiếu với cơ sở dữ liệu, quyết định từng dòng sẽ làm gì
async function planImport(rows, { session } = {}) {
  const parsed = parseRows(rows);
  if (parsed.error) return parsed;
  const { items } = parsed;
  const variants = await Variant.find({ sku: { $in: items.map((i) => i.sku) } }).select("sku name product price salePrice stock").session(session || null).lean();
  const bySku = new Map(variants.map((v) => [v.sku, v]));
  const productKeys = [...new Set(items.filter((i) => !bySku.has(i.sku) && i.product).map((i) => i.product))];
  const products = productKeys.length ? await Product.find({ $or: [{ slug: { $in: productKeys.map((k) => k.toLowerCase()) } }, { name: { $in: productKeys } }] }).select("name slug").session(session || null).lean() : [];
  const productOf = (key) => products.find((p) => p.slug === key.toLowerCase()) || products.find((p) => p.name.toLowerCase() === key.toLowerCase());
  const newProductIds = [...new Set(items.filter((i) => !bySku.has(i.sku)).map((i) => productOf(i.product || "")?._id).filter(Boolean).map(String))];
  const siblings = newProductIds.length ? await Variant.find({ product: { $in: newProductIds } }).select("product name").session(session || null).lean() : [];
  const takenSizes = new Set(siblings.map((v) => `${v.product}|${fold(v.name).replace(/\s+/g, "")}`));

  for (const item of items) {
    const existing = bySku.get(item.sku);
    if (existing) {
      item.action = "update";
      item.variantId = String(existing._id);
      item.productId = String(existing.product);
      item.name = existing.name;
      item.before = { stock: existing.stock, price: existing.price, salePrice: existing.salePrice ?? null };
      const price = item.price ?? existing.price;
      const sale = item.salePrice === null ? existing.salePrice : (item.salePrice === 0 ? null : item.salePrice);
      if (sale != null && sale >= price) item.errors.push(`Giá giảm (${sale.toLocaleString("vi-VN")}đ) phải nhỏ hơn giá bán (${price.toLocaleString("vi-VN")}đ)`);
      item.after = { stock: existing.stock + item.qty, price, salePrice: sale ?? null };
      const changes = [];
      if (item.qty > 0) changes.push(`Nhập thêm ${item.qty}`);
      if (price !== existing.price) changes.push(`Giá ${existing.price.toLocaleString("vi-VN")}đ → ${price.toLocaleString("vi-VN")}đ`);
      if ((sale ?? null) !== (existing.salePrice ?? null)) changes.push(sale == null ? "Bỏ giảm giá" : `Giá giảm ${sale.toLocaleString("vi-VN")}đ`);
      item.summary = changes.join(", ");
      if (!changes.length && !item.errors.length) { item.action = "skip"; item.summary = "Không có thay đổi"; }
    } else {
      item.action = "create";
      const product = item.product ? productOf(item.product) : null;
      const size = parseSize(item.sizeText);
      if (!item.product) item.errors.push("Mã hàng mới: cần cột Sản phẩm (đường dẫn hoặc tên sản phẩm)");
      else if (!product) item.errors.push(`Không tìm thấy sản phẩm "${item.product}"`);
      if (!size) item.errors.push("Mã hàng mới: cần cột Dung tích, ví dụ 140ml hoặc 454g");
      if (item.price === null) item.errors.push("Mã hàng mới: cần Giá bán");
      const sale = item.salePrice ? item.salePrice : null;
      if (sale != null && item.price != null && sale >= item.price) item.errors.push("Giá giảm phải nhỏ hơn giá bán");
      if (product && size && takenSizes.has(`${product._id}|${size.name}`)) item.errors.push(`Sản phẩm đã có dung tích ${size.name}, hãy dùng mã hàng của dung tích đó`);
      if (product && size) takenSizes.add(`${product._id}|${size.name}`);
      item.productId = product ? String(product._id) : null;
      item.productName = product?.name || item.product;
      item.name = size?.name || item.sizeText;
      item.size = size;
      item.after = { stock: item.qty, price: item.price, salePrice: sale };
      item.summary = `Tạo dung tích mới ${item.name}${item.qty ? `, nhập ${item.qty}` : ""}`;
    }
  }
  const errorCount = items.filter((i) => i.errors.length).length;
  return {
    items,
    totals: {
      rows: items.length,
      errors: errorCount,
      updates: items.filter((i) => i.action === "update" && !i.errors.length).length,
      creates: items.filter((i) => i.action === "create" && !i.errors.length).length,
      skips: items.filter((i) => i.action === "skip").length,
      quantity: items.filter((i) => !i.errors.length).reduce((sum, i) => sum + i.qty, 0),
    },
  };
}

async function applyImport(rows, { actor, fileName }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const plan = await planImport(rows, { session });
      if (plan.error) { result = plan; return; }
      if (plan.totals.errors) { result = plan; return; }
      const note = (item) => `Nhập từ file ${fileName}${item.note ? `: ${item.note}` : ""}`.slice(0, 500);
      for (const item of plan.items) {
        if (item.action === "skip") continue;
        if (item.action === "update") {
          const update = { $set: { price: item.after.price, salePrice: item.after.salePrice } };
          if (item.qty) update.$inc = { stock: item.qty };
          // Điều kiện tồn kho như lúc xem trước: nếu vừa có người mua, giao dịch dừng để quản trị viên xem lại
          const updated = await Variant.findOneAndUpdate({ _id: item.variantId, stock: item.before.stock }, update, { returnDocument: "after", session, runValidators: true });
          if (!updated) throw Object.assign(new Error("STOCK_CHANGED"), { sku: item.sku });
          if (item.qty) await InventoryMovement.create([{ variant: updated._id, product: updated.product, actor, kind: "receipt", delta: item.qty, before: item.before.stock, after: updated.stock, note: note(item), reference: item.sku }], { session });
        } else {
          const [created] = await Variant.create([{ product: item.productId, name: item.name, sku: item.sku, size: item.size.size, unit: item.size.unit, price: item.after.price, salePrice: item.after.salePrice, stock: item.qty, isActive: true }], { session });
          if (item.qty) await InventoryMovement.create([{ variant: created._id, product: created.product, actor, kind: "receipt", delta: item.qty, before: 0, after: item.qty, note: note(item), reference: item.sku }], { session });
        }
      }
      result = { ...plan, applied: true };
    });
  } finally { await session.endSession(); }
  return result;
}

module.exports = { parseRows, planImport, applyImport, parseSize, toInt, fold, MAX_ROWS };
