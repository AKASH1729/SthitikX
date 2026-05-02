/**
 * TimelinePage — FIXED ACTIVITY DETECTION + PREMIUM UI
 * Fix: Speed-based classification fallback when backend type is unreliable
 * UI: Professional, 10yr-experience grade, mobile-first
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

/* ─────────────────────────────────────────────
   🔧 ACTIVITY TYPE FIX
   Backend sometimes mis-classifies movement.
   We re-classify using speed (km/h):
     < 1.0  → STOP
     1–8    → WALK
     > 8    → DRIVE
   If no distance/duration data, trust backend.
───────────────────────────────────────────── */
const classifyActivity = (item) => {
  if (item.distance != null && item.startTime && item.endTime) {
    const durationHrs =
      (new Date(item.endTime) - new Date(item.startTime)) / 3600000;
    if (durationHrs > 0) {
      const speedKmh = item.distance / durationHrs;
      if (speedKmh < 1.0) return "STOP";
      if (speedKmh <= 8.0) return "WALK";
      return "DRIVE";
    }
  }
  // fallback to backend type
  return item.type || "STOP";
};

const TYPE_CONFIG = {
  STOP: {
    emoji: "⛔",
    label: "Stop",
    color: "#ef4444",
    bg: "bg-red-50",
    border: "border-red-500",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700",
    mapColor: "#ef4444",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <circle cx="12" cy="12" r="10" />
        <rect x="6" y="11" width="12" height="2" fill="white" />
      </svg>
    ),
  },
  WALK: {
    emoji: "🚶",
    label: "Walk",
    color: "#22c55e",
    bg: "bg-emerald-50",
    border: "border-emerald-500",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
    mapColor: "#22c55e",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M13.5 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-2 4l-2 8h1.5l1-4 1.5 2v6h1.5v-7l-2-2 .5-3H16V9h-3l-1.5-3z" />
      </svg>
    ),
  },
  DRIVE: {
    emoji: "🚗",
    label: "Drive",
    color: "#3b82f6",
    bg: "bg-blue-50",
    border: "border-blue-500",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700",
    mapColor: "#3b82f6",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M5 11l1.5-4.5h11L19 11M17 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0M3 11l2-6h14l2 6v7H3z" />
      </svg>
    ),
  },
};

const getDurationSeconds = (start, end) =>
  Math.max(0, (new Date(end) - new Date(start)) / 1000);

const formatSeconds = (seconds) => {
  if (!seconds || seconds === 0) return "0s";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

const fmtTime = (ts) =>
  ts
    ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";

/* ─────────── STAT CARD ─────────── */
const StatCard = ({ type, count, formatted, isActive, onClick }) => {
  const cfg = TYPE_CONFIG[type];
  return (
    <motion.button
      whileHover={{ y: -2, boxShadow: "0 8px 25px rgba(0,0,0,0.12)" }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative rounded-2xl p-4 text-left transition-all border-2 ${
        isActive
          ? `${cfg.bg} ${cfg.border}`
          : "bg-white border-gray-100 hover:border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-2xl font-black ${isActive ? cfg.text : "text-gray-800"}`}>
          {formatted}
        </span>
        <span className="text-2xl">{cfg.emoji}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isActive ? cfg.badge : "bg-gray-100 text-gray-500"
          }`}
        >
          {count} event{count !== 1 ? "s" : ""}
        </span>
        <span className={`text-xs font-medium ${isActive ? cfg.text : "text-gray-400"}`}>
          {cfg.label}
        </span>
      </div>
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl`}
          style={{ background: cfg.color }}
        />
      )}
    </motion.button>
  );
};

