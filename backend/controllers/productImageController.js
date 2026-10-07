const Product = require("../models/Product");
const ImageCleanupTask = require("../models/ImageCleanupTask");
const cloudinaryImageService = require("../services/cloudinaryImageService");
const { ProductImageService, ProductImageError, entriesFor } = require("../services/productImageService");

let cloudinaryAdapter = cloudinaryImageService;
const repository = {
  get: (id) => Product.findById(id).select("images imageAssets __v"),
  save: (id, version, state) => Product.findOneAndUpdate({ _id: id, __v: Number(version) }, { $set: state, $inc: { __v: 1 } }, { new: true, runValidators: true }).select("images imageAssets __v"),
  isPublicIdReferenced: (publicId) => Product.exists({ "imageAssets.publicId": publicId }),
};
const cleanupRepository = { create: (task) => ImageCleanupTask.create(task) };
const service = () => new ProductImageService({ cloudinary: cloudinaryAdapter, repository, cleanupRepository });
const responseImages = (product) => entriesFor(product).map((entry, index) => ({ imageKey: entry.key, url: entry.url, managed: Boolean(entry.asset), isPrimary: index === 0 }));
const sendError = (res, error) => {
  if (error instanceof ProductImageError) return res.status(error.status).json({ success: false, code: error.code, stateUpdated: Boolean(error.stateUpdated), cleanupGuaranteed: false, message: error.code === "IMAGE_VERSION_CONFLICT" ? "Dữ liệu ảnh đã thay đổi. Vui lòng tải lại." : "Không thể hoàn tất thao tác ảnh" });
  return res.status(500).json({ success: false, message: "Không thể hoàn tất thao tác ảnh" });
};
const getImages = async (req, res) => { try { const product = await repository.get(req.params.productId); if (!product) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" }); return res.json({ success: true, data: { images: responseImages(product), version: product.__v } }); } catch (error) { return sendError(res, error); } };
const uploadImages = async (req, res) => { try { const product = await service().upload(req.params.productId, req.body.expectedVersion, req.files); return res.status(201).json({ success: true, data: { images: responseImages(product), version: product.__v } }); } catch (error) { return sendError(res, error); } };
const replaceImage = async (req, res) => { try { const product = await service().replace(req.params.productId, req.body.expectedVersion, req.params.imageKey, req.file); return res.json({ success: true, data: { images: responseImages(product), version: product.__v } }); } catch (error) { return sendError(res, error); } };
const deleteImage = async (req, res) => { try { const product = await service().remove(req.params.productId, req.body.expectedVersion, req.params.imageKey); return res.json({ success: true, data: { images: responseImages(product), version: product.__v } }); } catch (error) { return sendError(res, error); } };
const reorderImages = async (req, res) => { try { const product = await service().reorder(req.params.productId, req.body.expectedVersion, req.body.imageKeys, req.body.primaryImageKey); return res.json({ success: true, data: { images: responseImages(product), version: product.__v } }); } catch (error) { return sendError(res, error); } };
const setCloudinaryAdapterForTests = (adapter) => { cloudinaryAdapter = adapter || cloudinaryImageService; };

module.exports = { getImages, uploadImages, replaceImage, deleteImage, reorderImages, setCloudinaryAdapterForTests };
