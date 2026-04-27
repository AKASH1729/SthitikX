/**
 * LiveMapPage.jsx
 *
 * FINAL VERSION – ALL FIXES INCLUDED:
 *  1. Socket update type checks (battery, speed)
 *  2. Selected state sync on location update
 *  3. Route history mixing fixed (clear before load)
 *  4. Date format YYYY-MM-DD with leading zeros
 *  5. POLLING MERGE FIX – prevents false offline by computing isOnline from timestamp
 *
 * Other features:
 *  - Polling interval: 30s (REST fallback)
 *  - Route auto‑refresh every 30s for selected employee
 *  - No Cache-Control on poll (only on manual refresh)
 *  - Real-time socket updates
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

// ─── Fix Leaflet default icons ────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Custom icons ─────────────────────────────────────────────────────────────
const makeIcon = (className) => new L.Icon({
  iconUrl:      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize:     [25, 41],
  iconAnchor:   [12, 41],
  popupAnchor:  [1, -34],
  shadowUrl:    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  className,
});
const liveIcon    = makeIcon("live-marker");
const weakIcon    = makeIcon("weak-marker");
const offlineIcon = makeIcon("offline-marker");

const getIcon = (emp) => {
  if (!emp.isOnline)                 return offlineIcon;
  if (emp.networkQuality === "weak") return weakIcon;
  return liveIcon;
};

// ─── Map helpers ──────────────────────────────────────────────────────────────
function FlyToSelected({ selected, autoFollow }) {
  const map = useMap();
  useEffect(() => {
    const { lat, lng } = selected?.lastLocation || {};
    if (lat && lng && autoFollow) map.flyTo([lat, lng], 17, { duration: 1.5 });
  }, [selected, autoFollow, map]);
  return null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtCoord = (v) => (v == null ? "—" : Number(v).toFixed(5));

const fmtBattery = (b) =>
  typeof b === "number" && b >= 0 && b <= 100 ? `${b}%` : "--";

// FIX #4: Strict YYYY-MM-DD with leading zeros
const fmtDate = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

// Auth headers — NO Cache-Control (let browser/CDN cache poll responses)
const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

// Auth headers WITH cache-bust — used only for manual Refresh button
const authHeadersNoCache = () => ({
  headers: {
    Authorization:   `Bearer ${localStorage.getItem("token")}`,
    "Cache-Control": "no-cache",
  },
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function LiveMapPage() {
  const { socket, on, off } = useSocket();
  const mapRef = useRef();

  const [employees,     setEmployees]     = useState([]);
  const [paths,         setPaths]         = useState({});
  const [selected,      setSelected]      = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [lastUpdated,   setLastUpdated]   = useState(null);
  const [search,        setSearch]        = useState("");
  const [pathLoading,   setPathLoading]   = useState(false);
  const [autoFollow,    setAutoFollow]    = useState(true);
  const [historyDate,   setHistoryDate]   = useState(() => new Date().toISOString().split("T")[0]);
  const [historyPoints, setHistoryPoints] = useState([]);

  // ── Fetch live snapshot (with smart merge to prevent false offline) ─────────
  const fetchEmployees = useCallback(async (bustCache = false) => {
    try {
      const headers = bustCache ? authHeadersNoCache() : authHeaders();
      const res     = await api.get("/locations/live", headers);
      const newData = res.data?.employees || [];

      // FIX #5 (polling merge): compute isOnline from incoming timestamp,
      // otherwise preserve existing online status. Prevents polling from
      // marking a live employee as offline.
      setEmployees(prev =>
        newData.map(incoming => {
          const existing = prev.find(e => e._id === incoming._id);
          if (!existing) return incoming;

          // Determine online status:
          // - If incoming has a recent location timestamp (<10 min), mark online.
          // - Otherwise keep existing.isOnline (which is updated by socket).
          let online = existing.isOnline;
          if (incoming.lastLocation?.timestamp) {
            const lastTime = new Date(incoming.lastLocation.timestamp).getTime();
            if (Date.now() - lastTime < 10 * 60 * 1000) online = true;
          }

          return {
            ...existing,
            ...incoming,
            isOnline: online,   // preserve socket truth
          };
        })
      );
      setLastUpdated(new Date());
    } catch (err) {
      console.error("❌ fetchEmployees:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── POLLING: 30s REST fallback ──────────────────────────────────────────────
  useEffect(() => {
    fetchEmployees();
    const interval = setInterval(() => fetchEmployees(false), 30000);
    return () => clearInterval(interval);
  }, [fetchEmployees]);

  // ── Socket real-time updates (fixes #1 and #2) ─────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onLocationUpdate = (data) => {
      setLastUpdated(new Date());

      // FIX #1: Type checks for battery and speed
      const updatedBattery =
        typeof data.battery === "number" ? data.battery : undefined;
      const updatedSpeed =
        typeof data.speed === "number" ? data.speed : undefined;

      // Update employees list (always set isOnline = true from socket)
      setEmployees(prev =>
        prev.map(emp =>
          emp._id === data.employeeId || emp.employeeId === data.employeeId
            ? {
                ...emp,
                lastLocation:   {
                  lat: data.lat,
                  lng: data.lng,
                  timestamp: data.timestamp || new Date().toISOString(),
                },
                battery:        updatedBattery ?? emp.battery,
                speed:          updatedSpeed   ?? emp.speed ?? 0,
                networkQuality: data.networkQuality ?? emp.networkQuality,
                isTracking:     true,
                isOnline:       true,   // socket confirms online
              }
            : emp
        )
      );

      // FIX #2: Update selected employee if this update matches
      setSelected(prevSelected => {
        if (!prevSelected) return prevSelected;
        if (prevSelected._id !== data.employeeId && prevSelected.employeeId !== data.employeeId)
          return prevSelected;
        return {
          ...prevSelected,
          lastLocation: {
            lat: data.lat,
            lng: data.lng,
            timestamp: data.timestamp || new Date().toISOString(),
          },
          battery:        updatedBattery ?? prevSelected.battery ?? 0,
          speed:          updatedSpeed   ?? prevSelected.speed ?? 0,
          networkQuality: data.networkQuality ?? prevSelected.networkQuality,
          isOnline:       true,
          isTracking:     true,
        };
      });

      // Update path (live route)
      setPaths(prev => {
        const current  = prev[data.employeeId] || [];
        const newPoint = [data.lat, data.lng];
        const last     = current[current.length - 1];
        if (last && last[0] === newPoint[0] && last[1] === newPoint[1]) return prev;
        return { ...prev, [data.employeeId]: [...current, newPoint].slice(-500) };
      });
    };

    const onOffline = (data) =>
      setEmployees(prev =>
        prev.map(emp =>
          emp._id === data.employeeId || emp.employeeId === data.employeeId
            ? { ...emp, isTracking: false, isOnline: false }
            : emp
        )
      );

    const onOnline = (data) =>
      setEmployees(prev =>
        prev.map(emp =>
          emp._id === data.employeeId || emp.employeeId === data.employeeId
            ? { ...emp, isOnline: true }
            : emp
        )
      );

    on("location:update",         onLocationUpdate);
    on("system:employee-offline", onOffline);
    on("system:employee-online",  onOnline);
    return () => {
      off("location:update",         onLocationUpdate);
      off("system:employee-offline", onOffline);
      off("system:employee-online",  onOnline);
    };
  }, [socket, on, off]);

  // ── Route history loader (FIX #3: clear old points first) ───────────────────
  const loadRouteHistory = useCallback(async (employeeId, date = historyDate) => {
    if (!employeeId) return;
    try {
      setPathLoading(true);
      const res    = await api.get(
        `/locations/history/${employeeId}?date=${fmtDate(date)}`,
        authHeaders()
      );
      const coords = (res.data?.data || [])
        .filter(l => l.lat && l.lng)
        .map(l => [l.lat, l.lng]);

      // FIX #3: Clear existing route before setting new one (prevents mixing)
      setHistoryPoints([]);
      setHistoryPoints(coords);
      setPaths(prev => ({ ...prev, [employeeId]: coords }));
    } catch (err) {
      console.error("❌ loadRouteHistory:", err.message);
    } finally {
      setPathLoading(false);
    }
  }, [historyDate]);

  // Load route when employee is selected
  useEffect(() => {
    if (selected) loadRouteHistory(selected.employeeId);
  }, [selected, loadRouteHistory]);

  // ── ROUTE AUTO-REFRESH every 30s for selected employee ─────────────────────
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => {
      loadRouteHistory(selected.employeeId, historyDate);
    }, 30000);
    return () => clearInterval(interval);
  }, [selected, historyDate, loadRouteHistory]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const handleSelect  = (emp) => setSelected(emp);
  const clearSelected = () => { setSelected(null); setHistoryPoints([]); };

  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(search.toLowerCase()) ||
    emp.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = employees.filter(e => e.isOnline).length;

  if (loading) return <LoadingSpinner fullScreen text="Loading live map…" />;

  return (
    <div className="flex h-screen bg-gray-100">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div className="w-80 bg-white border-r flex flex-col shadow-lg z-10">

        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 text-lg">Live Tracking</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              {onlineCount} active
            </span>
          </div>
          <input
            type="text"
            placeholder="Search by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <div className="px-4 py-1.5 text-xs text-gray-400 bg-gray-50 border-b">
            Updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        {/* Employee list */}
        <div className="flex-1 overflow-y-auto">
          {filteredEmployees.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">No employees found</div>
          )}
          {filteredEmployees.map(emp => {
            const hasLocation = !!(emp.lastLocation?.lat && emp.lastLocation?.lng);
            const isSelected  = selected?._id === emp._id;
            const active      = emp.isOnline === true;
            return (
              <div
                key={emp._id}
                onClick={() => handleSelect(emp)}
                className={`p-3 cursor-pointer border-b hover:bg-gray-50 transition ${
                  isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700">
                    {emp.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.employeeId}</p>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${active ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                </div>
                <div className="mt-1 ml-12 flex items-center gap-2 text-xs flex-wrap">
                  {typeof emp.battery === "number" && emp.battery >= 0 && (
                    <span className={emp.battery < 20 ? "text-red-500 font-medium" : "text-gray-500"}>
                      🔋 {fmtBattery(emp.battery)}
                    </span>
                  )}
                  {!hasLocation && <span className="text-orange-400">No GPS</span>}
                  {emp.speed > 0 && <span className="text-gray-500">{emp.speed} km/h</span>}
                  {emp.networkQuality === "weak" && <span className="text-yellow-600">📶 weak</span>}
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="p-3 border-t bg-gray-50">
            <button
              onClick={clearSelected}
              className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Show all employees
            </button>
          </div>
        )}
      </div>

      {/* ── Map area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          whenCreated={map => (mapRef.current = map)}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />

          {/* Stable cluster key prevents full re-mount on state updates */}
          <MarkerClusterGroup chunkedLoading key="stable-cluster">
            {employees
              .filter(emp => !selected || emp._id === selected._id)
              .map(emp => {
                if (!emp.lastLocation?.lat || !emp.lastLocation?.lng) return null;
                const { lat, lng } = emp.lastLocation;
                return (
                  <Marker
                    key={emp._id}
                    position={[lat, lng]}
                    icon={getIcon(emp)}
                    eventHandlers={{ click: () => handleSelect(emp) }}
                  >
                    <Popup>
                      <div className="text-sm space-y-1 min-w-[160px]">
                        <p className="font-bold text-base">{emp.name}</p>
                        <p className="text-gray-500">{emp.employeeId}</p>
                        <hr />
                        <p>📍 {fmtCoord(lat)}, {fmtCoord(lng)}</p>
                        <p>🔋 Battery: {fmtBattery(emp.battery)}</p>
                        <p>
                          📶 Network:{" "}
                          {emp.networkQuality === "weak" ? "⚠️ Weak" : emp.isOnline ? "Good" : "Offline"}
                        </p>
                        <p>
                          Status:{" "}
                          <span className={emp.isOnline ? "text-green-600 font-medium" : "text-red-500"}>
                            {emp.isOnline ? "● Live" : "○ Offline"}
                          </span>
                        </p>
                        {emp.lastLocation?.timestamp && (
                          <p className="text-xs text-gray-400">
                            {new Date(emp.lastLocation.timestamp).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MarkerClusterGroup>

          {/* Live path (socket-built) */}
          {selected && (paths[selected.employeeId]?.length || 0) > 1 && (
            <Polyline
              positions={paths[selected.employeeId]}
              pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.8 }}
            />
          )}

          {/* Historical route (API-loaded) */}
          {selected && historyPoints.length > 1 && (
            <Polyline
              positions={historyPoints}
              pathOptions={{ color: "#9ca3af", weight: 2, opacity: 0.5, dashArray: "5,5" }}
            />
          )}

          <FlyToSelected selected={selected} autoFollow={autoFollow} />
        </MapContainer>

        {/* ── Selected employee card ──────────────────────────────────────── */}
        {selected && (
          <div className="absolute bottom-4 left-4 bg-white shadow-xl rounded-xl p-4 w-80 z-[1000] border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-lg">
                {selected.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{selected.name}</h3>
                <p className="text-xs text-gray-500">{selected.employeeId}</p>
              </div>
            </div>

            <div className="text-sm space-y-1.5 border-t pt-3">
              <p>📍 {fmtCoord(selected.lastLocation?.lat)}, {fmtCoord(selected.lastLocation?.lng)}</p>
              <p>
                🔋 Battery:{" "}
                <span className={
                  typeof selected.battery === "number" && selected.battery < 20
                    ? "text-red-500 font-bold" : ""
                }>
                  {fmtBattery(selected.battery)}
                </span>
              </p>
              <p>🚗 Speed: {selected.speed ? `${selected.speed} km/h` : "—"}</p>
              <p>
                📶 Network:{" "}
                {selected.networkQuality === "weak" ? "⚠️ Weak signal"
                  : selected.isOnline ? "Good" : "Offline"}
              </p>
              <p>
                Route points:{" "}
                {pathLoading ? "Loading…" : (paths[selected.employeeId]?.length || 0)}
              </p>
              <p className={selected.isOnline ? "text-green-600 font-medium" : "text-red-500"}>
                {selected.isOnline ? "● Live tracking active" : "○ Offline"}
              </p>
              {selected.lastLocation?.timestamp && (
                <p className="text-xs text-gray-400">
                  Last ping: {new Date(selected.lastLocation.timestamp).toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Route history date picker */}
            <div className="mt-3">
              <label className="text-xs text-gray-500 block mb-1">Show route for date</label>
              <input
                type="date"
                value={historyDate}
                onChange={e => setHistoryDate(e.target.value)}
                className="w-full text-sm border rounded px-2 py-1"
              />
              <button
                onClick={() => loadRouteHistory(selected.employeeId)}
                disabled={pathLoading}
                className="mt-2 w-full text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 py-1.5 rounded font-medium disabled:opacity-50"
              >
                {pathLoading ? "Loading…" : "Load route"}
              </button>
            </div>

            {/* Auto-follow + center */}
            <div className="mt-3 flex items-center justify-between">
              <label className="text-sm text-gray-600 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFollow}
                  onChange={e => setAutoFollow(e.target.checked)}
                />
                Auto-follow
              </label>
              <button
                onClick={() => {
                  const { lat, lng } = selected.lastLocation || {};
                  if (lat && lng && mapRef.current) mapRef.current.flyTo([lat, lng], 17, { duration: 1 });
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Center on map
              </button>
            </div>
          </div>
        )}

        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow p-3 text-xs space-y-1.5 z-[1000]">
          <p className="font-semibold text-gray-700">Legend</p>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" /><span>Live (good signal)</span></div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" /><span>Live (weak signal)</span></div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-gray-300" /><span>Offline</span></div>
          <div className="flex items-center gap-2"><div className="w-6 border-t-2 border-blue-500" /><span>Live route</span></div>
          <div className="flex items-center gap-2"><div className="w-6 border-t-2 border-gray-400 border-dashed" /><span>Historical route</span></div>
        </div>

        {/* ── Refresh button (cache-busting) ──────────────────────────────── */}
        <button
          onClick={() => fetchEmployees(true)}
          className="absolute top-4 left-4 bg-white shadow rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 z-[1000] border"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Marker CSS ───────────────────────────────────────────────────── */}
      <style jsx>{`
        .live-marker    { filter: drop-shadow(0 0 5px #22c55e); }
        .offline-marker { filter: grayscale(0.6) brightness(0.85); }
        .weak-marker    { filter: hue-rotate(50deg) brightness(1.1) drop-shadow(0 0 4px #eab308); }
      `}</style>
    </div>
  );
}
