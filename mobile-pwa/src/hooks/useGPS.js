/**
 * useGPS — Custom hook for continuous GPS tracking on mobile
 * Uses the Geolocation API with high accuracy mode
 * Automatically sends location updates via API and Socket.io
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

const GPS_OPTIONS = {
  enableHighAccuracy: true,   // Use GPS chip (vs WiFi triangulation)
  timeout:            10000,  // 10 second timeout per reading
  maximumAge:         5000,   // Accept 5s old cached position
};

const UPDATE_INTERVAL_MS = 15000; // Send location every 15 seconds

export const useGPS = ({ attendanceId, isTracking }) => {
  const { emit } = useSocket();

  const [position,   setPosition]   = useState(null);
  const [error,      setError]      = useState(null);
  const [accuracy,   setAccuracy]   = useState(null);
  const [isWatching, setIsWatching] = useState(false);

  const watchIdRef      = useRef(null);
  const lastUpdateRef   = useRef(0);
  const lastPositionRef = useRef(null);

  const sendLocationUpdate = useCallback(async (coords) => {
    if (!isTracking || !attendanceId) return;

    const now = Date.now();
    if (now - lastUpdateRef.current < UPDATE_INTERVAL_MS) return;
    lastUpdateRef.current = now;

    const payload = {
      lat:          coords.latitude,
      lng:          coords.longitude,
      accuracy:     coords.accuracy,
      speed:        coords.speed,
      heading:      coords.heading,
      attendanceId,
    };

    try {
      // Send via REST API for reliable persistence
      await api.post('/locations/update', payload);

      // Also broadcast via WebSocket for instant map update
      emit('location:ping', {
        lat:      coords.latitude,
        lng:      coords.longitude,
        accuracy: coords.accuracy,
        speed:    coords.speed,
      });
    } catch (err) {
      console.error('Location update failed:', err.message);
      // TODO: Queue for background sync when offline
    }
  }, [isTracking, attendanceId, emit]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device');
      return;
    }

    setIsWatching(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;

        setPosition({ lat, lng });
        setAccuracy(Math.round(accuracy));
        lastPositionRef.current = pos.coords;

        // Send update (throttled internally)
        sendLocationUpdate(pos.coords);
      },
      (err) => {
        const messages = {
          1: 'Location access denied. Please enable GPS in settings.',
          2: 'Location unavailable. Check GPS signal.',
          3: 'Location request timed out.',
        };
        setError(messages[err.code] || 'GPS error');
        setIsWatching(false);
      },
      GPS_OPTIONS
    );
  }, [sendLocationUpdate]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  // Auto-start tracking when isTracking changes
  useEffect(() => {
    if (isTracking) startTracking();
    else stopTracking();

    return () => stopTracking();
  }, [isTracking, startTracking, stopTracking]);

  // Keep screen awake using WakeLock API while tracking
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      if (!isTracking || !('wakeLock' in navigator)) return;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('🔆 Screen wake lock acquired');
      } catch (err) {
        console.log('Wake lock failed:', err.message);
      }
    };

    if (isTracking) requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().then(() => console.log('🔅 Wake lock released'));
      }
    };
  }, [isTracking]);

  return { position, error, accuracy, isWatching, startTracking, stopTracking };
};
