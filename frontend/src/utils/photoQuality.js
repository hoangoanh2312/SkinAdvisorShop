// Kiểm tra nhanh ảnh/khung hình camera ngay trên trình duyệt (không gửi đi đâu).
// Chỉ đo được ánh sáng và độ nét; vị trí khuôn mặt dùng FaceDetector nếu trình duyệt hỗ trợ.

const SAMPLE = 160;

export function measureFrame(source, width, height) {
  if (!width || !height) return null;
  const scale = SAMPLE / Math.max(width, height);
  const w = Math.max(1, Math.round(width * scale)); const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  let sum = 0; let clipped = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = luma; sum += luma; if (luma > 245) clipped += 1;
  }
  const brightness = sum / gray.length;
  // Độ nét: phương sai Laplacian trên ảnh thu nhỏ.
  let lapSum = 0; let lapSq = 0; let n = 0;
  for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
    const i = y * w + x;
    const lap = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
    lapSum += lap; lapSq += lap * lap; n += 1;
  }
  const sharpness = n ? lapSq / n - (lapSum / n) ** 2 : 0;
  return { brightness, sharpness, overexposed: clipped / gray.length };
}

export function rateQuality(metrics) {
  if (!metrics) return { light: "unknown", sharp: "unknown" };
  const light = metrics.brightness < 70 ? "dark" : metrics.brightness > 205 || metrics.overexposed > 0.18 ? "bright" : "good";
  const sharp = metrics.sharpness < 60 ? "blurry" : "good";
  return { light, sharp };
}

export const QUALITY_TEXT = {
  light: { good: "Ánh sáng tốt", dark: "Ảnh hơi tối", bright: "Ảnh bị chói", unknown: "Ánh sáng" },
  sharp: { good: "Ảnh rõ nét", blurry: "Ảnh hơi mờ", unknown: "Độ nét" },
  face: { good: "Mặt nằm trong khung", off: "Đưa mặt vào giữa khung", none: "Chưa thấy khuôn mặt", unsupported: "Tự căn mặt vào khung" },
};

// FaceDetector chỉ có trên một số trình duyệt (Chrome Android/ChromeOS...). Không có thì trả "unsupported".
let detector;
export async function checkFacePosition(source, width, height) {
  if (typeof window === "undefined" || !("FaceDetector" in window)) return "unsupported";
  try {
    detector = detector || new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    const faces = await detector.detect(source);
    if (!faces.length) return "none";
    const box = faces[0].boundingBox;
    const cx = (box.x + box.width / 2) / width; const cy = (box.y + box.height / 2) / height;
    const size = box.width / width;
    return Math.abs(cx - 0.5) < 0.18 && Math.abs(cy - 0.5) < 0.22 && size > 0.22 ? "good" : "off";
  } catch { return "unsupported"; }
}

// Thu nhỏ ảnh trước khi gửi (nhanh hơn, luôn dưới giới hạn 5 MB). Giữ nguyên nếu đã nhỏ.
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { resolve({ img, url }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("IMAGE_DECODE_FAILED")); };
    img.src = url;
  });
}
export function downscaleToJpeg(img, maxSide = 1600) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((img.naturalWidth || img.width) * scale); canvas.height = Math.round((img.naturalHeight || img.height) * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ? new File([blob], "skin-photo.jpg", { type: "image/jpeg" }) : null), "image/jpeg", 0.9));
}
