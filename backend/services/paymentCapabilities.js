const { isConfigured: isZalopayConfigured } = require('./zalopayService');
/** Read-only payment readiness: never send bank account data or gateway keys to the browser. */
const isHttps = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
const bankReady = (env = process.env) => /^[A-Z0-9]{2,20}$/i.test((env.BANK_CODE || '').trim())
  && /^\d{6,20}$/.test((env.BANK_ACCOUNT_NO || '').trim())
  && Boolean((env.BANK_ACCOUNT_NAME || '').trim())
  && (env.BANK_ACCOUNT_NAME || '').trim().length <= 100
  && !/[\x00-\x1f\x7f]/.test(env.BANK_ACCOUNT_NAME || '');
const vnpayMode = (env = process.env) => {
  const required = [env.VNP_TMN_CODE, env.VNP_HASH_SECRET, env.VNP_URL, env.VNP_RETURN_URL];
  if (required.some(value => !value || !value.trim())) return 'unavailable';
  const sandbox = /sandbox/i.test(env.VNP_URL);
  if (env.NODE_ENV === 'production') {
    if (sandbox || !isHttps(env.VNP_URL) || !isHttps(env.VNP_RETURN_URL) || !isHttps(env.VNP_IPN_URL)) return 'unavailable';
    return 'live';
  }
  return sandbox ? 'sandbox' : (isHttps(env.VNP_URL) && isHttps(env.VNP_RETURN_URL) ? 'live' : 'unavailable');
};
const zalopayMode = (env = process.env) => {
  if (!isZalopayConfigured(env)) return 'unavailable';
  const sandbox = /sb-openapi\.zalopay\.vn/i.test(env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2');
  if (env.NODE_ENV === 'production' && sandbox) return 'unavailable';
  return sandbox ? 'sandbox' : 'live';
};
const paymentCapabilities = (env = process.env) => ({
  COD: { available: true, mode: 'manual' },
  BANK_TRANSFER: { available: bankReady(env), mode: 'manual_verification' },
  // VNPAY_ENABLED=false hides VNPay without deleting its integration (e.g. while the sandbox terminal is not approved).
  VNPAY: { available: env.VNPAY_ENABLED !== 'false' && vnpayMode(env) !== 'unavailable', mode: vnpayMode(env) },
  ZALOPAY: { available: zalopayMode(env) !== 'unavailable', mode: zalopayMode(env) },
});
module.exports = { paymentCapabilities, bankReady, vnpayMode, zalopayMode };
