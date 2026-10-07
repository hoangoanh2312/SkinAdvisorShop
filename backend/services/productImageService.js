const mongoose = require("mongoose");

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const validateImageSignature = (buffer, mimeType) => {
  if (!Buffer.isBuffer(buffer) || !ALLOWED_IMAGE_TYPES.has(mimeType)) return false;
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
};

const assetValue = (asset) => typeof asset?.toObject === "function" ? asset.toObject() : { ...asset };
const buildConsistentImageState = (images = [], imageAssets = []) => {
  const uniqueImages = [...new Set(images.filter((url) => typeof url === "string" && url.trim()).map((url) => url.trim()))];
  const assetByUrl = new Map();
  for (const source of imageAssets) {
    const asset = assetValue(source);
    if (asset.url && asset.publicId && uniqueImages.includes(asset.url) && !assetByUrl.has(asset.url)) assetByUrl.set(asset.url, asset);
  }
  return { images: uniqueImages, imageAssets: uniqueImages.map((url) => assetByUrl.get(url)).filter(Boolean) };
};

const keyFor = (asset) => String(asset._id);
const entriesFor = (product) => {
  const state = buildConsistentImageState(product.images, product.imageAssets);
  const managedByUrl = new Map(state.imageAssets.map((asset) => [asset.url, asset]));
  let legacyIndex = 0;
  return state.images.map((url) => {
    const asset = managedByUrl.get(url);
    return asset ? { key: keyFor(asset), url, asset } : { key: `legacy:${legacyIndex++}`, url, asset: null };
  });
};

class ProductImageError extends Error {
  constructor(code, status = 400, details = {}) { super(code); this.code = code; this.status = status; Object.assign(this, details); }
}

class ProductImageService {
  constructor({ cloudinary, repository, cleanupRepository }) {
    this.cloudinary = cloudinary;
    this.repository = repository;
    this.cleanupRepository = cleanupRepository;
  }

  async cleanup(publicId, productId, reason, stateUpdated = false) {
    if (await this.repository.isPublicIdReferenced(publicId, productId)) return { status: "still_referenced" };
    try { await this.cloudinary.destroy(publicId); return { status: "destroyed" }; }
    catch (destroyError) {
      try { await this.cleanupRepository.create({ publicId, product: productId, reason, attempts: 0, status: "pending" }); return { status: "queued" }; }
      catch (taskError) { throw new ProductImageError("CLEANUP_UNCONFIRMED", 500, { stateUpdated }); }
    }
  }

  async queueUncertain(publicId, productId, reason) {
    try { await this.cleanupRepository.create({ publicId, product: productId, reason, attempts: 0, status: "pending", nextAttemptAt: new Date(Date.now() + 60 * 1000) }); }
    catch { throw new ProductImageError("CLEANUP_UNCONFIRMED", 500, { stateUpdated: false }); }
  }

  async upload(productId, expectedVersion, files) {
    const product = await this.repository.get(productId);
    if (!product) throw new ProductImageError("PRODUCT_NOT_FOUND", 404);
    if (Number(expectedVersion) !== Number(product.__v)) throw new ProductImageError("IMAGE_VERSION_CONFLICT", 409);
    const current = buildConsistentImageState(product.images, product.imageAssets);
    if (current.images.length + files.length > 10) throw new ProductImageError("TOO_MANY_PRODUCT_IMAGES");
    const uploaded = [];
    try {
      for (const file of files) {
        if (!validateImageSignature(file.buffer, file.mimetype)) throw new ProductImageError("INVALID_IMAGE");
        let result;
        try { result = await this.cloudinary.upload(file, productId); }
        catch (error) { if (error.publicId) await this.queueUncertain(error.publicId, productId, "upload_outcome_uncertain"); throw error; }
        uploaded.push({ _id: new mongoose.Types.ObjectId(), ...result, createdAt: new Date() });
      }
      const next = buildConsistentImageState([...current.images, ...uploaded.map((asset) => asset.url)], [...current.imageAssets, ...uploaded]);
      const saved = await this.repository.save(productId, expectedVersion, next);
      if (!saved) throw new ProductImageError("IMAGE_VERSION_CONFLICT", 409);
      return saved;
    } catch (error) {
      for (const asset of uploaded) await this.cleanup(asset.publicId, productId, "upload_rollback");
      throw error;
    }
  }

