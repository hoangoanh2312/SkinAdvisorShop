// Thông tin liên hệ THẬT của cửa hàng, hiển thị ở chân trang và các trang chính sách.
// Mục nào để trống ("") sẽ tự ẩn, không hiển thị chữ "đang cập nhật".
export const STORE_INFO = {
  name: "sandwich beauty",
  hotline: "0362 200 540",            // VD: "0912 345 678"
  email: "oanhtran.231205@gmail.com",              // VD: "hotro@sandwichbeauty.vn"
  address: "Ấp Hòa Lạc, xã Song Lộc, tỉnh Vĩnh Long",            // VD: "12 Nguyễn Văn Bảo, Phường Hạnh Thông, TP. Hồ Chí Minh"
  workingHours: "8:00 – 21:00 mỗi ngày",       // VD: "8:00 – 21:00, thứ Hai đến Chủ nhật"
  zalo: "",               // số điện thoại Zalo, VD: "0912 345 678"
  mapUrl: "",             // link Google Maps của cửa hàng (bấm Chia sẻ trên Google Maps rồi sao chép)
  social: {
    facebook: "",         // đường dẫn đầy đủ, VD: "https://facebook.com/sandwichbeauty"
    instagram: "",
    tiktok: "",
  },
  // Chính sách đổi trả: số ngày kể từ khi nhận hàng khách được yêu cầu trả hàng.
  returnDays: 7,
  // Khớp với cấu hình máy chủ (PAYMENT_HOLD_MINUTES, BANK_TRANSFER_HOLD_HOURS trong backend/.env).
  paymentHoldMinutes: 15,
  bankTransferHoldHours: 24,
};

export const hasContact = () => Boolean(STORE_INFO.hotline || STORE_INFO.email || STORE_INFO.address);
export const phoneHref = (value = "") => `tel:${value.replace(/[^\d+]/g, "")}`;
export const zaloHref = (value = "") => `https://zalo.me/${value.replace(/\D/g, "")}`;
export const mapHref = () => /^https:\/\//.test(STORE_INFO.mapUrl) ? STORE_INFO.mapUrl
  : STORE_INFO.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_INFO.address)}` : "";
export const socialLinks = () => [
  ["Facebook", STORE_INFO.social.facebook],
  ["Instagram", STORE_INFO.social.instagram],
  ["TikTok", STORE_INFO.social.tiktok],
  ["Zalo", STORE_INFO.zalo ? zaloHref(STORE_INFO.zalo) : ""],
].filter(([, url]) => /^https:\/\//.test(url));
