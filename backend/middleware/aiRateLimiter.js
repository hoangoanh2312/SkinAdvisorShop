const AI_RATE_LIMIT_CONFIG = Object.freeze({ windowMs: 60 * 1000, max: 10 });
const requestsByUser = new Map();

const aiRateLimiter = (req, res, next) => {
  const key = String(req.user?._id || req.ip);
  const now = Date.now();
  const recent = (requestsByUser.get(key) || []).filter(
    (timestamp) => now - timestamp < AI_RATE_LIMIT_CONFIG.windowMs
  );

  if (recent.length >= AI_RATE_LIMIT_CONFIG.max) {
    return res.status(429).json({
      success: false,
      message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.",
    });
  }

  recent.push(now);
  requestsByUser.set(key, recent);

  if (requestsByUser.size > 1000) {
    for (const [storedKey, timestamps] of requestsByUser) {
      if (!timestamps.some((timestamp) => now - timestamp < AI_RATE_LIMIT_CONFIG.windowMs)) {
        requestsByUser.delete(storedKey);
      }
    }
  }

  return next();
};

module.exports = { aiRateLimiter, AI_RATE_LIMIT_CONFIG };
