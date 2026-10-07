const cloudinary = require("../config/cloudinary");
const { randomUUID } = require("crypto");

const timeoutMs = () => Math.min(Math.max(Number(process.env.CLOUDINARY_UPLOAD_TIMEOUT_MS) || 30000, 5000), 60000);
const withTimeout = async (promise, duration = timeoutMs()) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("CLOUDINARY_TIMEOUT"), { code: "CLOUDINARY_TIMEOUT" })), duration); })]); }
  finally { clearTimeout(timer); }
};
const retry = async (operation, attempts = 2) => {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); } catch (error) { lastError = error; if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1))); }
  }
  throw lastError;
};

const uploadOnce = (file, productId, publicId) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({ public_id: publicId, resource_type: "image", overwrite: true, unique_filename: false, timeout: timeoutMs() }, (error, result) => error ? reject(error) : resolve({ url: result.secure_url, publicId: result.public_id, format: result.format, width: result.width, height: result.height, bytes: result.bytes }));
  stream.end(file.buffer);
});

module.exports = {
  withTimeout,
  upload: async (file, productId) => { const publicId = `skinora/products/${productId}/${randomUUID()}`; try { return await retry(() => withTimeout(uploadOnce(file, productId, publicId))); } catch (error) { error.publicId = publicId; throw error; } },
  destroy: (publicId) => retry(() => withTimeout(cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true }))),
};
