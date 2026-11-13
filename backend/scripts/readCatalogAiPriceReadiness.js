/** Read-only runtime validation of AI catalog eligibility; no Gemini call and no writes. */
'use strict';
async function run(){
 require('dotenv').config({quiet:true});
 const mongoose=require('mongoose');const Product=require('../models/Product'),Variant=require('../models/Variant');
 const {businessDatabaseName,businessUriFrom}=require('../config/businessDatabase');
 const db=businessDatabaseName(process.env);
 if(db!=='skinora_prod')throw Error(`REFUSED_DATABASE:${db}`);
 const uri=businessUriFrom(process.env.MONGO_URI,db);if(!uri)throw Error('MISSING_MONGO_URI');
 await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:15000});
 try {
  if(mongoose.connection.name!==db)throw Error('DATABASE_CONNECTION_MISMATCH');
  const slugs=require('../data/catalog48VerifiedRetailQuotes20261023.json').map(x=>x.slug);
  const products=await Product.find({slug:{$in:slugs}}).select('_id slug isActive basePrice').lean();
  const variants=await Variant.find({product:{$in:products.map(x=>x._id)}}).select('_id product sku price salePrice stock isActive').lean();
  const isLive=new Set(products.filter(x=>x.isActive===true).map(x=>String(x._id)));
  const eligible=variants.filter(x=>x.isActive===true&&x.stock>0&&x.price>0&&isLive.has(String(x.product)));
  const pricedDrafts=variants.filter(x=>x.price>0&&!(x.isActive&&x.stock>0&&isLive.has(String(x.product))));
  const summary={database:db,mode:'READ_ONLY',catalogProducts:products.length,variants:variants.length,
    pricedVariants:variants.filter(x=>x.price>0).length,pricedButNotSellable:pricedDrafts.length,
    sellableVariants:eligible.length,sellableProducts:new Set(eligible.map(x=>String(x.product))).size,
    recommendationExpected:eligible.length===0?'EMPTY_UNTIL_STOCK_AND_ACTIVATION':'CAN_TEST_REAL_GEMINI_AFTER_SKIN_PROFILE',
    note:'Positive price by itself DOES NOT make a product eligible. Stock>0, Variant.isActive and Product.isActive are also required. No inventory changes.'};
  return summary;
 }finally{await mongoose.disconnect();}
}
if(require.main===module)run().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error('SKINORA_AI_READINESS_STOPPED:',e.message);process.exitCode=1;});
module.exports={run};