  async reorder(productId, expectedVersion, keys, primaryKey) {
    const product = await this.repository.get(productId);
    if (!product) throw new ProductImageError("PRODUCT_NOT_FOUND", 404);
    if (Number(expectedVersion) !== Number(product.__v)) throw new ProductImageError("IMAGE_VERSION_CONFLICT", 409);
    const entries = entriesFor(product); const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    if (!Array.isArray(keys) || keys.length !== entries.length || new Set(keys).size !== keys.length || keys.some((key) => !byKey.has(key)) || !byKey.has(primaryKey)) throw new ProductImageError("INVALID_IMAGE_ORDER");
    const orderedKeys = [primaryKey, ...keys.filter((key) => key !== primaryKey)];
    const ordered = orderedKeys.map((key) => byKey.get(key));
    const next = buildConsistentImageState(ordered.map((entry) => entry.url), ordered.map((entry) => entry.asset).filter(Boolean));
    const saved = await this.repository.save(productId, expectedVersion, next);
    if (!saved) throw new ProductImageError("IMAGE_VERSION_CONFLICT", 409);
    return saved;
  }

  async replace(productId, expectedVersion, imageKey, file) {
    const product = await this.repository.get(productId);
    if (!product) throw new ProductImageError("PRODUCT_NOT_FOUND", 404);
    if (Number(expectedVersion) !== Number(product.__v)) throw new ProductImageError("IMAGE_VERSION_CONFLICT", 409);
    if (!validateImageSignature(file.buffer, file.mimetype)) throw new ProductImageError("INVALID_IMAGE");
    const entries = entriesFor(product); const targetIndex = entries.findIndex((entry) => entry.key === imageKey);
    if (targetIndex < 0) throw new ProductImageError("IMAGE_NOT_FOUND", 404);
    const oldAsset = entries[targetIndex].asset;
    let result;
    try { result = await this.cloudinary.upload(file, productId); }
    catch (error) { if (error.publicId) await this.queueUncertain(error.publicId, productId, "replace_upload_outcome_uncertain"); throw error; }
    const replacement = { _id: new mongoose.Types.ObjectId(), ...result, createdAt: new Date() };
    entries[targetIndex] = { key: keyFor(replacement), url: replacement.url, asset: replacement };
    const next = buildConsistentImageState(entries.map((entry) => entry.url), entries.map((entry) => entry.asset).filter(Boolean));
    const saved = await this.repository.save(productId, expectedVersion, next);
    if (!saved) {
      await this.cleanup(replacement.publicId, productId, "replace_rollback");
      throw new ProductImageError("IMAGE_VERSION_CONFLICT", 409);
    }
    if (oldAsset) await this.cleanup(oldAsset.publicId, productId, "image_replaced", true);
    return saved;
  }

  async remove(productId, expectedVersion, imageKey) {
    const product = await this.repository.get(productId);
    if (!product) throw new ProductImageError("PRODUCT_NOT_FOUND", 404);
    if (Number(expectedVersion) !== Number(product.__v)) throw new ProductImageError("IMAGE_VERSION_CONFLICT", 409);
    const entries = entriesFor(product); const target = entries.find((entry) => entry.key === imageKey);
    if (!target) throw new ProductImageError("IMAGE_NOT_FOUND", 404);
    const remaining = entries.filter((entry) => entry !== target);
    const next = buildConsistentImageState(remaining.map((entry) => entry.url), remaining.map((entry) => entry.asset).filter(Boolean));
    const saved = await this.repository.save(productId, expectedVersion, next);
    if (!saved) throw new ProductImageError("IMAGE_VERSION_CONFLICT", 409);
    if (target.asset) await this.cleanup(target.asset.publicId, productId, "image_removed", true);
    return saved;
  }
}

module.exports = { ALLOWED_IMAGE_TYPES, validateImageSignature, buildConsistentImageState, entriesFor, ProductImageError, ProductImageService };
