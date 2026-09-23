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

const router = express.Router();

router.route("/").get(getProducts).post(protect, authorize("admin"), createProduct);
router.route("/:productId/variants").get(getProductVariants).post(protect, authorize("admin"), createVariant);
router.route("/:productId/reviews").get(getReviews).post(protect, createReview);
router.route("/:idOrSlug").get(getProduct);
router.route("/:id").put(protect, authorize("admin"), updateProduct).delete(protect, authorize("admin"), deleteProduct);

module.exports = router;
