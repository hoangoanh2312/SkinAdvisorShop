/* Offline: per-metric scores, face markers and 4-step routine. No MongoDB, no Gemini. */
const assert = require("node:assert/strict");
const { normalizeSkinAnalysis } = require("../services/skinAnalysis/skinAnalysisNormalizer");
const { buildStepRoutines } = require("../services/skinAnalysis/recommendationService");

const raw = {
  skinType: "combination", confidence: 0.8, summary: "Da bóng nhẹ vùng chữ T.",
  faceBox: [150, 250, 850, 750],
  imageQuality: { faceDetected: true, lighting: "good", sharpness: "good", frontal: true },
  metrics: {
    texture: { score: 7, confidence: 0.7, regions: ["forehead"], evidence: "Bề mặt khá đều." },
    acne: { score: "4/10", confidence: "80%", regions: ["cheek_image_left", "chin"], points: [[600, 330], [880, 500], [10, 10]], evidence: "Vài nốt đỏ nhỏ ở má và cằm." },
    pores: { score: 55, confidence: 0.6, regions: ["nose"], evidence: "Lỗ chân lông rõ ở mũi." },
    pigmentation: { score: 6, confidence: 0.4, regions: ["cheek_image_right"], evidence: "Có thể có vết thâm." },
    redness: { score: 9, confidence: 0.2 },
  },
};
const analysis = normalizeSkinAnalysis(raw);
const byKey = Object.fromEntries(analysis.metrics.map((m) => [m.key, m]));

// Scores: clamped to 1–10, "x/10", percentages and 0–100 scales handled.
assert.equal(byKey.acne.score, 4);
assert.equal(byKey.acne.confidence, 0.8);
assert.equal(byKey.pores.score, 5.5);
// Markers: Gemini points kept only inside the face box; [10,10] is outside and dropped.
assert.equal(byKey.acne.markers.length, 2);
assert.ok(byKey.acne.markers.every((m) => m.x >= 0.2 && m.x <= 0.8 && m.y >= 0.1 && m.y <= 0.9));
// Without points, markers fall back to the named region inside the face box.
assert.equal(byKey.pores.markers.length, 1);
assert.equal(byKey.pores.markers[0].region, "nose");
// Low confidence: keeps a score but flagged; very low: no score and no marker (never guessed).
assert.equal(byKey.pigmentation.status, "low_confidence");
assert.equal(byKey.redness.status, "uncertain");
assert.equal(byKey.redness.score, null);
assert.equal(byKey.redness.markers.length, 0);
assert.equal(byKey.oiliness.status, "not_assessed");
// Overall uses only reliable metrics (texture 7, acne 4, pores 5.5).
assert.equal(analysis.overallScore, 5.5);
// Poor reliable metrics feed concerns (acne, large_pores) with the 0.5 threshold.
assert.ok(analysis.concerns.some((c) => c.key === "acne"));
assert.ok(analysis.concerns.some((c) => c.key === "large_pores"));
assert.ok(!analysis.concerns.some((c) => c.key === "pigmentation"), "low-confidence metric must not drive products");
assert.deepEqual(analysis.focusOptions.map((f) => f.key), ["acne", "pores", "texture"]);

// No face -> no scores at all, clear warning.
const noFace = normalizeSkinAnalysis({ skinType: "unknown", confidence: 0.1, imageQuality: { faceDetected: false }, metrics: raw.metrics });
assert.equal(noFace.metrics.length, 0);
assert.equal(noFace.overallScore, null);
assert.match(noFace.warnings[0], /khuôn mặt/);
// Legacy responses without metrics still work.
const legacy = normalizeSkinAnalysis({ skinType: "oily", confidence: 0.8, concerns: [{ key: "acne", confidence: 0.7, evidence: "Nốt đỏ ở má" }] });
assert.equal(legacy.overallScore, null);
assert.ok(legacy.metrics.every((m) => m.status === "not_assessed"));

// 4-step routine uses only the sellable candidates passed in.
const candidate = (id, name, extra = {}) => ({ product: { id, name, slug: id, isActive: true, variants: [{ _id: `${id}-v`, price: 100000, stock: 3, isActive: true }] },
  score: 10, reasons: [], categorySlug: "", skinConcerns: [], skinTypes: [], ingredientNames: [], ...extra });
const candidates = [
  candidate("c1", "Gentle Foam Cleanser"),
  candidate("s1", "BHA Liquid Exfoliant", { skinConcerns: ["acne"], ingredientNames: ["bha"] }),
  candidate("s2", "Hydrating Essence", { ingredientNames: ["hyaluronic acid"] }),
  candidate("m1", "Barrier Cream", { categorySlug: "kem-duong" }),
  candidate("p1", "UV Sunscreen SPF50"),
];
const routine = buildStepRoutines(candidates, analysis);
assert.equal(routine.defaultFocus, "acne");
const acnePlan = routine.plans.acne;
assert.deepEqual(acnePlan.map((s) => s.step), ["cleanse", "treat", "moisturize", "protect"]);
assert.equal(acnePlan[0].products[0].product.id, "c1");
assert.equal(acnePlan[1].products[0].product.id, "s1", "acne focus ranks BHA first");
assert.equal(acnePlan[2].products[0].product.id, "m1");
assert.equal(acnePlan[3].products[0].product.id, "p1", "sunscreen classified as protect, not moisturizer");
const ids = new Set(candidates.map((c) => c.product.id));
assert.ok(Object.values(routine.plans).flat().every((step) => step.products.every((p) => ids.has(p.product.id))), "no invented products");
// Red/sensitive skin pushes strong actives down.
const sensitive = buildStepRoutines(candidates, { ...analysis, selfSkinType: "sensitive" });
assert.equal(sensitive.plans.overall[1].products[0].product.id, "s2");
// Empty shop -> steps exist with no products.
assert.ok(buildStepRoutines([], analysis).plans.acne.every((s) => s.products.length === 0));

console.log("SKIN_METRICS_OFFLINE_PASS: scores 1–10, markers inside face, uncertain never scored, overall from reliable metrics, 4-step routine from sellable products only");
