// Chấm điểm từng chỉ số da (kiểu SkinCam) từ phản hồi Gemini — chỉ là ƯỚC LƯỢNG từ ảnh, không phải chẩn đoán.
// Thang điểm 1–10: 10 = ít dấu hiệu nhất (tình trạng tốt), 1 = dấu hiệu rõ nhất.

const METRICS = {
  texture: { label: "Độ căng mịn", concern: "dullness", productConcerns: ["dullness", "aging"] },
  acne: { label: "Mụn", concern: "acne", productConcerns: ["acne"] },
  pores: { label: "Lỗ chân lông", concern: "large_pores", productConcerns: ["pores", "oiliness"] },
  pigmentation: { label: "Sắc tố / thâm", concern: "pigmentation", productConcerns: ["pigmentation"] },
  redness: { label: "Đỏ da", concern: "redness", productConcerns: ["sensitivity"] },
  oiliness: { label: "Độ bóng dầu", concern: null, productConcerns: ["oiliness", "pores"] },
};
const METRIC_KEYS = Object.keys(METRICS);

// Vùng theo góc nhìn của ẢNH (không đảo trái/phải theo người trong ảnh).
const REGIONS = {
  forehead: { label: "Trán", x: 0.5, y: 0.2 },
  nose: { label: "Mũi", x: 0.5, y: 0.55 },
  cheek_image_left: { label: "Má (bên trái ảnh)", x: 0.27, y: 0.62 },
  cheek_image_right: { label: "Má (bên phải ảnh)", x: 0.73, y: 0.62 },
  chin: { label: "Cằm", x: 0.5, y: 0.88 },
  under_eyes: { label: "Vùng dưới mắt", x: 0.35, y: 0.45 },
};
const REGION_ALIASES = {
  left_cheek: "cheek_image_left", right_cheek: "cheek_image_right", cheeks: "cheek_image_left", cheek: "cheek_image_left",
  "t-zone": "forehead", tzone: "forehead", "t_zone": "forehead", jaw: "chin", jawline: "chin",
  "trán": "forehead", "mũi": "nose", "cằm": "chin",
};

const MIN_CONFIDENCE_SHOWN = 0.35; // dưới mức này: chỉ báo "chưa đủ rõ", không đưa điểm
const MIN_CONFIDENCE_RELIABLE = 0.5; // dùng cho điểm tổng quan và gợi ý sản phẩm

