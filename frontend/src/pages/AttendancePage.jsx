import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

const formatHours = (h) => {
  if (!h) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
};

export default function AttendancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [btnLoading, setBtnLoading] = useState(false);

  const lastLocation = useRef(null);
  const lastSentTime = useRef(0);
  const watchIdRef = useRef(null);

  /* =========================
     📍 LOCATION (GPS + FALLBACK)
  ========================= */
  useEffect(() => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    navigator.permissions?.query({ name: "geolocation" }).then((res) => {
      if (res.state === "denied") {
        alert("Please enable location permission");
      }
    });

    const success = (pos) => {
      setLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    };

    const fallback = () => {
      navigator.geolocation.getCurrentPosition(
        success,
        () => console.log("Fallback failed"),
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    };

    navigator.geolocation.getCurrentPosition(success, fallback, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    });

  }, []);

  /* =========================
     🚀 START TRACKING
  ========================= */
  const startTracking = () => {
    if (watchIdRef.current) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSentTime.current < 10000) return;

        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        let speed = pos.coords.speed ?? 0;

        if (
          !lastLocation.current ||
          Math.abs(lastLocation.current.lat - coords.lat) > 0.0001 ||
          Math.abs(lastLocation.current.lng - coords.lng) > 0.0001
        ) {
          lastSentTime.current = now;

          let battery = null;
          try {
            if (navigator.getBattery) {
              const batt = await navigator.getBattery();
              battery = Math.round(batt.level * 100);
            }
          } catch {}

          try {
            await api.post("/location/update", {
              lat: coords.lat,
              lng: coords.lng,
              speed,
              battery
            });
          } catch {}

          lastLocation.current = coords;
        }
      },
      () => {
        console.log("GPS failed → fallback mode");
        navigator.geolocation.watchPosition(() => {}, () => {}, {
          enableHighAccuracy: false,
          maximumAge: 60000,
          timeout: 10000
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  /* =========================
     AUTO RESTART
  ========================= */
  useEffect(() => {
    if (localStorage.getItem("tracking") === "true") {
      startTracking();
    }
  }, []);

  /* =========================
     FETCH RECORDS
  ========================= */
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/attendance");
      setRecords(data.records);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  /* =========================
     CLOCK IN (SAFE)
  ========================= */
  const handleClockIn = async () => {
    if (btnLoading) return;

    setBtnLoading(true);

    try {
      let loc = location;

      if (!loc && navigator.geolocation) {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject)
        );

        loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
      }

      if (!loc) {
        alert("Location not available");
        return;
      }

      const { data } = await api.post("/attendance/clock-in", loc);

      alert(data.message);
      localStorage.setItem("tracking", "true");
      startTracking();
      fetchRecords();

    } catch {
      alert("Already clocked in / Try again");
      localStorage.setItem("tracking", "true");
      startTracking();
    } finally {
      setBtnLoading(false);
    }
  };

  /* =========================
     CLOCK OUT
  ========================= */
  const handleClockOut = async () => {
    if (btnLoading) return;

    setBtnLoading(true);

    try {
      const { data } = await api.post("/attendance/clock-out", location);
      alert(data.message);

      localStorage.removeItem("tracking");
      stopTracking();
      fetchRecords();

    } catch (err) {
      alert(err.response?.data?.message || "Error");
    } finally {
      setBtnLoading(false);
    }
  };

  /* =========================
     CLEANUP
  ========================= */
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4">

      <div className="flex flex-col md:flex-row justify-between gap-2">
        <h1 className="text-lg md:text-xl font-bold">Attendance</h1>

        {!isAdmin && (
          <div className="flex gap-2">
            <button onClick={handleClockIn} className="btn-primary w-full md:w-auto">
              Clock In
            </button>

            <button onClick={handleClockOut} className="btn-secondary w-full md:w-auto">
              Clock Out
            </button>
          </div>
        )}
      </div>

      {!isAdmin && (
        <div className="card text-sm">
          📍 {location
            ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
            : "Fetching location..."}
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? <LoadingSpinner /> : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {isAdmin && <th>Employee</th>}
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Hours</th>
              </tr>
            </thead>

            <tbody>
              {records.map(r => (
                <tr key={r._id}>
                  {isAdmin && <td>{r.employee?.name}</td>}
                  <td>{format(parseISO(r.date), 'dd MMM')}</td>
                  <td>{r.clockIn?.timestamp ? format(new Date(r.clockIn.timestamp), 'hh:mm a') : '-'}</td>
                  <td>{r.clockOut?.timestamp ? format(new Date(r.clockOut.timestamp), 'hh:mm a') : '-'}</td>
                  <td>{formatHours(r.totalHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
