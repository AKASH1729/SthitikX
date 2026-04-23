/**
 * TimelinePage — PRECISE TIME SPENT WITH SECONDS + "SPENT TIME" BUTTON 🔥
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import api from "../services/api";
import {
  MapContainer,
  TileLayer,
  Polyline,
  AttributionControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export default function TimelinePage() {
  const { user } = useAuth();

  /* 🔥 ROLE PROTECTION */
  if (user?.role === "employee") {
    return <p className="text-center mt-20 text-red-500 font-semibold">Access denied</p>;
  }

  const today = new Date().toISOString().split("T")[0];

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [date, setDate] = useState(today);

  const [timeline, setTimeline] = useState([]);
  const [selectedPath, setSelectedPath] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSpentTimeModal, setShowSpentTimeModal] = useState(false);

  const mapRef = useRef(null);

  /* ================= FETCH EMPLOYEES ================= */
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get("/v2/users?limit=100");
        setEmployees(res.data.users || []);
      } catch (err) {
        console.error("EMPLOYEE ERROR:", err);
      }
    };
    fetchEmployees();
  }, []);

  /* ================= FETCH TIMELINE ================= */
const fetchTimeline = useCallback(async (empId, d) => {
  if (!empId || !d) return;

  setLoading(true);
  setError(null);

  try {
    const res = await api.get(
      `/timeline?employeeId=${empId}&date=${d}`
    );

    // ✅ FIX: get correct array
    const timelineData = res.data?.data || [];

    setTimeline(timelineData);

    // ✅ FIX: safe iteration
    let coords = [];
    timelineData.forEach((t) => {
      if (t.points && Array.isArray(t.points)) {
        coords.push(...t.points);
      }
    });

    setSelectedPath(coords);
    setActiveIndex(null);

    console.log("TIMELINE:", timelineData.length);

  } catch (err) {
    console.error("TIMELINE ERROR:", err);
    setError("Failed to load timeline");
  } finally {
    setLoading(false);
  }
}, []);

  /* ================= HANDLE SELECTION ================= */
  const handleEmployeeChange = (e) => {
    const id = e.target.value;
    setSelectedEmployee(id);
    fetchTimeline(id, date);
  };

  const handleDateChange = (e) => {
    const d = e.target.value;
    if (d > today) {
      alert("Future date not allowed");
      return;
    }
    setDate(d);
    fetchTimeline(selectedEmployee, d);
  };

  /* ================= AUTO-FIT MAP BOUNDS ================= */
  useEffect(() => {
    if (mapRef.current && selectedPath.length > 0) {
      try {
        mapRef.current.fitBounds(selectedPath, { padding: [50, 50] });
      } catch (err) {
        console.warn("Could not fit bounds", err);
      }
    }
  }, [selectedPath]);

  /* ================= HELPER: DURATION IN SECONDS ================= */
  const getDurationSeconds = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.max(0, (endDate - startDate) / 1000);
  };

  /* ================= FORMAT SECONDS ================= */
  const formatSeconds = (seconds) => {
    if (seconds === 0) return "0 sec";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    let result = "";
    if (hrs > 0) result += `${hrs} hr `;
    if (mins > 0) result += `${mins} min `;
    if (secs > 0 || (hrs === 0 && mins === 0)) result += `${secs} sec`;
    return result.trim();
  };

  /* ================= CALCULATE SPENT TIME STATS ================= */
  const getSpentTimeStats = () => {
    let stopCount = 0;
    let walkCount = 0;
    let driveCount = 0;
    let stopSeconds = 0;
    let walkSeconds = 0;
    let driveSeconds = 0;
    const events = [];

    timeline.forEach((item) => {
      let durationSec = 0;
      if (item.startTime && item.endTime) {
        durationSec = getDurationSeconds(item.startTime, item.endTime);
      } else {
        durationSec = (item.duration || 0) * 60;
      }

      const event = {
        type: item.type,
        start: item.startTime,
        end: item.endTime,
        durationSec,
        distance: item.distance || 0,
      };
      events.push(event);

      switch (item.type) {
        case "STOP":
          stopCount++;
          stopSeconds += durationSec;
          break;
        case "WALK":
          walkCount++;
          walkSeconds += durationSec;
          break;
        case "DRIVE":
          driveCount++;
          driveSeconds += durationSec;
          break;
        default:
          break;
      }
    });

    return {
      stop: { count: stopCount, seconds: stopSeconds, formatted: formatSeconds(stopSeconds) },
      walk: { count: walkCount, seconds: walkSeconds, formatted: formatSeconds(walkSeconds) },
      drive: { count: driveCount, seconds: driveSeconds, formatted: formatSeconds(driveSeconds) },
      totalSeconds: stopSeconds + walkSeconds + driveSeconds,
      events,
    };
  };

  const spentStats = getSpentTimeStats();

  return (
    <div className="p-6 max-w-full">
      {/* HEADER */}
      <div className="mb-5 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🕒 Timeline Tracking</h2>
          <p className="text-sm text-gray-500 mt-1">
            {user?.role === "super_admin"
              ? "👑 Super Admin – full access"
              : `🏢 Company: ${user?.companyId}`}
          </p>
        </div>
        {/* SPENT TIME BUTTON */}
        {timeline.length > 0 && !loading && (
          <button
            onClick={() => setShowSpentTimeModal(true)}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2 font-medium"
          >
            ⏱️ Spent Time
          </button>
        )}
      </div>

      {/* FILTER CONTROLS */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={selectedEmployee}
          onChange={handleEmployeeChange}
          className="border border-gray-300 rounded-lg px-4 py-2 text-base focus:ring-2 focus:ring-blue-400 focus:outline-none"
        >
          <option value="">Select Employee</option>
          {employees.map((emp) => (
            <option key={emp._id} value={emp.employeeId}>
              {emp.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          max={today}
          onChange={handleDateChange}
          className="border border-gray-300 rounded-lg px-4 py-2 text-base focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />
      </div>

      {/* SUMMARY PANEL (quick view) */}
      {timeline.length > 0 && !loading && (
        <div className="bg-white rounded-xl shadow-md p-5 mb-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            📊 Quick Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-500">
              <div className="flex items-center gap-2">
                <span className="text-xl">⛔</span>
                <span className="font-bold text-red-700">Stops</span>
              </div>
              <p className="text-2xl font-bold text-red-800">{spentStats.stop.formatted}</p>
              <p className="text-sm text-red-600">{spentStats.stop.count} events</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚶</span>
                <span className="font-bold text-green-700">Walking</span>
              </div>
              <p className="text-2xl font-bold text-green-800">{spentStats.walk.formatted}</p>
              <p className="text-sm text-green-600">{spentStats.walk.count} events</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚗</span>
                <span className="font-bold text-blue-700">Driving</span>
              </div>
              <p className="text-2xl font-bold text-blue-800">{spentStats.drive.formatted}</p>
              <p className="text-sm text-blue-600">{spentStats.drive.count} events</p>
            </div>
          </div>
        </div>
      )}

      {/* LOADING & ERROR STATES */}
      {loading && (
        <div className="flex items-center gap-2 text-blue-600 mb-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Loading timeline...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-4 rounded flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => fetchTimeline(selectedEmployee, date)}
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* MAIN LAYOUT: TIMELINE LIST + MAP */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* TIMELINE LIST */}
        <div className="w-full lg:w-80 bg-white rounded-xl shadow-md p-5 overflow-y-auto h-[500px] border border-gray-100">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
            📋 Timeline Events
          </h3>

          {timeline.length === 0 && !loading && (
            <p className="text-gray-500 text-center py-8">No data for selected date</p>
          )}

          <div className="space-y-3">
            {timeline.map((item, i) => {
              let durationStr = "";
              if (item.startTime && item.endTime) {
                const secs = getDurationSeconds(item.startTime, item.endTime);
                durationStr = formatSeconds(secs);
              } else {
                durationStr = `${item.duration || 0} min`;
              }
              return (
                <div
                  key={i}
                  onClick={() => {
                    setSelectedPath(item.points);
                    setActiveIndex(i);
                    if (mapRef.current && item.points.length) {
                      mapRef.current.fitBounds(item.points, { padding: [40, 40] });
                    }
                  }}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    activeIndex === i
                      ? "bg-blue-50 border-l-4 border-blue-500 shadow-sm"
                      : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">
                      {item.type === "STOP" && "⛔"}
                      {item.type === "WALK" && "🚶"}
                      {item.type === "DRIVE" && "🚗"}
                    </span>
                    <p className="font-bold text-gray-800">
                      {item.type === "STOP" && "Stop"}
                      {item.type === "WALK" && "Walk"}
                      {item.type === "DRIVE" && "Drive"}
                    </p>
                  </div>

                  <p className="text-sm text-gray-500 mb-1">
                    ⏱️ {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })} →
                    {new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                  </p>

                  <p className="text-sm">
                    📏 {item.distance} km • ⏳ {durationStr}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAP */}
        <div className="flex-1 bg-gray-100 rounded-xl overflow-hidden shadow-md">
          <MapContainer
            center={[22.5726, 88.3639]}
            zoom={14}
            style={{ height: "500px", width: "100%" }}
            zoomControl={true}
            scrollWheelZoom={true}
            attributionControl={false}
            whenCreated={(mapInstance) => {
              mapRef.current = mapInstance;
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              subdomains={['a', 'b', 'c']}
              maxZoom={19}
              minZoom={3}
            />

            {timeline.map((t, i) => (
              <Polyline
                key={i}
                positions={t.points}
                pathOptions={{
                  color:
                    t.type === "STOP"
                      ? "#ef4444"
                      : t.type === "WALK"
                      ? "#22c55e"
                      : "#3b82f6",
                  weight: activeIndex === i ? 6 : 3,
                  opacity: 0.8,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            ))}
          </MapContainer>
          <div className="text-xs text-gray-500 text-center py-1 bg-white border-t">
            🗺️ Detailed map data © OpenStreetMap
          </div>
        </div>
      </div>

      {/* ================= SPENT TIME MODAL ================= */}
      <AnimatePresence>
        {showSpentTimeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSpentTimeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b p-5 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  ⏱️ Spent Time Report
                  <span className="text-sm font-normal text-gray-500">
                    ({new Date(date).toLocaleDateString()})
                  </span>
                </h2>
                <button
                  onClick={() => setShowSpentTimeModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-red-100 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">⛔</div>
                    <div className="font-bold text-red-800 text-xl">{spentStats.stop.count}</div>
                    <div className="text-red-700">Stop Events</div>
                    <div className="text-sm text-red-600 mt-1">{spentStats.stop.formatted}</div>
                  </div>
                  <div className="bg-green-100 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">🚶</div>
                    <div className="font-bold text-green-800 text-xl">{spentStats.walk.count}</div>
                    <div className="text-green-700">Walk Events</div>
                    <div className="text-sm text-green-600 mt-1">{spentStats.walk.formatted}</div>
                  </div>
                  <div className="bg-blue-100 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">🚗</div>
                    <div className="font-bold text-blue-800 text-xl">{spentStats.drive.count}</div>
                    <div className="text-blue-700">Drive Events</div>
                    <div className="text-sm text-blue-600 mt-1">{spentStats.drive.formatted}</div>
                  </div>
                </div>

                {/* Total */}
                <div className="bg-gray-100 rounded-xl p-4 text-center">
                  <div className="text-xl font-bold text-gray-800">Total Active Time</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {formatSeconds(spentStats.totalSeconds)}
                  </div>
                </div>

                {/* Detailed Events List */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 border-b pb-2">📋 All Events</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {spentStats.events.map((event, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span>
                            {event.type === "STOP" && "⛔"}
                            {event.type === "WALK" && "🚶"}
                            {event.type === "DRIVE" && "🚗"}
                          </span>
                          <span className="font-medium">
                            {event.type === "STOP" && "Stop"}
                            {event.type === "WALK" && "Walk"}
                            {event.type === "DRIVE" && "Drive"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })} -
                            {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                          </span>
                        </div>
                        <div className="text-sm font-mono">
                          {formatSeconds(event.durationSec)}
                          {event.distance > 0 && ` • ${event.distance.toFixed(2)} km`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
