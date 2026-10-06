const { analyzeSkin: analyzeSkinImage } = require("../services/skinAnalysis/skinAnalysisService");
const { SkinAnalysisProviderError } = require("../services/skinAnalysis/providers/geminiVisionProvider");
const SkinAnalysis = require("../models/SkinAnalysis");

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const hasImageSignature = (buffer, mimeType) => {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mimeType === "image/jpeg") return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
};

const analyzeSkin = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Vui lòng chọn ảnh cần phân tích" });
  if (req.body?.consent !== "true") return res.status(400).json({ success: false, message: "Bạn cần đồng ý sử dụng ảnh để phân tích đặc điểm da" });
  if (!ALLOWED_MIME_TYPES.has(req.file.mimetype) || !hasImageSignature(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({ success: false, message: "Ảnh phải có định dạng JPEG, PNG hoặc WebP hợp lệ" });
  }
  const source = req.body?.source === "camera" ? "camera" : "upload";
  try {
    const data = await analyzeSkinImage({ buffer: req.file.buffer, mimeType: req.file.mimetype, source });
    await SkinAnalysis.create({ user: req.user._id, source, image: { url: null, publicId: null }, result: data.analysis, recommendedProducts: data.recommendations.map((item) => ({ product: item.product.id, score: item.score, reasons: item.reasons })) });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof SkinAnalysisProviderError) {
      return res.status(503).json({ success: false, message: "Dịch vụ phân tích da đang tạm thời không khả dụng" });
    }
    return res.status(500).json({ success: false, message: "Không thể phân tích ảnh lúc này" });
  }
};

module.exports = { analyzeSkin, hasImageSignature, ALLOWED_MIME_TYPES };
