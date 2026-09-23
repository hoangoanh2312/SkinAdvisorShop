const express = require("express");
const { advise } = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");
const { aiRateLimiter } = require("../middleware/aiRateLimiter");

const router = express.Router();

router.post("/advisor", protect, aiRateLimiter, advise);

module.exports = router;
