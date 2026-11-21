const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");

// Only customers who received the product (an order containing it is "completed") may review it.
const hasReceivedProduct = (userId, productId) => Order.exists({ user: userId, orderStatus: "completed", "items.product": productId });
const { isValidObjectId, pick, sendControllerError } = require("../utils/controllerHelpers");
const { refreshProductRating } = require("../utils/commerceHelpers");

const getReviews = async (req, res) => {
  if (!isValidObjectId(req.params.productId)) return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
    const filter = { product: req.params.productId, isActive: true };
    const [reviews, total] = await Promise.all([
      Review.find(filter).populate("user", "fullName avatar").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Review.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, data: { reviews, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể lấy đánh giá");
  }
};

const createReview = async (req, res) => {
  if (!isValidObjectId(req.params.productId)) return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  try {
    if (!(await Product.exists({ _id: req.params.productId, isActive: true }))) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    if (req.user.role !== "customer") return res.status(403).json({ success: false, message: "Chỉ khách hàng mới có thể đánh giá" });
    if (!(await hasReceivedProduct(req.user._id, req.params.productId))) return res.status(403).json({ success: false, message: "Bạn chỉ có thể đánh giá sản phẩm sau khi đơn hàng đã giao thành công" });
    const review = await Review.create({ user: req.user._id, product: req.params.productId, ...pick(req.body, ["rating", "comment"]) });
    await refreshProductRating(review.product);
    return res.status(201).json({ success: true, message: "Tạo đánh giá thành công", data: { review } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể tạo đánh giá");
  }
};

const updateReview = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID đánh giá không hợp lệ" });
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
    if (!review.user.equals(req.user._id)) return res.status(403).json({ success: false, message: "Bạn không có quyền sửa đánh giá này" });
    Object.assign(review, pick(req.body, ["rating", "comment"]));
    await review.save();
    await refreshProductRating(review.product);
    return res.status(200).json({ success: true, message: "Cập nhật đánh giá thành công", data: { review } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể cập nhật đánh giá");
  }
};

const deleteReview = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID đánh giá không hợp lệ" });
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
    if (!review.user.equals(req.user._id) && req.user.role !== "admin") return res.status(403).json({ success: false, message: "Bạn không có quyền xóa đánh giá này" });
    review.isActive = false;
    await review.save();
    await refreshProductRating(review.product);
    return res.status(200).json({ success: true, message: "Đã vô hiệu hóa đánh giá", data: { review } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể xóa đánh giá");
  }
};

// GET /products/:productId/reviews/eligibility
const getReviewEligibility = async (req, res) => {
  if (!isValidObjectId(req.params.productId)) return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  try {
    const [received, existing] = await Promise.all([
      req.user.role === "customer" ? hasReceivedProduct(req.user._id, req.params.productId) : null,
      Review.findOne({ user: req.user._id, product: req.params.productId }).select("_id rating comment"),
    ]);
    const reason = req.user.role !== "customer" ? "not_customer" : existing ? "already_reviewed" : received ? null : "not_purchased";
    return res.status(200).json({ success: true, data: { eligible: !reason, reason, review: existing } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể kiểm tra quyền đánh giá");
  }
};

module.exports = {
  getReviewEligibility, getReviews, createReview, updateReview, deleteReview };
