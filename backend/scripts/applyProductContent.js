/**
 * Điền nội dung hoàn chỉnh cho 48 sản phẩm: mô tả ngắn, giới thiệu, công dụng, hướng dẫn sử dụng, lưu ý
 *
 *   npm run content:full:preview   -> chỉ đọc, in ra những gì sẽ thay đổi
 *   npm run content:full:apply     -> ghi vào MongoDB
 *
 * Quy tắc an toàn:
 *  - Chỉ chạm vào sản phẩm có slug trong data/catalog48Drafts.json
 *  - Mô tả chỉ bị thay khi đang trống, còn là văn bản nháp lúc nhập dữ liệu hoặc là mô tả trung tính tự sinh
 *  - Công dụng, hướng dẫn, lưu ý, thành phần chỉ được điền khi đang trống, không ghi đè nội dung quản trị viên đã viết
 *  - Thêm --force để ghi đè toàn bộ phần mô tả bằng nội dung mới
 *  - Không đổi giá, tồn kho, ảnh, trạng thái mở bán
 */
require("dotenv").config({ quiet: true });
const drafts = require("../data/catalog48Drafts.json");
const content = require("../data/productContent48.json").products;
const { neutralTexts, sourcedIngredient } = require("./applyIngredientEvidence");

const CONFIRM = "FILL_PRODUCT_CONTENT_48";
const DRAFT_MARKERS = ["cần được người quản trị kiểm tra", "Người quản trị cần kiểm tra lại", "Nguồn tham khảo của thương hiệu", "Chưa có ảnh được cấp phép"];
const blank = (value) => typeof value !== "string" || !value.trim();
const isPlaceholder = (value, generated) => blank(value) || /^\s*bản nháp\b/i.test(value) || DRAFT_MARKERS.some((marker) => value.includes(marker)) || value === generated;

function planContentUpdate(product, row, entry, { force = false } = {}) {
  if (!entry) return null;
  const set = {};
  const changes = [];
  const neutral = neutralTexts(row);
  if (force ? product.description !== entry.description : isPlaceholder(product.description, neutral.description)) { set.description = entry.description; changes.push("giới thiệu"); }
  if (force ? product.shortDescription !== entry.shortDescription : isPlaceholder(product.shortDescription, neutral.shortDescription)) { set.shortDescription = entry.shortDescription; changes.push("mô tả ngắn"); }
  if (!product.benefitClaims?.length || force) { if (JSON.stringify(product.benefitClaims || []) !== JSON.stringify(entry.benefitClaims)) { set.benefitClaims = entry.benefitClaims; changes.push("công dụng"); } }
  if (blank(product.contentSourceUrl) && /^https:\/\//i.test(row.sourceUrl || "")) { set.contentSourceUrl = row.sourceUrl; changes.push("nguồn công dụng"); }
  if (blank(product.usage) || (force && product.usage !== entry.usage)) { set.usage = entry.usage; changes.push("hướng dẫn"); }
  if (!product.warnings?.length) { set.warnings = entry.warnings; changes.push("lưu ý"); }
  if (!product.ingredients?.length && entry.ingredients?.length) { set.ingredients = entry.ingredients.map(sourcedIngredient); set.keyIngredients = entry.ingredients; changes.push(`thành phần +${entry.ingredients.length}`); }
  return changes.length ? { set, changes } : null;
}

async function run({ apply = false, confirm = "", force = false } = {}) {
  if (apply && confirm !== CONFIRM) throw new Error(`Cần --confirm=${CONFIRM} để ghi dữ liệu`);
  const mongoose = require("mongoose");
  const Product = require("../models/Product");
  const { configureLiveDatabase } = require("../config/businessDatabase");
  const database = configureLiveDatabase();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  try {
    const rows = new Map(drafts.map((row) => [row.slug, row]));
    const products = await Product.find({ slug: { $in: [...rows.keys()] } }).select("slug name description shortDescription benefitClaims contentSourceUrl usage warnings ingredients").lean();
    const plans = products.map((product) => ({ product, plan: planContentUpdate(product, rows.get(product.slug), content[product.slug], { force }) })).filter((item) => item.plan);
    console.log(`Database: ${database} | sản phẩm khớp: ${products.length}/${rows.size} | cần cập nhật: ${plans.length}`);
    for (const { product, plan } of plans) console.log(`- ${product.name}: ${plan.changes.join(", ")}`);
    if (!apply) { console.log("\nCHỈ XEM TRƯỚC. Để ghi: npm run content:full:apply"); return; }
    for (const { product, plan } of plans) await Product.updateOne({ _id: product._id }, { $set: plan.set }, { runValidators: true });
    console.log(`Đã cập nhật ${plans.length} sản phẩm`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");
  const confirm = (process.argv.find((arg) => arg.startsWith("--confirm=")) || "").slice("--confirm=".length);
  run({ apply, confirm, force }).catch((error) => { console.error(`Lỗi: ${error.message}`); process.exitCode = 1; });
}

module.exports = { planContentUpdate, isPlaceholder, CONFIRM };
