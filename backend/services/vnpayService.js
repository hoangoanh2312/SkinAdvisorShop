const crypto = require("crypto");

class VnpayError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const requiredConfig = () => {
  const config = {
    tmnCode: process.env.VNP_TMN_CODE,
    hashSecret: process.env.VNP_HASH_SECRET,
    paymentUrl: process.env.VNP_URL,
    returnUrl: process.env.VNP_RETURN_URL,
  };
  if (Object.values(config).some((value) => !value?.trim())) throw new VnpayError("VNPAY_NOT_CONFIGURED");
  return config;
};

const formatDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
};

const encode = (value) => encodeURIComponent(String(value)).replace(/%20/g, "+");
const canonicalize = (params) => Object.entries(params)
  .filter(([key, value]) => key !== "vnp_SecureHash" && key !== "vnp_SecureHashType" && value !== undefined && value !== null && value !== "")
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${encode(key)}=${encode(value)}`)
  .join("&");

const signParams = (params, secret) => crypto.createHmac("sha512", secret)
  .update(canonicalize(params), "utf8").digest("hex");

const safeEqual = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBuffer = Buffer.from(left.toLowerCase(), "utf8");
  const rightBuffer = Buffer.from(right.toLowerCase(), "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const normalizeCallback = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => typeof value === "string")
);

const verifyCallback = (query) => {
  const params = normalizeCallback(query);
  const secureHash = params.vnp_SecureHash;
  if (!process.env.VNP_HASH_SECRET?.trim()) throw new VnpayError("VNPAY_NOT_CONFIGURED");
  return { valid: safeEqual(secureHash, signParams(params, process.env.VNP_HASH_SECRET)), params };
};

const createTransactionRef = (orderId) => `${orderId}${Date.now()}${crypto.randomBytes(3).toString("hex")}`;

const createPaymentUrl = ({ orderId, amount, ipAddress, transactionRef = createTransactionRef(orderId), now = new Date() }) => {
  const config = requiredConfig();
  if (!Number.isSafeInteger(amount) || amount < 0) throw new VnpayError("VNPAY_INVALID_AMOUNT");
  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    vnp_Amount: amount * 100,
    vnp_CreateDate: formatDate(now),
    vnp_CurrCode: "VND",
    vnp_IpAddr: ipAddress || "127.0.0.1",
    vnp_Locale: "vn",
    vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
    vnp_OrderType: "other",
    vnp_ReturnUrl: config.returnUrl,
    vnp_TxnRef: transactionRef,
  };
  const query = canonicalize(params);
  const secureHash = signParams(params, config.hashSecret);
  return { paymentUrl: `${config.paymentUrl}?${query}&vnp_SecureHash=${secureHash}`, transactionRef };
};

const callbackAmount = (params) => {
  const raw = Number(params.vnp_Amount);
  return Number.isSafeInteger(raw) && raw >= 0 && raw % 100 === 0 ? raw / 100 : null;
};

module.exports = {
  VnpayError, createPaymentUrl, verifyCallback, callbackAmount,
  canonicalize, signParams, formatDate, createTransactionRef,
};
