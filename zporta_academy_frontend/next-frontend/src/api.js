// src/api.js
import axios from "axios";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/")
  .replace(/\/+$/, ""); // strip trailing slash

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
