const express = require("express");
const { updateVariant, deleteVariant } = require("../controllers/variantController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/:id").put(protect, authorize("admin"), updateVariant).delete(protect, authorize("admin"), deleteVariant);

module.exports = router;
