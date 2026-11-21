/* Offline: tiền xử lý letterbox, giải mã đầu ra YOLO + NMS, hợp nhất với Gemini. Không cần MongoDB, Gemini hay file model. */
const assert = require("node:assert/strict");
const det = require("../services/skinAnalysis/acneDetector");
const { fuseAcneDetection, buildGeminiHint, scoreFromCount, severityOf } = require("../services/skinAnalysis/acneFusion");
const { normalizeSkinAnalysis } = require("../services/skinAnalysis/skinAnalysisNormalizer");
const skinService = require("../services/skinAnalysis/skinAnalysisService");
const Product = require("../models/Product");
const Variant = require("../models/Variant");

const run = async () => {
  // 1. Letterbox: ảnh ngang 1280x720 -> 640x360, đệm 140px trên/dưới.
  const lb = det.letterboxParams(1280, 720, 640);
  assert.deepEqual([lb.scale, lb.newWidth, lb.newHeight, lb.left, lb.top, lb.bottom], [0.5, 640, 360, 0, 140, 140]);
  const odd = det.letterboxParams(333, 500, 640);
  assert.equal(odd.newWidth + odd.left + odd.right, 640);
  assert.equal(odd.newHeight + odd.top + odd.bottom, 640);

  // 2. HWC uint8 -> CHW float 0..1
  const chw2 = det.toChwTensor(Uint8Array.from([255, 0, 51, 0, 255, 102, 10, 20, 30, 40, 50, 60]), 2);
  assert.equal(chw2.length, 12);
  assert.equal(chw2[0], 1); assert.equal(chw2[1], 0); assert.equal(chw2[4], 0); assert.equal(chw2[5], 1); assert.ok(Math.abs(chw2[8] - 0.2) < 1e-6);

  // 3. Giải mã tensor [1, 4+nc, N] tổng hợp.
  const names = ["nodules and cysts", "papules", "pustules", "whitehead and blackhead"];
  const nc = names.length; const anchors = 5;
  const data = new Float32Array((4 + nc) * anchors);
  const put = (a, [cx, cy, w, h], scores) => {
    data[a] = cx; data[anchors + a] = cy; data[2 * anchors + a] = w; data[3 * anchors + a] = h;
    scores.forEach((s, c) => { data[(4 + c) * anchors + a] = s; });
  };
  put(0, [320, 320, 20, 20], [0, 0.9, 0, 0]); // papule ở tâm ảnh
  put(1, [322, 321, 20, 20], [0, 0.6, 0, 0]); // trùng gần hoàn toàn -> NMS loại
  put(2, [100, 200, 10, 10], [0, 0, 0, 0.5]); // nhân mụn
  put(3, [500, 300, 16, 16], [0.1, 0.1, 0.2, 0]); // dưới ngưỡng 0.25 -> loại
  put(4, [330, 320, 20, 20], [0, 0, 0.8, 0]); // khác lớp nhưng trùng 0.6 IoU với #0 -> giữ (ngưỡng gộp khác lớp 0.7)
  const boxes = det.decodeYoloOutput(data, [1, 4 + nc, anchors], { numClasses: nc, letterbox: lb, width: 1280, height: 720 });
  assert.equal(boxes.length, 3);
  const papule = boxes.find((b) => b.classId === 1);
  // Tâm letterbox (320,320) -> ảnh gốc (640, 360); khung 20px -> 40px.
  assert.deepEqual([papule.x1, papule.y1, papule.x2, papule.y2], [620, 340, 660, 380]);
  assert.throws(() => det.decodeYoloOutput(data, [1, 9, anchors], { numClasses: nc, letterbox: lb, width: 1280, height: 720 }), /SHAPE_MISMATCH/);

  // 4. Chuẩn hóa toạ độ 0..1 + nhãn tiếng Việt.
  const detections = det.toDetections(boxes, { width: 1280, height: 720, names });
  const p = detections.find((d) => d.classKey === "papule");
  assert.equal(p.label, "Mụn sẩn viêm");
  assert.equal(p.x, 0.4844); assert.equal(p.width, 0.0313);
  assert.equal(det.classGroup("whiteheads").key, "comedone");
  assert.equal(det.classGroup("blackheads").key, "comedone");
  assert.equal(det.classGroup("cyst").key, "nodule");
  assert.equal(det.classGroup("pustule").key, "pustule");
  assert.equal(det.classGroup("fore").key, "acne");
  console.log("PASS: letterbox, CHW tensor, YOLO decode + NMS, Vietnamese labels");

  // 5. Điểm & mức độ theo số nốt.
  assert.equal(scoreFromCount(0), 10);
  assert.equal(scoreFromCount(3), 8.5);
  assert.equal(scoreFromCount(6), 7.5);
  assert.equal(scoreFromCount(20), 5);
  assert.equal(scoreFromCount(35), 3.5);
  assert.equal(scoreFromCount(80), 1.5);
  assert.equal(severityOf(0).key, "none"); assert.equal(severityOf(12).key, "moderate"); assert.equal(severityOf(60).key, "extensive");

  // 6. Hợp nhất: YOLO thay chỉ số acne của Gemini, bỏ nốt ngoài khuôn mặt.
  const box = (x, y, classKey = "papule", label = "Mụn sẩn viêm", confidence = 0.7) => ({ x, y, width: 0.02, height: 0.02, confidence, classKey, label });
  const detection = { available: true, detections: [
    box(0.3, 0.6), box(0.32, 0.62), box(0.7, 0.6, "comedone", "Nhân mụn (đầu trắng/đầu đen)", 0.5), box(0.5, 0.85, "pustule", "Mụn mủ", 0.9),
    box(0.02, 0.02), // ngoài khuôn mặt
  ], model: { name: "acne_yolo" }, inferenceMs: 42 };
  const gemini = {
    skinType: "oily", confidence: 0.8, faceBox: [150, 200, 900, 800], imageQuality: { faceDetected: true, lighting: "good", sharpness: "good" },
    metrics: { texture: { score: 7, confidence: 0.7 }, acne: { score: 9, confidence: 0.9, evidence: "Không thấy mụn" }, pores: { score: 6, confidence: 0.6 } },
    concerns: [{ key: "mụn", confidence: 0.2, evidence: "Gemini đoán" }, { key: "large_pores", confidence: 0.6 }], analysisSource: "gemini_vision",
  };
  const { raw, acneDetection } = fuseAcneDetection(gemini, detection);
  assert.equal(acneDetection.count, 4);
  assert.equal(acneDetection.byClass[0].key, "papule");
  assert.equal(acneDetection.byClass[0].count, 2);
  assert.equal(acneDetection.severity, "few");
  assert.equal(raw.metrics.acne.score, 8.5);
  assert.equal(raw.metrics.texture.score, 7, "Các chỉ số khác giữ của Gemini");
  assert.equal(raw.analysisSource, "gemini_vision+yolo_acne");
  assert.ok(!raw.concerns.some((c) => c.evidence === "Gemini đoán"), "Bỏ nhận định mụn của Gemini khi đã có YOLO");
  const analysis = normalizeSkinAnalysis(raw);
  const acne = analysis.metrics.find((m) => m.key === "acne");
  assert.equal(acne.score, 8.5); assert.equal(acne.status, "assessed");
  assert.equal(acne.markers.length, 3);
  assert.match(acne.evidence, /khoanh được 4 nốt/);
  assert.ok(acne.regions.includes("cheek_image_left"));
  assert.ok(analysis.concerns.some((c) => c.key === "acne"));

  // Không thấy nốt nào: điểm 10, không thêm concern acne.
  const none = fuseAcneDetection(gemini, { available: true, detections: [] });
  assert.equal(none.raw.metrics.acne.score, 10);
  assert.ok(!none.raw.concerns.some((c) => c.key === "acne" || c.key === "mụn"));
  assert.match(buildGeminiHint({ available: true, detections: [] }), /KHÔNG tìm thấy/);
  assert.match(buildGeminiHint(detection), /5 nốt/);
  // Metrics dạng mảng cũng được thay.
  const arr = fuseAcneDetection({ ...gemini, metrics: [{ key: "acne", score: 2 }, { key: "pores", score: 6 }] }, detection);
  assert.equal(arr.raw.metrics.filter((m) => m.key === "acne").length, 1);
  assert.equal(arr.raw.metrics.find((m) => m.key === "acne").score, 8.5);
  // Không có model hoặc không thấy mặt -> giữ nguyên Gemini.
  assert.equal(fuseAcneDetection(gemini, { available: false }).raw, gemini);
  assert.equal(fuseAcneDetection({ ...gemini, imageQuality: { faceDetected: false } }, detection).acneDetection, null);
  assert.equal(buildGeminiHint({ available: false }), "");
  console.log("PASS: YOLO count drives acne score/markers/concerns; Gemini kept for other metrics; graceful fallback");

  // 7. Luồng service: detector chạy trước, gợi ý được đưa vào yêu cầu Gemini; lỗi detector không làm hỏng phân tích.
  const originalProductFind = Product.find; const originalVariantFind = Variant.find;
  Product.find = () => ({ lean: async () => [] });
  Variant.find = () => ({ sort: () => ({ lean: async () => [] }) });
  let seen = null;
  skinService.setSkinAnalysisProviderForTests(async (request) => { seen = request; return gemini; });
  det.setAcneDetectorForTests(async () => detection);
  try {
    const result = await skinService.analyzeSkin({ buffer: Buffer.from([0xff, 0xd8, 0xff]), mimeType: "image/jpeg", source: "upload" });
    assert.match(seen.detectorHint, /YOLO/);
    assert.equal(result.analysis.acneDetection.count, 4);
    assert.equal(result.analysis.analysisSource, "gemini_vision+yolo_acne");
    det.setAcneDetectorForTests(async () => { throw new Error("boom"); });
    const fallback = await skinService.analyzeSkin({ buffer: Buffer.from([0xff, 0xd8, 0xff]), mimeType: "image/jpeg", source: "upload" });
    assert.equal(fallback.analysis.acneDetection, null);
    assert.equal(fallback.analysis.metrics.find((m) => m.key === "acne").score, 9, "Lỗi detector -> dùng điểm Gemini");
    assert.equal(seen.detectorHint, "");
  } finally {
    skinService.setSkinAnalysisProviderForTests(null); det.setAcneDetectorForTests(null);
    Product.find = originalProductFind; Variant.find = originalVariantFind;
  }
  // 8. Thiếu file model -> báo không khả dụng, không ném lỗi.
  process.env.ACNE_MODEL_PATH = "/khong/ton/tai/acne_yolo.onnx";
  det.resetAcneDetectorCache();
  assert.deepEqual(await det.detectAcne(Buffer.alloc(3)), { available: false, reason: "model_missing" });
  delete process.env.ACNE_MODEL_PATH; det.resetAcneDetectorCache();
  console.log("SKINORA_ACNE_DETECTOR_OFFLINE_PASS: detector-first pipeline, hint to Gemini, fallback when model/runtime missing");
};

run().catch((error) => { console.error(error); process.exit(1); });
