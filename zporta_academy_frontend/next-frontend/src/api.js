// src/api.js
import axios from "axios";

// Replace localhost with 127.0.0.1 for Windows SSR compatibility
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "/api")
  .replace(/\/+$/, "") // strip trailing slash
  .replace("localhost", "127.0.0.1"); // fix Windows SSR issues

const getToken = () => {
  if (typeof window === "undefined") return null; // SSR guard
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

const apiClient = axios.create({
  baseURL: BASE, // no trailing slash
  timeout: 20000,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Token ${token}`; // or Bearer
  // initialize retry count
  config.__retryCount = config.__retryCount || 0;
  return config;
});

// Exponential backoff helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Normalize errors and retry on network/timeout/5xx (not 4xx)
apiClient.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const config = error?.config || {};
    const status = error?.response?.status;
    const isTimeout =
      error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "");
    const isNetwork = !error?.response && !error?.request?.aborted;
    const isServerError = status >= 500 && status < 600;

    const shouldRetry =
      (isTimeout || isNetwork || isServerError) &&
      config.__retryCount < 2 &&
      config.method !== "post";

    if (shouldRetry) {
      config.__retryCount += 1;
      const backoff = 300 * Math.pow(2, config.__retryCount - 1); // 300ms, 600ms
      await delay(backoff);
      return apiClient.request(config);
    }

    // Return normalized error shape
    const normalized = {
      status,
      message:
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Request failed",
      data: error?.response?.data,
      url: config?.url,
      method: config?.method,
    };
    return Promise.reject(normalized);
  }
);

export default apiClient;
