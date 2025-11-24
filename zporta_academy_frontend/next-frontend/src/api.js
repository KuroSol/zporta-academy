// src/api.js
import axios from "axios";

// Replace localhost with 127.0.0.1 for Windows SSR compatibility
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "/api")
  .replace(/\/+$/, "") // strip trailing slash
  .replace('localhost', '127.0.0.1'); // fix Windows SSR issues

const getToken = () => {
  if (typeof window === "undefined") return null; // SSR guard
  try { return localStorage.getItem("token"); } catch { return null; }
};

const apiClient = axios.create({
  baseURL: BASE,            // no trailing slash
  timeout: 30000,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Token ${token}`; // or Bearer
  return config;
});

export default apiClient;
