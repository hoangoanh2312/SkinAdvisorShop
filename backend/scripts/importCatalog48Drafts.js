/**
 * SKINORA catalog draft importer for reviewed product names.
 * Default: dry-run; --check is entirely offline; --apply requires explicit confirmation.
 * Insertion only: never updates preexisting products, prices, images, variants or stock.
 */
const path = require('path');
const fs = require('fs');
const manifestPath = path.join(__dirname, '../data/catalog48Drafts.json');
const CONFIRM = '--confirm=IMPORT_47_DRAFTS';
const kinds = new Set(['normal', 'dry', 'oily', 'combination', 'sensitive']);
const concerns = new Set(['acne', 'dryness', 'sensitivity', 'aging', 'pigmentation', 'pores', 'dullness', 'oiliness']);
const CAT = new Set(['serum-tinh-chat','sua-rua-mat','toner-nuoc-can-bang','kem-duong','kem-chong-nang','tay-trang','mat-na','tay-te-bao-chet','cham-soc-mun','cham-soc-phuc-hoi']);
const COUNTS = {'COSRX':5,'CeraVe':5,'La Roche-Posay':5,'Bioderma':5,'Hada Labo':5,'Anessa':4,'SKIN1004':5,"Paula's Choice":4,'The Ordinary':5,'Cocoon':5};

function validate(manifest) {
  if (!Array.isArray(manifest) || manifest.length !== 48) throw new Error('EXPECTED_48_PRODUCTS');
  const slugs = new Set(); const counts = {};
  for (const row of manifest) {
    if (!row || !row.brand || !COUNTS[row.brand] || !row.name || !row.slug ||
      !/^[a-z0-9-]+$/.test(row.slug) || !CAT.has(row.categorySlug) ||
      !Array.isArray(row.skinTypes) || !row.skinTypes.every(x => kinds.has(x)) ||
      !Array.isArray(row.skinConcerns) || !row.skinConcerns.every(x => concerns.has(x)) ||
      !Array.isArray(row.keyIngredients) || !row.keyIngredients.every(x => typeof x === 'string') ||
      !/^https:\/\//.test(row.sourceUrl) || row.reviewStatus !== 'CHO_XAC_MINH_THONG_TIN' ||
      row.suggestedPrice !== null || row.suggestedStock !== 0 || row.imageUrl !== '') {
      throw new Error(`CATALOG_ITEM_INVALID:${row?.slug || '<empty>'}`);
    }
    if (slugs.has(row.slug)) throw new Error(`DUPLICATE_SLUG:${row.slug}`);
    slugs.add(row.slug); counts[row.brand] = (counts[row.brand] || 0) + 1;
  }
  if (Object.keys(COUNTS).some(b => counts[b] !== COUNTS[b])) throw new Error('BRAND_DISTRIBUTION_INVALID');
  const original = manifest.filter(p => p.isExistingProduct);
  if (original.length !== 1 || original[0].slug !== 'cosrx-advanced-snail-96-mucin-power-essence') {
    throw new Error('EXPECTED_EXISTING_COSRX_MARKER');
  }
  return { total: manifest.length, newCandidates: manifest.length - original.length, brands: counts };
}

function draftDocument(row, brand, category) {
  if (!brand?._id || !category?._id) throw new Error(`MISSING_TAXONOMY:${row.slug}`);
  return {
    name: row.name, slug: row.slug, brand: row.brand, brandRef: brand._id, category: category._id,
    shortDescription: 'Bản nháp – chờ kiểm chứng giá, thông tin sản phẩm và quyền sử dụng ảnh.',
    description: `${row.briefDescription}\nNguồn tham khảo của thương hiệu: ${row.sourceUrl}\n` +
      'Chưa có ảnh được cấp phép, giá VNĐ và tồn kho thực. Người quản trị cần kiểm tra lại trước khi mở bán.',
    skinTypes: [...row.skinTypes], skinConcerns: [...row.skinConcerns],
    keyIngredients: [...row.keyIngredients], ingredients: [],
    images: [], imageAssets: [], basePrice: 0, salePrice: null,
    isActive: false, isFeatured: false,
  };
}

