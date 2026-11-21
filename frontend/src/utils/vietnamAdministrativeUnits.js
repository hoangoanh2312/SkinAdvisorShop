// Danh mục hai cấp 34 tỉnh/thành, 3.321 xã/phường/đặc khu (snapshot 2026-11-05).
// Nguồn: Địa Chỉ Việt, CC BY 4.0, văn bản cập nhật đến 2026-09-20.
// https://diachiviet.com/du-lieu-mo/ — dữ liệu được tải từ API công khai,
// không truyền thông tin khách hàng hoặc địa chỉ giao hàng ra API này.
// Tham chiếu pháp lý: Quyết định 19/2025/QĐ-TTg và các nghị quyết điều chỉnh.
export const ADMINISTRATIVE_DATA_SOURCE = Object.freeze({
  name: "Địa Chỉ Việt",
  url: "https://diachiviet.com/du-lieu-mo/",
  license: "CC BY 4.0",
  date: "2026-11-05",
  legalDataThrough: "2026-09-20",
  provinceCount: 34,
  wardCount: 3321,
});

export const VIETNAM_PROVINCES = [
  { code: "01", name: "Hà Nội", slug: "ha-noi", expectedWards: 126 },
  { code: "04", name: "Cao Bằng", slug: "cao-bang", expectedWards: 56 },
  { code: "08", name: "Tuyên Quang", slug: "tuyen-quang", expectedWards: 124 },
  { code: "11", name: "Điện Biên", slug: "dien-bien", expectedWards: 45 },
  { code: "12", name: "Lai Châu", slug: "lai-chau", expectedWards: 38 },
  { code: "14", name: "Sơn La", slug: "son-la", expectedWards: 75 },
  { code: "15", name: "Lào Cai", slug: "lao-cai", expectedWards: 99 },
  { code: "19", name: "Thái Nguyên", slug: "thai-nguyen", expectedWards: 92 },
  { code: "20", name: "Lạng Sơn", slug: "lang-son", expectedWards: 65 },
  { code: "22", name: "Quảng Ninh", slug: "quang-ninh", expectedWards: 54 },
  { code: "24", name: "Bắc Ninh", slug: "bac-ninh", expectedWards: 99 },
  { code: "25", name: "Phú Thọ", slug: "phu-tho", expectedWards: 148 },
  { code: "31", name: "Hải Phòng", slug: "hai-phong", expectedWards: 114 },
  { code: "33", name: "Hưng Yên", slug: "hung-yen", expectedWards: 104 },
  { code: "37", name: "Ninh Bình", slug: "ninh-binh", expectedWards: 129 },
  { code: "38", name: "Thanh Hóa", slug: "thanh-hoa", expectedWards: 166 },
  { code: "40", name: "Nghệ An", slug: "nghe-an", expectedWards: 130 },
  { code: "42", name: "Hà Tĩnh", slug: "ha-tinh", expectedWards: 69 },
  { code: "44", name: "Quảng Trị", slug: "quang-tri", expectedWards: 78 },
  { code: "46", name: "Huế", slug: "hue", expectedWards: 40 },
  { code: "48", name: "Đà Nẵng", slug: "da-nang", expectedWards: 94 },
  { code: "51", name: "Quảng Ngãi", slug: "quang-ngai", expectedWards: 96 },
  { code: "52", name: "Gia Lai", slug: "gia-lai", expectedWards: 135 },
  { code: "56", name: "Khánh Hòa", slug: "khanh-hoa", expectedWards: 65 },
  { code: "66", name: "Đắk Lắk", slug: "dak-lak", expectedWards: 102 },
  { code: "68", name: "Lâm Đồng", slug: "lam-dong", expectedWards: 124 },
  { code: "75", name: "Đồng Nai", slug: "dong-nai", expectedWards: 95 },
  { code: "79", name: "Hồ Chí Minh", slug: "ho-chi-minh", expectedWards: 168 },
  { code: "80", name: "Tây Ninh", slug: "tay-ninh", expectedWards: 96 },
  { code: "82", name: "Đồng Tháp", slug: "dong-thap", expectedWards: 102 },
  { code: "86", name: "Vĩnh Long", slug: "vinh-long", expectedWards: 124 },
  { code: "91", name: "An Giang", slug: "an-giang", expectedWards: 102 },
  { code: "92", name: "Cần Thơ", slug: "can-tho", expectedWards: 103 },
  { code: "96", name: "Cà Mau", slug: "ca-mau", expectedWards: 64 }
];

export const normalizeAdministrativeText = (value) => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D")
  .toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const normalizeProvince = (value) => normalizeAdministrativeText(value)
  .replace(/^(?:tinh|thanh pho|tp) /, "")
  .trim();

export function provinceByName(name) {
  return VIETNAM_PROVINCES.find((p) => normalizeProvince(p.name) === normalizeProvince(name));
}

const loadedWards = new Map();
const API_ROOT = "https://diachiviet.com/api/v1";

async function requestProvinceWards(url, province, signal) {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload?.dong)) throw new Error("Dữ liệu phường/xã trả về không hợp lệ");
  const rows = payload.dong.filter((item) => String(item?.ma_tinh) === province.code);
  const codes = new Set(rows.map((item) => String(item?.ma_xa || "")));
  if (rows.length !== province.expectedWards || codes.size !== rows.length) {
    throw new Error(`Danh sách ${province.name} chưa đầy đủ (${rows.length}/${province.expectedWards}). Không dùng kết quả thiếu.`);
  }
  if (rows.some((item) => !item?.ma_xa || !item?.ten)) {
    throw new Error("Có phường/xã thiếu mã hoặc tên; vui lòng tải lại nguồn dữ liệu");
  }
  const entries = rows.map((item) => ({ code: String(item.ma_xa), name: String(item.ten).trim() }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  // Mốc đối chiếu bắt buộc: xã Song Lộc, Vĩnh Long (Nghị quyết 1687/NQ-UBTVQH15).
  if (province.code === "86" && !entries.some((item) => normalizeAdministrativeText(item.name) === "xa song loc")) {
    throw new Error("Nguồn dữ liệu thiếu Xã Song Lộc, tỉnh Vĩnh Long; không dùng danh sách không đầy đủ");
  }
  return entries;
}

// Tải riêng từng tỉnh để nhanh; nếu endpoint tỉnh lỗi, thử file toàn quốc rồi lọc.
// Không rơi về API cũ vì API cũ có thể thiếu đơn vị hành chính mới.
export async function loadProvinceWards(provinceCode, signal) {
  const province = VIETNAM_PROVINCES.find((p) => p.code === String(provinceCode));
  if (!province) throw new Error("Mã tỉnh/thành không tồn tại");
  if (loadedWards.has(province.code)) return loadedWards.get(province.code);
  const urls = [
    `${API_ROOT}/xa/${province.slug}.json`,
    `${API_ROOT}/xa.json`,
  ];
  let lastError;
  for (const url of urls) {
    try {
      const entries = await requestProvinceWards(url, province, signal);
      loadedWards.set(province.code, entries);
      return entries;
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      lastError = error;
    }
  }
  throw new Error(`Không tải được dữ liệu hành chính đầy đủ cho ${province.name}: ${lastError?.message || "Lỗi mạng"}`);
}
