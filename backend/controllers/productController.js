const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { isValidObjectId, escapeRegex, pick, sendControllerError } = require("../utils/controllerHelpers");

const PRODUCT_FIELDS = [
  "name", "slug", "brand", "category", "description", "shortDescription", "images",
  "skinTypes", "skinConcerns", "ingredients", "keyIngredients", "avoidFor", "usage",
  "warnings", "basePrice", "salePrice", "averageRating", "reviewCount", "soldCount",
  "isFeatured", "isActive",
];

const CATEGORY_POPULATE = { path: "category", select: "name slug image" };

const getProducts = async (req, res) => {
  try {
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 12;
    const filter = { isActive: true };

    if (req.query.search?.trim()) {
      const search = new RegExp(escapeRegex(req.query.search.trim()), "i");
      filter.$or = [{ name: search }, { brand: search }];
    }

    if (req.query.category?.trim()) {
      const categoryValue = req.query.category.trim();
      if (isValidObjectId(categoryValue)) {
        filter.category = categoryValue;
      } else {
        const category = await Category.findOne({ slug: categoryValue.toLowerCase(), isActive: true }).select("_id");
        if (!category) {
          return res.status(200).json({
            success: true,
            data: { products: [], pagination: { page, limit, total: 0, totalPages: 0 } },
          });
        }
        filter.category = category._id;
      }
    }

    if (req.query.brand?.trim()) {
      filter.brand = new RegExp(`^${escapeRegex(req.query.brand.trim())}$`, "i");
    }
    if (req.query.skinType?.trim()) filter.skinTypes = req.query.skinType.trim().toLowerCase();
    if (req.query.skinConcern?.trim()) filter.skinConcerns = req.query.skinConcern.trim().toLowerCase();
    if (req.query.ingredient?.trim()) {
      filter["ingredients.normalizedName"] = req.query.ingredient.trim().toLowerCase();
    }
    if (req.query.featured === "true") filter.isFeatured = true;
    if (req.query.featured === "false") filter.isFeatured = false;

    const price = {};
    if (req.query.minPrice !== undefined) {
      const minPrice = Number(req.query.minPrice);
      if (!Number.isFinite(minPrice) || minPrice < 0) {
        return res.status(400).json({ success: false, message: "minPrice không hợp lệ" });
      }
      price.$gte = minPrice;
    }
    if (req.query.maxPrice !== undefined) {
      const maxPrice = Number(req.query.maxPrice);
      if (!Number.isFinite(maxPrice) || maxPrice < 0) {
        return res.status(400).json({ success: false, message: "maxPrice không hợp lệ" });
      }
      price.$lte = maxPrice;
    }
    if (Object.keys(price).length) filter.basePrice = price;

    const sortOptions = {
      newest: { createdAt: -1 },
      price_asc: { basePrice: 1 },
      price_desc: { basePrice: -1 },
      rating: { averageRating: -1 },
      popular: { soldCount: -1 },
    };
    const sort = sortOptions[req.query.sort] || sortOptions.newest;

    const [products, total] = await Promise.all([
      Product.find(filter).populate(CATEGORY_POPULATE).sort(sort).skip((page - 1) * limit).limit(limit),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: { products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return sendControllerError(res, error, "Không thể lấy danh sách sản phẩm");
  }
};

const getProduct = async (req, res) => {
  try {
    const value = req.params.idOrSlug;
    const productFilter = isValidObjectId(value) ? { _id: value } : { slug: value.toLowerCase() };
    const product = await Product.findOne({ ...productFilter, isActive: true }).populate(CATEGORY_POPULATE);
    if (!product) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    const variants = await Variant.find({ product: product._id, isActive: true }).sort({ price: 1 });
    return res.status(200).json({ success: true, data: { product, variants } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể lấy sản phẩm");
  }
};

const validateActiveCategory = async (categoryId) => {
  if (!isValidObjectId(categoryId)) return null;
  return Category.findOne({ _id: categoryId, isActive: true }).select("_id");
};

const createProduct = async (req, res) => {
  try {
    const data = pick(req.body, PRODUCT_FIELDS);
    if (!data.name?.trim() || !data.slug?.trim() || !data.brand?.trim() || data.basePrice === undefined) {
      return res.status(400).json({ success: false, message: "Tên, slug, thương hiệu và giá cơ bản là bắt buộc" });
    }
    if (!(await validateActiveCategory(data.category))) {
      return res.status(400).json({ success: false, message: "Danh mục không hợp lệ hoặc đã bị vô hiệu hóa" });
    }
    const product = await Product.create(data);
    await product.populate(CATEGORY_POPULATE);
    return res.status(201).json({ success: true, message: "Tạo sản phẩm thành công", data: { product } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể tạo sản phẩm");
  }
};

const updateProduct = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  }
  try {
    const data = pick(req.body, PRODUCT_FIELDS);
    if (data.category !== undefined && !(await validateActiveCategory(data.category))) {
      return res.status(400).json({ success: false, message: "Danh mục không hợp lệ hoặc đã bị vô hiệu hóa" });
    }
    const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
      .populate(CATEGORY_POPULATE);
    if (!product) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    return res.status(200).json({ success: true, message: "Cập nhật sản phẩm thành công", data: { product } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể cập nhật sản phẩm");
  }
};

const deleteProduct = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  }
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    return res.status(200).json({ success: true, message: "Đã vô hiệu hóa sản phẩm", data: { product } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể vô hiệu hóa sản phẩm");
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct };
