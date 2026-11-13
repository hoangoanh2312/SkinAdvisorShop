const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Variant = require("../models/Variant");
const Order = require("../models/Order");
const { escapeRegex, isValidObjectId, sendControllerError } = require("../utils/controllerHelpers");

// COD is collected when the order is completed. Refunded and failed payments are excluded.
const revenueMatch = {
  orderStatus: "completed",
  paymentStatus: { $nin: ["refunded", "failed"] },
  $or: [{ paymentStatus: "paid" }, { paymentMethod: "COD" }],
};
const earnedExpression = {
  $and: [
    { $eq: ["$orderStatus", "completed"] },
    { $not: [{ $in: ["$paymentStatus", ["refunded", "failed"]] }] },
    { $or: [{ $eq: ["$paymentStatus", "paid"] }, { $eq: ["$paymentMethod", "COD"] }] },
  ],
};
const pagination = query => ({
  page: Math.max(Number.parseInt(query.page, 10) || 1, 1),
  limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100),
});
const pageResult = ({ page, limit }, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });

const listAdminProducts = async (req, res) => {
  try {
    const paging = pagination(req.query);
    const filter = {};
    if (req.query.includeInactive !== "true") filter.isActive = true;
    if (req.query.search?.trim()) {
      const pattern = new RegExp(escapeRegex(req.query.search.trim()), "i");
      filter.$or = [{ name: pattern }, { brand: pattern }, { slug: pattern }];
    }
    // Filter in MongoDB BEFORE pagination, so counts/pages stay correct.
    if (req.query.imageStatus === "missing") filter["images.0"] = { $exists: false };
    if (req.query.imageStatus === "present") filter["images.0"] = { $exists: true };
    const status = req.query.status;
    if (status === "draft") { filter.isActive = false; filter.isCatalogVisible = { $ne: true }; }
    if (status === "preview") { filter.isActive = false; filter.isCatalogVisible = true; }
    if (status === "selling" || status === "out-of-stock") {
      filter.isActive = true;
      // A sellable SKU requires an active variant, verified positive price and actual stock.
      // Resolve eligible product IDs before counting/paging so pagination is accurate.
      const eligibleIds = await Variant.distinct("product", { isActive: true, price: { $gt: 0 }, stock: { $gt: 0 } });
      filter._id = status === "selling" ? { $in: eligibleIds } : { $nin: eligibleIds };
    }
    const [products, total] = await Promise.all([
      Product.find(filter).populate("category", "name slug").populate("brandRef", "name slug")
        .sort({ createdAt: -1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).lean(),
      Product.countDocuments(filter),
    ]);
    const variants = await Variant.find({ product: { $in: products.map(item => item._id) } })
      .select("product name sku size unit price salePrice stock isActive")
      .sort({ createdAt: 1 }).lean();
    const byProduct = new Map();
    for (const variant of variants) {
      const id = String(variant.product);
      byProduct.set(id, [...(byProduct.get(id) || []), variant]);
    }
    return res.json({ success: true, data: {
      products: products.map(item => {
        const productVariants = byProduct.get(String(item._id)) || [];
        return { ...item, variants: productVariants, totalStock: productVariants.filter(variant => variant.isActive).reduce((sum, variant) => sum + variant.stock, 0), variantCount: productVariants.filter(variant => variant.isActive).length };
      }),
      pagination: pageResult(paging, total),
    } });
  } catch (error) { return sendControllerError(res, error, "Không thể tải sản phẩm quản trị"); }
};

const adminProductDetail = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID không hợp lệ" });
  try {
    const product = await Product.findById(req.params.id).populate("category", "name slug").populate("brandRef", "name slug");
    if (!product) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    const variants = await Variant.find({ product: product._id }).sort({ createdAt: 1 });
    return res.json({ success: true, data: { product, variants } });
  } catch (error) { return sendControllerError(res, error, "Không thể tải sản phẩm"); }
};

