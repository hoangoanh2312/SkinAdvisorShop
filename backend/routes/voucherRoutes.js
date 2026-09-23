const express = require("express");
const { listVouchers, createVoucher, updateVoucher, deleteVoucher, validateVoucher } = require("../controllers/voucherController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
router.post("/validate", protect, validateVoucher);
router.route("/").get(protect, authorize("admin"), listVouchers).post(protect, authorize("admin"), createVoucher);
router.route("/:id").put(protect, authorize("admin"), updateVoucher).delete(protect, authorize("admin"), deleteVoucher);

module.exports = router;
