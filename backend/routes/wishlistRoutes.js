const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const WishlistItem = require("../models/WishlistItem");
const { protect, authorize } = require("../middleware/authMiddleware");
const { summarizeCatalogVariants } = require("../utils/catalogAvailability");

const router = express.Router();
router.use(protect, authorize("customer"));

const visible = { $or: [{ isActive: true }, { isCatalogVisible: true }] };
const validId = (value) => mongoose.isValidObjectId(value);

router.get("/", async (req, res) => {
  try {
    const saved = await WishlistItem.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    const ids = saved.map((item) => item.product);
    const [products, variants] = await Promise.all([
      Product.find({ _id: { $in: ids }, ...visible }).lean(),
      Variant.find({ product: { $in: ids } }).select("product price salePrice stock isActive name sku size unit").lean(),
    ]);
    const byId = new Map(products.map((product) => [String(product._id), product]));
    const byProduct = new Map();
    for (const variant of variants) {
      const key = String(variant.product);
      if (!byProduct.has(key)) byProduct.set(key, []);
      byProduct.get(key).push(variant);
    }
    const items = saved.flatMap((item) => {
      const product = byId.get(String(item.product));
      if (!product) return [];
      const productVariants = byProduct.get(String(product._id)) || [];
      const summary = summarizeCatalogVariants(productVariants, { previewOnly: !product.isActive });
      const displayVariant = productVariants.find(variant => variant.price > 0 && (!product.isActive || variant.isActive !== false) && (summary.availableVariantCount === 0 || variant.stock > 0) && (variant.salePrice > 0 && variant.salePrice <= variant.price ? variant.salePrice : variant.price) === summary.catalogSalePrice) || null;
      return [{ ...product, ...summary, displayVariant: displayVariant ? { sku: displayVariant.sku, name: displayVariant.name, size: displayVariant.size, unit: displayVariant.unit } : null }];
    });
    return res.json({ success: true, data: { products: items } });
  } catch {
    return res.status(500).json({ success: false, message: "Không thể tải sản phẩm yêu thích" });
  }
});

router.post("/:productId", async (req, res) => {
  if (!validId(req.params.productId)) return res.status(400).json({ success: false, message: "Sản phẩm không hợp lệ" });
  try {
    const product = await Product.findOne({ _id: req.params.productId, ...visible }).select("_id");
    if (!product) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    await WishlistItem.updateOne({ user: req.user._id, product: product._id }, { $setOnInsert: { user: req.user._id, product: product._id } }, { upsert: true });
    return res.json({ success: true, message: "Đã lưu sản phẩm yêu thích" });
  } catch (error) {
    if (error.code === 11000) return res.json({ success: true, message: "Sản phẩm đã được lưu" });
    return res.status(500).json({ success: false, message: "Không thể lưu sản phẩm yêu thích" });
  }
});

router.delete("/:productId", async (req, res) => {
  if (!validId(req.params.productId)) return res.status(400).json({ success: false, message: "Sản phẩm không hợp lệ" });
  try {
    await WishlistItem.deleteOne({ user: req.user._id, product: req.params.productId });
    return res.json({ success: true, message: "Đã bỏ sản phẩm yêu thích" });
  } catch {
    return res.status(500).json({ success: false, message: "Không thể cập nhật sản phẩm yêu thích" });
  }
});

module.exports = router;
