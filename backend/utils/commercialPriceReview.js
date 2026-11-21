"use strict";

// An operator-supplied attestation. A source string is NOT independent proof of a price.
const HEADERS = ["sku", "slug", "ten_san_pham", "dung_tich", "gia_dang_luu_vnd", "gia_da_xac_minh_vnd", "nguon_xac_minh", "nguoi_xac_minh", "xac_nhan"];
const PRICE_LIMIT = 100000000;

function escapeCell(value) {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function makeTemplate(variants, productById) {
  const rows = [...variants].sort((a, b) => a.sku.localeCompare(b.sku)).map(variant => {
    const product = productById.get(String(variant.product));
    if (!product) throw Error(`ORPHAN_VARIANT:${variant.sku}`);
    const name = String(product.name || "");
    // Never allow spreadsheet formulas from user-editable names/identifiers.
    if ([name, String(product.slug), String(variant.sku)].some(x => /^[\s\t]*[=+@-]/.test(x))) throw Error(`CSV_FORMULA_RISK:${variant.sku}`);
    return {
      sku: variant.sku, slug: product.slug, ten_san_pham: name,
      dung_tich: `${variant.size || ""}${variant.unit || ""}`,
      gia_dang_luu_vnd: String(variant.price), gia_da_xac_minh_vnd: "",
      nguon_xac_minh: "", nguoi_xac_minh: "", xac_nhan: "",
    };
  });
  return "\uFEFF" + [HEADERS, ...rows.map(row => HEADERS.map(key => row[key]))]
    .map(row => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}
function parseCsv(source) {
  const text = String(source).replace(/^\uFEFF/, "");
  const lines = []; let row = [], cell = "", inside = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inside) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inside = false; closed = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell !== "" || closed) throw Error("INVALID_QUOTING");
      inside = true;
    } else if (c === ',') { row.push(cell); cell = ""; closed = false; }
    else if (c === '\n') {
      row.push(cell); cell = ""; closed = false;
      if (row.some(x => x !== "")) lines.push(row);
      row = [];
    } else if (c === '\r' && text[i+1] === '\n') continue;
    else { if (closed) throw Error("INVALID_CSV_TRAILING_TEXT"); cell += c; }
  }
  if (inside) throw Error("UNTERMINATED_CSV_QUOTE");
  if (cell || row.length) { row.push(cell); lines.push(row); }
  if (!lines.length || lines[0].join('\0') !== HEADERS.join('\0')) throw Error("PRICE_CSV_HEADERS_INVALID");
  return lines.slice(1).map((cells, i) => {
    if (cells.length !== HEADERS.length) throw Error(`PRICE_CSV_COLUMN_COUNT_ROW_${i + 2}`);
    return Object.fromEntries(HEADERS.map((header, n) => [header, cells[n]]));
  });
}
function reviewRows(rows, products, variants) {
  const productMap = new Map(products.map(p => [String(p._id), p]));
  const variantMap = new Map(variants.map(v => [v.sku, v]));
  const grouped = new Map();
  for (const variant of variants) grouped.set(String(variant.product), (grouped.get(String(variant.product)) || 0) + 1);
  const seen = new Set(), approved = [], skipped = [], errors = [];
  if (rows.length !== variants.length) errors.push(`CSV phải chứa đủ ${variants.length} mã hàng; hiện có ${rows.length} dòng`);
  for (const row of rows) {
    const sku = row.sku.trim();
    if (seen.has(sku) || !sku) { errors.push(`${sku || '(trống)'}: Mã hàng trùng hoặc trống`); continue; }
    seen.add(sku);
    const variant = variantMap.get(sku), product = variant ? productMap.get(String(variant.product)) : null;
    if (!variant || !product) { errors.push(`${sku}: không còn mã hàng trong cơ sở dữ liệu`); continue; }
    if (product.slug !== row.slug || product.name !== row.ten_san_pham ||
        `${variant.size || ''}${variant.unit || ''}` !== row.dung_tich ||
        String(variant.price) !== row.gia_dang_luu_vnd.trim()) {
      errors.push(`${sku}: giá/tên/đường dẫn/dung tích đã đổi; cần xuất mẫu mới`); continue;
    }
    if (!row.xac_nhan.trim()) { skipped.push(sku); continue; }
    if (row.xac_nhan.trim() !== 'XAC_NHAN_GIA') { errors.push(`${sku}: cột xác nhận phải là XAC_NHAN_GIA`); continue; }
    const priceText = row.gia_da_xac_minh_vnd.trim();
    const price = Number(priceText);
    if (!/^[1-9]\d*$/.test(priceText) || !Number.isSafeInteger(price) || price > PRICE_LIMIT) {
      errors.push(`${sku}: giá xác minh phải là số nguyên VND từ 1 đến ${PRICE_LIMIT}`); continue;
    }
    const source = row.nguon_xac_minh.trim(), reviewer = row.nguoi_xac_minh.trim();
    if (source.length < 8 || source.length > 300 || reviewer.length < 2 || reviewer.length > 100) {
      errors.push(`${sku}: nguồn xác minh (8-300 ký tự) và người xác minh (2-100 ký tự) là bắt buộc`); continue;
    }
    if (grouped.get(String(product._id)) !== 1 || product.isActive !== false ||
        variant.stock !== 0 || (variant.salePrice != null) || (product.salePrice != null) ||
        !Number.isSafeInteger(variant.price) || variant.price < 0 || Number(product.basePrice) !== variant.price) {
      errors.push(`${sku}: trạng thái đang bán, tồn kho, khuyến mãi hoặc giá gốc không phù hợp để nhập hàng loạt; hãy sửa trong trang quản trị`); continue;
    }
    approved.push({ sku, productId: String(product._id), variantId: String(variant._id), oldPrice: variant.price, price,
      source, reviewer, changed: variant.price !== price });
  }
  for (const sku of variantMap.keys()) if (!seen.has(sku)) errors.push(`${sku}: thiếu dòng CSV`);
  return { approved, skipped, errors };
}
module.exports = { HEADERS, PRICE_LIMIT, makeTemplate, parseCsv, reviewRows };
