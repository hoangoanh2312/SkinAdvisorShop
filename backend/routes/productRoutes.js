const express = require("express");
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { getProductVariants, createVariant } = require("../controllers/variantController");
const { getReviews, createReview } = require("../controllers/reviewController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { getImages, uploadImages, replaceImage, deleteImage, reorderImages } = require("../controllers/productImageController");
const { parseProductImages, parseProductImage } = require("../middleware/productImageUpload");
const { productImageRateLimiter } = require("../middleware/productImageRateLimiter");

const router = express.Router();

router.route("/").get(getProducts).post(protect, authorize("admin"), createProduct);
router.route("/:productId/variants").get(getProductVariants).post(protect, authorize("admin"), createVariant);
router.route("/:productId/reviews").get(getReviews).post(protect, createReview);
router.get("/:productId/images", protect, authorize("admin"), getImages);
router.post("/:productId/images", protect, authorize("admin"), productImageRateLimiter, parseProductImages, uploadImages);
router.patch("/:productId/images/order", protect, authorize("admin"), productImageRateLimiter, reorderImages);
router.put("/:productId/images/:imageKey", protect, authorize("admin"), productImageRateLimiter, parseProductImage, replaceImage);
router.delete("/:productId/images/:imageKey", protect, authorize("admin"), productImageRateLimiter, deleteImage);
router.route("/:idOrSlug").get(getProduct);
router.route("/:id").put(protect, authorize("admin"), updateProduct).delete(protect, authorize("admin"), deleteProduct);

module.exports = router;
