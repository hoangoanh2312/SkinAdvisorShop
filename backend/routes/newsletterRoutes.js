const express = require("express");
const { subscribe, unsubscribe, listSubscribers, listCampaigns, createCampaign, sendTestCampaign } = require("../controllers/newsletterController");
const { createAuthRateLimiter } = require("../middleware/authRateLimiter");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
router.post("/subscribe", createAuthRateLimiter({ max: 10 }), subscribe);
// Link "Hủy nhận bản tin" trong email: không cần đăng nhập
router.get("/unsubscribe", createAuthRateLimiter({ max: 30 }), unsubscribe);
router.post("/unsubscribe", createAuthRateLimiter({ max: 30 }), unsubscribe);
router.get("/admin", protect, authorize("admin"), listSubscribers);
router.get("/admin/campaigns", protect, authorize("admin"), listCampaigns);
router.post("/admin/campaigns/test", protect, authorize("admin"), createAuthRateLimiter({ max: 10 }), sendTestCampaign);
router.post("/admin/campaigns", protect, authorize("admin"), createAuthRateLimiter({ max: 10 }), createCampaign);
module.exports = router;
