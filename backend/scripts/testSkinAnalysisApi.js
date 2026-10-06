require("dotenv").config({ quiet: true });

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const generateToken = require("../utils/generateToken");
const aiRoutes = require("../routes/aiRoutes");

mongoose.set("autoIndex", false);
const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
let server;

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const password = await bcrypt.hash(`Skin-${tag}`, 12);
    const [user, analysisUser] = await User.create([
      { fullName: "Skin Analysis Test", email: `skin.analysis.${tag}@example.com`, password },
      { fullName: "Skin Analysis Result Test", email: `skin.analysis.result.${tag}@example.com`, password },
    ]);
    const app = express();
    app.use("/api/ai", aiRoutes);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/api/ai/skin-analysis`;
    const token = generateToken(user);
    const request = async (form, authToken = token) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: form,
      });
      return { status: response.status, body: await response.json().catch(() => ({})) };
    };

    const noAuth = new FormData();
    noAuth.set("consent", "true");
    assert((await request(noAuth, null)).status === 401, "No-token skin analysis must return 401");
    assert((await request(new FormData(), "invalid-token")).status === 401, "Invalid token skin analysis must return 401");

    const noImage = new FormData();
    noImage.set("consent", "true");
    assert((await request(noImage)).status === 400, "Missing image must return 400");

    const noConsent = new FormData();
    noConsent.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }), "face.jpg");
    assert((await request(noConsent)).status === 400, "Missing consent must return 400");

    const invalidMime = new FormData();
    invalidMime.set("consent", "true");
    invalidMime.set("image", new Blob([Buffer.from("not-an-image")], { type: "text/plain" }), "face.txt");
    assert((await request(invalidMime)).status === 400, "Invalid MIME must return 400");

    const spoofedMime = new FormData();
    spoofedMime.set("consent", "true");
    spoofedMime.set("image", new Blob([Buffer.from("not-an-image")], { type: "image/jpeg" }), "face.jpg");
    assert((await request(spoofedMime)).status === 400, "Spoofed image MIME must return 400");

    const tooLarge = new FormData();
    tooLarge.set("consent", "true");
    tooLarge.set("image", new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: "image/png" }), "large.png");
    assert((await request(tooLarge)).status === 413, "Oversized image must return 413");

    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const validWithoutProvider = new FormData();
    validWithoutProvider.set("consent", "true");
    validWithoutProvider.set("source", "upload");
    validWithoutProvider.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])], { type: "image/jpeg" }), "face.jpg");
    const unavailable = await request(validWithoutProvider);
    if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
    assert(unavailable.status === 503, "Unconfigured provider must return 503");
    console.log("Skin analysis authentication, upload validation and provider-unavailable mapping: passed");

    const skinAnalysisService = require("../services/skinAnalysis/skinAnalysisService");
    assert(typeof skinAnalysisService.setSkinAnalysisProviderForTests === "function", "Skin analysis provider must be injectable for isolated tests");

    const category = await Category.create({ name: `Skin Analysis ${tag}`, slug: `skin-analysis-${tag}` });
    const [matchingProduct, inactiveProduct, unavailableProduct] = await Product.create([
      { name: `Niacinamide Serum ${tag}`, slug: `niacinamide-analysis-${tag}`, brand: "Skinora Test", category: category._id, basePrice: 320000, skinTypes: ["oily"], skinConcerns: ["acne", "pores"], keyIngredients: ["Niacinamide"], ingredients: [{ name: "Niacinamide", normalizedName: "niacinamide", concerns: ["acne", "pores"] }], averageRating: 4.8 },
      { name: `Inactive Analysis ${tag}`, slug: `inactive-analysis-${tag}`, brand: "Skinora Test", category: category._id, basePrice: 100000, skinTypes: ["oily"], skinConcerns: ["acne"], isActive: false },
      { name: `Out Of Stock Analysis ${tag}`, slug: `out-stock-analysis-${tag}`, brand: "Skinora Test", category: category._id, basePrice: 120000, skinTypes: ["oily"], skinConcerns: ["acne"] },
    ]);
    await Variant.create([
      { product: matchingProduct._id, name: "30 ml", sku: `SKINA-${tag}`.toUpperCase(), price: 320000, salePrice: 289000, stock: 8 },
      { product: inactiveProduct._id, name: "30 ml", sku: `SKINI-${tag}`.toUpperCase(), price: 100000, stock: 10 },
      { product: unavailableProduct._id, name: "30 ml", sku: `SKINO-${tag}`.toUpperCase(), price: 120000, stock: 0 },
    ]);
    skinAnalysisService.setSkinAnalysisProviderForTests(async () => ({
      skinType: "oily", skinTypeLabel: "Da dầu", confidence: 0.87,
      concerns: [{ key: "acne", label: "Mụn", confidence: 0.73 }, { key: "large_pores", label: "Lỗ chân lông to", confidence: 0.7 }],
      recommendedIngredients: ["Niacinamide"], warnings: [], analysisSource: "mock_vision",
    }));
    const resultForm = new FormData();
    resultForm.set("consent", "true"); resultForm.set("source", "camera");
    resultForm.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])], { type: "image/jpeg" }), "capture.jpg");
    const valid = await request(resultForm, generateToken(analysisUser));
    assert(valid.status === 200 && valid.body.success, "Valid mocked skin analysis must return 200");
    assert(valid.body.data.analysis.skinType === "oily" && valid.body.data.analysis.confidence === 0.87, "Analysis result was not normalized");
    const recommendationIds = valid.body.data.recommendations.map((item) => item.product.id);
    assert(recommendationIds.includes(String(matchingProduct._id)), "Matching active in-stock product was not recommended");
    assert(!recommendationIds.includes(String(inactiveProduct._id)) && !recommendationIds.includes(String(unavailableProduct._id)), "Inactive or out-of-stock product was recommended");
    const matchingRecommendation = valid.body.data.recommendations.find((item) => item.product.id === String(matchingProduct._id));
    assert(matchingRecommendation.score > 0 && matchingRecommendation.reasons.length >= 2, "Recommendation score/reasons are missing");
    assert(valid.body.data.routine?.morning && valid.body.data.routine?.evening, "Morning/evening routine is missing");
    assert(!JSON.stringify(valid.body).includes("base64") && !JSON.stringify(valid.body).includes("capture.jpg"), "Response leaked uploaded image data or filename");
    const storedAnalysis = await mongoose.connection.db.collection("skinanalyses").findOne({ user: analysisUser._id });
    assert(storedAnalysis && storedAnalysis.source === "camera", "Skin analysis history was not stored for the authenticated user");
    assert(!storedAnalysis.image?.data && !storedAnalysis.image?.base64 && !storedAnalysis.image?.buffer, "Skin analysis history stored binary/base64 image data");
    assert(storedAnalysis.result?.skinType === "oily" && storedAnalysis.recommendedProducts?.some((item) => String(item.product) === String(matchingProduct._id)), "Stored history does not contain normalized result and real product references");

    skinAnalysisService.setSkinAnalysisProviderForTests(async () => ({ skinType: "invented", confidence: "bad", concerns: "bad" }));
    const malformedForm = new FormData(); malformedForm.set("consent", "true"); malformedForm.set("image", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }), "face.png");
    const malformed = await request(malformedForm, generateToken(analysisUser));
    assert(malformed.status === 200 && malformed.body.data.analysis.skinType === "unknown", "Malformed provider result was not normalized safely");
    const { SkinAnalysisProviderError, analyzeWithGeminiVision } = require("../services/skinAnalysis/providers/geminiVisionProvider");
    skinAnalysisService.setSkinAnalysisProviderForTests(async () => { throw new SkinAnalysisProviderError("SKIN_ANALYSIS_PROVIDER_UNAVAILABLE"); });
    const errorForm = new FormData(); errorForm.set("consent", "true"); errorForm.set("image", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }), "face.jpg");
    assert((await request(errorForm, generateToken(analysisUser))).status === 503, "Provider error must map to 503");
    console.log("Normalized analysis, real catalog recommendations and malformed-provider fallback: passed");

    const originalFetch = global.fetch; const originalApiKey = process.env.GEMINI_API_KEY; const originalModel = process.env.GEMINI_MODEL;
    process.env.GEMINI_API_KEY = "test-key"; process.env.GEMINI_MODEL = "test-vision-model";
    global.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ skinType: "dry", confidence: 0.8, concerns: [], recommendedIngredients: [], warnings: [], analysisSource: "gemini_vision" }) }] } }] }) });
    const providerResult = await analyzeWithGeminiVision({ buffer: Buffer.from([0xff, 0xd8, 0xff]), mimeType: "image/jpeg" });
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = originalModel;
    assert(providerResult.skinType === "dry" && providerResult.analysisSource === "gemini_vision", "Configured Gemini Vision provider did not parse structured response");
    console.log("Gemini Vision provider contract: passed with mocked network");
  } catch (error) {
    console.error(`Skin analysis API test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    try { require("../services/skinAnalysis/skinAnalysisService").setSkinAnalysisProviderForTests(null); } catch {}
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState !== 0) {
      await Promise.all([
        User.updateMany({ email: { $in: [`skin.analysis.${tag}@example.com`, `skin.analysis.result.${tag}@example.com`] } }, { isActive: false }),
        Product.updateMany({ slug: { $in: [`niacinamide-analysis-${tag}`, `inactive-analysis-${tag}`, `out-stock-analysis-${tag}`] } }, { isActive: false }),
        Variant.updateMany({ sku: { $in: [`SKINA-${tag}`, `SKINI-${tag}`, `SKINO-${tag}`].map((value) => value.toUpperCase()) } }, { isActive: false }),
        Category.updateMany({ slug: `skin-analysis-${tag}` }, { isActive: false }),
      ]);
      await mongoose.connection.close();
    }
  }
};

run();
