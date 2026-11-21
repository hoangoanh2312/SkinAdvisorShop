/* Offline: thêm dung tích mới — dữ liệu hợp lệ, có nguồn giá, không trùng, không đụng mã hàng cũ */
const assert = require('node:assert/strict');
const { validateRows, planRows, loadRows } = require('./syncCatalogExtraSizes');

const rows = loadRows();
const summary = validateRows(rows);
assert.ok(summary.newSkus >= 10, 'có ít nhất 10 dung tích mới');
for (const r of rows) {
  assert.match(r.sourceUrl, /^https:\/\/(www\.watsons\.vn|nhathuoclongchau\.com\.vn)\//, `nguồn giá Việt Nam: ${r.sku}`);
  if (r.salePriceVND !== null) assert.ok(r.salePriceVND < r.priceVND);
}
// Dầu tẩy trang hoa hồng: 140ml rẻ hơn 310ml đang bán 339.000đ
const rose = rows.find((r) => r.sku === 'COCOON-DAU-TAY-TRANG-HOA-HONG-140ML');
assert.ok(rose && rose.priceVND < 339000);

// Dữ liệu sai bị chặn
const bad = (patch, code) => assert.throws(() => validateRows([{ ...rows[0], ...patch }]), new RegExp(code));
bad({ sku: 'cocoon-thuong' }, 'INVALID_OR_DUPLICATE_SKU');
bad({ salePriceVND: rows[0].priceVND + 1 }, 'INVALID_SALE_PRICE');
bad({ sourceUrl: 'http://x' }, 'MISSING_SOURCE');
bad({ name: rows[0].existingSize, size: rows[0].existingSize.replace(/\D/g, ''), sku: rows[0].sku.replace(/-\d+(ML|G)$/, `-${rows[0].existingSize.toUpperCase()}`) }, 'SAME_AS_EXISTING_SIZE');
assert.throws(() => validateRows([rows[0], rows[0]]), /DUPLICATE/);

// Kế hoạch: bỏ qua mã đã có, dung tích đã có, sản phẩm không tồn tại; chạy lại không tạo trùng
const products = [{ _id: 'p48', slug: rose.slug, name: 'Cocoon Dầu tẩy trang hoa hồng' }];
const first = planRows([rose], { products, variants: [{ product: 'p48', sku: 'COCOON-DAU-TAY-TRANG-HOA-HONG-310ML', name: '310ml' }] });
assert.equal(first.planned.length, 1);
const again = planRows([rose], { products, variants: [{ product: 'p48', sku: rose.sku, name: '140ml' }] });
assert.equal(again.planned.length, 0); assert.equal(again.skipped[0].reason, 'MA_HANG_DA_CO');
const sameSize = planRows([rose], { products, variants: [{ product: 'p48', sku: 'KHAC', name: '140 ml' }] });
assert.equal(sameSize.skipped[0].reason, 'DUNG_TICH_DA_CO');
const missing = planRows([rose], { products: [], variants: [] });
assert.equal(missing.skipped[0].reason, 'KHONG_TIM_THAY_SAN_PHAM');
console.log(`SKINORA_EXTRA_SIZES_OFFLINE_PASS: ${summary.newSkus} dung tích mới cho ${summary.products} sản phẩm, có nguồn giá, chạy lại không trùng`);
