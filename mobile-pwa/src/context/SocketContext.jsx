import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, token }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // 🔔 Ask notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    // ✅ Use ENV variable
    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('⚠️ Socket error:', err.message);
    });

    // 🔔 Handle alerts from backend
    socket.on('alert:received', (data) => {
      console.log('📩 Alert received:', data);

      if (Notification.permission === 'granted') {
        navigator.serviceWorker.getRegistration().then((reg) => {
          reg?.showNotification('GeoTrack Alert', {
            body: data.message,
            icon: '/icons/icon-192.png',
          });
        });
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // 📡 Emit event to backend
  const emit = (event, data) => {
    if (!socketRef.current) {
      console.warn('⚠️ Socket not connected');
      return;
    }
    socketRef.current.emit(event, data);
  };

  return (
    <SocketContext.Provider value={{ connected, emit }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);