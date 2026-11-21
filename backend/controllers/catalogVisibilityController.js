const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { isValidObjectId, sendControllerError } = require("../utils/controllerHelpers");

// A visible catalog item is informational only. "isActive", SKU price and
// stock continue to decide whether checkout is allowed.
const completeProfile = (product) => Boolean(
  product?.name?.trim() &&
  product?.slug?.trim() &&
  product?.brand?.trim() &&
  product?.category &&
  product?.images?.some((url) => typeof url === "string" && /^https?:\/\//i.test(url))
);

async function eligibleHiddenCatalog() {
  const candidates = await Product.find({
    isActive: false,
    isCatalogVisible: { $ne: true },
  }).select("_id name slug brand category images").lean();

  if (!candidates.length) return { eligibleIds: [], skipped: 0, total: 0 };
  const withProfile = candidates.filter(completeProfile);
  // Public preview is NOT selling. Draft SKUs are commonly disabled until
  // stock and product publication are verified. Requiring isActive:true here
  // incorrectly hides almost the entire imported catalog.
  // Require a positively priced SKU to keep unpriced draft variants private.
  const withSku = withProfile.length
    ? await Variant.distinct("product", {
      product: { $in: withProfile.map((item) => item._id) },
      price: { $gt: 0 },
    })
    : [];
  const skuSet = new Set(withSku.map(String));
  const eligibleIds = withProfile.filter((item) => skuSet.has(String(item._id))).map((item) => item._id);
  return { eligibleIds, skipped: candidates.length - eligibleIds.length, total: candidates.length };
}

async function previewCatalogVisibility(_req, res) {
  try {
    const result = await eligibleHiddenCatalog();
    return res.json({ success: true, data: {
      eligible: result.eligibleIds.length,
      skipped: result.skipped,
      total: result.total,
      message: "Xem trước, chưa thay đổi cơ sở dữ liệu. Sản phẩm chỉ hiện thông tin, không tự mở bán.",
    } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể kiểm tra Catalog");
  }
}

async function bulkShowEligibleCatalog(req, res) {
  if (req.body?.action !== "show-eligible" || req.body?.confirm !== "SHOW_ELIGIBLE_CATALOG") {
    return res.status(400).json({ success: false, message: "Thiếu xác nhận hiển thị Catalog" });
  }
  try {
    const { eligibleIds, skipped } = await eligibleHiddenCatalog();
    if (!eligibleIds.length) return res.json({ success: true, data: { updated: 0, skipped } });
    const result = await Product.updateMany({
      _id: { $in: eligibleIds },
      isActive: false,
      isCatalogVisible: { $ne: true },
    }, { $set: { isCatalogVisible: true } });
    return res.json({
      success: true,
      message: "Đã hiển thị mỹ phẩm hợp lệ trên Catalog mà không thay đổi giá hay tồn kho",
      data: { updated: result.modifiedCount, skipped },
    });
  } catch (error) {
    return sendControllerError(res, error, "Không thể cập nhật Catalog");
  }
}

async function setCatalogVisibility(req, res) {
  if (!isValidObjectId(req.params.id) || typeof req.body?.visible !== "boolean") {
    return res.status(400).json({ success: false, message: "ID hoặc trạng thái hiển thị không hợp lệ" });
  }
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    if (!req.body.visible && product.isActive) {
      return res.status(400).json({ success: false, message: "Hãy tắt bán trước khi ẩn sản phẩm đang mở bán" });
    }
    if (req.body.visible) {
      if (!completeProfile(product)) {
        return res.status(400).json({ success: false, message: "Cần đầy đủ tên, thương hiệu, danh mục và ít nhất một đường dẫn ảnh hợp lệ" });
      }
      const hasSku = await Variant.exists({ product: product._id, price: { $gt: 0 } });
      if (!hasSku) return res.status(400).json({ success: false, message: "Cần ít nhất một mã hàng có giá hợp lệ trước khi hiển thị" });
    }
    product.isCatalogVisible = req.body.visible;
    await product.save();
    return res.json({ success: true, data: { isCatalogVisible: product.isCatalogVisible } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể thay đổi trạng thái Catalog");
  }
}

module.exports = { previewCatalogVisibility, bulkShowEligibleCatalog, setCatalogVisibility, completeProfile };
