// ZaloPay Gateway API v2 (https://docs.zalopay.vn).
// key1 signs requests we send; key2 verifies callbacks and browser redirects coming from ZaloPay.
const crypto = require("crypto");

class ZalopayError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const SANDBOX_ENDPOINT = "https://sb-openapi.zalopay.vn/v2";

const config = (env = process.env) => {
  const value = {
    appId: (env.ZALOPAY_APP_ID || "").trim(),
    key1: (env.ZALOPAY_KEY1 || "").trim(),
    key2: (env.ZALOPAY_KEY2 || "").trim(),
    endpoint: (env.ZALOPAY_ENDPOINT || SANDBOX_ENDPOINT).trim().replace(/\/+$/, ""),
    redirectUrl: (env.ZALOPAY_REDIRECT_URL || `${(env.GOOGLE_FRONTEND_ORIGIN || "http://localhost:5173").replace(/\/+$/, "")}/payment/result`).trim(),
    callbackUrl: (env.ZALOPAY_CALLBACK_URL || "").trim(),
  };
  return value;
};
const isConfigured = (env = process.env) => {
  const c = config(env);
  return /^\d+$/.test(c.appId) && Boolean(c.key1) && Boolean(c.key2) && /^https:\/\//.test(c.endpoint);
};
const isSandbox = (env = process.env) => /sb-openapi\.zalopay\.vn/i.test(config(env).endpoint);

const hmac = (key, data) => crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");
const safeEqual = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left.toLowerCase()); const b = Buffer.from(right.toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// app_trans_id must be "yymmdd_xxx" (Vietnam date), max 40 chars, unique per app.
const vnDate = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "2-digit", month: "2-digit", day: "2-digit" })
    .formatToParts(now).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}${parts.month}${parts.day}`;
};
const createAppTransId = (orderId, now = new Date()) => `${vnDate(now)}_${String(orderId).slice(-12)}${now.getTime().toString().slice(-8)}${crypto.randomBytes(2).toString("hex")}`;

const post = async (path, params, fetchImpl = fetch) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetchImpl(`${config().endpoint}${path}`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString(),
    });
    if (!response.ok) throw new ZalopayError("ZALOPAY_HTTP_ERROR");
    return await response.json();
  } catch (error) {
    if (error instanceof ZalopayError) throw error;
    throw new ZalopayError(error.name === "AbortError" ? "ZALOPAY_TIMEOUT" : "ZALOPAY_UNAVAILABLE");
  } finally { clearTimeout(timer); }
};

/** Create a gateway order; returns { orderUrl, appTransId }. */
const createGatewayOrder = async ({ orderId, amount, description, userId, expireSeconds, now = new Date(), fetchImpl }) => {
  if (!isConfigured()) throw new ZalopayError("ZALOPAY_NOT_CONFIGURED");
  if (!Number.isSafeInteger(amount) || amount < 1000) throw new ZalopayError("ZALOPAY_INVALID_AMOUNT");
  const c = config();
  const appTransId = createAppTransId(orderId, now);
  const order = {
    app_id: c.appId,
    app_trans_id: appTransId,
    app_user: String(userId || "sandwich_beauty").slice(0, 50),
    app_time: now.getTime(),
    amount,
    item: "[]",
    // redirecturl: where the browser returns after paying (ZaloPay appends appid, apptransid, status, checksum...).
    embed_data: JSON.stringify({ redirecturl: c.redirectUrl, preferred_payment_method: [] }),
    description: (description || `sandwich beauty - Thanh toan don hang ${orderId}`).slice(0, 256),
    bank_code: "",
  };
  if (c.callbackUrl) order.callback_url = c.callbackUrl;
  // Hết hạn giữ hàng thì cổng cũng không nhận thanh toán nữa (ZaloPay: 300 giây đến 30 ngày).
  if (Number.isFinite(expireSeconds)) order.expire_duration_seconds = Math.min(Math.max(Math.floor(expireSeconds), 300), 2592000);
  order.mac = hmac(c.key1, [order.app_id, order.app_trans_id, order.app_user, order.amount, order.app_time, order.embed_data, order.item].join("|"));
  const result = await post("/create", order, fetchImpl);
  if (Number(result?.return_code) !== 1 || !result.order_url) {
    const error = new ZalopayError("ZALOPAY_CREATE_FAILED");
    error.detail = [result?.return_message, result?.sub_return_message].filter(Boolean).join(" - ");
    throw error;
  }
  return { orderUrl: result.order_url, appTransId };
};

/** Authoritative status from ZaloPay. status: "paid" | "failed" | "processing". */
const queryOrderStatus = async (appTransId, fetchImpl) => {
  if (!isConfigured()) throw new ZalopayError("ZALOPAY_NOT_CONFIGURED");
  const c = config();
  const mac = hmac(c.key1, [c.appId, appTransId, c.key1].join("|"));
  const result = await post("/query", { app_id: c.appId, app_trans_id: appTransId, mac }, fetchImpl);
  const code = Number(result?.return_code);
  const status = code === 1 ? "paid" : code === 2 ? "failed" : "processing";
  return { status, amount: Number(result?.amount), zpTransId: result?.zp_trans_id ? String(result.zp_trans_id) : "", raw: result };
};

/** Callback body {data, mac}: mac = HMAC(key2, data). */
const verifyCallback = (body = {}) => {
  const c = config();
  if (!c.key2 || typeof body.data !== "string") return { valid: false };
  const valid = safeEqual(body.mac, hmac(c.key2, body.data));
  if (!valid) return { valid: false };
  try { return { valid: true, data: JSON.parse(body.data) }; } catch { return { valid: false }; }
};

/** Browser redirect: checksum = HMAC(key2, appid|apptransid|pmcid|bankcode|amount|discountamount|status). */
const verifyRedirect = (query = {}) => {
  const c = config();
  const fields = ["appid", "apptransid", "pmcid", "bankcode", "amount", "discountamount", "status"].map((key) => (typeof query[key] === "string" ? query[key] : ""));
  return Boolean(c.key2) && safeEqual(query.checksum, hmac(c.key2, fields.join("|")));
};

module.exports = { createGatewayOrder, queryOrderStatus, verifyCallback, verifyRedirect, isConfigured, isSandbox, createAppTransId, hmac, ZalopayError, SANDBOX_ENDPOINT };
