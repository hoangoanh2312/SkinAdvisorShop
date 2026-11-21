const express = require("express");
const { createVnpayPayment, vnpayReturn, vnpayIpn, getBankTransfer, confirmBankTransfer, createZalopayPayment, zalopayCallback, zalopayReturn } = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

const { paymentCapabilities } = require("../services/paymentCapabilities");
const router = express.Router();
router.get("/methods", (_req, res) => res.set("Cache-Control", "no-store").json({ success: true, data: paymentCapabilities() }));
router.post("/vnpay/create", protect, createVnpayPayment);
router.get("/bank-transfer/:orderId", protect, getBankTransfer);
router.post("/bank-transfer/:orderId/confirm", protect, confirmBankTransfer);
router.get("/vnpay/return", vnpayReturn);
router.get("/vnpay/ipn", vnpayIpn);
router.post("/zalopay/create", protect, createZalopayPayment);
router.post("/zalopay/callback", zalopayCallback);
router.get("/zalopay/return", zalopayReturn);

// VNPAY sandbox rejects a localhost return domain (error 71 "Website này chưa được phê duyệt").
// Use a public tunnel URL ending in /api/payments/vnpay/browser-return as VNP_RETURN_URL; this hop
// only forwards the browser to the local frontend result page, which still verifies the signature
// through /vnpay/return. The target origin is fixed by config, so this is not an open redirect.
const frontendResultUrl = () => {
  const configured = process.env.VNP_FRONTEND_RESULT_URL || `${process.env.GOOGLE_FRONTEND_ORIGIN || "http://localhost:5173"}/payment/result`;
  try { const url = new URL(configured); return /^https?:$/.test(url.protocol) ? url : null; } catch { return null; }
};
router.get("/vnpay/browser-return", (req, res) => {
  const target = frontendResultUrl();
  if (!target) return res.status(503).json({ success: false, message: "Chưa cấu hình trang kết quả thanh toán" });
  const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  return res.redirect(302, `${target.origin}${target.pathname}${query}`);
});

module.exports = router;
