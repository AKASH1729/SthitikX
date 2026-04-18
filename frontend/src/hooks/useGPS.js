/**
 * useGPS — FINAL PRODUCTION VERSION 🔥
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 5000,
};

const UPDATE_INTERVAL_MS = 15000;
const MIN_DISTANCE_METERS = 10; // 🔥 avoid spam

export const useGPS = ({ attendanceId, isTracking }) => {
  const { emit } = useSocket();

  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [isWatching, setIsWatching] = useState(false);

  const watchIdRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const lastCoordsRef = useRef(null);

  /* ================= DISTANCE ================= */
  const getDistance = (a, b) => {
    if (!a || !b) return Infinity;

    const R = 6371e3;
    const dLat = (b.latitude - a.latitude) * Math.PI / 180;
    const dLng = (b.longitude - a.longitude) * Math.PI / 180;

    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.latitude * Math.PI / 180) *
      Math.cos(b.latitude * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  /* ================= SEND LOCATION ================= */
  const sendLocationUpdate = useCallback(async (coords) => {
    if (!isTracking || !attendanceId) return;

    const now = Date.now();

    // 🔥 throttle
    if (now - lastUpdateRef.current < UPDATE_INTERVAL_MS) return;

    // 🔥 movement filter
    const distance = getDistance(lastCoordsRef.current, coords);
    if (distance < MIN_DISTANCE_METERS) return;

    lastUpdateRef.current = now;
    lastCoordsRef.current = coords;

    const payload = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy,
      speed: coords.speed,
      heading: coords.heading,
      attendanceId,
    };

    try {
      await api.post('/locations/update', payload);

      emit('location:ping', payload);

    } catch (err) {
      console.log('📡 Offline — saving locally');

      // 🔥 STORE FAILED REQUEST
      const queue = JSON.parse(localStorage.getItem('gpsQueue') || '[]');
      queue.push(payload);
      localStorage.setItem('gpsQueue', JSON.stringify(queue));
    }
  }, [isTracking, attendanceId, emit]);

  /* ================= RETRY FAILED ================= */
  const retryQueuedLocations = async () => {
    const queue = JSON.parse(localStorage.getItem('gpsQueue') || '[]');

    if (!queue.length) return;

    console.log(`🔄 Retrying ${queue.length} locations`);

    for (const loc of queue) {
      try {
        await api.post('/locations/update', loc);
      } catch {
        return; // stop retry if still failing
      }
    }

    localStorage.removeItem('gpsQueue');
  };

  /* ================= START ================= */
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    setIsWatching(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;

        setPosition({ lat, lng });
        setAccuracy(Math.round(accuracy));

        sendLocationUpdate(pos.coords);
      },
      (err) => {
        const messages = {
          1: 'Permission denied',
          2: 'Location unavailable',
          3: 'Timeout',
        };

        setError(messages[err.code] || 'GPS error');
        setIsWatching(false);
      },
      GPS_OPTIONS
    );
  }, [sendLocationUpdate]);

  /* ================= STOP ================= */
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  /* ================= AUTO START ================= */
  useEffect(() => {
    if (isTracking) startTracking();
    else stopTracking();

    return () => stopTracking();
  }, [isTracking, startTracking, stopTracking]);

  /* ================= ONLINE RETRY ================= */
  useEffect(() => {
    window.addEventListener('online', retryQueuedLocations);
    return () => window.removeEventListener('online', retryQueuedLocations);
  }, []);

  /* ================= WAKE LOCK ================= */
  useEffect(() => {
    let wakeLock = null;

    const enableWakeLock = async () => {
      if (!isTracking || !('wakeLock' in navigator)) return;

      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch {}
    };

    enableWakeLock();

    return () => {
      wakeLock?.release();
    };
  }, [isTracking]);

  return {
    position,
    error,
    accuracy,
    isWatching,
    startTracking,
    stopTracking,
  };
};