/**
 * SocketContext — FIXED STABLE VERSION 🚀
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();

  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const newSocket = io(
      process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000',
      {
        auth: { token },
        transports: ['websocket'], // 🔥 force websocket (better for realtime)
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      }
    );

    newSocket.on('connect', () => {
      console.log('🔌 Socket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setIsConnected(false);
    });

    // 🔥 IMPORTANT: listen location updates here also (debug)
    newSocket.on('location:update', (data) => {
      console.log("📡 SOCKET RECEIVED:", data);
    });

    newSocket.on('alert:received', (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 20));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, user]);

  /* ================= SAFE METHODS ================= */

  const emit = (event, data) => {
    if (socket?.connected) {
      socket.emit(event, data);
    }
  };

  const on = (event, handler) => {
    socket?.on(event, handler);
  };

  const off = (event, handler) => {
    socket?.off(event, handler);
  };

  return (
    <SocketContext.Provider
      value={{ socket, isConnected, emit, on, off, alerts }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);