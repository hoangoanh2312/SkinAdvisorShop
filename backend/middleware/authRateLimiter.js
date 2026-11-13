/** Single-process baseline. Add a shared/store-backed limiter at the public reverse proxy. */
const createAuthRateLimiter = ({ windowMs = 15 * 60_000, max = 20 } = {}) => {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const row = (hits.get(key) || []).filter(time => now - time < windowMs);
    if (row.length >= max) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - row[0])) / 1000)));
      return res.status(429).json({ success: false, message: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.' });
    }
    row.push(now); hits.set(key, row);
    if (hits.size > 2000) for (const [ip, times] of hits) {
      if (!times.some(time => now - time < windowMs)) hits.delete(ip);
    }
    return next();
  };
};
module.exports = { createAuthRateLimiter };
