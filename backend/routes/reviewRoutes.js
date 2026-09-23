const express = require("express");
const { updateReview, deleteReview } = require("../controllers/reviewController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.route("/:id").put(protect, updateReview).delete(protect, deleteReview);

module.exports = router;
