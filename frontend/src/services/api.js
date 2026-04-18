/**
 * Axios API — FULL FIXED VERSION 🚀
 */

import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  timeout: 15000,
});

/* =========================
   🔐 REQUEST INTERCEPTOR
========================= */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    /* 🔥 SKIP AUTH FOR PUBLIC ROUTES */
    const publicRoutes = [
      "/payment/order",
      "/payment/verify",
      "/auth/login",
      "/auth/register-company",
      "/auth/register",
    ];

    const isPublic = publicRoutes.some((route) =>
      config.url?.includes(route)
    );

    if (token && !isPublic) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* =========================
   🔁 TOKEN REFRESH SYSTEM
========================= */
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });

  failedQueue = [];
};

/* =========================
   🚪 FORCE LOGOUT
========================= */
const forceLogout = (message = "Session expired") => {
  console.warn("Logout:", message);

  localStorage.clear();

  window.location.href = "/login"; // ✅ better UX
};

/* =========================
   🔥 RESPONSE INTERCEPTOR
========================= */
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      return Promise.reject(error);
    }

    const { status, data } = error.response;

    /* =========================================
       🔥 PLAN EXPIRED
    ========================================= */
    if (data?.planExpired) {
      alert("Your plan expired. Please upgrade.");
      window.location.href = "/pricing";
      return Promise.reject(error);
    }

    /* =========================================
       ⚠️ SKIP PUBLIC ROUTES
    ========================================= */
    const publicRoutes = [
      "/payment/order",
      "/payment/verify",
      "/auth/login",
      "/auth/register",
    ];

    const isPublic = publicRoutes.some((route) =>
      originalRequest.url?.includes(route)
    );

    /* =========================================
       🔐 HANDLE 401
    ========================================= */
    if (status === 401 && !originalRequest._retry && !isPublic) {

      if (originalRequest.url.includes("/auth/refresh")) {
        forceLogout("Session expired. Please login again.");
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject: (err) => reject(err),
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");

        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken }
        );

        const newToken = data.token;

        localStorage.setItem("token", newToken);

        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${newToken}`;

        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        return api(originalRequest);

      } catch (err) {
        processQueue(err, null);
        forceLogout("Session expired. Please login again.");
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;