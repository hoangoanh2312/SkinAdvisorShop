const express = require("express");
const { advise } = require("../controllers/aiController");
const { analyzeSkin } = require("../controllers/skinAnalysisController");
const { protect } = require("../middleware/authMiddleware");
const { aiRateLimiter } = require("../middleware/aiRateLimiter");
const { parseSkinImage } = require("../middleware/skinAnalysisUpload");

const router = express.Router();

router.post("/advisor", protect, aiRateLimiter, advise);
router.post("/skin-analysis", protect, aiRateLimiter, parseSkinImage, analyzeSkin);

module.exports = router;
