/* Pure/isolated tests. Does NOT connect to MongoDB or use real Gemini API. */
const assert = require('node:assert/strict');
const { normalizeSkinAnalysis } = require('../services/skinAnalysis/skinAnalysisNormalizer');
const { getIngredientGuidance } = require('../services/skinAnalysis/ingredientGuidanceService');
const { recommendProducts, buildRoutine } = require('../services/skinAnalysis/recommendationService');
const skinService = require('../services/skinAnalysis/skinAnalysisService');
const { analyzeWithGeminiVision } = require('../services/skinAnalysis/providers/geminiVisionProvider');
const Product = require('../models/Product');
const Variant = require('../models/Variant');

const originalProductFind = Product.find;
const originalVariantFind = Variant.find;
const originalFetch = global.fetch;
const originalApiKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;
const base64 = Buffer.from([0xff, 0xd8, 0xff]);

const run = async () => {
  const empty = normalizeSkinAnalysis({ skinType: 'combination', confidence: 0.85,
    concerns: [{ key: 'redness', confidence: 0.9 }, { key: 'large_pores', confidence: 0.8 }],
    recommendedIngredients: [], analysisSource: 'gemini_vision' });
  const acneObserved = normalizeSkinAnalysis({ skinType: 'oily', confidence: '0.76', concerns: [
    { key: 'acne', confidence: '0.81', evidence: 'Vài nốt đỏ nhỏ vùng má' },
    { key: 'redness', confidence: 0.41, evidence: 'Đỏ nhẹ vùng má' },
    { key: 'pimples', confidence: 0.35, evidence: 'Nốt nhỏ vùng cằm' },
  ] });
  assert.equal(acneObserved.concerns[0].key, 'acne');
  assert.equal(acneObserved.concerns[0].confidence, 0.81);
  assert(acneObserved.concerns[0].evidence.includes('má'));
  assert(acneObserved.possibleConcerns.some((item) => item.key === 'redness'));
  assert(!acneObserved.possibleConcerns.some((item) => item.key === 'acne'), 'Do not repeat confirmed acne as possible');
  const acneUncertain = normalizeSkinAnalysis({ skinType: 'unknown', confidence: 0.1, concerns: [{ key: 'acne', confidence: 0.43, evidence: 'Nốt nhỏ ở trán, chưa rõ' }] });
  assert.equal(acneUncertain.concerns.length, 0, 'Uncertain acne must not feed recommendations');
  assert.equal(acneUncertain.possibleConcerns[0].key, 'acne');
  const acneLowConfidence = normalizeSkinAnalysis({ skinType: 'unknown', confidence: 0.1, concerns: [{ key: 'mụn ẩn', confidence: '25%', evidence: 'Nốt nhỏ ở trán, chưa đủ rõ' }] });
  assert.equal(acneLowConfidence.concerns.length, 0, 'Weak acne must not feed recommendations');
  assert.equal(acneLowConfidence.possibleConcerns[0].key, 'acne', 'Keep low-confidence acne with evidence');
  assert.equal(acneLowConfidence.possibleConcerns[0].confidence, 0.25);
  const acneNumberPercentage = normalizeSkinAnalysis({ skinType: 'unknown', confidence: 20, concerns: [{ key: 'mụn viêm', confidence: 75, evidence: 'Nốt đỏ nhỏ ở má' }] });
  assert.equal(acneNumberPercentage.concerns[0].confidence, 0.75);
  const noAcne = normalizeSkinAnalysis({ skinType: 'unknown', confidence: 0.1, concerns: [{ key: 'redness', confidence: 0.2 }] });
  assert(![...noAcne.concerns, ...noAcne.possibleConcerns].some(c => c.key === 'acne'), 'Never invent acne');
  console.log('PASS: visible acne, uncertain acne, and no fabricated acne are distinct');
  const guide = getIngredientGuidance(empty);
  assert(guide.recommendedIngredients.includes('Panthenol'));
  assert(guide.recommendedIngredients.includes('Ceramide'));
  assert.equal(guide.ingredientSuggestionSource, 'reference_rules');
  assert(guide.ingredientGuidance.every((x) => x.reason.length > 15));
  assert(!guide.recommendedIngredients.includes('Salicylic Acid'), 'Redness must not automatically add exfoliating acids');
  const unknown = normalizeSkinAnalysis({ skinType: 'combination', confidence: 0.3,
    concerns: [{ key: 'redness', confidence: 0.2 }], recommendedIngredients: ['Niacinamide'] });
  assert.equal(unknown.skinType, 'unknown');
  assert.deepEqual(getIngredientGuidance(unknown).recommendedIngredients, []);
  assert.equal(getIngredientGuidance(unknown).ingredientSuggestionSource, 'insufficient_evidence');
  const routine = buildRoutine([], { ...empty, ...guide });
  assert(routine.morning.every((x) => x.description && !x.product));
  assert(routine.evening.some((x) => /hàng rào da/.test(x.label)));
  assert(routine.morning.some((x) => /SPF 30/.test(x.description)));
  assert(!buildRoutine([], { skinType: 'oily', concerns: [{ key: 'acne' }] }).evening.some((x) => /hàng rào da/.test(x.label)));
  console.log('PASS: no fabricated inference for uncertain skin; curated ingredient guidance; personalized routine');

  // Stub only the database query methods (no Mongo connection or production writes).
  const original = { _id: 'prod-1', slug: 'example', name: 'Niacinamide Serum', brand: 'Existing Brand',
    skinTypes: ['combination'], skinConcerns: ['pores', 'sensitivity'],
    keyIngredients: ['Niacinamide'], images: ['image.jpg'], basePrice: 200000, averageRating: 0, reviewCount: 0 };
  Product.find = () => ({ lean: async () => [original] });
  Variant.find = () => ({ sort: () => ({ lean: async () => [{ product: 'prod-1', name: '30 ml', price: 200000, stock: 3, isActive: true }] }) });
  let found = await recommendProducts({ ...empty, ...guide });
  assert.equal(found.length, 1);
  assert.equal(found[0].product.slug, 'example');
  assert.equal(found[0].product.price, 200000);
  Variant.find = () => ({ sort: () => ({ lean: async () => [] }) });
  found = await recommendProducts({ ...empty, ...guide });
  assert.equal(found.length, 0, 'No in-stock variant means no recommendation');
  console.log('PASS: only real matching product can be recommended; no-stock catalog yields []');

  // Mock ONLY the external HTTP response, testing prompt + mapping without a Gemini key.
  process.env.GEMINI_API_KEY = 'mock-only'; process.env.GEMINI_MODEL = 'mock-only';
  let sent;
  global.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      skinType: 'combination', confidence: 0.85,
      concerns: [{ key: 'redness', confidence: 0.9 }, { key: 'large_pores', confidence: 0.8 }],
      recommendedIngredients: [], analysisSource: 'gemini_vision', warnings: [],
    }) }] } }] }) };
  };
  const response = await analyzeWithGeminiVision({ buffer: base64, mimeType: 'image/jpeg' });
  assert.equal(response.skinType, 'combination');
  assert.equal(sent.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
  assert(sent.contents[0].parts[0].text.toLowerCase().includes('không chẩn đoán'));
  assert(sent.contents[0].parts[0].text.includes('DẤU HIỆU MỤN'), 'Gemini must inspect acne specifically');
  skinService.setSkinAnalysisProviderForTests(async () => response);
  const result = await skinService.analyzeSkin({ buffer: base64, mimeType: 'image/jpeg', source: 'upload' });
  assert(result.analysis.recommendedIngredients.includes('Panthenol'));
  assert.equal(result.analysis.ingredientSuggestionSource, 'reference_rules');
  assert.equal(result.recommendations.length, 0);
  assert(result.routine.evening.some((step) => step.description));
  assert.equal(result.analysis.analysisSource, 'gemini_vision');
  console.log('PASS: mocked Gemini empty ingredients -> meaningful guidance and routine; no fake products');
};
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  Product.find = originalProductFind;
  Variant.find = originalVariantFind;
  global.fetch = originalFetch;
  skinService.setSkinAnalysisProviderForTests(null);
  if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = originalModel;
});
