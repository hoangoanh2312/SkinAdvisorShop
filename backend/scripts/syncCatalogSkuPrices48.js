/**
 * SKINORA: safe, idempotent, inventory-zero commercial draft SKU sync.
 * Offline validation: --check. Default is a read-only MongoDB dry-run.
 * Apply requires --apply --confirm=ADD_DRAFT_SKU_48. Never overrides an
 * existing SKU, image, stock, sale state or a manually entered price.
 * 14 unconfirmed sizes are intentionally blocked by default.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const manifestFile = path.join(__dirname, '../data/catalog48CommercialReview.json');
const current = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const allowedUnits = new Set(['ml', 'g']);

function validateManifest(rows) {
  if (!Array.isArray(rows) || rows.length !== 48) throw new Error('MANIFEST_NOT_48');
  const slugs = new Set(); const skus = new Set(); let confirmed = 0; let priced = 0;
  for (const r of rows) {
    if (!r.slug || slugs.has(r.slug) || !/^[-a-z0-9]+$/.test(r.slug)) throw new Error('INVALID_OR_DUPLICATE_SLUG');
    if (!r.sku || skus.has(r.sku) || !/^[A-Z0-9-]+$/.test(r.sku)) throw new Error('INVALID_OR_DUPLICATE_SKU');
    if (!/^\d+$/.test(r.size) || !allowedUnits.has(r.unit) || !['CONFIRMED','REVIEW_SIZE'].includes(r.sizeStatus)) throw new Error(`INVALID_SIZE:${r.slug}`);
    if (r.stock !== 0 || r.draftOnly !== true) throw new Error(`UNSAFE_STOCK_OR_STATE:${r.slug}`);
    if (r.listPriceVND !== null && (!Number.isInteger(r.listPriceVND) || r.listPriceVND <= 0 || !r.priceSourceUrl?.startsWith('https://') || r.priceStatus !== 'SOURCE_QUOTED_RECHECK_BEFORE_APPLY')) throw new Error(`UNVERIFIED_PRICE:${r.slug}`);
    if (r.listPriceVND === null && r.priceStatus !== 'PENDING_VND_PRICE') throw new Error(`INCORRECT_PRICE_STATUS:${r.slug}`);
    slugs.add(r.slug); skus.add(r.sku);
    if (r.sizeStatus === 'CONFIRMED') confirmed++;
    if (r.listPriceVND !== null) priced++;
  }
  if (rows.filter(r=>r.existingProduct).length !== 1 || !rows[0].existingProduct) throw new Error('EXISTING_COSRX_MARKER_INVALID');
  return {total: 48, verifiedSize: confirmed, needsSizeReview: 48-confirmed, vndSourceQuoted:priced, remainingVndPriceReview:48-priced};
}

function plannedRows(rows, opts={}) {
  return rows.filter(r=>!r.existingProduct && (r.sizeStatus==='CONFIRMED' || opts.includeReviewSizes));
}
function variantDraft(row, productId) {
  return {
    product:productId, name:`${row.size}${row.unit}`,sku:row.sku,
    size:String(row.size),unit:row.unit,
    price:row.listPriceVND === null ? 0 : row.listPriceVND,
    salePrice:null,stock:0,isActive:false,image:''
  };
}

async function syncDrafts({apply=false,includeReviewSizes=false,rows=current}={}) {
  const verified = validateManifest(rows);
  require('dotenv').config({quiet:true});
  const mongoose=require('mongoose');
  const Product=require('../models/Product'); const Variant=require('../models/Variant');
  const {businessUriFrom,businessDatabaseName}=require('../config/businessDatabase');
  const db=businessDatabaseName(process.env);
  if (db!=='skinora_prod') throw new Error(`REFUSED_DATABASE:${db}`);
  const uri=businessUriFrom(process.env.MONGO_URI,db);
  if (!uri) throw new Error('MISSING_MONGODB_URI');
  await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:12000});
  try {
    if (mongoose.connection.name!==db) throw new Error('DATABASE_CONNECTION_MISMATCH');
    const candidates=plannedRows(rows,{includeReviewSizes});
    const products=await Product.find({slug:{$in:candidates.map(r=>r.slug)}}).select('_id name slug isActive basePrice').lean();
    const bySlug=new Map(products.map(p=>[p.slug,p]));
    const variants=await Variant.find({product:{$in:products.map(p=>p._id)}}).select('product sku').lean();
    const existingProductIds=new Set(variants.map(v=>String(v.product)));
    const existingSkus=new Set(variants.map(v=>v.sku));
    const planned=[];const skipped=[];
    for (const r of candidates) {
      const p=bySlug.get(r.slug);
      if (!p) {skipped.push({slug:r.slug,reason:'PRODUCT_NOT_FOUND'});continue;}
      if (p.isActive) {skipped.push({slug:r.slug,reason:'ACTIVE_PRODUCT_NOT_TOUCHED'});continue;}
      // Never add another variant to products already manually configured.
      if (existingProductIds.has(String(p._id)) || existingSkus.has(r.sku)) {skipped.push({slug:r.slug,reason:'EXISTING_SKU_OR_VARIANT_PRESERVED'});continue;}
      if (p.basePrice !== 0 && r.listPriceVND !== null && p.basePrice !== r.listPriceVND) {
        skipped.push({slug:r.slug,reason:'MANUAL_PRODUCT_PRICE_PRESERVED'});continue;
      }
      planned.push({slug:r.slug,sku:r.sku,size:`${r.size}${r.unit}`,listPriceVND:r.listPriceVND||null,productId:String(p._id)});
    }
    const preview={database:db,mode:apply?'APPLY':'DRY_RUN',...verified,
      eligibleNewDraftSkus:candidates.length,plannedToCreate:planned.length,
      skipped,reviewSizesNotApplied:rows.filter(r=>r.sizeStatus==='REVIEW_SIZE'&&!r.existingProduct&&!includeReviewSizes).map(r=>r.slug),
      planned,guardrails:'No updates to existing SKU, images, inventory, active products, or manually set prices'};
    if (!apply) return preview;
    let created=0,productPricesUpdated=0;
    for (const plan of planned) {
      const row=rows.find(r=>r.slug===plan.slug);
      const p=bySlug.get(plan.slug);
      if (await Variant.exists({$or:[{product:p._id},{sku:row.sku}]})) continue;
      await Variant.create(variantDraft(row,p._id));
      created++;
      // Only record a source-backed VND list price on an untouched draft.
      if (row.listPriceVND!==null && p.basePrice===0) {
        const x=await Product.updateOne({_id:p._id,isActive:false,basePrice:0},{$set:{basePrice:row.listPriceVND}});
        productPricesUpdated+=x.modifiedCount || 0;
      }
    }
    return {...preview,created,productPricesUpdated,notes:'Every new SKU is INACTIVE and stock=0. Prices are source-quoted VND LIST prices, NOT guaranteed current retail offers. Check before sales.'};
  } finally {await mongoose.disconnect();}
}

if (require.main===module) {
  const args=process.argv.slice(2); const check=args.includes('--check');const apply=args.includes('--apply');
  const includeReviewSizes=args.includes('--include-unverified-sizes');
  if (check) {
    try {console.log(JSON.stringify({status:'OFFLINE_PASS',...validateManifest(current),createdDatabaseWrites:0},null,2));}
    catch(e) {console.error(e.message);process.exitCode=1;}
  } else if (apply && !args.includes('--confirm=ADD_DRAFT_SKU_48')) {
    console.error('REFUSED: --apply requires --confirm=ADD_DRAFT_SKU_48. Preview first.');process.exitCode=1;
  } else if (includeReviewSizes && !(apply && args.includes('--confirm=ALLOW_UNVERIFIED_SIZE'))) {
    console.error('REFUSED: sizes awaiting packaging review require --confirm=ALLOW_UNVERIFIED_SIZE in addition to --apply.');process.exitCode=1;
  } else {
    syncDrafts({apply,includeReviewSizes}).then(x=>console.log(JSON.stringify(x,null,2)))
      .catch(e=>{console.error('SKINORA_SKU_SYNC_STOPPED:',e.message);process.exitCode=1;});
  }
}
module.exports={validateManifest,plannedRows,variantDraft,syncDrafts};
