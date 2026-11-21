const express = require("express");
const { register, login, getMe, forgotPassword, resetPassword, verifyEmail, resendVerification, updateMe, changePassword } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { createAuthRateLimiter } = require("../middleware/authRateLimiter");
const { googleLogin, linkGoogle } = require("../controllers/googleAuthController");

const router = express.Router();

router.post("/register", createAuthRateLimiter({ max: 8 }), register);
router.post("/login", createAuthRateLimiter({ max: 20 }), login);
router.post("/google", createAuthRateLimiter({ max: 20 }), googleLogin);
router.post("/google/link", protect, createAuthRateLimiter({ max: 10 }), linkGoogle);
router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);
router.put("/me/password", protect, createAuthRateLimiter({ max: 10 }), changePassword);
router.post("/forgot-password", createAuthRateLimiter({ max: 5 }), forgotPassword);
router.post("/reset-password", createAuthRateLimiter({ max: 10 }), resetPassword);
router.post("/verify-email", createAuthRateLimiter({ max: 20 }), verifyEmail);
router.post("/resend-verification", protect, createAuthRateLimiter({ max: 5 }), resendVerification);

module.exports = router;
