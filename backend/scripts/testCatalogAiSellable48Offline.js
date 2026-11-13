'use strict';
const assert=require('node:assert/strict');
const Module=require('node:module');
const original=Module._load;
const live=[
  {_id:'draft',name:'Draft',brand:'SKINORA',slug:'draft',isActive:false,skinTypes:['combination'],skinConcerns:['dryness'],ingredients:[],images:[]},
  {_id:'badprice',name:'Free price',brand:'SKINORA',slug:'badprice',isActive:true,skinTypes:['combination'],skinConcerns:['dryness'],ingredients:[],images:[]},
  {_id:'good',name:'Good serum',brand:'SKINORA',slug:'good',isActive:true,skinTypes:['combination'],skinConcerns:['dryness'],ingredients:[],images:['image.jpg'],basePrice:215000},
  {_id:'out',name:'Out of stock',brand:'SKINORA',slug:'out',isActive:true,skinTypes:['combination'],skinConcerns:['dryness'],ingredients:[],images:[]}
];
const inventory=[
  {_id:'sku0',product:'draft',stock:4,price:100000,isActive:true},
  {_id:'sku1',product:'badprice',stock:4,price:0,isActive:true},
  {_id:'sku2',product:'good',stock:0,price:215000,isActive:true},
  {_id:'sku3',product:'out',stock:2,price:215000,isActive:false},
  {_id:'sku4',product:'good',stock:3,price:215000,isActive:true}
];
let returnedStockZero=false;
const fakeVariant={find(query){
 assert.equal(query.stock.$gt,0);assert.equal(query.price.$gt,0);assert.equal(query.isActive,true);
 let variants=inventory.filter(x=>x.stock>0&&x.price>0&&x.isActive);
 if(returnedStockZero) variants=[];
 return {sort(){return this},lean:async()=>variants};
}};
const fakeProduct={find(query){
 const ids=new Set(query._id.$in.map(String));
 const products=live.filter(x=>x.isActive&&ids.has(x._id));
 return {sort(){return this},lean:async()=>products};
}};
Module._load=function(request,parent,isMain){
 if(request.endsWith('/models/Product') || request==='../../models/Product')return fakeProduct;
 if(request.endsWith('/models/Variant') || request==='../../models/Variant')return fakeVariant;
 return original.apply(this,arguments);
};
let advisor, skin;
try {advisor=require('../services/advisorProductService');skin=require('../services/skinAnalysis/recommendationService');}
finally{Module._load=original;}
(async()=>{
 let candidates=await advisor.getCandidateProducts({skinType:'combination',skinConcerns:['dryness']});
 assert.equal(candidates.length,1);assert.equal(candidates[0].slug,'good');
 assert.equal(candidates[0].variants.length,1);assert.equal(candidates[0].variants[0].stock,3);
 let rec=await skin.recommendProducts({skinType:'combination',skinTypeLabel:'Da hỗn hợp',concerns:[{key:'dehydration'}],recommendedIngredients:[]});
 assert.equal(rec.length,1);assert.equal(rec[0].product.id,'good');
 returnedStockZero=true;
 candidates=await advisor.getCandidateProducts({skinType:'combination',skinConcerns:['dryness']});
 rec=await skin.recommendProducts({skinType:'combination',skinTypeLabel:'Da hỗn hợp',concerns:[],recommendedIngredients:[]});
 assert.equal(candidates.length,0);assert.equal(rec.length,0);
 console.log('SKINORA_AI_SELLABLE_OFFLINE_PASS: in-stock positive-price active only; no suggestions for 48 drafts; user data untouched');
})().catch(e=>{console.error(e);process.exitCode=1;});
