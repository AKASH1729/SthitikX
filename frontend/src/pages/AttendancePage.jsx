// /**
//  * AttendancePage — FINAL OPTIMIZED (10s TRACKING 🚀)
//  */

// import React, { useState, useEffect, useCallback, useRef } from 'react';
// import { format, parseISO } from 'date-fns';
// import api from '../services/api';
// import { useAuth } from '../context/AuthContext';
// import LoadingSpinner from '../components/Shared/LoadingSpinner';

// const formatHours = (h) => {
//   if (!h) return '—';
//   const hrs = Math.floor(h);
//   const mins = Math.round((h - hrs) * 60);
//   return `${hrs}h ${mins}m`;
// };

// export default function AttendancePage() {
//   const { user } = useAuth();
//   const isAdmin = user?.role === 'admin';

//   const [records, setRecords] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [location, setLocation] = useState(null);
//   const [btnLoading, setBtnLoading] = useState(false);

//   const lastLocation = useRef(null);
//   const lastSentTime = useRef(0);
//   const watchIdRef = useRef(null);

//   /* =========================
//      📍 GET INITIAL GPS
//   ========================= */
//   useEffect(() => {
//     if (!navigator.geolocation) {
//       alert("Geolocation not supported");
//       return;
//     }

//     navigator.geolocation.getCurrentPosition(
//       (pos) => {
//         setLocation({
//           lat: pos.coords.latitude,
//           lng: pos.coords.longitude,
//         });
//       },
//       () => alert("Enable GPS"),
//       { enableHighAccuracy: true }
//     );
//   }, []);

//   /* =========================
//      🚀 START LIVE TRACKING (10 sec throttle)
//   ========================= */
//   const startTracking = () => {
//     if (watchIdRef.current) return;

//     watchIdRef.current = navigator.geolocation.watchPosition(
//       async (pos) => {
//         const now = Date.now();

//         // ⛔ only every 10 seconds
//         if (now - lastSentTime.current < 10000) return;

//         const coords = {
//           lat: pos.coords.latitude,
//           lng: pos.coords.longitude,
//         };

//         // ⛔ send only if moved enough
//         if (
//           !lastLocation.current ||
//           Math.abs(lastLocation.current.lat - coords.lat) > 0.0001 ||
//           Math.abs(lastLocation.current.lng - coords.lng) > 0.0001
//         ) {
//           lastSentTime.current = now;

//           let battery = null;

//           try {
//             if (navigator.getBattery) {
//               const batt = await navigator.getBattery();
//               battery = Math.round(batt.level * 100);
//             }
//           } catch {}

//           try {
//             await api.post("/location/update", {
//               lat: coords.lat,
//               lng: coords.lng,
//               battery
//             });

//             console.log("📍 SENT:", coords, "⏱ every 10s");

//           } catch (err) {
//             console.error("❌ API FAILED BUT CONTINUES");
//           }

//           lastLocation.current = coords;
//         }
//       },
//       (err) => console.error("GPS ERROR:", err),
//       {
//         enableHighAccuracy: true,
//         maximumAge: 0,
//         timeout: 5000
//       }
//     );
//   };

//   /* =========================
//      🔴 STOP TRACKING
//   ========================= */
//   const stopTracking = () => {
//     if (watchIdRef.current) {
//       navigator.geolocation.clearWatch(watchIdRef.current);
//       watchIdRef.current = null;
//     }
//   };

//   /* =========================
//      📊 FETCH ATTENDANCE
//   ========================= */
//   const fetchRecords = useCallback(async () => {
//     setLoading(true);
//     try {
//       const { data } = await api.get("/attendance");
//       setRecords(data.records);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchRecords();
//   }, [fetchRecords]);

//   /* =========================
//      ✅ CLOCK IN
//   ========================= */
//   const handleClockIn = async () => {
//     if (!location || btnLoading) return;

//     setBtnLoading(true);

//     try {
//       const { data } = await api.post("/attendance/clock-in", location);
//       alert(data.message);

//       startTracking(); // 🔥 start tracking
//       fetchRecords();

//     } catch (err) {
//       alert(err.response?.data?.message || "Error");
//     } finally {
//       setBtnLoading(false);
//     }
//   };

//   /* =========================
//      ✅ CLOCK OUT
//   ========================= */
//   const handleClockOut = async () => {
//     if (!location || btnLoading) return;

//     setBtnLoading(true);

//     try {
//       const { data } = await api.post("/attendance/clock-out", location);
//       alert(data.message);

//       stopTracking(); // 🔴 stop tracking
//       fetchRecords();

//     } catch (err) {
//       alert(err.response?.data?.message || "Error");
//     } finally {
//       setBtnLoading(false);
//     }
//   };

//   /* =========================
//      🧹 CLEANUP
//   ========================= */
//   useEffect(() => {
//     return () => {
//       if (watchIdRef.current) {
//         navigator.geolocation.clearWatch(watchIdRef.current);
//       }
//     };
//   }, []);

//   return (
//     <div className="p-6 space-y-4">