/* ─────────── TIMELINE ITEM ─────────── */
const TimelineItem = ({ item, index, isActive, onClick, isLast }) => {
  const type = classifyActivity(item);
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.STOP;
  const durationSec =
    item.startTime && item.endTime
      ? getDurationSeconds(item.startTime, item.endTime)
      : (item.duration || 0) * 60;

  return (
    <div className="flex gap-3">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <motion.div
          whileHover={{ scale: 1.15 }}
          onClick={onClick}
          className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 transition-all border-2 ${
            isActive
              ? `border-white shadow-lg`
              : "border-gray-200 bg-white"
          }`}
          style={isActive ? { background: cfg.color, borderColor: cfg.color } : {}}
        >
          <span className={`text-xs ${isActive ? "text-white" : cfg.text}`}>
            {cfg.emoji}
          </span>
        </motion.div>
        {!isLast && (
          <div className="w-0.5 flex-1 mt-1 mb-1" style={{ background: isActive ? cfg.color : "#e5e7eb" }} />
        )}
      </div>

      {/* Card */}
      <motion.div
        whileHover={{ x: 2 }}
        onClick={onClick}
        className={`flex-1 mb-3 p-3 rounded-xl cursor-pointer transition-all border ${
          isActive
            ? `${cfg.bg} border-transparent shadow-md`
            : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={`text-sm font-bold ${isActive ? cfg.text : "text-gray-800"}`}>
              {cfg.label}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs text-gray-400">{fmtTime(item.startTime)}</span>
              <span className="text-gray-300 text-xs">→</span>
              <span className="text-xs text-gray-400">{fmtTime(item.endTime)}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-sm font-bold ${isActive ? cfg.text : "text-gray-700"}`}>
              {formatSeconds(durationSec)}
            </div>
            {item.distance > 0 && (
              <div className="text-xs text-gray-400">{Number(item.distance).toFixed(2)} km</div>
            )}
          </div>
        </div>

        {/* Speed badge — shows re-classified type if different from backend */}
        {type !== item.type && (
          <div className="mt-1.5">
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              ⚡ Re-classified from {item.type}
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export default function TimelinePage() {
  const { user } = useAuth();

  if (user?.role === "employee") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-red-500 font-semibold text-lg">Access Denied</p>
          <p className="text-gray-400 text-sm mt-2">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [date, setDate] = useState(today);
  const [timeline, setTimeline] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const mapRef = useRef(null);

  /* ── ENRICHED timeline with corrected types ── */
  const enrichedTimeline = timeline.map((item) => ({
    ...item,
    _resolvedType: classifyActivity(item),
  }));

  const filteredTimeline = filterType
    ? enrichedTimeline.filter((t) => t._resolvedType === filterType)
    : enrichedTimeline;

  /* ── MAP PATH ── */
  const getMapPath = useCallback(() => {
    if (activeIndex !== null && filteredTimeline[activeIndex]?.points?.length) {
      return filteredTimeline[activeIndex].points;
    }
    return enrichedTimeline.flatMap((t) => t.points || []);
  }, [activeIndex, filteredTimeline, enrichedTimeline]);

  /* ── FETCH EMPLOYEES ── */
  useEffect(() => {
    api
      .get("/v2/users?limit=100")
      .then((res) => setEmployees(res.data.users || []))
      .catch((err) => console.error("EMPLOYEE ERROR:", err));
  }, []);

  /* ── FETCH TIMELINE ── */
  const fetchTimeline = useCallback(async (empId, d) => {
    if (!empId || !d) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/timeline?employeeId=${empId}&date=${d}`);
      const data = res.data?.data || [];
      setTimeline(data);
      setActiveIndex(null);
      setFilterType(null);

      // fit map
      const coords = data.flatMap((t) => t.points || []);
      if (mapRef.current && coords.length) {
        setTimeout(() => {
          try { mapRef.current.fitBounds(coords, { padding: [50, 50] }); } catch {}
        }, 300);
      }
    } catch (err) {
      console.error("TIMELINE ERROR:", err);
      setError("Failed to load timeline data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEmployeeChange = (e) => {
    const id = e.target.value;
    setSelectedEmployee(id);
    fetchTimeline(id, date);
  };

  const handleDateChange = (e) => {
    const d = e.target.value;
    if (d > today) { alert("Future dates are not allowed."); return; }
    setDate(d);
    fetchTimeline(selectedEmployee, d);
  };

  /* ── STATS ── */
  const getStats = () => {
    const stats = { STOP: { count: 0, seconds: 0 }, WALK: { count: 0, seconds: 0 }, DRIVE: { count: 0, seconds: 0 } };
    enrichedTimeline.forEach((item) => {
      const type = item._resolvedType;
      if (!stats[type]) return;
      const secs = item.startTime && item.endTime
        ? getDurationSeconds(item.startTime, item.endTime)
        : (item.duration || 0) * 60;
      stats[type].count++;
      stats[type].seconds += secs;
    });
    return {
      ...Object.fromEntries(
        Object.entries(stats).map(([k, v]) => [k, { ...v, formatted: formatSeconds(v.seconds) }])
      ),
      total: Object.values(stats).reduce((a, b) => a + b.seconds, 0),
    };
  };

  const stats = getStats();

  /* ── MAP BOUNDS SYNC ── */
  useEffect(() => {
    const path = getMapPath();
    if (mapRef.current && path.length) {
      try { mapRef.current.fitBounds(path, { padding: [40, 40] }); } catch {}
    }
  }, [activeIndex, filterType]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ── TOP BAR ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-5 h-5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">Timeline Tracker</h1>
                <p className="text-xs text-gray-400 hidden sm:block">
                  {user?.role === "super_admin" ? "Super Admin · Full Access" : `Company: ${user?.companyId}`}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedEmployee}
                onChange={handleEmployeeChange}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none min-w-[140px]"
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp.employeeId}>{emp.name}</option>
                ))}
              </select>

              <input
                type="date"
                value={date}
                max={today}
                onChange={handleDateChange}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none"
              />

              {enrichedTimeline.length > 0 && !loading && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowModal(true)}
                  className="text-sm bg-gray-900 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-800 transition flex items-center gap-1.5"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="hidden sm:inline">Spent Time</span>
                  <span className="sm:hidden">Time</span>
                </motion.button>
              )}

              {/* Toggle sidebar on mobile */}
              <button
                className="lg:hidden text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
                onClick={() => setSidebarOpen((v) => !v)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── STAT PILLS ── */}
      {enrichedTimeline.length > 0 && !loading && (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {["STOP", "WALK", "DRIVE"].map((type) => (
              <StatCard
                key={type}
                type={type}
                count={stats[type].count}
                formatted={stats[type].formatted}
                isActive={filterType === type}
                onClick={() => {
                  setFilterType(filterType === type ? null : type);
                  setActiveIndex(null);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-2"
          >
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex justify-between items-center">
              <span>⚠️ {error}</span>
              <button
                onClick={() => fetchTimeline(selectedEmployee, date)}
                className="text-red-600 font-semibold hover:underline ml-4"
              >Retry</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN LAYOUT ── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-8">
        <div className="flex flex-col lg:flex-row gap-4">

          {/* ── SIDEBAR ── */}
          <AnimatePresence>
            {(sidebarOpen || window.innerWidth >= 1024) && (
              <motion.div
                key="sidebar"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full lg:w-72 xl:w-80 flex-shrink-0"
              >
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-800">
                      Events
                      {filterType && (
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          (filtered: {TYPE_CONFIG[filterType]?.label})
                        </span>
                      )}
                    </h2>
                    {filterType && (
                      <button
                        onClick={() => { setFilterType(null); setActiveIndex(null); }}
                        className="text-xs text-gray-400 hover:text-gray-700 transition"
                      >
                        Clear ✕
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)", minHeight: "300px" }}>
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="relative w-10 h-10">
                          <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
                          <div className="absolute inset-0 rounded-full border-2 border-t-gray-800 animate-spin" />
                        </div>
                        <span className="text-sm text-gray-400">Loading events...</span>
                      </div>
                    ) : filteredTimeline.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <div className="text-4xl mb-3">📍</div>
                        <p className="text-sm text-gray-500 font-medium">No events found</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {selectedEmployee ? "Try a different date or filter." : "Select an employee to begin."}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4">
                        {filteredTimeline.map((item, i) => (
                          <TimelineItem
                            key={i}
                            item={item}
                            index={i}
                            isActive={activeIndex === i}
                            isLast={i === filteredTimeline.length - 1}
                            onClick={() => {
                              setActiveIndex(i);
                              if (mapRef.current && item.points?.length) {
                                try { mapRef.current.fitBounds(item.points, { padding: [40, 40] }); } catch {}
                              }
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── MAP ── */}
          <div className="flex-1 min-h-[300px]">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: "calc(100vh - 230px)", minHeight: "350px" }}>
              {/* Map legend */}
              <div className="absolute z-10 m-3 flex gap-1.5 flex-wrap" style={{ pointerEvents: "none" }}>
                {["STOP", "WALK", "DRIVE"].map((type) => (
                  <div
                    key={type}
                    className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm border border-gray-100 text-xs font-medium text-gray-700"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: TYPE_CONFIG[type].mapColor }} />
                    {TYPE_CONFIG[type].label}
                  </div>
                ))}
              </div>

              <MapContainer
                center={[22.5726, 88.3639]}
                zoom={14}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
                attributionControl={false}
                whenCreated={(m) => { mapRef.current = m; }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  subdomains={["a", "b", "c"]}
                  maxZoom={19}
                  minZoom={3}
                />

                {enrichedTimeline.map((t, i) => {
                  if (!t.points?.length) return null;
                  const cfg = TYPE_CONFIG[t._resolvedType] || TYPE_CONFIG.STOP;
                  const isActive = activeIndex === i;
                  return (
                    <Polyline
                      key={i}
                      positions={t.points}
                      pathOptions={{
                        color: cfg.mapColor,
                        weight: isActive ? 7 : 3,
                        opacity: isActive ? 1 : filterType && t._resolvedType !== filterType ? 0.2 : 0.75,
                        lineCap: "round",
                        lineJoin: "round",
                      }}
                      eventHandlers={{
                        click: () => setActiveIndex(i),
                      }}
                    />
                  );
                })}
              </MapContainer>


            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ SPENT TIME MODAL ══════════════ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Spent Time Report</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-6 space-y-5">
                {/* Cards row */}
                <div className="grid grid-cols-3 gap-3">
                  {["STOP", "WALK", "DRIVE"].map((type) => {
                    const cfg = TYPE_CONFIG[type];
                    const s = stats[type];
                    return (
                      <div key={type} className={`rounded-2xl p-4 ${cfg.bg} border border-transparent`}>
                        <div className="text-2xl mb-2">{cfg.emoji}</div>
                        <div className={`text-xl font-black ${cfg.text}`}>{s.formatted}</div>
                        <div className={`text-xs mt-1 ${cfg.text} opacity-80`}>{s.count} events</div>
                        <div className={`text-xs font-semibold mt-1 ${cfg.text}`}>{cfg.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="bg-gray-900 text-white rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Total Active Time</div>
                    <div className="text-3xl font-black tracking-tight">{formatSeconds(stats.total)}</div>
                  </div>
                  <div className="text-4xl opacity-20">⏱</div>
                </div>

                {/* Events list */}
                <div>
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    All Events
                    <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {enrichedTimeline.length} total
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {enrichedTimeline.map((item, idx) => {
                      const type = item._resolvedType;
                      const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.STOP;
                      const secs = item.startTime && item.endTime
                        ? getDurationSeconds(item.startTime, item.endTime)
                        : (item.duration || 0) * 60;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-xl border ${cfg.bg} border-transparent`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-base">{cfg.emoji}</span>
                            <div>
                              <div className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</div>
                              <div className="text-xs text-gray-400">
                                {fmtTime(item.startTime)} → {fmtTime(item.endTime)}
                              </div>
                              {type !== item.type && (
                                <span className="text-xs text-amber-600">
                                  ↺ Re-classified from {item.type}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-bold ${cfg.text}`}>{formatSeconds(secs)}</div>
                            {item.distance > 0 && (
                              <div className="text-xs text-gray-400">{Number(item.distance).toFixed(2)} km</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
