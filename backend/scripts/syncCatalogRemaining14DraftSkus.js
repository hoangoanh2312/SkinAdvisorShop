/**
 * 14 remaining SKINORA SKUs. Read-only preview by default.
 * Only CREATE inactive, zero-price, zero-stock variants.
 * Never edits existing products, variants, prices, stock, images or status.
 * On production: --apply --confirm=CREATE_14_ZERO_STOCK_DRAFT_SKUS.
 */
'use strict';
const path = require('node:path');
const rows = require('../data/catalog14SizeVerifiedDraft.json');
const expectedCommercial = require('../data/catalog48CommercialReview.json');
const ACCEPT = '--confirm=CREATE_14_ZERO_STOCK_DRAFT_SKUS';
const imageOverrides = new Map([
  ['cerave-hydrating-facial-cleanser', '355ml'],
  ['bioderma-sensibio-gel-moussant', '500ml'],
  ['bioderma-sebium-gel-moussant', '500ml'],
  ['bioderma-atoderm-intensive-baume', '500ml'],
]);

function validate(rowsToCheck = rows, master = expectedCommercial) {
  if (!Array.isArray(rowsToCheck) || rowsToCheck.length !== 14) throw Error('EXPECTED_EXACTLY_14');
  if (!Array.isArray(master) || master.length !== 48) throw Error('MASTER_CATALOG_INVALID');
  const review = new Map(master.filter(r => r.sizeStatus === 'REVIEW_SIZE').map(r => [r.slug, r]));
  if (review.size !== 14) throw Error('MASTER_REVIEW_COUNT_MISMATCH');
  const slugs = new Set(), skus = new Set();
  for (const r of rowsToCheck) {
    const m = review.get(r.slug);
    if (!m || !r.slug || slugs.has(r.slug) || !/^[a-z0-9-]+$/.test(r.slug)) throw Error(`INVALID_SLUG:${r.slug}`);
    if (!r.sku || skus.has(r.sku) || !/^[A-Z0-9-]+$/.test(r.sku)) throw Error(`INVALID_SKU:${r.sku}`);
    if (imageOverrides.has(r.slug)) {
      const selected = `${r.size}${r.unit}`;
      const expectedSku = m.sku.replace(new RegExp(`-${m.size}${m.unit.toUpperCase()}$`), `-${r.size}${r.unit.toUpperCase()}`);
      if (selected !== imageOverrides.get(r.slug) || r.sku !== expectedSku || !r.imageSizeMatched || !r.imageEvidence?.startsWith('anh/'))
        throw Error(`IMAGE_VERIFIED_SIZE_MISMATCH:${r.slug}`);
    } else if (r.size !== m.size || r.unit !== m.unit || r.sku !== m.sku) {
      throw Error(`SIZE_OR_SKU_MISMATCH:${r.slug}`);
    }
    if (!/^\d+$/.test(r.size) || !['ml', 'g'].includes(r.unit)) throw Error(`INVALID_SIZE:${r.slug}`);
    if (!r.sourceUrl?.startsWith('https://') || !r.sourceNote || r.reviewRegionalPackaging !== true) throw Error(`SIZE_SOURCE_MISSING:${r.slug}`);
    if (r.priceVND !== 0 || r.stock !== 0 || r.isActive !== false) throw Error(`UNSAFE_DRAFT:${r.slug}`);
    slugs.add(r.slug); skus.add(r.sku);
  }
  if (slugs.size !== review.size) throw Error('MISSING_REVIEW_SKU');
  return {sourceCatalog:48, toComplete:14, verifiedForCatalogSize:14, defaultPrice:0, defaultStock:0, active:false};
}

function draftVariant(row, productId) {
  return {product:productId,name:`${row.size}${row.unit}`,sku:row.sku,
    size:row.size,unit:row.unit,price:0,salePrice:null,stock:0,isActive:false,image:''};
}
function shouldCreate(product, existingVariants = []) {
  if (!product) return 'PRODUCT_NOT_FOUND';
  if (product.isActive) return 'ACTIVE_PRODUCT_NOT_TOUCHED';
  if (existingVariants.length) return 'EXISTING_VARIANT_PRESERVED';
  return null;
}

