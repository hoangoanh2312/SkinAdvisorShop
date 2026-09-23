const Review = require("../models/Review");
const Product = require("../models/Product");

const calculateVoucherDiscount = (voucher, orderValue, now = new Date()) => {
  if (!voucher || !voucher.isActive) throw new Error("VOUCHER_INVALID");
  if (now < voucher.startDate || now > voucher.endDate) throw new Error("VOUCHER_EXPIRED");
  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) throw new Error("VOUCHER_LIMIT");
  if (orderValue < voucher.minOrderValue) throw new Error("VOUCHER_MIN_ORDER");

  let discount = voucher.discountType === "percent"
    ? (orderValue * voucher.discountValue) / 100
    : voucher.discountValue;
  if (voucher.maxDiscount !== null) discount = Math.min(discount, voucher.maxDiscount);
  return Math.min(Math.round(discount), orderValue);
};

const refreshProductRating = async (productId) => {
  const [summary] = await Review.aggregate([
    { $match: { product: productId, isActive: true } },
    { $group: { _id: "$product", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
  ]);
  await Product.findByIdAndUpdate(productId, {
    averageRating: summary ? Math.round(summary.averageRating * 10) / 10 : 0,
    reviewCount: summary?.reviewCount || 0,
  });
};

module.exports = { calculateVoucherDiscount, refreshProductRating };
