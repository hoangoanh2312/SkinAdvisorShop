"use strict";
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { buildFixture, SAMPLE_STOCK, SAMPLE_PRICE } = require("./setupDefenseDemo");
const { defenseDemoConfig } = require("./defenseDemoConfig");

(async () => {
  const source = mongoose.Types.ObjectId;
  const category = new source();
  const brand = new source();
  const product = new source();
  const variant = new source();
  const fixture = buildFixture({
    categories: [{ _id: category, name: "Tẩy trang", slug: "tay-trang" }],
    brands: [{ _id: brand, name: "Cocoon", slug: "cocoon" }],
    products: [{ _id: product, name: "Mỹ phẩm mẫu", slug: "my-pham-mau", brand: "Cocoon", brandRef: brand, category, images: [], skinTypes: ["dry"] }],
    variants: [{ _id: variant, product, name: "310ml", sku: "SAMPLE-310ML", price: null, stock: 0, isActive: false }]
  });
  assert.equal(fixture.products.length, 1);
  assert.equal(fixture.variants[0].price, SAMPLE_PRICE);
  assert.equal(fixture.variants[0].stock, SAMPLE_STOCK);
  assert.equal(fixture.variants[0].isActive, true);
  assert.equal(fixture.products[0].isActive, true);
  assert.equal(fixture.products[0].isCatalogVisible, true);
  assert.match(fixture.products[0].images[0], /^data:image\/svg\+xml;base64,/);
  assert.equal(fixture.sourceSkuCountWithNoPrice, 1);
  for (const [Model, items] of [[require("../models/Category"), fixture.categories],
    [require("../models/Brand"), fixture.brands], [require("../models/Product"), fixture.products],
    [require("../models/Variant"), fixture.variants]]) {
    for (const item of items) await new Model(item).validate();
  }
  const previous = { mongo: process.env.MONGO_URI, business: process.env.BUSINESS_DB_NAME, demo: process.env.SKINORA_DEMO_DB_NAME };
  try {
    process.env.MONGO_URI = "mongodb+srv://user:dummy@mockcluster.mongodb.net/skinora_prod?retryWrites=true";
    process.env.BUSINESS_DB_NAME = "skinora_prod";
    process.env.SKINORA_DEMO_DB_NAME = "skinora_baove_test";
    const config = defenseDemoConfig();
    assert.equal(config.sourceName, "skinora_prod");
    assert.equal(config.demoName, "skinora_baove_test");
    assert.match(config.demoUri, /\/skinora_baove_test\?/);
    process.env.SKINORA_DEMO_DB_NAME = "skinora_prod";
    assert.throws(() => defenseDemoConfig(), /DEMO_DATABASE_NAME/);
  } finally {
    for (const [key, value] of [["MONGO_URI", previous.mongo], ["BUSINESS_DB_NAME", previous.business], ["SKINORA_DEMO_DB_NAME", previous.demo]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  console.log("DEMO_OFFLINE_TEST_PASS: isolation, demo stock/prices, SKU, images and schema");
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
