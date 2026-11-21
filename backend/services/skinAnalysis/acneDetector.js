// Phát hiện từng nốt mụn bằng mô hình YOLO tự huấn luyện (ACNE04), chạy ONNX ngay trên server.
// Notebook huấn luyện: ml/acne_yolo_training.ipynb. Nếu chưa có model hoặc chưa cài thư viện,
// detector báo "không khả dụng" và hệ thống quay về chỉ dùng Gemini — không làm hỏng luồng phân tích.
const fs = require("fs");
const path = require("path");

const DEFAULT_MODEL = path.join(__dirname, "..", "..", "ml", "models", "acne_yolo.onnx");
const CONF_THRESHOLD = Math.min(Math.max(Number(process.env.ACNE_CONF_THRESHOLD) || 0.25, 0.05), 0.9);
const IOU_THRESHOLD = 0.45;
const MAX_DETECTIONS = 150;
const PAD_VALUE = 114;

// Gom tên lớp của dataset (tiếng Anh, có thể khác nhau giữa các bản ACNE04) về nhóm hiển thị.
const CLASS_GROUPS = [
  { key: "comedone", label: "Nhân mụn (đầu trắng/đầu đen)", test: /black|white|comedo/i },
  { key: "pustule", label: "Mụn mủ", test: /pustul/i },
  { key: "papule", label: "Mụn sẩn viêm", test: /papul/i },
  { key: "nodule", label: "Mụn bọc / nang", test: /nodul|cyst/i },
];
const classGroup = (name = "") => CLASS_GROUPS.find((group) => group.test.test(name)) || { key: "acne", label: "Nốt mụn" };

// ---------- Hàm thuần (không cần thư viện native) — được kiểm thử offline ----------

const letterboxParams = (width, height, size) => {
  const scale = Math.min(size / width, size / height);
  const newWidth = Math.max(1, Math.round(width * scale));
  const newHeight = Math.max(1, Math.round(height * scale));
  const left = Math.floor((size - newWidth) / 2);
  const top = Math.floor((size - newHeight) / 2);
  return { scale, newWidth, newHeight, left, top, right: size - newWidth - left, bottom: size - newHeight - top };
};

// Ảnh RGB HWC uint8 -> Float32 CHW chuẩn hóa 0..1 (định dạng đầu vào YOLO).
const toChwTensor = (rgb, size) => {
  const area = size * size;
  const out = new Float32Array(3 * area);
  for (let i = 0, p = 0; p < area; p += 1, i += 3) {
    out[p] = rgb[i] / 255; out[area + p] = rgb[i + 1] / 255; out[2 * area + p] = rgb[i + 2] / 255;
  }
  return out;
};

const iou = (a, b) => {
  const x1 = Math.max(a.x1, b.x1); const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2); const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return union > 0 ? inter / union : 0;
};

// NMS độc lập theo lớp, sau đó gộp các khung trùng khác lớp (một nốt chỉ đếm một lần).
const nms = (boxes, iouThreshold = IOU_THRESHOLD, limit = MAX_DETECTIONS) => {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const kept = [];
  for (const box of sorted) {
    if (kept.length >= limit) break;
    const overlapSame = kept.some((k) => k.classId === box.classId && iou(k, box) > iouThreshold);
    const overlapAny = kept.some((k) => iou(k, box) > 0.7);
    if (!overlapSame && !overlapAny) kept.push(box);
  }
  return kept;
};

// Giải mã đầu ra YOLOv8/YOLO11 dạng [1, 4 + nc, N] (cx, cy, w, h trên ảnh letterbox + điểm từng lớp).
const decodeYoloOutput = (data, dims, { numClasses, letterbox, width, height, confThreshold = CONF_THRESHOLD }) => {
  const [, channels, anchors] = dims;
  if (channels !== 4 + numClasses) throw new Error(`ACNE_MODEL_SHAPE_MISMATCH: ${channels} != ${4 + numClasses}`);
  const candidates = [];
  for (let a = 0; a < anchors; a += 1) {
    let best = 0; let classId = -1;
    for (let c = 0; c < numClasses; c += 1) {
      const score = data[(4 + c) * anchors + a];
      if (score > best) { best = score; classId = c; }
    }
    if (best < confThreshold) continue;
    const cx = data[a]; const cy = data[anchors + a]; const w = data[2 * anchors + a]; const h = data[3 * anchors + a];
    // Bỏ phần đệm letterbox, quy về pixel ảnh gốc rồi cắt trong biên ảnh.
    const x1 = Math.min(Math.max((cx - w / 2 - letterbox.left) / letterbox.scale, 0), width);
    const y1 = Math.min(Math.max((cy - h / 2 - letterbox.top) / letterbox.scale, 0), height);
    const x2 = Math.min(Math.max((cx + w / 2 - letterbox.left) / letterbox.scale, 0), width);
    const y2 = Math.min(Math.max((cy + h / 2 - letterbox.top) / letterbox.scale, 0), height);
    if (x2 - x1 < 1 || y2 - y1 < 1) continue;
    candidates.push({ x1, y1, x2, y2, confidence: best, classId });
  }
  return nms(candidates);
};

