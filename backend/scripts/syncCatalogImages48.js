/**
 * Explicit slug -> local file catalog image synchronization for SKINORA.
 * Offline --check performs no network requests. Default --dry-run reads only from skinora_prod.
 * --apply --confirm=SYNC_SKINORA_IMAGES uploads Cloudinary and attaches to products missing ALL images.
 * NEVER replaces existing images or changes stock, price, variants, active state or product metadata.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.resolve(__dirname, '..', 'data', 'catalog48ImageMap.json');
const CATALOG = path.resolve(__dirname, '..', 'data', 'catalog48Drafts.json');

function signature(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
const EXTENSIONS = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
function validateManifest({ manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')), catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8')) } = {}) {
  if (manifest.length !== 48 || catalog.length !== 48) throw new Error('EXPECTED_48_CATALOG_ROWS');
  const seen = new Set();
  const files = new Set();
  const summary = { total: 48, mapped: 0, missing: [], entries: [] };
  for (let i = 0; i < catalog.length; i++) {
    const row = manifest[i];
    if (!row || row.index !== i + 1 || row.slug !== catalog[i].slug || row.name !== catalog[i].name || row.brand !== catalog[i].brand || seen.has(row.slug)) throw new Error(`MISMATCH_OR_DUPLICATE_ROW_${i + 1}`);
    seen.add(row.slug);
    if (!row.file) { summary.missing.push({ number: i + 1, slug: row.slug, reason: 'NO_LOCAL_IMAGE' }); continue; }
    if (!/^anh\/[a-z0-9_/' .%-]+\.(jpg|jpeg|png|webp)$/i.test(row.file) || row.file.includes('..') || files.has(row.file)) throw new Error(`INVALID_ASSET_MAPPING_${row.slug}`);
    const absolute = path.resolve(PROJECT_ROOT, row.file);
    if (!absolute.startsWith(path.join(PROJECT_ROOT, 'anh') + path.sep)) throw new Error(`INVALID_ASSET_PATH_${row.slug}`);
    if (!fs.existsSync(absolute)) throw new Error(`ASSET_FILE_NOT_FOUND_${row.file}`);
    const buffer = fs.readFileSync(absolute);
    const mime = signature(buffer);
    if (!mime || mime !== EXTENSIONS[path.extname(absolute).toLowerCase()]) throw new Error(`IMAGE_FORMAT_MISMATCH_${row.file}`);
    if (buffer.length > 10 * 1024 * 1024) throw new Error(`IMAGE_TOO_LARGE_${row.file}`);
    files.add(row.file);
    summary.mapped++;
    summary.entries.push({ number: i + 1, slug: row.slug, file: row.file, mime, bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') });
  }
  return summary;
}
async function synchronize({ apply = false, confirm = false, limit = 0, logger = console, plan = validateManifest() } = {}) {
  if (apply && !confirm) throw new Error('REQUIRES_EXPLICIT_CONFIRMATION');
  require('dotenv').config({ quiet: true });
  const mongoose = require('mongoose');
  const Product = require('../models/Product');
  const { businessUriFrom, businessDatabaseName } = require('../config/businessDatabase');
  const dbName = businessDatabaseName(process.env);
  if (dbName !== 'skinora_prod') throw new Error(`REFUSING_DATABASE_${dbName}`);
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI_NOT_CONFIGURED');
  await mongoose.connect(businessUriFrom(process.env.MONGO_URI, dbName), { autoIndex: false, serverSelectionTimeoutMS: 12000 });
  try {
    if (mongoose.connection.name !== dbName) throw new Error('DATABASE_MISMATCH');
    const slugs = plan.entries.map(e => e.slug);
    const actual = await Product.find({ slug: { $in: slugs } }).select('name slug images imageAssets __v').lean();
    const bySlug = new Map(actual.map(p => [p.slug, p]));
    const stats = { database: dbName, mode: apply ? 'APPLY_MISSING_IMAGES_ONLY' : 'DRY_RUN_READ_ONLY', mapped: plan.mapped, noLocalImage: plan.missing.length, missingProducts: [], alreadyHasImage: [], candidates: [], uploaded: [], failed: [] };
    for (const entry of plan.entries) {
      const product = bySlug.get(entry.slug);
      if (!product) { stats.missingProducts.push(entry.slug); continue; }
      if ((product.images || []).some(Boolean) || (product.imageAssets || []).length) { stats.alreadyHasImage.push(entry.slug); continue; }
      stats.candidates.push(entry.slug);
    }
    if (!apply) return stats;
    // Load Cloudinary only after the preview and explicit approval.
    const ImageCleanupTask = require('../models/ImageCleanupTask');
    const cloudinary = require('../services/cloudinaryImageService');
    const { ProductImageService } = require('../services/productImageService');
    const repository = {
      get: id => Product.findById(id).select('images imageAssets __v'),
      save: (id, version, state) => Product.findOneAndUpdate({ _id: id, __v: Number(version) }, { $set: state, $inc: { __v: 1 } }, { returnDocument: 'after', runValidators: true }).select('images imageAssets __v'),
      isPublicIdReferenced: publicId => Product.exists({ 'imageAssets.publicId': publicId }),
    };
    const imageService = new ProductImageService({ cloudinary, repository, cleanupRepository: { create: doc => ImageCleanupTask.create(doc) } });
    const allowed = new Set(stats.candidates.slice(0, limit > 0 ? limit : undefined));
    for (const entry of plan.entries) {
      if (!allowed.has(entry.slug)) continue;
      try {
        const doc = await repository.get(bySlug.get(entry.slug)._id);
        if (!doc || (doc.images || []).some(Boolean) || (doc.imageAssets || []).length) {
          stats.alreadyHasImage.push(entry.slug); logger.log(`[skip existing] ${entry.slug}`); continue;
        }
        const absolute = path.resolve(PROJECT_ROOT, entry.file);
        await imageService.upload(String(doc._id), doc.__v, [{ originalname: path.basename(entry.file), mimetype: entry.mime, buffer: fs.readFileSync(absolute) }]);
        stats.uploaded.push(entry.slug); logger.log(`[uploaded] ${entry.slug}`);
      } catch (err) {
        stats.failed.push({ slug: entry.slug, reason: String(err.code || err.message || err) });
        logger.error(`[failed] ${entry.slug}: ${err.code || err.message}`);
        // Never try to overwrite existing images; continue so the user gets a per-product report.
      }
    }
    return stats;
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const plan = validateManifest();
    if (args.includes('--check')) {
      console.log(JSON.stringify({ mode: 'OFFLINE_NO_DB', total: plan.total, mapped: plan.mapped, noLocalImage: plan.missing }, null, 2));
      return;
    }
    const apply = args.includes('--apply'), confirm = args.includes('--confirm=SYNC_SKINORA_IMAGES');
    const limitArg = args.find(x => x.startsWith('--limit='));
    const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : 0;
    if ((limitArg && (!Number.isInteger(limit) || limit < 1)) || (apply && !confirm)) throw new Error('USE_--apply_--confirm=SYNC_SKINORA_IMAGES (optional --limit=N)');
    const result = await synchronize({ apply, confirm, limit, plan });
    console.log('\nSYNC_SKINORA_IMAGES_RESULT\n' + JSON.stringify(result, null, 2));
    if (result.failed.length) process.exitCode = 1;
  })().catch(err => { console.error('IMAGE_SYNC_STOPPED:', err.message); process.exitCode = 1; });
}
module.exports = { signature, validateManifest, synchronize };
