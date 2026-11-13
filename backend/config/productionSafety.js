/** Fail closed when a publicly deployed server lacks essential protections. */
const assertProductionSafety = (env = process.env) => {
  if (env.NODE_ENV !== 'production') return;
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('PRODUCTION_JWT_SECRET_TOO_SHORT');
  const origins = (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    try { const url = new URL(origin); return url.protocol !== 'https:' || url.origin !== origin; }
    catch { return true; }
  })) throw new Error('PRODUCTION_CORS_ORIGINS_MUST_BE_HTTPS');
  if (!env.MONGO_URI) throw new Error('PRODUCTION_MONGO_URI_MISSING');
};
module.exports = { assertProductionSafety };