async function importDrafts({ apply = false, manifest = require(manifestPath), env = process.env } = {}) {
  validate(manifest);
  if (apply && !env.SKINORA_CATALOG_48_CONFIRM) throw new Error('EXPLICIT_CONFIRM_REQUIRED');
  require('dotenv').config({ quiet: true });
  const mongoose = require('mongoose');
  const Product = require('../models/Product');
  const Brand = require('../models/Brand');
  const Category = require('../models/Category');
  const { businessUriFrom, businessDatabaseName } = require('../config/businessDatabase');
  const name = businessDatabaseName(process.env);
  if (name !== 'skinora_prod') throw new Error(`REFUSE_NON_SKINORA_PRODUCTION:${name}`);
  const target = businessUriFrom(process.env.MONGO_URI, name);
  await mongoose.connect(target, { autoIndex: false, serverSelectionTimeoutMS: 12000 });
  try {
    if (mongoose.connection.name !== 'skinora_prod') throw new Error('DATABASE_MISMATCH');
    const brands = await Brand.find({}).lean();
    const cats = await Category.find({}).lean();
    const brandMap = new Map(brands.map(b => [b.name, b]));
    const catMap = new Map(cats.map(c => [c.slug, c]));
    const unavailable = manifest.filter(x => !brandMap.has(x.brand) || !catMap.has(x.categorySlug));
    if (unavailable.length) throw new Error(`MISSING_BRANDS_OR_CATEGORIES:${unavailable.map(x=>x.brand+'/'+x.categorySlug).join(',')}`);
    const existing = await Product.find({}).select('brand name slug').lean();
    const slugSet = new Set(existing.map(p => p.slug));
    const keySet = new Set(existing.map(p => `${p.brand.toLocaleLowerCase('en-US')}|${p.name.toLocaleLowerCase('en-US')}`));
    const rows = manifest.filter(row => !row.isExistingProduct && !slugSet.has(row.slug) && !keySet.has(`${row.brand.toLocaleLowerCase('en-US')}|${row.name.toLocaleLowerCase('en-US')}`));
    const preview = { database: mongoose.connection.name, mode: apply ? 'APPLY_ADD_ONLY' : 'DRY_RUN', catalogSize: manifest.length,
      existingCatalogSize: existing.length, existingMatches: manifest.filter(row => slugSet.has(row.slug) || keySet.has(`${row.brand.toLocaleLowerCase('en-US')}|${row.name.toLocaleLowerCase('en-US')}`)).length,
      plannedToCreate: rows.length, preexistingCOSRXSkipped: true, noExistingProductsUpdated: true, noVariantsOrStockCreated: true,
      allNewProductsAreDrafts: true, plannedNames: rows.map(r => r.name) };
    if (!apply) return preview;
    let created = 0;
    for (const row of rows) {
      try {
        await Product.create(draftDocument(row, brandMap.get(row.brand), catMap.get(row.categorySlug)));
        created++;
      } catch (error) {
        if (error?.code === 11000) continue; // Re-run safe if a duplicate was concurrently added.
        throw new Error(`PARTIAL_IMPORT_CREATED_${created}_DRAFTS; FAILED_${row.slug}: ${error.message}`);
      }
    }
    return { ...preview, created, message: 'Đã tạo bản nháp. Chưa mở bán sản phẩm mới.', note: 'Nhập lại cùng lệnh không tạo trùng.' };
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) {
  const options = process.argv.slice(2);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (options.includes('--check')) {
    try { console.log(JSON.stringify({status:'CATALOG_48_OFFLINE_VALID',...validate(manifest)},null,2)); }
    catch (error) { console.error(error.message); process.exitCode=1; }
  } else {
    const apply = options.includes('--apply');
    if (apply && !options.includes(CONFIRM)) {
      console.error('BỊ CHẶN: muốn nhập 47 bản nháp, dùng cả --apply và --confirm=IMPORT_47_DRAFTS.');
      process.exitCode = 1;
    } else {
      if (apply) process.env.SKINORA_CATALOG_48_CONFIRM = '1';
      importDrafts({apply,manifest}).then(result=>console.log(JSON.stringify(result,null,2)))
        .catch(error=>{console.error(`Catalog import stopped: ${error.message}`);process.exitCode=1});
    }
  }
}
module.exports = {validate,draftDocument,importDrafts};
