/**
 * useGPS — Production-ready GPS tracking hook
 * Features:
 * - High accuracy tracking
 * - API + Socket updates
 * - Offline queue (localStorage)
 * - Background sync support
 * - Movement detection (avoid duplicate calls)
 * - Battery optimization
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

/* ===============================
   CONFIG
================================ */
const UPDATE_INTERVAL_MS = 15000; // 15 sec

/* ===============================
   OFFLINE QUEUE
================================ */
const queueLocation = (payload) => {
  const existing = JSON.parse(localStorage.getItem('gpsQueue') || '[]');
  existing.push(payload);
  localStorage.setItem('gpsQueue', JSON.stringify(existing));
};

/* ===============================
   MOVEMENT CHECK (~10 meters)
================================ */
const hasMoved = (prev, curr) => {
  if (!prev) return true;

  const dx = prev.latitude - curr.latitude;
  const dy = prev.longitude - curr.longitude;

  return Math.sqrt(dx * dx + dy * dy) > 0.0001;
};

/* ===============================
   HOOK
================================ */
export const useGPS = ({ attendanceId, isTracking }) => {
  const { emit } = useSocket();

  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [isWatching, setIsWatching] = useState(false);

  const watchIdRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const lastPositionRef = useRef(null);

  /* ===============================
     SEND LOCATION
  ================================ */
  const sendLocationUpdate = useCallback(async (coords) => {
    if (!isTracking || !attendanceId) return;

    // 🔍 Movement check
    if (!hasMoved(lastPositionRef.current, coords)) return;

    // ⏱ Throttle
    const now = Date.now();
    if (now - lastUpdateRef.current < UPDATE_INTERVAL_MS) return;
    lastUpdateRef.current = now;

    const payload = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy,
      speed: coords.speed,
      heading: coords.heading,
      attendanceId,
    };

    try {
      // 🌐 API call
      await api.post('/locations/update', payload);

      // ⚡ Real-time socket update
      emit?.('location:ping', payload);

    } catch (err) {
      console.error('❌ Location update failed:', err.message);

      // 💾 Store offline
      queueLocation(payload);

      // 🔄 Trigger background sync
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.sync.register('location-sync');
        });
      }
    }
  }, [isTracking, attendanceId, emit]);

  /* ===============================
     START TRACKING
  ================================ */
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    setIsWatching(true);
    setError(null);

    const GPS_OPTIONS = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 10000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = pos.coords;

        setPosition({
          lat: coords.latitude,
          lng: coords.longitude,
        });

        setAccuracy(Math.round(coords.accuracy));

        lastPositionRef.current = coords;

        sendLocationUpdate(coords);
      },
      (err) => {
        const messages = {
          1: 'Permission denied. Enable location.',
          2: 'Location unavailable.',
          3: 'Request timeout.',
        };

        setError(messages[err.code] || 'GPS error');
        setIsWatching(false);
      },
      GPS_OPTIONS
    );
  }, [sendLocationUpdate]);

  /* ===============================
     STOP TRACKING
  ================================ */
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  /* ===============================
     AUTO START/STOP
  ================================ */
  useEffect(() => {
    if (isTracking) startTracking();
    else stopTracking();

    return () => stopTracking();
  }, [isTracking, startTracking, stopTracking]);

  /* ===============================
     WAKE LOCK (KEEP SCREEN ON)
  ================================ */
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      if (!isTracking || !('wakeLock' in navigator)) return;

      try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('🔆 Wake lock ON');
      } catch (err) {
        console.log('Wake lock failed:', err.message);
      }
    };

    if (isTracking) requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().then(() => console.log('🔅 Wake lock OFF'));
      }
    };
  }, [isTracking]);

  /* ===============================
     RETURN
  ================================ */
  return {
    position,
    error,
    accuracy,
    isWatching,
    startTracking,
    stopTracking,
  };
};