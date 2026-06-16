import axios from "axios";

import { API_BASE, getAccessToken, refreshAccessToken } from "@/lib/client";

/**
 * Axios instance for the hybrid auth scheme:
 * - sends the refresh cookie via `withCredentials`
 * - attaches the in-memory access token as a Bearer header
 * - silently refreshes once on a 401 and retries
 */
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const ok = await refreshAccessToken();
      if (ok) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${getAccessToken()}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
