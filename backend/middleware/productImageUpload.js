const multer = require("multer");

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_REQUEST_BYTES = 20 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES, files: 6, fields: 2 } });

const handle = (parser) => (req, res, next) => parser(req, res, (error) => {
  if (error?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ success: false, message: "Mỗi ảnh không được vượt quá 5 MB" });
  if (error) return res.status(400).json({ success: false, message: "Dữ liệu ảnh tải lên không hợp lệ" });
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) return res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_PRODUCT_IMAGE_REQUEST_BYTES) return res.status(413).json({ success: false, message: "Tổng dung lượng ảnh không được vượt quá 20 MB" });
  return next();
});

module.exports = { parseProductImages: handle(upload.array("images", 6)), parseProductImage: handle(upload.single("image")), MAX_PRODUCT_IMAGE_BYTES, MAX_PRODUCT_IMAGE_REQUEST_BYTES };