const dashboardSummary = async (_req, res) => {
  try {
    const [activeProducts, activeCategories, activeBrands, activeCustomers, totalOrders, pendingOrders, revenueRows, stockCandidates, recentOrders] = await Promise.all([
      Product.countDocuments({ isActive: true }), Category.countDocuments({ isActive: true }),
      Brand.countDocuments({ isActive: true }), User.countDocuments({ role: "customer", isActive: true }),
      Order.countDocuments(), Order.countDocuments({ orderStatus: "pending" }),
      Order.aggregate([{ $match: revenueMatch }, { $group: { _id: null, total: { $sum: "$total" } } }]),
      Variant.find({ isActive: true, stock: { $lte: 5 } }).populate("product", "name brand images isActive").sort({ stock: 1 }).limit(50),
      Order.find().populate("user", "fullName email").sort({ createdAt: -1 }).limit(5),
    ]);
    return res.json({ success: true, data: {
      activeProducts, activeCategories, activeBrands, activeCustomers, totalOrders, pendingOrders,
      revenue: revenueRows[0]?.total || 0,
      lowStock: stockCandidates.filter(item => item.product?.isActive).slice(0, 10), recentOrders,
    } });
  } catch (error) { return sendControllerError(res, error, "Không thể tải tổng quan"); }
};

const listCustomers = async (req, res) => {
  try {
    const paging = pagination(req.query);
    const filter = { role: "customer" };
    if (req.query.status === "active") filter.isActive = true;
    if (req.query.status === "inactive") filter.isActive = false;
    if (req.query.search?.trim()) {
      const pattern = new RegExp(escapeRegex(req.query.search.trim()), "i");
      filter.$or = [{ fullName: pattern }, { email: pattern }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).select("fullName email createdAt isActive").sort({ createdAt: -1 })
        .skip((paging.page - 1) * paging.limit).limit(paging.limit).lean(),
      User.countDocuments(filter),
    ]);
    const stats = await Order.aggregate([
      { $match: { user: { $in: users.map(item => item._id) } } },
      { $group: { _id: "$user", orderCount: { $sum: 1 }, totalSpent: { $sum: { $cond: [earnedExpression, "$total", 0] } } } },
    ]);
    const byUser = new Map(stats.map(item => [String(item._id), item]));
    return res.json({ success: true, data: {
      customers: users.map(user => ({ ...user, orderCount: byUser.get(String(user._id))?.orderCount || 0, totalSpent: byUser.get(String(user._id))?.totalSpent || 0 })),
      pagination: pageResult(paging, total),
    } });
  } catch (error) { return sendControllerError(res, error, "Không thể tải khách hàng"); }
};

const customerDetail = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "ID không hợp lệ" });
  try {
    const customer = await User.findOne({ _id: req.params.id, role: "customer" }).select("fullName email phone createdAt isActive").lean();
    if (!customer) return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });
    const paging = pagination(req.query);
    const filter = { user: customer._id };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit),
      Order.countDocuments(filter),
    ]);
    return res.json({ success: true, data: { customer, orders, pagination: pageResult(paging, total) } });
  } catch (error) { return sendControllerError(res, error, "Không thể tải khách hàng"); }
};

const setCustomerStatus = async (req, res) => {
  if (!isValidObjectId(req.params.id) || typeof req.body.isActive !== "boolean") return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
  try {
    const customer = await User.findOneAndUpdate({ _id: req.params.id, role: "customer" }, { isActive: req.body.isActive }, { returnDocument: "after" }).select("fullName email createdAt isActive");
    if (!customer) return res.status(400).json({ success: false, message: "Chỉ có thể cập nhật tài khoản khách hàng" });
    return res.json({ success: true, data: { customer } });
  } catch (error) { return sendControllerError(res, error, "Không thể cập nhật khách hàng"); }
};

module.exports = { adminProductDetail, customerDetail, dashboardSummary, listAdminProducts, listCustomers, setCustomerStatus };
