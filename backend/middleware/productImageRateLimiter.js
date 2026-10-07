const WINDOW_MS = 10 * 60 * 1000; const MAX_REQUESTS = 20; const requests = new Map();
const productImageRateLimiter = (req, res, next) => {
  const key = String(req.user._id); const now = Date.now();
  const recent = (requests.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return res.status(429).json({ success: false, message: "Bạn đã thao tác ảnh quá nhiều lần. Vui lòng thử lại sau." });
  recent.push(now); requests.set(key, recent); return next();
};
module.exports = { productImageRateLimiter };
