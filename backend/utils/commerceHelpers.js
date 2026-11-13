const Review = require("../models/Review");
const Product = require("../models/Product");

const { calculateVoucherDiscount } = require("../services/voucherEligibilityService");

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
