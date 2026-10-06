const multer = require("multer");

const MAX_SKIN_IMAGE_BYTES = 5 * 1024 * 1024;
const uploadSkinImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SKIN_IMAGE_BYTES, files: 1, fields: 2 },
}).single("image");

const parseSkinImage = (req, res, next) => {
  uploadSkinImage(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ success: false, message: "Ảnh không được vượt quá 5 MB" });
    return res.status(400).json({ success: false, message: "Dữ liệu ảnh tải lên không hợp lệ" });
  });
};

module.exports = { parseSkinImage, MAX_SKIN_IMAGE_BYTES };
