/**
 * AuthContext — FINAL MULTI-TENANT VERSION 🔥
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  /* ================= INIT ================= */
  useEffect(() => {
    const init = async () => {
      if (token) {
        try {
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          const { data } = await api.get("/auth/me");

          setUser(data.user);

          // 🔥 store role + company for UI
          localStorage.setItem("role", data.user.role);
          localStorage.setItem("companyId", data.user.companyId);

        } catch (err) {
          console.log("❌ Token invalid, logging out");

          localStorage.clear();
          setToken(null);
          setUser(null);
        }
      }

      setLoading(false);
    };

    init();
  }, [token]);

  /* ================= LOGIN ================= */
  const login = useCallback(async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });

      const { token: newToken, refreshToken, user: userData } = data;

      // 🔥 STORE EVERYTHING
      localStorage.setItem("token", newToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("role", userData.role);
      localStorage.setItem("companyId", userData.companyId);

      api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

      setToken(newToken);
      setUser(userData);

      return userData;

    } catch (error) {
      console.error("❌ Login failed:", error.message);
      throw error;
    }
  }, []);

  /* ================= LOGOUT ================= */
  const logout = useCallback(async () => {
  try {
    // 🔥 AUTO CLOCK-OUT BEFORE LOGOUT
    if (localStorage.getItem("tracking")) {
      await api.post("/attendance/clock-out");
    }

    await api.post("/auth/logout"); // optional backend logout
  } catch (err) {
    console.log("Logout error:", err.message);
  }

  // 🔥 CLEAR EVERYTHING
  localStorage.clear();

  delete api.defaults.headers.common["Authorization"];

  setToken(null);
  setUser(null);

  window.location.href = "/login"; // 🔥 redirect
}, []);
  /* ================= REFRESH TOKEN ================= */
  const refreshAccessToken = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) return logout();

      const { data } = await api.post("/auth/refresh", { refreshToken });

      localStorage.setItem("token", data.token);

      api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;

      setToken(data.token);

    } catch (err) {
      console.log("❌ Refresh failed → logout");
      logout();
    }
  };

  /* ================= AUTO REFRESH (OPTIONAL) ================= */
  useEffect(() => {
    const interval = setInterval(() => {
      refreshAccessToken();
    }, 1000 * 60 * 10); // every 10 min

    return () => clearInterval(interval);
  }, []);

  /* ================= CONTEXT ================= */
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        setUser,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};