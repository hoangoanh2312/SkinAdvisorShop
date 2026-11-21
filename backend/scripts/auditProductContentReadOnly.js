require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Product = require("../models/Product");

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const products = await Product.find({}).select("name description shortDescription ingredients usage warnings").lean();
    const present = value => typeof value === "string" && value.trim().length > 0;
    const count = predicate => products.filter(predicate).length;
    const sought = ["allantoin", "betaine", "panthenol", "snail secretion filtrate", "sodium hyaluronate"];
    console.log(JSON.stringify({ database: mongoose.connection.name, products: products.length,
      withDescription: count(p => present(p.description)), withShortDescription: count(p => present(p.shortDescription)),
      withIngredients: count(p => p.ingredients?.length > 0), withUsage: count(p => present(p.usage)),
      withWarnings: count(p => p.warnings?.length > 0),
      missingDescription: products.filter(p => !present(p.description) && !present(p.shortDescription)).map(p => p.name),
      ingredientCoverage: sought.map(name => ({ name, products: count(p => p.ingredients?.some(i => (i.normalizedName || i.name?.toLowerCase()) === name)), sourced: count(p => p.ingredients?.some(i => (i.normalizedName || i.name?.toLowerCase()) === name && present(i.sourceUrl))) })),
    }, null, 2));
  } finally { await mongoose.disconnect(); }
}
run().catch(error => { console.error(`READ_ONLY_CONTENT_AUDIT_FAILED: ${error.name}: ${error.message}`); process.exitCode = 1; });
