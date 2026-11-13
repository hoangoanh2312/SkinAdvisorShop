const assert=require('node:assert/strict');
const manifest=require('../data/catalog48CommercialReview.json');
const {validateManifest,plannedRows,variantDraft}=require('./syncCatalogSkuPrices48');
const result=validateManifest(manifest);
assert.equal(result.total,48);assert.equal(result.verifiedSize,34);assert.equal(result.vndSourceQuoted,7);
assert.equal(plannedRows(manifest).length,33);
assert.equal(plannedRows(manifest,{includeReviewSizes:true}).length,47);
const skus=plannedRows(manifest).map(r=>variantDraft(r,'sample-product-id'));
assert.equal(new Set(skus.map(x=>x.sku)).size,33);
for(const draft of skus){assert.equal(draft.stock,0);assert.equal(draft.isActive,false);assert.equal(draft.salePrice,null);assert.match(draft.name,/^\d+(g|ml)$/);assert(draft.price>=0)}
const withPrice=skus.filter(x=>x.price>0);assert.equal(withPrice.length,7);
const broken=structuredClone(manifest);broken[1].stock=3;assert.throws(()=>validateManifest(broken),/UNSAFE_STOCK_OR_STATE/);
const broken2=structuredClone(manifest);broken2[2].sku=broken2[1].sku;assert.throws(()=>validateManifest(broken2),/DUPLICATE_SKU/);
console.log(`SKINORA_SKU_PRICE_OFFLINE_PASS: 48 rows | 33 new verified-size draft SKUs | 14 require size review | 7 VND source quotes | zero stock / inactive | safe idempotent preview`);
