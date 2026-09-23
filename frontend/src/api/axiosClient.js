import axios from "axios";
const axiosClient = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api", headers: { "Content-Type": "application/json" } });
axiosClient.interceptors.request.use((config) => { const token = localStorage.getItem("skinora_token"); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
axiosClient.interceptors.response.use((response) => response, (error) => { if (error.response?.status === 401 && error.config?.sessionProtected) window.dispatchEvent(new Event("skinora:session-expired")); return Promise.reject(error); });
export default axiosClient;
