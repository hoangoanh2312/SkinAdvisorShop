const express = require("express");
const { createMessage, listMessages, updateStatus } = require("../controllers/contactController");
const { createAuthRateLimiter } = require("../middleware/authRateLimiter");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
router.post("/", createAuthRateLimiter({ max: 5 }), createMessage);
router.get("/admin", protect, authorize("admin"), listMessages);
router.patch("/admin/:id", protect, authorize("admin"), updateStatus);
module.exports = router;
