/** Read-only audit. Never writes to MongoDB or changes sellability. */
"use strict";
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const quotes = require("../data/catalog48VerifiedRetailQuotes20261023.json");
const { businessDatabaseName, businessUriFrom } = require("../config/businessDatabase");

async function run() {
  const database = businessDatabaseName(process.env);
  if (database !== "skinora_prod") throw new Error(`REFUSED_DATABASE:${database}`);
  const uri = businessUriFrom(process.env.MONGO_URI, database);
  if (!uri) throw new Error("MISSING_MONGO_URI");
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  try {
    if (mongoose.connection.name !== database) throw new Error("DATABASE_CONNECTION_MISMATCH");
    const products = await Product.find({ slug: { $in: quotes.map(item => item.slug) } })
      .select("_id name slug brand category images imageAssets basePrice salePrice isActive").lean();
    const variants = await Variant.find({ product: { $in: products.map(item => item._id) } })
      .select("_id product sku size unit price salePrice stock isActive").lean();
    const bySlug = new Map(products.map(item => [item.slug, item]));
    const byProduct = new Map();
    for (const variant of variants) {
      const id = String(variant.product);
      byProduct.set(id, [...(byProduct.get(id) || []), variant]);
    }
    const rows = quotes.map(quote => {
      const product = bySlug.get(quote.slug);
      const linked = product ? byProduct.get(String(product._id)) || [] : [];
      const variant = linked.find(item => item.sku === quote.sku);
      return {
        name: quote.name, slug: quote.slug, sku: quote.sku, expectedSize: quote.size,
        productFound: Boolean(product), variantFound: Boolean(variant), variantsOnProduct: linked.length,
        productPrice: product?.basePrice ?? null, variantPrice: variant?.price ?? null,
        sizeMatches: variant ? `${variant.size}${variant.unit}`.replace(/\s+/g, "").toLowerCase() === String(quote.size).replace(/\s+/g, "").toLowerCase() : false,
        priceMatches: Boolean(product && variant && product.basePrice === variant.price),
        productActive: product?.isActive ?? null, variantActive: variant?.isActive ?? null, stock: variant?.stock ?? null,
        imageCount: product?.images?.length ?? 0,
        imageAssetsConsistent: product ? product.imageAssets.every(asset => product.images.includes(asset.url)) : false,
      };
    });
    const skuCounts = new Map();
    for (const variant of variants) skuCounts.set(variant.sku, (skuCounts.get(variant.sku) || 0) + 1);
    return {
      database, mode: "READ_ONLY", productCount: products.length, variantCount: variants.length,
      pricedSkuCount: rows.filter(item => item.variantPrice > 0).length,
      unpriced: rows.filter(item => item.variantPrice === 0 || item.variantPrice == null).map(({ name, sku, expectedSize, productPrice, variantPrice }) => ({ name, sku, expectedSize, productPrice, variantPrice })),
      priceMismatches: rows.filter(item => !item.priceMatches).map(({ sku, productPrice, variantPrice }) => ({ sku, productPrice, variantPrice })),
      missingOrMultipleVariants: rows.filter(item => !item.productFound || !item.variantFound || item.variantsOnProduct !== 1).map(({ sku, productFound, variantFound, variantsOnProduct }) => ({ sku, productFound, variantFound, variantsOnProduct })),
      sizeMismatches: rows.filter(item => !item.sizeMatches).map(({ sku, expectedSize }) => ({ sku, expectedSize })),
      duplicateSkus: [...skuCounts].filter(([, count]) => count > 1).map(([sku, count]) => ({ sku, count })),
      productsWithoutImages: rows.filter(item => item.imageCount === 0).map(item => item.sku),
      imageAssetMismatches: rows.filter(item => !item.imageAssetsConsistent).map(item => item.sku),
      activeProducts: rows.filter(item => item.productActive === true).length,
      activeVariants: rows.filter(item => item.variantActive === true).length,
      stockedVariants: rows.filter(item => item.stock > 0).length,
    };
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(`CATALOG_AUDIT_STOPPED:${error.message}`); process.exitCode = 1; });
module.exports = { run };
