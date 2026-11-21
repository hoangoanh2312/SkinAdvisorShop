// Hợp nhất kết quả mô hình YOLO phát hiện mụn với phản hồi Gemini.
// Với chỉ số "mụn", số nốt đếm được từ YOLO là nguồn chính; Gemini vẫn chấm các chỉ số còn lại.
const { REGIONS, toBox } = require("./skinMetrics");
const { normalizeConcernKey } = require("./skinAnalysisNormalizer");

// Mức độ tham khảo theo số nốt (dựa trên các ngưỡng của thang Hayashi dùng trong ACNE04) — không phải chẩn đoán.
const SEVERITY = [
  { max: 0, key: "none", label: "Không thấy nốt mụn rõ" },
  { max: 5, key: "few", label: "Ít nốt mụn" },
  { max: 20, key: "moderate", label: "Mụn mức vừa" },
  { max: 50, key: "many", label: "Nhiều nốt mụn" },
  { max: Infinity, key: "extensive", label: "Mụn lan rộng" },
];
const severityOf = (count) => SEVERITY.find((level) => count <= level.max);

// Thang 10 = ít dấu hiệu nhất, giảm dần theo số nốt.
const scoreFromCount = (count) => {
  let score;
  if (count <= 0) score = 10;
  else if (count <= 5) score = 9 - (count - 1) * 0.25; // 9 → 8
  else if (count <= 20) score = 7.5 - ((count - 6) * 2.5) / 14; // 7.5 → 5
  else if (count <= 50) score = 4.5 - ((count - 21) * 2) / 29; // 4.5 → 2.5
  else score = 1.5;
  return Math.min(Math.max(Math.round(score * 2) / 2, 1), 10);
};

const center = (d) => ({ x: d.x + d.width / 2, y: d.y + d.height / 2 });
const insideFace = (point, box) => !box || (point.x >= box.x - 0.03 && point.x <= box.x + box.width + 0.03 && point.y >= box.y - 0.05 && point.y <= box.y + box.height + 0.08);

const nearestRegion = (point, box) => {
  if (!box) return null;
  const rx = (point.x - box.x) / box.width; const ry = (point.y - box.y) / box.height;
  let best = null; let bestDistance = Infinity;
  for (const [key, region] of Object.entries(REGIONS)) {
    const distance = (region.x - rx) ** 2 + (region.y - ry) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = key; }
  }
  return best;
};

const countByClass = (detections) => {
  const groups = new Map();
  for (const d of detections) {
    const entry = groups.get(d.classKey) || { key: d.classKey, label: d.label, count: 0 };
    entry.count += 1; groups.set(d.classKey, entry);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
};

// Câu gợi ý gửi kèm prompt Gemini để phần tóm tắt/nhận xét nhất quán với số nốt mô hình đếm được.
const buildGeminiHint = (detection) => {
  if (!detection?.available) return "";
  const n = detection.detections.length;
  if (!n) return "Mô hình phát hiện mụn chuyên dụng (YOLO, huấn luyện trên ACNE04) KHÔNG tìm thấy nốt mụn rõ trong ảnh. Khi viết summary, đừng khẳng định có mụn trừ khi thấy rất rõ; vẫn chấm các chỉ số khác theo quan sát.";
  const groups = countByClass(detection.detections);
  const parts = groups.length > 1 || groups[0]?.key !== "acne" ? ` (${groups.map((g) => `${g.count} ${g.label.toLowerCase()}`).join(", ")})` : "";
  return `Mô hình phát hiện mụn chuyên dụng (YOLO, huấn luyện trên ACNE04) đã khoanh được ${n} nốt mụn${parts}. Dùng thông tin này khi viết summary và evidence cho chỉ số acne; vẫn chấm các chỉ số khác theo quan sát của bạn.`;
};

const replaceAcneMetric = (metrics, acne) => {
  if (Array.isArray(metrics)) return [...metrics.filter((item) => String(item?.key || "").trim().toLowerCase() !== "acne"), { key: "acne", ...acne }];
  return { ...(metrics && typeof metrics === "object" ? metrics : {}), acne };
};

/**
 * Trả về { raw, acneDetection }: raw đã được thay chỉ số acne bằng kết quả YOLO (nếu dùng được),
 * acneDetection là dữ liệu khung từng nốt để giao diện vẽ.
 */
const fuseAcneDetection = (raw = {}, detection) => {
  if (!detection?.available) return { raw, acneDetection: null };
  if (raw.imageQuality?.faceDetected === false) return { raw, acneDetection: null };
  const faceBox = toBox(raw.faceBox);
  const detections = (detection.detections || []).filter((d) => insideFace(center(d), faceBox));
  const count = detections.length;
  const byClass = countByClass(detections);
  const severity = severityOf(count);
  const poorImage = raw.imageQuality?.sharpness === "blurry" || raw.imageQuality?.lighting === "low";
  const confidence = Math.max((count ? 0.8 : 0.6) - (poorImage ? 0.2 : 0), 0.35);

  const regionCounts = new Map();
  for (const d of detections) {
    const region = nearestRegion(center(d), faceBox);
    if (region) regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
  }
  const regions = [...regionCounts.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key).slice(0, 4);
  const points = [...detections].sort((a, b) => b.confidence - a.confidence).slice(0, 3)
    .map((d) => { const c = center(d); return [Math.round(c.y * 1000), Math.round(c.x * 1000)]; });

  const where = regions.length ? `; tập trung ở ${regions.map((r) => REGIONS[r].label.toLowerCase()).join(", ")}` : "";
  const evidence = count
    ? `Mô hình phát hiện mụn khoanh được ${count} nốt${byClass.length > 1 || byClass[0]?.key !== "acne" ? `: ${byClass.map((g) => `${g.count} ${g.label.toLowerCase()}`).join(", ")}` : ""}${where}.`
    : "Mô hình phát hiện mụn không tìm thấy nốt mụn rõ trên ảnh này (có thể bỏ sót nốt rất nhỏ hoặc bị che)";

  const acne = { score: scoreFromCount(count), confidence, regions, points, evidence: evidence.slice(0, 200) };
  const concerns = (Array.isArray(raw.concerns) ? raw.concerns : []).filter((item) => normalizeConcernKey(item?.key) !== "acne");
  if (count) concerns.push({ key: "acne", confidence, evidence: evidence.slice(0, 180) });

  return {
    raw: { ...raw, metrics: replaceAcneMetric(raw.metrics, acne), concerns, analysisSource: `${raw.analysisSource || "gemini_vision"}+yolo_acne` },
    acneDetection: {
      count, byClass, severity: severity.key, severityLabel: severity.label,
      detections, model: detection.model || null, inferenceMs: detection.inferenceMs ?? null,
    },
  };
};

module.exports = { fuseAcneDetection, buildGeminiHint, scoreFromCount, severityOf, countByClass, nearestRegion };