//       <div className="flex justify-between">
//         <h1 className="text-xl font-bold">Attendance</h1>

//         {!isAdmin && (
//           <div className="flex gap-2">
//             <button onClick={handleClockIn} className="btn-primary">
//               Clock In
//             </button>

//             <button onClick={handleClockOut} className="btn-secondary">
//               Clock Out
//             </button>
//           </div>
//         )}
//       </div>

//       {!isAdmin && (
//         <div className="card">
//           📍 {location
//             ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
//             : "Fetching..."}
//         </div>
//       )}

//       <div className="card">
//         {loading ? <LoadingSpinner /> : (
//           <table className="w-full text-sm">
//             <thead>
//               <tr>
//                 {isAdmin && <th>Employee</th>}
//                 <th>Date</th>
//                 <th>Clock In</th>
//                 <th>Clock Out</th>
//                 <th>Hours</th>
//               </tr>
//             </thead>

//             <tbody>
//               {records.map(r => (
//                 <tr key={r._id}>
//                   {isAdmin && <td>{r.employee?.name}</td>}
//                   <td>{format(parseISO(r.date), 'dd MMM')}</td>
//                   <td>{r.clockIn?.timestamp ? format(new Date(r.clockIn.timestamp), 'hh:mm a') : '-'}</td>
//                   <td>{r.clockOut?.timestamp ? format(new Date(r.clockOut.timestamp), 'hh:mm a') : '-'}</td>
//                   <td>{formatHours(r.totalHours)}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>

//     </div>
//   );
// }


/**
 * AttendancePage — FINAL (PAGARGEO READY 🚀)
 */
/**
 * AttendancePage — FINAL (PWA + TRACKING + WAKELOCK 🚀)
 */
/**
 * AttendancePage — FINAL (ALL FIXED 🔥)
 */

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
     📍 INITIAL GPS
  ========================= */
  useEffect(() => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => alert("Enable GPS"),
      { enableHighAccuracy: true }
    );
  }, []);

  /* =========================
     🔋 WAKE LOCK (SCREEN ON)
  ========================= */
  useEffect(() => {
    let wakeLock = null;

    const enableWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log("🔋 WakeLock ON");
        }
      } catch (err) {
        console.error("WakeLock error:", err);
      }
    };

    enableWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        enableWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (wakeLock) wakeLock.release();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
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

        let speed = pos.coords.speed;
        speed = speed != null ? speed : 0;

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

            console.log("📍 SENT:", coords, "🚀 speed:", speed);
          } catch {
            console.log("API failed but continues");
          }

          lastLocation.current = coords;
        }
      },
      (err) => console.error("GPS ERROR:", err),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
  };

  /* =========================
     🔴 STOP TRACKING
  ========================= */
  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  /* =========================
     🔁 AUTO RESTART TRACKING
  ========================= */
  useEffect(() => {
    const isTracking = localStorage.getItem("tracking");

    if (isTracking === "true") {
      console.log("♻️ Restart tracking");
      startTracking();
    }
  }, []);

  /* =========================
     📍 FIX OFFLINE BUG (SEND FIRST LOCATION)
  ========================= */
  useEffect(() => {
    const isTracking = localStorage.getItem("tracking");

    if (isTracking === "true" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await api.post("/location/update", {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speed: pos.coords.speed || 0
            });

            console.log("📍 Initial location sent → ONLINE");
          } catch {
            console.log("Initial location failed");
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, []);

  /* =========================
     🔁 RESUME ON FOCUS
  ========================= */
  useEffect(() => {
    const handleFocus = () => {
      const isTracking = localStorage.getItem("tracking");

      if (isTracking === "true" && !watchIdRef.current) {
        console.log("🔁 Resume tracking");
        startTracking();
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  /* =========================
     📊 FETCH ATTENDANCE
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
     ✅ CLOCK IN
  ========================= */
  const handleClockIn = async () => {
    if (!location || btnLoading) return;

    setBtnLoading(true);

    try {
      const { data } = await api.post("/attendance/clock-in", location);
      alert(data.message);

      localStorage.setItem("tracking", "true");
      startTracking();

      fetchRecords();
    } catch (err) {
      // 🔥 FIX: already clocked in case
      localStorage.setItem("tracking", "true");
      startTracking();

      alert("Already clocked in, tracking resumed");
    } finally {
      setBtnLoading(false);
    }
  };

  /* =========================
     ✅ CLOCK OUT
  ========================= */
  const handleClockOut = async () => {
    if (!location || btnLoading) return;

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
     🧹 CLEANUP
  ========================= */
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="p-6 space-y-4">

      <div className="flex justify-between">
        <h1 className="text-xl font-bold">Attendance</h1>

        {!isAdmin && (
          <div className="flex gap-2">
            <button onClick={handleClockIn} className="btn-primary">
              Clock In
            </button>

            <button onClick={handleClockOut} className="btn-secondary">
              Clock Out
            </button>
          </div>
        )}
      </div>

      {!isAdmin && (
        <div className="card">
          📍 {location
            ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
            : "Fetching..."}
        </div>
      )}

      <div className="card">
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