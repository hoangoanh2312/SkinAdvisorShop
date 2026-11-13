const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Brand = require("../models/Brand");
const { isValidObjectId, escapeRegex, pick, sendControllerError } = require("../utils/controllerHelpers");
const { summarizeCatalogVariants } = require("../utils/catalogAvailability");

const PRODUCT_FIELDS = [
  "name", "slug", "brand", "brandRef", "category", "description", "shortDescription",
  "skinTypes", "skinConcerns", "ingredients", "keyIngredients", "avoidFor", "usage",
  "warnings", "basePrice", "salePrice",
  "isFeatured", "isActive",
];

const CATEGORY_POPULATE = { path: "category", select: "name slug image" };

const getProducts = async (req, res) => {
  try {
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 12;
    // Visibility never grants permission to buy; checkout still requires isActive.
    const filter = { $and: [{ $or: [{ isActive: true }, { isCatalogVisible: true }] }] };

    // The optional storefront filter must never expose an inactive/draft product.
    // A product is orderable only if it is active and at least one SKU is active,
    // priced and in stock. This filter runs before count/pagination.
    if (req.query.sellableOnly === "true") {
      const availableProducts = await Variant.distinct("product", {
        isActive: true, price: { $gt: 0 }, stock: { $gt: 0 },
      });
      filter.$and.push({ isActive: true, _id: { $in: availableProducts } });
    }

    if (req.query.search?.trim()) {
      const search = new RegExp(escapeRegex(req.query.search.trim()), "i");
      // Preserve the public-visibility guard when search adds another OR clause.
      filter.$and.push({ $or: [{ name: search }, { brand: search }] });
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
    if (price.$gte !== undefined && price.$lte !== undefined && price.$gte > price.$lte) {
      return res.status(400).json({ success: false, message: "Khoảng giá không hợp lệ" });
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      price_asc: { basePrice: 1 },
      price_desc: { basePrice: -1 },
      rating: { averageRating: -1 },
      popular: { soldCount: -1 },
    };
    const sort = sortOptions[req.query.sort] || sortOptions.newest;

    const needsSkuPricing = Object.keys(price).length > 0 || ["price_asc", "price_desc"].includes(req.query.sort);
    // Giá thực tế là giá SKU (không phải basePrice lưu ở Product). Khi người dùng
    // lọc/sắp xếp theo giá, tính giá SKU TRƯỚC khi phân trang để kết quả chính xác.
    // Với catalog hiện tại (48 sản phẩm), nhánh này ưu tiên tính đúng nghiệp vụ.
    const [products, totalBeforeSku] = await Promise.all([
      (() => {
        const query = Product.find(filter).populate(CATEGORY_POPULATE).sort(needsSkuPricing ? { createdAt: -1 } : sort);
        return needsSkuPricing ? query.lean() : query.skip((page - 1) * limit).limit(limit);
      })(),
      needsSkuPricing ? Promise.resolve(null) : Product.countDocuments(filter),
    ]);
    const pageVariants = products.length
      ? await Variant.find({ product: { $in: products.map((product) => product._id) } })
        .select("product price salePrice stock isActive").lean()
      : [];
    const byProduct = new Map();
    for (const variant of pageVariants) {
      const key = String(variant.product);
      if (!byProduct.has(key)) byProduct.set(key, []);
      byProduct.get(key).push(variant);
    }
    const catalogProducts = products.map((product) => {
      const previewOnly = product.isActive === false && product.isCatalogVisible === true;
      return {
        ...(typeof product.toObject === "function" ? product.toObject() : product),
        ...summarizeCatalogVariants(byProduct.get(String(product._id)) || [], { previewOnly }),
      };
    });
    let total = totalBeforeSku;
    let pagedProducts = catalogProducts;
    if (needsSkuPricing) {
      const priced = catalogProducts.filter((item) => {
        const amount = item.catalogSalePrice;
        if (Object.keys(price).length && (amount == null || (price.$gte !== undefined && amount < price.$gte) || (price.$lte !== undefined && amount > price.$lte))) return false;
        return true;
      });
      if (["price_asc", "price_desc"].includes(req.query.sort)) {
        const direction = req.query.sort === "price_asc" ? 1 : -1;
        priced.sort((left, right) => {
          if (left.catalogSalePrice == null) return right.catalogSalePrice == null ? 0 : 1;
          if (right.catalogSalePrice == null) return -1;
          return direction * (left.catalogSalePrice - right.catalogSalePrice);
        });
      }
      total = priced.length;
      pagedProducts = priced.slice((page - 1) * limit, page * limit);
    }

    return res.status(200).json({
      success: true,
      data: { products: pagedProducts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return sendControllerError(res, error, "Không thể lấy danh sách sản phẩm");
  }
};

const getProduct = async (req, res) => {
  try {
    const value = req.params.idOrSlug;
    const productFilter = isValidObjectId(value) ? { _id: value } : { slug: value.toLowerCase() };
    const product = await Product.findOne({ ...productFilter, $or: [{ isActive: true }, { isCatalogVisible: true }] }).populate(CATEGORY_POPULATE);
    if (!product) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    // Informational preview may show a draft SKU/price, but cannot sell it.
    // Live products continue to expose only enabled SKUs.
    const variantFilter = product.isActive === false
      ? { product: product._id, price: { $gt: 0 } }
      : { product: product._id, isActive: true };
    const variants = await Variant.find(variantFilter).sort({ price: 1 });
    return res.status(200).json({ success: true, data: { product, variants } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể lấy sản phẩm");
  }
};

const validateActiveCategory = async (categoryId) => {
  if (!isValidObjectId(categoryId)) return null;
  return Category.findOne({ _id: categoryId, isActive: true }).select("_id");
};

const validateProductPrice = (data, existing = {}) => {
  const basePrice = data.basePrice === undefined ? existing.basePrice : Number(data.basePrice);
  const salePriceValue = data.salePrice === undefined ? existing.salePrice : data.salePrice;
  if (data.basePrice !== undefined && (!Number.isFinite(basePrice) || basePrice < 0)) return false;
  if (salePriceValue !== undefined && salePriceValue !== null && salePriceValue !== "") {
    const salePrice = Number(salePriceValue);
    if (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > basePrice) return false;
  }
  return true;
};

const resolveBrand = async (data) => {
  if (data.brandRef === undefined || data.brandRef === null || data.brandRef === "") return data;
  if (!isValidObjectId(data.brandRef)) throw new Error("INVALID_BRAND");
  const brand = await Brand.findOne({ _id: data.brandRef, isActive: true }).select("_id name");
  if (!brand) throw new Error("INVALID_BRAND");
  return { ...data, brandRef: brand._id, brand: brand.name };
};

const createProduct = async (req, res) => {
  try {
    let data = pick(req.body, PRODUCT_FIELDS);
    data = await resolveBrand(data);
    if (!validateProductPrice(data)) return res.status(400).json({ success: false, message: "Giá sản phẩm không hợp lệ" });
    if (!data.name?.trim() || !data.slug?.trim() || !data.brand?.trim() || data.basePrice === undefined) {
      return res.status(400).json({ success: false, message: "Tên, slug, thương hiệu và giá cơ bản là bắt buộc" });
    }
    if (!(await validateActiveCategory(data.category))) {
      return res.status(400).json({ success: false, message: "Danh mục không hợp lệ hoặc đã bị vô hiệu hóa" });
    }
    // Always create a private draft. Images/SKUs must be added before any publication or sale.
    const product = await Product.create({ ...data, isActive: false, isCatalogVisible: false });
    await product.populate(CATEGORY_POPULATE);
    return res.status(201).json({ success: true, message: "Tạo sản phẩm thành công", data: { product } });
  } catch (error) {
    if (error.message === "INVALID_BRAND") return res.status(400).json({ success: false, message: "Thương hiệu không hợp lệ hoặc đã bị vô hiệu hóa" });
    return sendControllerError(res, error, "Không thể tạo sản phẩm");
  }
};

const updateProduct = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  }
  try {
    let data = pick(req.body, PRODUCT_FIELDS);
    data = await resolveBrand(data);
    const current = await Product.findById(req.params.id).select("basePrice salePrice isActive images").lean();
    if (!current) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    if (!validateProductPrice(data, current)) return res.status(400).json({ success: false, message: "Giá sản phẩm không hợp lệ" });
    if (data.isActive === true && current.isActive === false) {
      if (!current.images?.length) return res.status(400).json({ success: false, message: "Cần tải lên ít nhất một ảnh trước khi mở bán" });
      const available = await Variant.exists({ product: req.params.id, isActive: true, stock: { $gt: 0 }, price: { $gt: 0 } });
      if (!available) return res.status(400).json({ success: false, message: "Cần ít nhất một phiên bản có giá, đang hoạt động và còn hàng trước khi mở bán" });
    }
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
    if (error.message === "INVALID_BRAND") return res.status(400).json({ success: false, message: "Thương hiệu không hợp lệ hoặc đã bị vô hiệu hóa" });
    return sendControllerError(res, error, "Không thể cập nhật sản phẩm");
  }
};

const deleteProduct = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  }
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false, isCatalogVisible: false }, { new: true });
    if (!product) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    return res.status(200).json({ success: true, message: "Đã vô hiệu hóa sản phẩm", data: { product } });
  } catch (error) {
    return sendControllerError(res, error, "Không thể vô hiệu hóa sản phẩm");
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct };
