const express = require("express");
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getAdminCategories,
} = require("../controllers/categoryController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/admin/list", protect, authorize("admin"), getAdminCategories);

router.route("/").get(getCategories).post(protect, authorize("admin"), createCategory);
router.route("/:id").get(getCategory).put(protect, authorize("admin"), updateCategory).delete(protect, authorize("admin"), deleteCategory);

module.exports = router;
