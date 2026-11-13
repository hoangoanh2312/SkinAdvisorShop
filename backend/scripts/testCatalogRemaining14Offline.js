/** Non-network safeguards for the 14 outstanding SKUs. */
'use strict';
const assert = require('node:assert/strict');
const {validate,draftVariant,shouldCreate}=require('./syncCatalogRemaining14DraftSkus');
const rows=require('../data/catalog14SizeVerifiedDraft.json');
assert.equal(validate().toComplete,14);
assert.equal(new Set(rows.map(r=>r.sku)).size,14);
for (const [slug, size] of [
  ['cerave-hydrating-facial-cleanser', '355ml'],
  ['bioderma-sensibio-gel-moussant', '500ml'],
  ['bioderma-sebium-gel-moussant', '500ml'],
  ['bioderma-atoderm-intensive-baume', '500ml'],
]) {const r=rows.find(x=>x.slug===slug);assert.equal(`${r.size}${r.unit}`,size);assert.equal(r.imageSizeMatched,true);}

for (const row of rows) {
  const v=draftVariant(row,'507f1f77bcf86cd799439011');
  assert.equal(v.price,0);assert.equal(v.stock,0);assert.equal(v.isActive,false);
  assert.equal(v.name,`${row.size}${row.unit}`);
  assert.equal(v.sku,row.sku);assert.equal(v.salePrice,null);
  assert.equal(shouldCreate(null,[]),'PRODUCT_NOT_FOUND');
  assert.equal(shouldCreate({isActive:true},[]),'ACTIVE_PRODUCT_NOT_TOUCHED');
  assert.equal(shouldCreate({isActive:false},[v]),'EXISTING_VARIANT_PRESERVED');
  assert.equal(shouldCreate({isActive:false},[]),null);
}
assert.throws(()=>validate(rows.map((r,i)=>i===0?{...r,stock:4}:r)),/UNSAFE_DRAFT/);
assert.throws(()=>validate(rows.map((r,i)=>i===0?{...r,sku:'WRONG'}:r)),/(SIZE_OR_SKU_MISMATCH|IMAGE_VERIFIED_SIZE_MISMATCH)/);
assert.throws(()=>validate(rows.map((r,i)=>i===0?{...r,sourceUrl:'http://example.test'}:r)),/SIZE_SOURCE_MISSING/);
assert.throws(()=>validate(rows.slice(1)),/EXPECTED_EXACTLY_14/);
console.log('SKINORA_14_SKU_TEST_PASS: 14 verified proposed variants, no stock/price/publish edits, duplicates protected');
