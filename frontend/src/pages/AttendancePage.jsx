import React, { useState, useEffect, useCallback, useRef } from "react";
import { format, parseISO } from "date-fns";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import { FiClock, FiMapPin, FiWifi, FiWifiOff, FiCheckCircle, FiAlertCircle, FiShield } from "react-icons/fi";

const formatHours = (h) => {
  if (!h) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
};

export default function AttendancePage() {
  const { user } = useAuth();
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  const [records, setRecords] = useState([]);
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [syncStatus, setSyncStatus] = useState("online");
  const [showLocation, setShowLocation] = useState(false);
  const [assignedGeofence, setAssignedGeofence] = useState(null);
  const [geofenceError, setGeofenceError] = useState("");

  const locationIntervalRef = useRef(null);

  /* ================= 📡 INTERNET STATUS ================= */
  useEffect(() => {
    const updateStatus = () => setSyncStatus(navigator.onLine ? "online" : "offline");
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    updateStatus();
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  /* ================= 📦 OFFLINE STORAGE ================= */
  const saveOffline = (data) => {
    const existing = JSON.parse(localStorage.getItem("offlineLocations") || "[]");
    existing.push({ ...data, syncId: Date.now() });
    localStorage.setItem("offlineLocations", JSON.stringify(existing));
  };

  const getOffline = () => JSON.parse(localStorage.getItem("offlineLocations") || "[]");
  const clearOffline = () => localStorage.removeItem("offlineLocations");

  /* ================= 🔄 SYNC ================= */
  const syncOfflineData = useCallback(async () => {
    const data = getOffline();
    if (!data.length) return;
    try {
      await api.post("/location/sync", data);
      clearOffline();
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("online"), 2000);
    } catch {
      setSyncStatus("sync-failed");
      setTimeout(() => setSyncStatus("online"), 2000);
    }
  }, []);

  /* ================= 📍 LOCATION UPDATE (30 sec interval) ================= */
  const updateLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const data = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          deviceId: "WEB_DEVICE",
          syncId: Date.now().toString(),
        };
        setLocation(data);

        if (navigator.onLine) {
          try {
            await api.post("/location/update", data);
          } catch {
            saveOffline(data);
          }
        } else {
          saveOffline(data);
        }
      },
      (err) => console.warn("Location error:", err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const startTracking = useCallback(() => {
    if (locationIntervalRef.current) return;
    // Send first location immediately
    updateLocation();
    // Then every 30 seconds
    locationIntervalRef.current = setInterval(updateLocation, 30000);
  }, [updateLocation]);

  const stopTracking = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  /* ================= FETCH RECORDS & GEOFENCE ================= */
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const [all, todayRes] = await Promise.all([
        api.get("/attendance"),
        api.get("/attendance/today"),
      ]);
      setRecords(all.data.records);
      setToday(todayRes.data.attendance);

      // Only fetch geofence for non‑admin users
      if (!isAdmin) {
        try {
          const geofenceRes = await api.get("/users/me/geofence");
          if (geofenceRes.data?.geofence) setAssignedGeofence(geofenceRes.data.geofence);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchRecords();
    // Check if user was already clocked in (tracking flag)
    if (localStorage.getItem("tracking") === "true") {
      startTracking();
    }
    const interval = setInterval(syncOfflineData, 15000);
    return () => {
      stopTracking();
      clearInterval(interval);
    };
  }, [fetchRecords, startTracking, stopTracking, syncOfflineData]);

  /* ================= GEOFENCE VALIDATION ================= */
  const checkInsideGeofence = (lat, lng) => {
    if (!assignedGeofence) return true;
    const center = assignedGeofence.center;
    const radius = assignedGeofence.radius;
    const R = 6371e3;
    const φ1 = (center.lat * Math.PI) / 180;
    const φ2 = (lat * Math.PI) / 180;
    const Δφ = ((lat - center.lat) * Math.PI) / 180;
    const Δλ = ((lng - center.lng) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance <= radius;
  };

  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  };

  /* ================= CLOCK IN ================= */
  const handleClockIn = async () => {
    setBtnLoading("clock-in");
    setGeofenceError("");
    try {
      const pos = await getCurrentPosition();
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      if (!isAdmin && assignedGeofence && !checkInsideGeofence(loc.lat, loc.lng)) {
        setGeofenceError(`You are outside your assigned zone: ${assignedGeofence.name}. Please move inside the zone to clock in.`);
        setBtnLoading(false);
        return;
      }

      await api.post("/attendance/clock-in", loc);
      localStorage.setItem("tracking", "true");
      startTracking(); // start 30‑sec location updates
      fetchRecords();
    } catch (err) {
      alert(err.response?.data?.message || "Clock-in failed. Enable location and try again.");
    }
    setBtnLoading(false);
  };

  /* ================= CLOCK OUT ================= */
  const handleClockOut = async () => {
    setBtnLoading("clock-out");
    setGeofenceError("");
    try {
      const pos = await getCurrentPosition();
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      if (!isAdmin && assignedGeofence && !checkInsideGeofence(loc.lat, loc.lng)) {
        setGeofenceError(`You are outside your assigned zone: ${assignedGeofence.name}. Please move inside the zone to clock out.`);
        setBtnLoading(false);
        return;
      }

      await api.post("/attendance/clock-out", loc);
      localStorage.removeItem("tracking");
      stopTracking(); // stop location updates
      fetchRecords();
    } catch (err) {
      alert(err.response?.data?.message || "Clock-out failed.");
    }
    setBtnLoading(false);
  };

  if (loading) return <LoadingSpinner text="Loading attendance data..." />;

  const alreadyClockedIn = !!today?.clockIn;
  const alreadyClockedOut = !!today?.clockOut;

  const statusConfig = {
    online: { icon: <FiWifi className="text-green-500" />, text: "Online" },
    offline: { icon: <FiWifiOff className="text-red-500" />, text: "Offline" },
    synced: { icon: <FiCheckCircle className="text-green-500" />, text: "Synced" },
    "sync-failed": { icon: <FiAlertCircle className="text-yellow-500" />, text: "Sync Failed" },
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 w-full">
      {/* Header - Full Width */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Attendance Dashboard</h1>
          <p className="text-gray-600">
            {isAdmin ? "View all employee attendance records" : "Track your work hours and location"}
          </p>
        </div>
        <div className="flex items-center mt-2 md:mt-0 bg-white px-3 py-2 rounded-full shadow-sm">
          {statusConfig[syncStatus].icon}
          <span className="ml-2 text-sm font-medium text-gray-700">{statusConfig[syncStatus].text}</span>
        </div>
      </div>

      {/* Employee‑only content: geofence info & action cards */}
      {!isAdmin && (
        <>
          {/* Geofence Alert */}
          {geofenceError && (
            <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg flex items-start gap-3">
              <FiAlertCircle className="text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Geofence Restriction</p>
                <p className="text-sm text-yellow-700">{geofenceError}</p>
              </div>
              <button onClick={() => setGeofenceError("")} className="ml-auto text-yellow-600">✕</button>
            </div>
          )}

          {/* Assigned Geofence Badge */}
          {assignedGeofence && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <FiShield className="text-blue-600" />
              <span className="text-sm text-blue-800">
                Your assigned work zone: <strong>{assignedGeofence.name}</strong> (radius {assignedGeofence.radius}m)
              </span>
            </div>
          )}

          {/* Three Cards Row (only for employees) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Status Card */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-700">Today's Status</h2>
                <FiClock className="text-blue-500" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500">Current Status</p>
                  <p className="text-xl font-bold mt-1">
                    {alreadyClockedOut ? "Completed" : alreadyClockedIn ? "Working" : "Not Started"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500">Hours Today</p>
                  <p className="text-xl font-bold mt-1">{today?.totalHours ? formatHours(today.totalHours) : "—"}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Actions</h2>
              <div className="flex flex-col space-y-3">
                <button
                  disabled={alreadyClockedIn || btnLoading}
                  onClick={handleClockIn}
                  className={`flex items-center justify-center py-3 px-4 rounded-lg transition-all ${
                    alreadyClockedIn
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600 text-white"
                  }`}
                >
                  {btnLoading === "clock-in" ? (
                    <span className="animate-pulse">Processing...</span>
                  ) : (
                    <>
                      <span>Clock In</span>
                      {alreadyClockedIn && <span className="ml-2 text-sm">✓ Done</span>}
                    </>
                  )}
                </button>
                <button
                  disabled={!alreadyClockedIn || alreadyClockedOut || btnLoading}
                  onClick={handleClockOut}
                  className={`flex items-center justify-center py-3 px-4 rounded-lg transition-all ${
                    !alreadyClockedIn || alreadyClockedOut
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-red-500 hover:bg-red-600 text-white"
                  }`}
                >
                  {btnLoading === "clock-out" ? (
                    <span className="animate-pulse">Processing...</span>
                  ) : (
                    <>
                      <span>Clock Out</span>
                      {alreadyClockedOut && <span className="ml-2 text-sm">✓ Done</span>}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Location Card */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-700">Live Location</h2>
                <FiMapPin className="text-blue-500" />
              </div>
              <div className="flex flex-col">
                {location ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-500">Lat:</span>
                      <span className="font-medium">{location.lat.toFixed(5)}</span>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-gray-500">Lng:</span>
                      <span className="font-medium">{location.lng.toFixed(5)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Updated every 30 seconds</p>
                  </>
                ) : (
                  <p className="text-gray-500">Waiting for location...</p>
                )}
                <button
                  onClick={() => setShowLocation(!showLocation)}
                  className="mt-4 text-sm text-blue-500 hover:text-blue-700 self-start"
                >
                  {showLocation ? "Hide Map" : "Show on Map"}
                </button>
                {showLocation && location && (
                  <div className="mt-3 h-40 bg-gray-100 rounded-lg overflow-hidden">
                    <iframe
                      title="location-map"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      src={`https://maps.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Attendance Records Table - shown for both admin and employees */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-700">
            {isAdmin ? "All Attendance Records" : "Your Attendance History"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.length > 0 ? (
                records.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    {isAdmin && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.employee?.name}</td>}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{format(parseISO(r.date), "dd MMM yyyy")}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {r.clockIn?.timestamp ? format(new Date(r.clockIn.timestamp), "hh:mm a") : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {r.clockOut?.timestamp ? format(new Date(r.clockOut.timestamp), "hh:mm a") : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatHours(r.totalHours)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No attendance records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}