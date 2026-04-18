/**
 * SocketContext — FINAL MULTI-TENANT VERSION 🔥
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();

  const socketRef = useRef(null);
  const reconnectRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    /* ================= DISCONNECT IF NO USER ================= */
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    /* ================= PREVENT DUPLICATE ================= */
    if (socketRef.current) return;

    /* ================= CREATE SOCKET ================= */
    const socket = io(
      process.env.REACT_APP_SOCKET_URL || "https://mahadevassociates.online",
      {
        autoConnect: false,
        transports: ["websocket"],

        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,

        timeout: 20000,
      }
    );

    /* 🔥 MULTI-TENANT AUTH */
    socket.auth = {
      token,
    };

    socket.connect();

    /* ================= EVENTS ================= */

    socket.on("connect", () => {
      console.log(`✅ Connected (${user.role}) →`, socket.id);
      setIsConnected(true);

      // 🔥 Join role-based UI logic (optional)
      if (user.role === "admin") {
        socket.emit("admin:request-live-locations");
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.log("⚠️ Error:", err.message);
    });

    socket.on("reconnect_attempt", () => {
      console.log("🔄 Reconnecting...");
      socket.auth = { token }; // 🔥 refresh token
    });

    /* ================= REAL-TIME EVENTS ================= */

    // 📍 Location updates (admin only)
    socket.on("location:update", (data) => {
      if (user.role === "admin") {
        console.log("📡 LOCATION:", data);
      }
    });

    // 🚨 Alerts (all roles)
    socket.on("alert:received", (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 20));
    });

    /* ================= STORE ================= */
    socketRef.current = socket;

    /* ================= CLEANUP ================= */
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("location:update");
      socket.off("alert:received");

      socket.disconnect();
      socketRef.current = null;

      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
    };
  }, [token, user]);

  /* ================= SAFE METHODS ================= */

  const emit = (event, data) => {
    const socket = socketRef.current;

    if (!socket) return console.log("⚠️ Socket not ready");

    if (!socket.connected) {
      console.log("⚠️ Reconnecting socket...");
      socket.connect();
      return;
    }

    socket.emit(event, data);
  };

  const on = (event, handler) => {
    socketRef.current?.on(event, handler);
  };

  const off = (event, handler) => {
    socketRef.current?.off(event, handler);
  };

  /* ================= RETURN ================= */

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        alerts,
        emit,
        on,
        off,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);