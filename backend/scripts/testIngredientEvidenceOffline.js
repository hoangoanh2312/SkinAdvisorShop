const assert = require("assert/strict");
const { planProductUpdate, sourcedIngredient, CONFIRM } = require("./applyIngredientEvidence");
const evidence = require("../data/ingredientEvidence.json").ingredients;
const drafts = require("../data/catalog48Drafts.json");

// Every evidence entry has a Vietnamese description and an HTTPS source.
for (const item of evidence) {
  assert.match(item.sourceUrl, /^https:\/\/[^\s]+$/, item.name);
  assert.ok(item.description.length > 40, item.name);
  assert.equal(item.normalizedName, item.normalizedName.toLowerCase());
}
// Every key ingredient used by the 48-product catalog has sourced content.
const keys = new Set(drafts.flatMap((row) => row.keyIngredients));
for (const key of keys) assert.ok(sourcedIngredient(key).sourceUrl, `missing evidence for ${key}`);
// Filter alias: "Ceramides" must match the Products page filter value "ceramide".
assert.equal(sourcedIngredient("Ceramides").normalizedName, "ceramide");

const row = drafts.find((item) => item.keyIngredients.includes("Hyaluronic Acid"));
const importedDraft = {
  slug: row.slug, ingredients: [], contentSourceUrl: "",
  shortDescription: "Bản nháp – chờ kiểm chứng giá, thông tin sản phẩm và quyền sử dụng ảnh.",
  description: `${row.briefDescription}\nNguồn tham khảo của thương hiệu: ${row.sourceUrl}\nChưa có ảnh được cấp phép, giá VNĐ và tồn kho thực. Người quản trị cần kiểm tra lại trước khi mở bán.`,
};
const plan = planProductUpdate(importedDraft, row);
assert.ok(plan.set.ingredients.every((item) => item.sourceUrl && item.description));
assert.ok(plan.set.ingredients.some((item) => item.normalizedName === "hyaluronic acid"));
assert.ok(plan.set.description.includes(row.brand) && !plan.set.description.includes("Người quản trị"));
assert.ok(!("benefitClaims" in plan.set) && !("contentSourceUrl" in plan.set), "no unverified product claims");
for (const forbidden of ["basePrice", "salePrice", "isActive", "images", "stock"]) assert.ok(!(forbidden in plan.set));

// Admin-written content is never overwritten.
const curated = { ...importedDraft, description: "Mô tả do quản trị viên viết.", shortDescription: "Tóm tắt riêng.", contentSourceUrl: "https://brand.example/p",
  ingredients: [{ name: "Hyaluronic Acid", normalizedName: "hyaluronic acid", description: "Ghi chú riêng", sourceUrl: "https://x.example" }] };
assert.equal(planProductUpdate(curated, row), null);

// Existing ingredient rows without a source get one; other fields stay.
const partial = { ...curated, ingredients: [{ name: "Hyaluronic Acid", normalizedName: "hyaluronic acid", description: "", benefits: [] }] };
const filled = planProductUpdate(partial, row);
assert.match(filled.set.ingredients[0].sourceUrl, /^https:\/\//);
assert.equal(filled.set.description, undefined);
assert.equal(CONFIRM, "ADD_SOURCED_INGREDIENT_CONTENT");

console.log(`INGREDIENT_EVIDENCE_OFFLINE_PASS: ${evidence.length} sourced ingredients cover all ${keys.size} catalog key ingredients; drafts only, no price/stock/publish changes`);
