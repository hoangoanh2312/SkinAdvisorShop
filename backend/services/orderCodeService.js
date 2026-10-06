const ORDER_CODE_RETRY_LIMIT = 5;
const ORDER_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const generateOrderCode = (date = new Date()) => {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  let suffix = "";
  for (let index = 0; index < 4; index += 1) {
    suffix += ORDER_CODE_ALPHABET[Math.floor(Math.random() * ORDER_CODE_ALPHABET.length)];
  }
  return `SKN${year}${month}${day}${suffix}`;
};

const isOrderCodeCollision = (error) => error?.code === 11000
  && Boolean(error?.keyPattern?.orderCode || error?.keyValue?.orderCode);

const withOrderCodeRetry = async (operation, options = {}) => {
  const generate = options.generate || generateOrderCode;
  const maxAttempts = options.maxAttempts || ORDER_CODE_RETRY_LIMIT;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(generate());
    } catch (error) {
      if (!isOrderCodeCollision(error) || attempt === maxAttempts) throw error;
    }
  }
  throw new Error("ORDER_CODE_GENERATION_FAILED");
};

module.exports = { generateOrderCode, withOrderCodeRetry };
