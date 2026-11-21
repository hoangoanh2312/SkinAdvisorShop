const express = require("express");
const { updateVariant, deleteVariant } = require("../controllers/variantController");
const { uploadVariantImage, removeVariantImage, addVariantExtraImage, removeVariantExtraImage } = require("../controllers/variantImageController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { productImageRateLimiter } = require("../middleware/productImageRateLimiter");
const { parseProductImage } = require("../middleware/productImageUpload");

const router = express.Router();

router.route("/:id").put(protect, authorize("admin"), updateVariant).delete(protect, authorize("admin"), deleteVariant);
router.post("/:id/image", protect, authorize("admin"), productImageRateLimiter, parseProductImage, uploadVariantImage);
router.delete("/:id/image", protect, authorize("admin"), productImageRateLimiter, removeVariantImage);
router.post("/:id/extra-images", protect, authorize("admin"), productImageRateLimiter, parseProductImage, addVariantExtraImage);
router.delete("/:id/extra-images", protect, authorize("admin"), productImageRateLimiter, removeVariantExtraImage);

module.exports = router;
