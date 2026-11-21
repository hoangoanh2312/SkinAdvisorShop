// Kiểm tra offline: nội dung 48 sản phẩm đầy đủ, thay đúng văn bản nháp, không ghi đè nội dung quản trị viên đã viết
const assert = require("node:assert/strict");
const drafts = require("../data/catalog48Drafts.json");
const content = require("../data/productContent48.json").products;
const { planContentUpdate } = require("./applyProductContent");

for (const row of drafts) {
  const entry = content[row.slug];
  assert.ok(entry, `thiếu nội dung cho ${row.slug}`);
  for (const key of ["shortDescription", "description", "usage"]) assert.ok(entry[key]?.trim().length > 20, `${row.slug}.${key} quá ngắn`);
  assert.ok(entry.benefitClaims.length >= 3 && entry.warnings.length >= 1, `${row.slug} thiếu công dụng hoặc lưu ý`);
  assert.ok(!/quản trị|bản nháp|https?:/i.test(entry.description + entry.shortDescription), `${row.slug} còn chữ nháp`);
  assert.ok(/^https:\/\//.test(row.sourceUrl), `${row.slug} thiếu link nguồn HTTPS`);
}
const row = drafts.find((item) => item.slug === "cocoon-nuoc-tay-trang-hoa-hong");
const draft = { description: `${row.briefDescription}\nNguồn tham khảo của thương hiệu: ${row.sourceUrl}\nChưa có ảnh được cấp phép, giá VNĐ và tồn kho thực. Người quản trị cần kiểm tra lại trước khi mở bán.`, shortDescription: "Bản nháp – chờ kiểm chứng giá, thông tin sản phẩm và quyền sử dụng ảnh.", benefitClaims: [], usage: "", warnings: [], ingredients: [] };
const plan = planContentUpdate(draft, row, content[row.slug]);
assert.equal(plan.set.description, content[row.slug].description);
assert.equal(plan.set.contentSourceUrl, row.sourceUrl);
assert.deepEqual(plan.set.keyIngredients, ["Chiết xuất hoa hồng"]);
const written = { description: "Mô tả do quản trị viên tự viết", shortDescription: "Tự viết", benefitClaims: ["A"], contentSourceUrl: "https://x.vn", usage: "Tự viết", warnings: ["B"], ingredients: [{ name: "X" }] };
assert.equal(planContentUpdate(written, row, content[row.slug]), null);
console.log(`PASS nội dung đầy đủ cho ${drafts.length} sản phẩm, thay đúng văn bản nháp, giữ nguyên nội dung đã viết`);