const toRatio = (value) => {
  const input = typeof value === "string" ? value.trim().replace("%", "") : value;
  const number = Number(input);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number > 1 ? number / 100 : number, 0), 1);
};
const toScore = (value) => {
  const number = Number(typeof value === "string" ? value.split("/")[0] : value);
  if (!Number.isFinite(number)) return null;
  const scaled = number > 10 ? number / 10 : number; // chấp nhận thang 100
  return Math.min(Math.max(Math.round(scaled * 2) / 2, 1), 10);
};
const toPoint = (value) => {
  // Gemini quy ước [y, x] trên thang 0–1000; cũng chấp nhận {x,y}.
  let x; let y;
  if (Array.isArray(value) && value.length >= 2) [y, x] = value.map(Number);
  else if (value && typeof value === "object") ({ x, y } = { x: Number(value.x), y: Number(value.y) });
  if (![x, y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)) return null;
  return { x: Math.round(x) / 1000, y: Math.round(y) / 1000 };
};
const toBox = (value) => {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = value.map(Number);
  if (![ymin, xmin, ymax, xmax].every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)) return null;
  if (xmax - xmin < 80 || ymax - ymin < 80) return null; // mặt quá nhỏ trong ảnh
  return { x: xmin / 1000, y: ymin / 1000, width: (xmax - xmin) / 1000, height: (ymax - ymin) / 1000 };
};
const insideBox = (point, box) => box && point.x >= box.x - 0.03 && point.x <= box.x + box.width + 0.03 && point.y >= box.y - 0.05 && point.y <= box.y + box.height + 0.05;
const regionKey = (value) => {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  const resolved = REGIONS[key] ? key : REGION_ALIASES[key] || REGION_ALIASES[value.trim().toLowerCase()];
  return resolved || null;
};
const text = (value, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const normalizeImageQuality = (raw = {}) => {
  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  return {
    faceDetected: raw.faceDetected !== false,
    lighting: pick(raw.lighting, ["good", "low", "harsh", "uneven"], "unknown"),
    sharpness: pick(raw.sharpness, ["good", "blurry"], "unknown"),
    frontal: raw.frontal === false ? false : raw.frontal === true ? true : null,
    filterSuspected: raw.filterSuspected === true,
    makeupSuspected: raw.makeupSuspected === true,
  };
};

const normalizeMetrics = (rawMetrics, faceBox) => {
  const source = Array.isArray(rawMetrics)
    ? Object.fromEntries(rawMetrics.filter((item) => item && typeof item.key === "string").map((item) => [item.key.trim().toLowerCase(), item]))
    : rawMetrics && typeof rawMetrics === "object" ? rawMetrics : {};
  return METRIC_KEYS.map((key) => {
    const item = source[key];
    const definition = METRICS[key];
    if (!item || typeof item !== "object") return { key, label: definition.label, status: "not_assessed", score: null, confidence: 0, regions: [], markers: [], evidence: "" };
    const confidence = toRatio(item.confidence);
    const score = toScore(item.score);
    const regions = [...new Set((Array.isArray(item.regions) ? item.regions : []).map(regionKey).filter(Boolean))].slice(0, 4);
    // Ưu tiên điểm Gemini chỉ ra; nếu không có/ra ngoài khuôn mặt thì đặt theo vùng trong khung mặt.
    const points = (Array.isArray(item.points) ? item.points : item.point ? [item.point] : []).map(toPoint).filter(Boolean)
      .filter((point) => !faceBox || insideBox(point, faceBox));
    let markers = points.slice(0, 3).map((point, index) => ({ ...point, region: regions[index] || null }));
    if (!markers.length && faceBox) {
      markers = regions.slice(0, 3).map((region) => ({ x: faceBox.x + REGIONS[region].x * faceBox.width, y: faceBox.y + REGIONS[region].y * faceBox.height, region }));
    }
    markers = markers.map((m) => ({ x: Math.round(m.x * 1000) / 1000, y: Math.round(m.y * 1000) / 1000, region: m.region }));
    const status = score === null || confidence < MIN_CONFIDENCE_SHOWN ? "uncertain" : confidence < MIN_CONFIDENCE_RELIABLE ? "low_confidence" : "assessed";
    return {
      key, label: definition.label, status,
      score: status === "uncertain" ? null : score,
      confidence, regions, regionLabels: regions.map((region) => REGIONS[region].label),
      markers: status === "uncertain" ? [] : markers,
      evidence: text(item.evidence),
    };
  });
};

const overallScore = (metrics) => {
  const reliable = metrics.filter((item) => item.status === "assessed");
  if (reliable.length < 3) return null; // quá ít chỉ số đáng tin để tổng hợp
  return Math.round((reliable.reduce((sum, item) => sum + item.score, 0) / reliable.length) * 2) / 2;
};

// Chỉ số kém + đủ tin cậy -> concern dùng cho gợi ý thành phần/sản phẩm (cùng ngưỡng 0.5 như normalizer cũ).
const concernsFromMetrics = (metrics) => metrics
  .filter((item) => item.status === "assessed" && item.score <= 6 && METRICS[item.key].concern)
  .map((item) => ({ key: METRICS[item.key].concern, confidence: item.confidence, evidence: item.evidence || `${item.label}: ${item.score}/10 (ước lượng từ ảnh)` }));

// Thứ tự ưu tiên chăm sóc: điểm thấp nhất trước; chỉ dùng chỉ số đáng tin.
const focusOptions = (metrics) => metrics
  .filter((item) => item.status === "assessed" && item.score <= 7)
  .sort((a, b) => a.score - b.score || b.confidence - a.confidence)
  .map(({ key, label, score }) => ({ key, label, score }));

module.exports = { METRICS, METRIC_KEYS, REGIONS, normalizeMetrics, normalizeImageQuality, toBox, overallScore, concernsFromMetrics, focusOptions, MIN_CONFIDENCE_RELIABLE };
