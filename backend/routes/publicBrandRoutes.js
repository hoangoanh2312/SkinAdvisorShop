const router = require("express").Router();
const Brand = require("../models/Brand");

router.get("/", async (_req, res) => {
  try {
    const brands = await Brand.find({ isActive: true }).select("name slug").sort({ name: 1 }).limit(100).lean();
    return res.json({ success: true, data: { brands } });
  } catch (_error) {
    return res.status(500).json({ success: false, message: "Không thể tải thương hiệu" });
  }
});

module.exports = router;
