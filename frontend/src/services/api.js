import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 15000,
});

// 🔥 REQUEST INTERCEPTOR
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ Don't override FormData
    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 🔥 RESPONSE INTERCEPTOR (TOKEN REFRESH)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // ✅ Prevent crash if no response (network error)
    if (!error.response) {
      return Promise.reject(error);
    }

    // 🔥 Handle 401 (token expired)
    if (error.response.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");

        // ❗ If no refresh token → logout immediately
        if (!refreshToken) {
          localStorage.clear();
          window.location.href = "/login";
          return;
        }

        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken }
        );

        // ✅ Save new token
        localStorage.setItem("token", data.token);

        // ✅ Update headers globally
        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${data.token}`;

        original.headers.Authorization = `Bearer ${data.token}`;

        // 🔁 Retry original request
        return api(original);

      } catch (err) {
        console.error("Refresh failed:", err);

        localStorage.clear();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;