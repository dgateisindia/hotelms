import axios from "axios";
import { getAccessToken, setAccessToken } from "../utils/icons/tokenManager";

const apiClient = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // needed so the httpOnly refreshToken cookie is sent
});

// ── Request interceptor: attach access token ──
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ──
let isRefreshing = false;
let pendingRequests = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // queue this request until refresh finishes
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject, originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          "http://localhost:5000/api/auth/refresh-token",
          {},
          { withCredentials: true }
        );
        const newAccessToken = res.data.accessToken;
        setAccessToken(newAccessToken);

        // retry queued requests with new token
        pendingRequests.forEach(({ resolve, originalRequest: req }) => {
          req.headers.Authorization = `Bearer ${newAccessToken}`;
          resolve(apiClient(req));
        });
        pendingRequests = [];

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        pendingRequests.forEach(({ reject }) => reject(refreshError));
        pendingRequests = [];

        // refresh failed — force logout
        setAccessToken(null);
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;