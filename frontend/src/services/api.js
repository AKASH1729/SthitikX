import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

/* REQUEST INTERCEPTOR */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  const publicRoutes = [
    "/payment/order",
    "/payment/verify",
    "/auth/login",
    "/auth/register",
    "/auth/register-company",
    "/auth/refresh",
  ];

  const isPublic = publicRoutes.some((route) =>
    config.url?.startsWith(route)
  );

  if (token && !isPublic) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers["Content-Type"] = "application/json";

  return config;
});

/* RESPONSE INTERCEPTOR */
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

export default api;
