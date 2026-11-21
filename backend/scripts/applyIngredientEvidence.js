/**
 * Bổ sung thông tin thành phần CÓ NGUỒN và mô tả trung tính cho 48 sản phẩm trong danh mục.
 *
 *   npm run content:sourced:preview                       -> chỉ đọc, in ra những gì sẽ thay đổi
 *   npm run content:sourced:apply                         -> ghi vào MongoDB (cần --confirm)
 *
 * Quy tắc an toàn:
 *  - Chỉ chạm vào sản phẩm có slug nằm trong data/catalog48Drafts.json.
 *  - Không ghi đè nội dung quản trị viên đã tự viết: chỉ thay mô tả còn là văn bản nháp của script import,
 *    chỉ điền mô tả/nguồn cho thành phần đang trống.
 *  - Không đổi giá, tồn kho, ảnh, trạng thái mở bán.
 *  - Mô tả thành phần lấy từ data/ingredientEvidence.json (mỗi mục có link HTTPS tới bài tổng quan khoa học).
 *  - Không viết "công dụng sản phẩm" (benefitClaims/contentSourceUrl) vì chưa đối chiếu được với bao bì / trang
 *    chính hãng; quản trị viên nhập phần này trong form sản phẩm khi đã có nguồn.
 */
require("dotenv").config({ quiet: true });
const drafts = require("../data/catalog48Drafts.json");
const evidence = require("../data/ingredientEvidence.json").ingredients;

const CONFIRM = "ADD_SOURCED_INGREDIENT_CONTENT";
const ALIASES = { ceramides: "ceramide" };
const CATEGORY_LABELS = {
  "serum-tinh-chat": "serum / tinh chất", "sua-rua-mat": "sữa rửa mặt", "tay-te-bao-chet": "tẩy tế bào chết",
  "kem-duong": "kem dưỡng", "toner-nuoc-can-bang": "toner / nước cân bằng", "cham-soc-phuc-hoi": "chăm sóc phục hồi",
  "kem-chong-nang": "kem chống nắng", "tay-trang": "tẩy trang",
};
const SKIN_LABELS = { normal: "da thường", dry: "da khô", oily: "da dầu", combination: "da hỗn hợp", sensitive: "da nhạy cảm" };
const DRAFT_SHORT = "Bản nháp – chờ kiểm chứng giá, thông tin sản phẩm và quyền sử dụng ảnh.";
const DRAFT_MARKERS = ["Người quản trị cần kiểm tra lại trước khi mở bán", "cần được người quản trị kiểm tra"];

const normalize = (name) => { const key = String(name || "").trim().toLowerCase(); return ALIASES[key] || key; };
const byKey = new Map(evidence.map((item) => [item.normalizedName, item]));
const blank = (value) => typeof value !== "string" || !value.trim();
const isDraftText = (value) => blank(value) || DRAFT_MARKERS.some((marker) => value.includes(marker)) || value === DRAFT_SHORT;

const sourcedIngredient = (name) => {
  const key = normalize(name);
  const found = byKey.get(key);
  return found
    ? { name: found.name, normalizedName: key, description: found.description, benefits: [...found.benefits], sourceUrl: found.sourceUrl }
    : { name: String(name).trim(), normalizedName: key };
};

const neutralTexts = (row) => {
  const category = CATEGORY_LABELS[row.categorySlug] || "chăm sóc da";
  const skins = (row.skinTypes || []).map((value) => SKIN_LABELS[value]).filter(Boolean);
  const keys = (row.keyIngredients || []).join(", ");
  const size = row.sizeHint ? `, dung tích tham khảo ${row.sizeHint}` : "";
  const shortDescription = `Sản phẩm ${category} của ${row.brand}${keys ? ` với thành phần nổi bật ${keys}` : ""}.`;
  const description = [
    `${row.name} là sản phẩm ${category} của thương hiệu ${row.brand}${size}.`,
    keys ? `Thành phần nổi bật ghi nhận trong danh mục: ${keys}. Xem giải thích từng thành phần (có nguồn) ở mục "Thành phần nổi bật" bên dưới.` : "",
    skins.length ? `Trong danh mục sandwich beauty, sản phẩm được xếp để tham khảo cho: ${skins.join(", ")}.` : "",
    "Hãy đọc kỹ bảng thành phần và hướng dẫn trên bao bì; thử trên vùng da nhỏ trước khi dùng nếu da nhạy cảm.",
  ].filter(Boolean).join(" ");
  return { shortDescription, description };
};

/** Pure function: decide the update for one product. Returns null when nothing should change. */
function planProductUpdate(product, row) {
  const set = {};
  const changes = [];
  const current = Array.isArray(product.ingredients) ? product.ingredients : [];
  if (!current.length && row.keyIngredients?.length) {
    set.ingredients = row.keyIngredients.map(sourcedIngredient);
    changes.push(`ingredients: +${set.ingredients.length} (${set.ingredients.filter((item) => item.sourceUrl).length} có nguồn)`);
  } else if (current.length) {
    let filled = 0;
    const next = current.map((item) => {
      const found = byKey.get(normalize(item.normalizedName || item.name));
      if (!found || !blank(item.description) || !blank(item.sourceUrl)) return item;
      filled += 1;
      return { ...item, description: found.description, sourceUrl: found.sourceUrl, benefits: item.benefits?.length ? item.benefits : [...found.benefits] };
    });
    if (filled) { set.ingredients = next; changes.push(`ingredients: điền nguồn cho ${filled}`); }
  }
  const texts = neutralTexts(row);
  if (isDraftText(product.description)) { set.description = texts.description; changes.push("description"); }
  if (isDraftText(product.shortDescription)) { set.shortDescription = texts.shortDescription; changes.push("shortDescription"); }
  return changes.length ? { set, changes } : null;
}

async function run({ apply = false, confirm = "" } = {}) {
  if (apply && confirm !== CONFIRM) throw new Error(`Cần --confirm=${CONFIRM} để ghi dữ liệu`);
  const mongoose = require("mongoose");
  const Product = require("../models/Product");
  const { configureLiveDatabase } = require("../config/businessDatabase");
  const database = configureLiveDatabase();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  try {
    const rows = new Map(drafts.map((row) => [row.slug, row]));
    const products = await Product.find({ slug: { $in: [...rows.keys()] } }).select("slug name description shortDescription ingredients").lean();
    const plans = products.map((product) => ({ product, plan: planProductUpdate(product, rows.get(product.slug)) })).filter((item) => item.plan);
    console.log(`Database: ${database} | sản phẩm khớp slug: ${products.length}/${rows.size} | cần cập nhật: ${plans.length}`);
    for (const { product, plan } of plans) console.log(`- ${product.slug}: ${plan.changes.join(", ")}`);
    if (!apply) { console.log(`\nCHỈ XEM TRƯỚC. Để ghi: npm run content:sourced:apply`); return; }
    for (const { product, plan } of plans) {
      // runValidators keeps the HTTPS-only rule for ingredient/content source URLs.
      await Product.updateOne({ _id: product._id }, { $set: plan.set }, { runValidators: true });
    }
    console.log(`Đã cập nhật ${plans.length} sản phẩm.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  const apply = process.argv.includes("--apply");
  const confirm = (process.argv.find((arg) => arg.startsWith("--confirm=")) || "").slice("--confirm=".length);
  run({ apply, confirm }).catch((error) => { console.error(`Lỗi: ${error.message}`); process.exitCode = 1; });
}

module.exports = { planProductUpdate, sourcedIngredient, neutralTexts, normalize, CONFIRM };
