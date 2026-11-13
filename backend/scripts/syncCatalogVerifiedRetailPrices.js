/**
 * SKINORA source-quoted price review, 2026-10-23.
 * Default mode: read-only DRY_RUN. To write: --apply --confirm=SET_VERIFIED_DRAFT_PRICES
 * Strictly price fields Product.basePrice and Variant.price are changed, transactionally.
 * No SKU, image, stock, discounts, isActive, or customer records are touched.
 * Prices are quoted retail prices on external websites, not guaranteed present-day offers.
 */
'use strict';
const quotes=require('../data/catalog48VerifiedRetailQuotes20261023.json');
const CONFIRM='--confirm=SET_VERIFIED_DRAFT_PRICES';
const eligible=quotes.filter(r=>r.status==='VERIFIED_SOURCE_QUOTE');
function validate(records=quotes) {
  if(records.length!==48) throw Error('EXPECTED_48_ROWS');
  const slugs=new Set(), skus=new Set();let verified=0,preserved=0,pending=0;
  for(const r of records){
    if(!r.slug || slugs.has(r.slug) || !r.sku || skus.has(r.sku))throw Error(`DUPLICATE_OR_EMPTY:${r.slug}`);
    if(!/^\d+(ml|g)$/.test(r.size) || !r.sku.endsWith('-'+r.size.toUpperCase()))throw Error(`SKU_SIZE_MISMATCH:${r.slug}`);
    if(r.checkedOn!=='2026-10-23')throw Error(`DATE_INVALID:${r.slug}`);
    if(r.status==='VERIFIED_SOURCE_QUOTE'){
      if(!Number.isSafeInteger(r.priceVND)||r.priceVND<=0||!/^https:\/\//.test(r.sourceUrl)||!r.sourceName||!r.note)throw Error(`PRICE_SOURCE_INVALID:${r.slug}`);
      verified++;
    } else if(r.status==='EXISTING_PRICE_PRESERVE'){
      if(r.priceVND!==null||!Number.isSafeInteger(r.existingBaselinePriceVND)||r.existingBaselinePriceVND<=0)throw Error(`PRIOR_PRICE_INVALID:${r.slug}`);
      preserved++;
    } else if(r.status==='NEED_VERIFICATION'){
      if(r.priceVND!==null||!r.note)throw Error(`PENDING_PRICE_INVALID:${r.slug}`);
      pending++;
    } else throw Error(`UNKNOWN_STATUS:${r.slug}`);
    slugs.add(r.slug);skus.add(r.sku);
  }
  if(verified!==35||preserved!==7||pending!==6)throw Error(`UNEXPECTED_STATUS_COUNTS:${verified}/${preserved}/${pending}`);
  return {total:48,newSourceQuotes:verified,priorPricesPreserved:preserved,needsRecheck:pending,dateOfSourceCheck:'2026-10-23'};
}
function isDraftEligible(p,variantList,r){
  if(!p)return 'PRODUCT_NOT_FOUND';
  if(p.isActive!==false)return 'PRODUCT_ACTIVE_PRESERVED';
  if(p.basePrice!==0||p.salePrice!=null)return 'PRODUCT_PRICE_ALREADY_SET_PRESERVED';
  if(variantList.length!==1)return 'EXPECTED_EXACTLY_ONE_VARIANT';
  const v=variantList[0];
  if(v.sku!==r.sku)return 'SKU_NOT_MATCHED';
  if(`${v.size}${v.unit}`.toLowerCase()!==r.size.toLowerCase())return 'SIZE_NOT_MATCHED';
  if(v.isActive!==false||v.stock!==0)return 'STOCK_OR_STATUS_NOT_DRAFT';
  if(v.price!==0||v.salePrice!=null)return 'VARIANT_PRICE_ALREADY_SET_PRESERVED';
  return null;
}
function previewChanges(records,products,variants) {
  const bySlug=new Map(products.map(p=>[p.slug,p]));
  const byProduct=new Map();
  for(const v of variants){const id=String(v.product);const arr=byProduct.get(id)||[];arr.push(v);byProduct.set(id,arr);}
  const planned=[],skipped=[];
  for(const r of records.filter(r=>r.status==='VERIFIED_SOURCE_QUOTE')){
    const p=bySlug.get(r.slug);const list=p?(byProduct.get(String(p._id))||[]):[];
    const why=isDraftEligible(p,list,r);
    if(why){skipped.push({slug:r.slug,reason:why});continue;}
    planned.push({slug:r.slug,productId:String(p._id),variantId:String(list[0]._id),sku:r.sku,size:r.size,priceVND:r.priceVND,sourceUrl:r.sourceUrl});
  }
  return {planned,skipped};
}
async function main({apply=false}={}){
  const counts=validate();
  require('dotenv').config({quiet:true});
  const mongoose=require('mongoose');
  const Product=require('../models/Product'),Variant=require('../models/Variant');
  const {businessDatabaseName,businessUriFrom}=require('../config/businessDatabase');
  const db=businessDatabaseName(process.env);
  if(db!=='skinora_prod')throw Error(`REFUSED_DATABASE:${db}`);
  const uri=businessUriFrom(process.env.MONGO_URI,db);
  if(!uri)throw Error('MISSING_MONGO_URI');
  await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:15000});
  try {
    if(mongoose.connection.name!==db)throw Error('DATABASE_CONNECTION_MISMATCH');
    const products=await Product.find({slug:{$in:eligible.map(r=>r.slug)}}).select('_id slug isActive basePrice salePrice').lean();
    const variants=await Variant.find({product:{$in:products.map(p=>p._id)}}).select('_id product sku size unit isActive price salePrice stock').lean();
    const {planned,skipped}=previewChanges(quotes,products,variants);
    const out={database:db,mode:apply?'APPLY':'DRY_RUN',...counts,plannedToUpdate:planned.length,skipped,planned,
      guardrails:'Product.basePrice and Variant.price ONLY; inactive zero-price zero-stock exact SKU; atomic per SKU; no image/SKU/stock/isActive/discount edits'};
    if(!apply)return out;
    let updated=0,skippedDuringApply=0;
    for(const item of planned){
      const session=await mongoose.startSession();
      try {
        await session.withTransaction(async()=>{
          // Read/re-evaluate inside transaction so changes made since preview are protected.
          const p=await Product.findById(item.productId).select('_id slug isActive basePrice salePrice').session(session).lean();
          const list=await Variant.find({product:item.productId}).select('_id product sku size unit isActive price salePrice stock').session(session).lean();
          const quote=quotes.find(r=>r.slug===item.slug);
          if(isDraftEligible(p,list,quote)) {skippedDuringApply++;return;}
          if(String(list[0]._id)!==item.variantId){skippedDuringApply++;return;}
          const vg=await Variant.updateOne({_id:list[0]._id,product:p._id,sku:item.sku,price:0,stock:0,isActive:false,salePrice:null},{$set:{price:item.priceVND}},{session});
          if(vg.modifiedCount!==1)throw Error(`CONCURRENT_VARIANT_EDIT:${item.sku}`);
          const pg=await Product.updateOne({_id:p._id,isActive:false,basePrice:0,salePrice:null},{$set:{basePrice:item.priceVND}},{session});
          if(pg.modifiedCount!==1)throw Error(`CONCURRENT_PRODUCT_EDIT:${item.slug}`);
          updated++;
        });
      }finally{await session.endSession();}
    }
    return {...out,updated,skippedDuringApply,notes:'Prices are historical point-in-time retailer quotations. Stock and activation remain unchanged; AI will not recommend drafts.'};
  }finally{await mongoose.disconnect();}
}
if(require.main===module){
 const args=process.argv.slice(2);const apply=args.includes('--apply');
 if(apply&&!args.includes(CONFIRM)){console.error(`REFUSED: ${CONFIRM} required`);process.exitCode=1;}
 else if(args.includes('--check')){try{console.log('SKINORA_VERIFIED_PRICES_OFFLINE_PASS:',JSON.stringify(validate()));}catch(e){console.error(e.message);process.exitCode=1;}}
 else main({apply}).then(data=>console.log(JSON.stringify(data,null,2))).catch(e=>{console.error('SKINORA_VERIFIED_PRICE_SYNC_STOPPED:',e.message);process.exitCode=1;});
}
module.exports={validate,isDraftEligible,previewChanges,main};
