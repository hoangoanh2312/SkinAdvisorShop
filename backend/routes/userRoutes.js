const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require("../controllers/addressController");

const router = express.Router();

router.use(protect);
router.get("/me/addresses", getAddresses);
router.post("/me/addresses", createAddress);
router.put("/me/addresses/:addressId", updateAddress);
router.delete("/me/addresses/:addressId", deleteAddress);
router.put("/me/addresses/:addressId/default", setDefaultAddress);

module.exports = router;
