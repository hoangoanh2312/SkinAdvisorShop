const router = require("express").Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { createBrand, listBrands, updateBrand } = require("../controllers/brandController");
router.use(protect, authorize("admin"));
router.route("/").get(listBrands).post(createBrand);
router.patch("/:id", updateBrand);
module.exports = router;
