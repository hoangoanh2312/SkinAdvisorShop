class VietQrError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const bankConfig = () => {
  const config = {
    bankCode: process.env.BANK_CODE?.trim(),
    accountNo: process.env.BANK_ACCOUNT_NO?.trim(),
    accountName: process.env.BANK_ACCOUNT_NAME?.trim(),
  };
  const validBankCode = /^[A-Z0-9]{2,20}$/i.test(config.bankCode || "");
  const validAccountNo = /^\d{6,20}$/.test(config.accountNo || "");
  const validAccountName = Boolean(config.accountName)
    && config.accountName.length <= 100
    && !/[\u0000-\u001F\u007F]/.test(config.accountName);
  if (!validBankCode || !validAccountNo || !validAccountName) throw new VietQrError("VIETQR_NOT_CONFIGURED");
  return config;
};

const buildVietQrPayload = (order) => {
  const config = bankConfig();
  const query = new URLSearchParams({
    amount: String(order.total),
    addInfo: order.orderCode,
    accountName: config.accountName,
  });
  const bankCode = encodeURIComponent(config.bankCode);
  const accountNo = encodeURIComponent(config.accountNo);
  return {
    ...config,
    amount: order.total,
    orderCode: order.orderCode,
    qrUrl: `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact2.png?${query.toString()}`,
  };
};

module.exports = { VietQrError, buildVietQrPayload };
