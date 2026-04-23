import React, { useState, useEffect, useCallback, useRef } from "react";
import { format, parseISO } from "date-fns";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import {
  FiClock,
  FiMapPin,
  FiWifi,
  FiWifiOff,
  FiCheckCircle,
  FiAlertCircle,
  FiShield,
  FiCalendar,
  FiUser,
  FiLogIn,
  FiLogOut,
} from "react-icons/fi";

const formatHours = (h) => {
  if (!h && h !== 0) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
};

export default function AttendancePage() {
  const { user } = useAuth();
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  // State
  const [groupedRecords, setGroupedRecords] = useState({}); // key: YYYY-MM-DD, value: array
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [syncStatus, setSyncStatus] = useState("online");
  const [showLocation, setShowLocation] = useState(false);
  const [assignedGeofence, setAssignedGeofence] = useState(null);
  const [geofenceError, setGeofenceError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
    updateLocation();
    locationIntervalRef.current = setInterval(updateLocation, 30000);
  }, [updateLocation]);

  const stopTracking = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  /* ================= FETCH TODAY & GEOFENCE ================= */
  const fetchTodayAndGeofence = useCallback(async () => {
    try {
      const [todayRes, geofenceRes] = await Promise.all([
        api.get("/attendance/today"),
        isAdmin ? Promise.resolve({ data: {} }) : api.get("/users/me/geofence").catch(() => ({ data: {} })),
      ]);
      setToday(todayRes.data.attendance);
      if (!isAdmin && geofenceRes.data?.geofence) {
        setAssignedGeofence(geofenceRes.data.geofence);
      }
    } catch (err) {
      console.error("Failed to fetch today's data", err);
    }
  }, [isAdmin]);

  /* ================= FETCH GROUPED RECORDS FOR SELECTED DATE ================= */
  const fetchGroupedRecords = useCallback(async (date) => {
    if (!date) return;
    setLoadingHistory(true);
    try {
      const res = await api.get(`/attendance?date=${date}`);
      // 🔥 FIX: backend returns grouped data under res.data.data
      const grouped = res.data.data || {};
      setGroupedRecords(grouped);
    } catch (err) {
      console.error("Failed to fetch attendance for date", err);
      setGroupedRecords({});
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchTodayAndGeofence();
      await fetchGroupedRecords(selectedDate);
      setLoading(false);
    };
    init();
  }, [fetchTodayAndGeofence, fetchGroupedRecords, selectedDate]);

  // When date picker changes, fetch new records
  useEffect(() => {
    if (selectedDate) {
      fetchGroupedRecords(selectedDate);
    }
  }, [selectedDate, fetchGroupedRecords]);

  // Tracking start/stop based on clock-in status
  useEffect(() => {
    if (localStorage.getItem("tracking") === "true") {
      startTracking();
    } else {
      stopTracking();
    }
    const interval = setInterval(syncOfflineData, 15000);
    return () => {
      stopTracking();
      clearInterval(interval);
    };
  }, [startTracking, stopTracking, syncOfflineData]);

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
      startTracking();
      await fetchTodayAndGeofence();
      // Refresh records for the selected date if it's today
      if (selectedDate === new Date().toISOString().split("T")[0]) {
        await fetchGroupedRecords(selectedDate);
      }
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
      stopTracking();
      await fetchTodayAndGeofence();
      if (selectedDate === new Date().toISOString().split("T")[0]) {
        await fetchGroupedRecords(selectedDate);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Clock-out failed.");
    }
    setBtnLoading(false);
  };

  if (loading) return <LoadingSpinner fullScreen />;

  const alreadyClockedIn = !!today?.clockIn;
  const alreadyClockedOut = !!today?.clockOut;

  const statusConfig = {
    online: { icon: <FiWifi className="inline mr-1" />, text: "Online" },
    offline: { icon: <FiWifiOff className="inline mr-1" />, text: "Offline" },
    synced: { icon: <FiCheckCircle className="inline mr-1" />, text: "Synced" },
    "sync-failed": { icon: <FiAlertCircle className="inline mr-1" />, text: "Sync Failed" },
  };

  // Sort dates descending (newest first)
  const sortedDates = Object.keys(groupedRecords).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Attendance Dashboard</h1>
            <p className="text-gray-500 mt-1">
              {isAdmin ? "View all employee attendance records" : "Track your work hours and location"}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-3 sm:mt-0">
            <div className="bg-white rounded-full px-4 py-2 shadow-sm text-sm font-medium text-gray-700">
              {statusConfig[syncStatus].icon}
              {statusConfig[syncStatus].text}
            </div>
          </div>
        </div>

        {/* Employee‑only content */}
        {!isAdmin && (
          <div className="space-y-6 mb-10">
            {/* Geofence error alert */}
            {geofenceError && (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg flex items-start gap-3 shadow-sm">
                <FiAlertCircle className="text-amber-500 text-xl flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">Geofence Restriction</p>
                  <p className="text-sm text-amber-700">{geofenceError}</p>
                </div>
                <button onClick={() => setGeofenceError("")} className="text-amber-600 hover:text-amber-800">
                  ✕
                </button>
              </div>
            )}

            {/* Assigned geofence badge */}
            {assignedGeofence && (
              <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2 text-blue-800 text-sm shadow-sm">
                <FiShield className="text-blue-500 text-lg" />
                <span>
                  Your assigned work zone: <strong>{assignedGeofence.name}</strong> (radius {assignedGeofence.radius}m)
                </span>
              </div>
            )}

            {/* Three Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Status Card */}
              <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">Today's Status</h3>
                  <div className="p-2 bg-blue-100 rounded-full">
                    <FiClock className="text-blue-600" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Current Status</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {alreadyClockedOut ? "Completed" : alreadyClockedIn ? "Working" : "Not Started"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Hours Today</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {today?.totalHours != null ? formatHours(today.totalHours) : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-white rounded-2xl shadow-md p-6">
                <h3 className="font-semibold text-gray-700 mb-4">Actions</h3>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleClockIn}
                    disabled={btnLoading === "clock-in" || alreadyClockedIn}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium transition ${
                      alreadyClockedIn
                        ? "bg-green-100 text-green-700 cursor-default"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    }`}
                  >
                    {btnLoading === "clock-in" ? (
                      "Processing..."
                    ) : (
                      <>
                        <FiLogIn size={18} />
                        Clock In {alreadyClockedIn && "✓"}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleClockOut}
                    disabled={btnLoading === "clock-out" || !alreadyClockedIn || alreadyClockedOut}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium transition ${
                      !alreadyClockedIn || alreadyClockedOut
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                    }`}
                  >
                    {btnLoading === "clock-out" ? (
                      "Processing..."
                    ) : (
                      <>
                        <FiLogOut size={18} />
                        Clock Out {alreadyClockedOut && "✓"}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Location Card */}
              <div className="bg-white rounded-2xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">Live Location</h3>
                  <div className="p-2 bg-green-100 rounded-full">
                    <FiMapPin className="text-green-600" />
                  </div>
                </div>
                {location ? (
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-gray-500">Lat:</span>{" "}
                      <span className="font-mono">{location.lat.toFixed(6)}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Lng:</span>{" "}
                      <span className="font-mono">{location.lng.toFixed(6)}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Updated every 30 seconds</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Waiting for location...</p>
                )}
                <button
                  onClick={() => setShowLocation(!showLocation)}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showLocation ? "Hide Map" : "Show on Map"}
                </button>
                {showLocation && location && (
                  <div className="mt-3 h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                    Map preview (integrate react-leaflet or static map image)
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Attendance Records Section */}
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {isAdmin ? "Attendance Records" : "Your Attendance History"}
            </h2>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
              <FiCalendar className="text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-none focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            {loadingHistory ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
                <p className="mt-3 text-gray-500">Loading records...</p>
              </div>
            ) : sortedDates.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                No attendance records for {format(parseISO(selectedDate), "dd MMM yyyy")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {isAdmin && (
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee
                        </th>
                      )}
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Clock In
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Clock Out
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hours
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {sortedDates.map((date) => (
                      <React.Fragment key={date}>
                        {/* Date header row */}
                        <tr className="bg-gray-100">
                          <td
                            colSpan={isAdmin ? 5 : 4}
                            className="px-6 py-3 text-sm font-semibold text-gray-700"
                          >
                            {format(parseISO(date), "EEEE, dd MMM yyyy")}
                          </td>
                        </tr>
                        {/* Records for this date */}
                        {groupedRecords[date].map((record) => (
                          <tr key={record._id} className="hover:bg-gray-50 transition">
                            {isAdmin && (
                              <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                    <FiUser size={12} className="text-blue-600" />
                                  </div>
                                  {record.employee?.name}
                                </div>
                              </td>
                            )}
                            <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                              {format(parseISO(record.date), "dd MMM yyyy")}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap">
                              {record.clockIn?.timestamp
                                ? format(new Date(record.clockIn.timestamp), "hh:mm a")
                                : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap">
                              {record.clockOut?.timestamp
                                ? format(new Date(record.clockOut.timestamp), "hh:mm a")
                                : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">
                              {formatHours(record.totalHours)}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
