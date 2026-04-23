/**
 * Axios API — FINAL STABLE VERSION 🚀
 */

import axios from "axios";

/* 🔥 BASE URL */
const API_BASE = process.env.REACT_APP_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

/* =========================
   🔐 REQUEST INTERCEPTOR
========================= */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    const publicRoutes = [
      "/payment/order",
      "/payment/verify",
      "/auth/login",
      "/auth/register",
      "/auth/register-company",
    ];

    const url = config.url || "";

    // 🔥 FIX: use includes instead of startsWith
    const isPublic = publicRoutes.some((route) =>
      url.includes(route)
    );

    /* 🔐 Attach token */
    if (token && !isPublic) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    /* 🔥 FIX: Detect FormData safely */
    const isFormData =
      typeof FormData !== "undefined" &&
      config.data instanceof FormData;

    // Only set JSON header when NOT FormData
    if (!isFormData) {
      config.headers["Content-Type"] = "application/json";
    } else {
      // 🔥 IMPORTANT: let browser set multipart boundary
      delete config.headers["Content-Type"];
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
  window.location.replace("/login");
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

    /* 🔥 PLAN EXPIRED */
    if (data?.planExpired) {
      alert("Your plan expired. Please upgrade.");
      window.location.href = "/pricing";
      return Promise.reject(error);
    }

    const publicRoutes = [
      "/payment/order",
      "/payment/verify",
      "/auth/login",
      "/auth/register",
      "/auth/register-company",
    ];

    const url = originalRequest.url || "";

    // 🔥 FIX: includes
    const isPublic = publicRoutes.some((route) =>
      url.includes(route)
    );

    /* 🔐 HANDLE 401 */
    if (status === 401 && !originalRequest._retry && !isPublic) {
      if (url.includes("/auth/refresh")) {
        forceLogout();
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

        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(
          `${API_BASE}/auth/refresh`,
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
        forceLogout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
