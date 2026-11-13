"use strict";

const HEADERS = ["sku", "slug", "ten_san_pham", "dung_tich", "gia_hien_tai_vnd", "so_luong_thuc_te", "xac_nhan_mo_ban"];

function csvField(value) {
  const str = String(value ?? "");
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
function csvStringify(rows) {
  return "\uFEFF" + [HEADERS, ...rows.map(row => HEADERS.map(key => row[key] ?? ""))]
    .map(row => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
function csvParse(content) {
  const source = String(content).replace(/^\uFEFF/, "");
  const records = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') {
      if (cell !== "") throw new Error("CSV_QUOTE_INVALID");
      quoted = true;
    } else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") {
      row.push(cell.replace(/\r$/, "")); cell = "";
      if (row.some(item => item !== "")) records.push(row);
      row = [];
    } else if (char === "\r" && source[i + 1] === "\n") {
      continue;
    } else cell += char;
  }
  if (quoted) throw new Error("CSV_UNCLOSED_QUOTE");
  if (cell || row.length) { row.push(cell); records.push(row); }
  if (records.length === 0 || records[0].join("|") !== HEADERS.join("|")) throw new Error("CSV_HEADERS_INVALID");
  return records.slice(1).map((cells, index) => {
    if (cells.length !== HEADERS.length) throw new Error(`CSV_COLUMN_COUNT_ROW_${index + 2}`);
    return Object.fromEntries(HEADERS.map((header, i) => [header, cells[i]]));
  });
}
function validateImport(rows, productMap, variantMap) {
  const seen = new Set(), planned = [], skipped = [], errors = [];
  for (const row of rows) {
    const sku = row.sku.trim();
    if (!sku || seen.has(sku)) { errors.push(`${sku || "(trống)"}: SKU trống hoặc lặp`); continue; }
    seen.add(sku);
    // Blank approval is intentional; it must never silently become a stock update.
    if (!row.xac_nhan_mo_ban.trim()) { skipped.push({ sku, reason: "CHUA_XAC_NHAN" }); continue; }
    if (row.xac_nhan_mo_ban.trim() !== "MO_BAN") { errors.push(`${sku}: xác nhận phải là MO_BAN`); continue; }
    const productAndVariant = variantMap.get(sku), variant = productAndVariant?.variant;
    const product = productAndVariant?.product;
    if (!variant || !product) { errors.push(`${sku}: không tìm thấy SKU trong database`); continue; }
    if (String(product.slug) !== row.slug || String(product.name) !== row.ten_san_pham ||
      String(`${variant.size || ""}${variant.unit || ""}`).replace(/\s+/g, "").toLowerCase() !== row.dung_tich.replace(/\s+/g, "").toLowerCase()) {
      errors.push(`${sku}: tên/slug/dung tích đã thay đổi so với CSV`); continue;
    }
    if (row.gia_hien_tai_vnd !== String(variant.price) || !(variant.price > 0) || Number(product.basePrice) !== Number(variant.price)) {
      errors.push(`${sku}: giá chưa xác minh hoặc giá đã đổi; xuất mẫu CSV mới`); continue;
    }
    const qtyText = row.so_luong_thuc_te.trim();
    if (!/^[1-9]\d*$/.test(qtyText) || !Number.isSafeInteger(Number(qtyText)) || Number(qtyText) > 1000000) {
      errors.push(`${sku}: phải nhập số lượng hàng thực tế là số nguyên từ 1 đến 1000000`); continue;
    }
    if (!Array.isArray(product.images) || !product.images.some(url => typeof url === "string" && /^https:\/\//.test(url))) {
      errors.push(`${sku}: sản phẩm chưa có đường dẫn ảnh HTTPS`); continue;
    }
    if (product.isActive !== false || variant.stock !== 0) {
      errors.push(`${sku}: sản phẩm đã mở bán hoặc tồn kho đã thay đổi; xử lý trong Admin thay vì ghi đè`); continue;
    }
    planned.push({ sku, name: product.name, price: variant.price, size: row.dung_tich,
      qty: Number(qtyText), productId: String(product._id), variantId: String(variant._id) });
  }
  // productMap is a separate integrity guard: don't accept foreign SKU rows.
  if (seen.size > productMap.size) errors.push("CSV chứa nhiều SKU hơn số sản phẩm trong database");
  return { planned, skipped, errors };
}
module.exports = { HEADERS, csvStringify, csvParse, validateImport };