async function sync({apply=false}={}) {
  const verification=validate();
  require('dotenv').config({quiet:true});
  const mongoose=require('mongoose');
  const Product=require('../models/Product');
  const Variant=require('../models/Variant');
  const {businessDatabaseName,businessUriFrom}=require('../config/businessDatabase');
  const database=businessDatabaseName(process.env);
  if (database!=='skinora_prod') throw Error(`REFUSED_DATABASE:${database}`);
  const uri=businessUriFrom(process.env.MONGO_URI,database);
  if (!uri) throw Error('MISSING_MONGO_URI');
  await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:12000});
  try {
    if (mongoose.connection.name!==database) throw Error('DATABASE_CONNECTION_MISMATCH');
    const products=await Product.find({slug:{$in:rows.map(r=>r.slug)}}).select('_id slug isActive basePrice').lean();
    const productBySlug=new Map(products.map(p=>[p.slug,p]));
    const variants=await Variant.find({$or:[
      {product:{$in:products.map(p=>p._id)}},
      {sku:{$in:rows.map(r=>r.sku)}}
    ]}).select('product sku').lean();
    const variantByProduct=new Map();
    for (const v of variants) {
      const key=String(v.product);
      const list=variantByProduct.get(key)||[];list.push(v);variantByProduct.set(key,list);
    }
    const takenSkus=new Set(variants.map(v=>v.sku));
    const planned=[], skipped=[];
    for (const r of rows) {
      const p=productBySlug.get(r.slug);
      const reason=shouldCreate(p,p ? (variantByProduct.get(String(p._id))||[]) : []);
      if (reason) {skipped.push({slug:r.slug,reason});continue;}
      if (takenSkus.has(r.sku)) {skipped.push({slug:r.slug,reason:'SKU_ALREADY_EXISTS'});continue;}
      planned.push({slug:r.slug,sku:r.sku,size:`${r.size}${r.unit}`,productId:String(p._id)});
    }
    const summary={database,mode:apply?'APPLY':'DRY_RUN',...verification,
      plannedToCreate:planned.length,skipped,planned,
      guardrails:'ONLY CREATE inactive zero-price zero-stock SKU; NO product/price/image/inventory/status updates; skip already configured'};
    if (!apply) return summary;
    let created=0, skippedDuringApply=0;
    for (const p of planned) {
      const product=await Product.findById(p.productId).select('_id isActive').lean();
      if (!product || product.isActive) {skippedDuringApply++;continue;}
      // Re-check just before each write (protects manual updates since preview).
      if (await Variant.exists({$or:[{product:product._id},{sku:p.sku}]})) {skippedDuringApply++;continue;}
      const row=rows.find(r=>r.slug===p.slug);
      try { await Variant.create(draftVariant(row,product._id));created++; }
      catch (e) {if (e.code===11000) {skippedDuringApply++;continue;} throw e;}
    }
    return {...summary,created,skippedDuringApply,notes:'Draft SKUs only. Inventory 0, price 0, inactive. Check actual packaging and commercial prices before selling.'};
  } finally {await mongoose.disconnect();}
}
if (require.main===module) {
  const args=process.argv.slice(2);
  try {
    if (args.includes('--check')) {
      console.log('SKINORA_14_SKU_OFFLINE_PASS:',JSON.stringify(validate()));
    } else {
      const apply=args.includes('--apply');
      if (apply && !args.includes(ACCEPT)) throw Error(`REFUSED_CONFIRMATION: ${ACCEPT}`);
      sync({apply}).then(res=>console.log(JSON.stringify(res,null,2)))
        .catch(err=>{console.error('SKINORA_14_SKU_STOPPED:',err.message);process.exitCode=1;});
    }
  } catch(e) {console.error('SKINORA_14_SKU_STOPPED:',e.message);process.exitCode=1;}
}
module.exports={validate,draftVariant,shouldCreate,sync};
