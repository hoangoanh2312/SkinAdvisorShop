const express = require("express");
const { createVnpayPayment, vnpayReturn, vnpayIpn, getBankTransfer, confirmBankTransfer } = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.post("/vnpay/create", protect, createVnpayPayment);
router.get("/bank-transfer/:orderId", protect, getBankTransfer);
router.post("/bank-transfer/:orderId/confirm", protect, confirmBankTransfer);
router.get("/vnpay/return", vnpayReturn);
router.get("/vnpay/ipn", vnpayIpn);

module.exports = router;
