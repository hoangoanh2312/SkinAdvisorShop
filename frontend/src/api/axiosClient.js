import axios from "axios";

// Without a timeout, a backend that accepts the connection but cannot reach MongoDB
// leaves pages on "Đang tải..." / "Đang đăng nhập..." forever.
const DEFAULT_TIMEOUT_MS = 20000;
const SLOW_TIMEOUT_MS = 120000; // AI, skin analysis and image uploads legitimately take longer.
const SLOW_PATH = /\/(ai|skin-analysis)(\/|$)|\/images(\/|$)/;

const axiosClient = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api" });
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("skinora_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (!config.timeout) {
    const slow = (typeof FormData !== "undefined" && config.data instanceof FormData) || SLOW_PATH.test(config.url || "");
    config.timeout = slow ? SLOW_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  }
  return config;
});
axiosClient.interceptors.response.use((response) => response, (error) => { if (error.response?.status === 401 && error.config?.sessionProtected) window.dispatchEvent(new Event("skinora:session-expired")); return Promise.reject(error); });

// Human-readable message for any request error, including "backend not running" and timeouts.
export const apiErrorMessage = (error, fallback = "Đã có lỗi xảy ra. Vui lòng thử lại.") => {
  if (error?.response) return error.response.data?.message || fallback;
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") return "Máy chủ phản hồi quá lâu. Có thể máy chủ chưa kết nối được cơ sở dữ liệu — vui lòng thử lại sau ít phút.";
  if (error?.code === "ERR_NETWORK" || error?.request) return "Không kết nối được máy chủ. Hãy kiểm tra máy chủ đã được khởi động rồi thử lại.";
  return fallback;
};

export default axiosClient;
