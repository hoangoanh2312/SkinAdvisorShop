require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { startTestServer } = require("../utils/testServer");
const generateToken = require("../utils/generateToken");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { setSkinAnalysisProviderForTests } = require("../services/skinAnalysis/skinAnalysisService");

async function run() {
  process.env.JWT_SECRET ||= "ai-catalog-cart-test-only";
  const test = await startTestServer();
  try {
    assert.match(test.databaseName, /_test(?:_|$)/);
    const user = await User.create({ fullName: "Integration Test", email: "ai-cart-integration@example.test", password: await bcrypt.hash("TestOnly!123", 10) });
    const category = await Category.create({ name: "Serum Test", slug: "serum-ai-cart-test" });
    const products = await Product.create([
      { name: "Sellable Serum Test", slug: "sellable-serum-test", brand: "Test", category: category._id, basePrice: 120000, skinTypes: ["oily"], skinConcerns: ["acne"], isActive: true },
      { name: "No Stock Serum Test", slug: "no-stock-serum-test", brand: "Test", category: category._id, basePrice: 120000, skinTypes: ["oily"], skinConcerns: ["acne"], isActive: true },
      { name: "Draft Serum Test", slug: "draft-serum-test", brand: "Test", category: category._id, basePrice: 120000, skinTypes: ["oily"], skinConcerns: ["acne"], isActive: false },
    ]);
    const variants = await Variant.create(products.map((product, index) => ({ product: product._id, name: "30 ml", sku: `AI-CART-${index}`, size: "30", unit: "ml", price: 120000, stock: index === 1 ? 0 : 4 })));
    setSkinAnalysisProviderForTests(async () => ({ skinType: "oily", confidence: 0.8, concerns: [{ key: "acne", confidence: 0.8 }], recommendedIngredients: [], warnings: [], analysisSource: "mock_vision" }));
    const form = new FormData();
    form.set("consent", "true");
    form.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])], { type: "image/jpeg" }), "test.jpg");
    const analyzed = await fetch(`${test.baseUrl}/api/ai/skin-analysis`, { method: "POST", headers: { Authorization: `Bearer ${generateToken(user)}` }, body: form });
    assert.equal(analyzed.status, 200);
    const analysis = (await analyzed.json()).data;
    assert.deepEqual(analysis.recommendations.map(item => item.product.id), [String(products[0]._id)]);
    const detailResponse = await fetch(`${test.baseUrl}/api/products/${analysis.recommendations[0].product.slug}`);
    assert.equal(detailResponse.status, 200);
    const detail = (await detailResponse.json()).data;
    assert.equal(String(detail.product._id), String(products[0]._id));
    assert.equal(String(detail.variants[0]._id), String(variants[0]._id));
    assert.equal(detail.variants[0].stock, 4);
    assert.equal(detail.variants[0].price, 120000);
    // Contract consumed by the frontend cart; browser interaction is tested separately.
    assert.ok(detail.product.isActive && detail.variants[0].isActive && detail.variants[0].stock > 0);
    console.log(`AI -> recommendation -> product detail -> cart-ready variant PASS (${test.databaseName})`);
  } finally {
    setSkinAnalysisProviderForTests(null);
    await test.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