// Chuẩn hóa về tọa độ 0..1 của ảnh + nhãn tiếng Việt để trả cho frontend.
const toDetections = (boxes, { width, height, names }) => boxes.map((box) => {
  const group = classGroup(names[box.classId]);
  const round = (n) => Math.round(n * 10000) / 10000;
  return {
    x: round(box.x1 / width), y: round(box.y1 / height),
    width: round((box.x2 - box.x1) / width), height: round((box.y2 - box.y1) / height),
    confidence: Math.round(box.confidence * 1000) / 1000,
    classKey: group.key, label: group.label, rawClass: names[box.classId] || null,
  };
});

// ---------- Phần chạy thật: cần onnxruntime-node + sharp + file model ----------

let sessionPromise = null;
let override = null;

const modelPaths = () => {
  const onnx = process.env.ACNE_MODEL_PATH?.trim() ? path.resolve(process.env.ACNE_MODEL_PATH.trim()) : DEFAULT_MODEL;
  return { onnx, meta: onnx.replace(/\.onnx$/i, ".json") };
};

const loadModel = () => {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      if (process.env.ACNE_DETECTOR_ENABLED === "false") return { available: false, reason: "disabled" };
      const paths = modelPaths();
      if (!fs.existsSync(paths.onnx) || !fs.existsSync(paths.meta)) return { available: false, reason: "model_missing" };
      let ort; let sharp;
      try { ort = require("onnxruntime-node"); sharp = require("sharp"); } catch { return { available: false, reason: "runtime_missing" }; }
      const meta = JSON.parse(fs.readFileSync(paths.meta, "utf8"));
      if (!Array.isArray(meta.names) || !meta.names.length) return { available: false, reason: "invalid_metadata" };
      const session = await ort.InferenceSession.create(paths.onnx, { graphOptimizationLevel: "all" });
      return { available: true, ort, sharp, session, meta, imgsz: Number(meta.imgsz) || 640 };
    })().catch((error) => {
      console.warn("[acne-detector] Không tải được mô hình:", error.message);
      return { available: false, reason: "load_failed" };
    });
  }
  return sessionPromise;
};

const detectAcne = async (buffer) => {
  if (override) return override(buffer);
  const model = await loadModel();
  if (!model.available) return { available: false, reason: model.reason };
  const started = Date.now();
  const { sharp, ort, session, meta, imgsz } = model;
  // Xoay theo EXIF giống trình duyệt hiển thị, để khung khớp với ảnh người dùng thấy.
  const { data: oriented, info } = await sharp(buffer, { failOn: "none" }).rotate().toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const lb = letterboxParams(width, height, imgsz);
  const rgb = await sharp(oriented, { raw: { width, height, channels: info.channels } }).resize(lb.newWidth, lb.newHeight, { fit: "fill" })
    .extend({ top: lb.top, bottom: lb.bottom, left: lb.left, right: lb.right, background: { r: PAD_VALUE, g: PAD_VALUE, b: PAD_VALUE } })
    .removeAlpha().raw().toBuffer();
  const input = new ort.Tensor("float32", toChwTensor(rgb, imgsz), [1, 3, imgsz, imgsz]);
  const outputs = await session.run({ [session.inputNames[0]]: input });
  const output = outputs[session.outputNames[0]];
  const boxes = decodeYoloOutput(output.data, output.dims, { numClasses: meta.names.length, letterbox: lb, width, height });
  return {
    available: true,
    detections: toDetections(boxes, { width, height, names: meta.names }),
    image: { width, height },
    model: { name: meta.name || "acne_yolo", architecture: meta.architecture || "yolo", trainedAt: meta.trainedAt || null, metrics: meta.metrics ? { map50: meta.metrics.map50, precision: meta.metrics.precision, recall: meta.metrics.recall } : null },
    inferenceMs: Date.now() - started,
  };
};

const getAcneDetectorStatus = async () => {
  const model = await loadModel();
  return model.available ? { available: true, names: model.meta.names, metrics: model.meta.metrics || null } : { available: false, reason: model.reason };
};
const setAcneDetectorForTests = (fn) => { override = fn; };
const resetAcneDetectorCache = () => { sessionPromise = null; };

module.exports = {
  detectAcne, getAcneDetectorStatus, setAcneDetectorForTests, resetAcneDetectorCache,
  letterboxParams, toChwTensor, decodeYoloOutput, nms, iou, toDetections, classGroup, CLASS_GROUPS,
};
