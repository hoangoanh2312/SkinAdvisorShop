/* Kiểm tra mô hình phát hiện mụn trên một ảnh: npm run acne:check -- path/to/face.jpg */
require("dotenv").config({ quiet: true });
const fs = require("fs");
const { detectAcne, getAcneDetectorStatus } = require("../services/skinAnalysis/acneDetector");
const { countByClass, scoreFromCount, severityOf } = require("../services/skinAnalysis/acneFusion");

(async () => {
  const status = await getAcneDetectorStatus();
  if (!status.available) {
    const help = {
      model_missing: "Chưa có backend/ml/models/acne_yolo.onnx và acne_yolo.json — chạy notebook ml/acne_yolo_training.ipynb rồi chép vào.",
      runtime_missing: "Chưa cài onnxruntime-node / sharp — chạy `npm install` trong thư mục backend.",
      disabled: "ACNE_DETECTOR_ENABLED=false trong .env.",
    };
    console.error(`Detector OFF: ${status.reason}. ${help[status.reason] || ""}`);
    process.exit(1);
  }
  console.log("Lớp:", status.names.join(", "));
  if (status.metrics) console.log("Chỉ số đánh giá:", JSON.stringify({ map50: status.metrics.map50, map50_95: status.metrics.map50_95, precision: status.metrics.precision, recall: status.metrics.recall }));
  const file = process.argv[2];
  if (!file) { console.log("Thêm đường dẫn ảnh để chạy thử: npm run acne:check -- anh.jpg"); return; }
  const result = await detectAcne(fs.readFileSync(file));
  const n = result.detections.length;
  console.log(`Ảnh ${result.image.width}x${result.image.height}, suy luận ${result.inferenceMs} ms`);
  console.log(`Phát hiện ${n} nốt →`, countByClass(result.detections).map((g) => `${g.label}: ${g.count}`).join("; ") || "không có");
  console.log(`Điểm mụn (thang 10): ${scoreFromCount(n)} — ${severityOf(n).label}`);
  result.detections.slice(0, 10).forEach((d, i) => console.log(`  #${i + 1} ${d.label} ${Math.round(d.confidence * 100)}% tại x=${d.x}, y=${d.y}`));
})().catch((error) => { console.error("Lỗi:", error.message); process.exit(1); });
