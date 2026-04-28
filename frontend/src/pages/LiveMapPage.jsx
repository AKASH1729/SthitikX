/**
 * LiveMapPage.jsx — FULLY FIXED + MODERN UI
 *
 * All 10 original fixes + battery preservation fixes:
 *
 * BATTERY FIXES:
 *  B1. Polling merge — never overwrite good battery with null/0
 *  B2. Socket update — never overwrite good battery with 0
 *  B3. Selected sync — same guard
 *  B4. fmtBattery — b <= 0 shows "--"
 *
 * ORIGINAL FIXES:
 *  1.  Socket isOnline — only true if lat+lng valid
 *  2.  Selected sync isOnline — same guard
 *  3.  Battery 0% display — shows "--"
 *  4.  Speed typeof guard
 *  5.  Polling merge — requires lat+lng for online=true
 *  6.  Marker icon — requires lastLocation.lat
 *  7.  Popup network — offline-first logic
 *  8.  Online dot — requires lat+lng
 *  9.  Route points count — safe (|| []).length
 *  10. Timestamp fallback preserved
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
const makeIcon = (className) =>
  new L.Icon({
    iconUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconSize:    [25, 41],
    iconAnchor:  [12, 41],
    popupAnchor: [1, -34],
    shadowUrl:   "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    className,
  });

const liveIcon    = makeIcon("lm-live");
const weakIcon    = makeIcon("lm-weak");
const offlineIcon = makeIcon("lm-offline");

// FIX #6: require lastLocation.lat for live icon
const getIcon = (emp) => {
  if (!emp.isOnline || !emp.lastLocation?.lat) return offlineIcon;
  if (emp.networkQuality === "weak")            return weakIcon;
  return liveIcon;
};

// ─── Map auto-fly ─────────────────────────────────────────────────────────────
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

// FIX B4 / #3: b <= 0 shows "--", handles null from backend
const fmtBattery = (b) => {
  if (typeof b !== "number" || b <= 0 || b > 100) return "--";
  return `${Math.round(b)}%`;
};

// Is this a real, valid battery reading?
const isGoodBattery = (b) => typeof b === "number" && b > 0 && b <= 100;

const fmtDate = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
  );
};

const batteryColor = (b) => {
  if (!isGoodBattery(b)) return "#94a3b8";
  if (b < 20) return "#ef4444";
  if (b < 50) return "#f59e0b";
  return "#22c55e";
};

// ─── Auth headers ─────────────────────────────────────────────────────────────
const authHeaders        = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const authHeadersNoCache = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Cache-Control": "no-cache" } });

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

  // ── Fetch live snapshot ───────────────────────────────────────────────────
  const fetchEmployees = useCallback(async (bustCache = false) => {
    try {
      const headers = bustCache ? authHeadersNoCache() : authHeaders();
      const res     = await api.get("/locations/live", headers);
      const newData = res.data?.employees || [];

      setEmployees(prev =>
        newData.map(incoming => {
          const existing = prev.find(e => e._id === incoming._id);
          if (!existing) return incoming;

          // FIX #5: require lat+lng for online=true
          let online = existing.isOnline;
          if (
            incoming.lastLocation?.timestamp &&
            incoming.lastLocation?.lat &&
            incoming.lastLocation?.lng
          ) {
            const age = Date.now() - new Date(incoming.lastLocation.timestamp).getTime();
            if (age < 10 * 60 * 1000) online = true;
          }

          // FIX B1: never overwrite a good battery with null/0
          const battery = isGoodBattery(incoming.battery)
            ? incoming.battery
            : existing.battery;

          return {
            ...existing,
            ...incoming,
            battery,          // B1: sticky good value
            isOnline: online, // #5: no fake online
          };
        })
      );
      setLastUpdated(new Date());
    } catch (err) {
      console.error("fetchEmployees:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Polling: 30s REST fallback ─────────────────────────────────────────────
  useEffect(() => {
    fetchEmployees();
    const id = setInterval(() => fetchEmployees(false), 30000);
    return () => clearInterval(id);
  }, [fetchEmployees]);

  // ── Socket real-time updates ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onLocationUpdate = (data) => {
      setLastUpdated(new Date());

      // FIX B2: only accept battery if genuinely valid (>0)
      const incomingBattery =
        typeof data.battery === "number" && data.battery > 0 && data.battery <= 100
          ? data.battery
          : undefined; // undefined = preserve existing

      // FIX #4: typeof guard for speed
      const incomingSpeed =
        typeof data.speed === "number" ? data.speed : undefined;

      // FIX #1: only online if lat+lng are real
      const hasCoords = !!(data.lat && data.lng);

      setEmployees(prev =>
        prev.map(emp => {
          if (emp._id !== data.employeeId && emp.employeeId !== data.employeeId)
            return emp;
          return {
            ...emp,
            lastLocation: {
              lat:       data.lat,
              lng:       data.lng,
              timestamp: data.timestamp || new Date().toISOString(), // FIX #10
            },
            // FIX B2: sticky — never wipe good battery with undefined/0
            battery:        incomingBattery !== undefined ? incomingBattery : emp.battery,
            speed:          incomingSpeed   !== undefined ? incomingSpeed   : (emp.speed ?? 0),
            networkQuality: data.networkQuality ?? emp.networkQuality,
            isTracking:     true,
            isOnline:       hasCoords ? true : emp.isOnline, // FIX #1
          };
        })
      );

      // FIX #2 + B3: selected employee card sync
      setSelected(prev => {
        if (!prev) return prev;
        if (prev._id !== data.employeeId && prev.employeeId !== data.employeeId)
          return prev;
        return {
          ...prev,
          lastLocation: {
            lat:       data.lat,
            lng:       data.lng,
            timestamp: data.timestamp || new Date().toISOString(),
          },
          battery:        incomingBattery !== undefined ? incomingBattery : prev.battery, // FIX B3
          speed:          incomingSpeed   !== undefined ? incomingSpeed   : (prev.speed ?? 0),
          networkQuality: data.networkQuality ?? prev.networkQuality,
          isOnline:       hasCoords ? true : prev.isOnline, // FIX #2
          isTracking:     true,
        };
      });

      // Append to live path
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

  // ── Route history ──────────────────────────────────────────────────────────
  const loadRouteHistory = useCallback(async (employeeId, date = historyDate) => {
    if (!employeeId) return;
    try {
      setPathLoading(true);
      const res = await api.get(
        `/locations/history/${employeeId}?date=${fmtDate(date)}`,
        authHeaders()
      );
      const coords = (res.data?.data || [])
        .filter(l => l.lat && l.lng)
        .map(l => [l.lat, l.lng]);
      setHistoryPoints([]);
      setHistoryPoints(coords);
      setPaths(prev => ({ ...prev, [employeeId]: coords }));
    } catch (err) {
      console.error("loadRouteHistory:", err.message);
    } finally {
      setPathLoading(false);
    }
  }, [historyDate]);

  useEffect(() => {
    if (selected) loadRouteHistory(selected.employeeId);
  }, [selected, loadRouteHistory]);

  useEffect(() => {
    if (!selected) return;
    const id = setInterval(() => loadRouteHistory(selected.employeeId, historyDate), 30000);
    return () => clearInterval(id);
  }, [selected, historyDate, loadRouteHistory]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleSelect  = (emp) => setSelected(emp);
  const clearSelected = () => { setSelected(null); setHistoryPoints([]); };

  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(search.toLowerCase()) ||
    emp.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = employees.filter(e => e.isOnline).length;

  if (loading) return <LoadingSpinner fullScreen text="Loading live map…" />;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#f1f5f9" }}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside style={{
        width: 304, flexShrink: 0,
        display: "flex", flexDirection: "column",
        background: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        boxShadow: "2px 0 16px rgba(15,23,42,0.05)",
        zIndex: 10,
      }}>

        {/* Header */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.4px" }}>
                Live Tracking
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "#94a3b8" }}>
                Real-time employee locations
              </p>
            </div>
            <div style={{
              background: onlineCount > 0 ? "#f0fdf4" : "#f8fafc",
              color:      onlineCount > 0 ? "#16a34a"  : "#64748b",
              border:    `1px solid ${onlineCount > 0 ? "#bbf7d0" : "#e2e8f0"}`,
              fontSize: 11, fontWeight: 700,
              padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap",
            }}>
              {onlineCount} live
            </div>
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "8px 10px 8px 30px",
                border: "1.5px solid #e2e8f0", borderRadius: 8,
                fontSize: 13, color: "#0f172a", background: "#f8fafc",
                outline: "none", transition: "border-color 0.15s",
              }}
              onFocus={e => (e.target.style.borderColor = "#818cf8")}
              onBlur={e  => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>
        </div>

        {/* Last updated strip */}
        {lastUpdated && (
          <div style={{
            padding: "5px 16px", fontSize: 11, color: "#94a3b8",
            background: "#fafbfd", borderBottom: "1px solid #f1f5f9",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        {/* Employee list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredEmployees.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              No employees found
            </div>
          )}

          {filteredEmployees.map(emp => {
            const hasLocation = !!(emp.lastLocation?.lat && emp.lastLocation?.lng);
            const isSelected  = selected?._id === emp._id;
            // FIX #8: require lat+lng for active green dot
            const active = !!(emp.isOnline && emp.lastLocation?.lat && emp.lastLocation?.lng);
            const batOk  = isGoodBattery(emp.battery);

            return (
              <div
                key={emp._id}
                onClick={() => handleSelect(emp)}
                style={{
                  padding: "11px 16px", cursor: "pointer",
                  borderBottom: "1px solid #f1f5f9",
                  borderLeft: `3px solid ${isSelected ? "#6366f1" : "transparent"}`,
                  background: isSelected ? "#f5f3ff" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: isSelected ? "#ede9fe" : "#f1f5f9",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14,
                    color: isSelected ? "#6366f1" : "#64748b",
                  }}>
                    {emp.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {emp.name}
                    </p>
                    <p style={{ margin: "1px 0 0", fontSize: 11, color: "#94a3b8" }}>
                      {emp.employeeId}
                    </p>
                  </div>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: active ? "#22c55e" : "#e2e8f0",
                    boxShadow: active ? "0 0 0 3px rgba(34,197,94,0.18)" : "none",
                  }} />
                </div>

                <div style={{ marginTop: 6, marginLeft: 46, display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
                  {batOk && (
                    <span style={{ fontSize: 11, color: emp.battery < 20 ? "#ef4444" : "#64748b", fontWeight: 500, display: "flex", alignItems: "center", gap: 3 }}>
                      <BatteryMini pct={emp.battery} />
                      {fmtBattery(emp.battery)}
                    </span>
                  )}
                  {!hasLocation && (
                    <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 500 }}>No GPS</span>
                  )}
                  {/* FIX #4 */}
                  {typeof emp.speed === "number" && emp.speed > 0 && (
                    <span style={{ fontSize: 11, color: "#64748b" }}>{emp.speed} km/h</span>
                  )}
                  {emp.networkQuality === "weak" && (
                    <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 500 }}>Weak</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid #f1f5f9" }}>
            <button
              onClick={clearSelected}
              style={{
                width: "100%", padding: "8px 0",
                background: "#f5f3ff", border: "1.5px solid #ddd6fe",
                borderRadius: 8, color: "#6366f1", fontSize: 12,
                fontWeight: 600, cursor: "pointer",
              }}
            >
              Show all employees
            </button>
          </div>
        )}
      </aside>

      {/* ══ MAP ══════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, position: "relative" }}>
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
                      <div style={{ fontSize: 13, minWidth: 190, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, margin: "0 0 1px", color: "#0f172a" }}>{emp.name}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 8px" }}>{emp.employeeId}</p>
                        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                          <PopupRow label="Location" value={`${fmtCoord(lat)}, ${fmtCoord(lng)}`} />
                          <PopupRow label="Battery"  value={fmtBattery(emp.battery)} />
                          {/* FIX #7: offline-first network status */}
                          <PopupRow
                            label="Network"
                            value={
                              !emp.isOnline
                                ? "Offline"
                                : emp.networkQuality === "weak"
                                ? "Weak signal"
                                : "Good"
                            }
                          />
                          <PopupRow
                            label="Status"
                            value={emp.isOnline ? "Live" : "Offline"}
                            valueColor={emp.isOnline ? "#16a34a" : "#ef4444"}
                            bold
                          />
                          {emp.lastLocation?.timestamp && (
                            <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                              {new Date(emp.lastLocation.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MarkerClusterGroup>

          {/* Live path */}
          {selected && (paths[selected.employeeId] || []).length > 1 && (
            <Polyline
              positions={paths[selected.employeeId]}
              pathOptions={{ color: "#6366f1", weight: 4, opacity: 0.85 }}
            />
          )}

          {/* Historical route */}
          {selected && historyPoints.length > 1 && (
            <Polyline
              positions={historyPoints}
              pathOptions={{ color: "#94a3b8", weight: 2.5, opacity: 0.55, dashArray: "6,5" }}
            />
          )}

          <FlyToSelected selected={selected} autoFollow={autoFollow} />
        </MapContainer>

        {/* Refresh button */}
        <button
          onClick={() => fetchEmployees(true)}
          style={{
            position: "absolute", top: 14, left: 14, zIndex: 1000,
            background: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 10, padding: "8px 14px",
            fontSize: 12, fontWeight: 600, color: "#6366f1",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
          }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          Refresh
        </button>

        {/* Legend */}
        <div style={{
          position: "absolute", top: 14, right: 14, zIndex: 1000,
          background: "#fff", borderRadius: 12, padding: "12px 14px",
          boxShadow: "0 2px 16px rgba(0,0,0,0.09)", border: "1px solid #e2e8f0",
          minWidth: 165,
        }}>
          <p style={{ margin: "0 0 9px", fontWeight: 700, fontSize: 12, color: "#0f172a" }}>Legend</p>
          <LegendRow dot="#22c55e" glow  label="Live · good signal" />
          <LegendRow dot="#f59e0b" glow  label="Live · weak signal" />
          <LegendRow dot="#e2e8f0"       label="Offline" />
          <LegendRow line="#6366f1"      label="Live route" />
          <LegendRow line="#94a3b8" dashed label="Historical route" />
        </div>

        {/* Selected employee card */}
        {selected && (
          <div style={{
            position: "absolute", bottom: 18, left: 18, zIndex: 1000,
            width: 304, background: "#fff",
            borderRadius: 16, border: "1px solid #e2e8f0",
            boxShadow: "0 8px 32px rgba(15,23,42,0.12)",
            overflow: "hidden",
          }}>
            {/* Card header */}
            <div style={{
              padding: "14px 16px 12px",
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex", alignItems: "center", gap: 11,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 17, color: "#fff", flexShrink: 0,
              }}>
                {selected.name?.charAt(0)?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#fff" }}>{selected.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{selected.employeeId}</p>
              </div>
              <div style={{
                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: selected.isOnline ? "#4ade80" : "#94a3b8",
                boxShadow: selected.isOnline ? "0 0 0 3px rgba(74,222,128,0.35)" : "none",
              }} />
            </div>

            {/* Card body */}
            <div style={{ padding: "14px 16px" }}>

              {/* Stat grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <StatBox label="Latitude"  value={fmtCoord(selected.lastLocation?.lat)} />
                <StatBox label="Longitude" value={fmtCoord(selected.lastLocation?.lng)} />
                <StatBox
                  label="Battery"
                  value={fmtBattery(selected.battery)}
                  valueColor={batteryColor(selected.battery)}
                />
                {/* FIX #4: typeof guard */}
                <StatBox
                  label="Speed"
                  value={typeof selected.speed === "number" && selected.speed > 0
                    ? `${selected.speed} km/h` : "—"}
                />
              </div>

              {/* Status row */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 12, color: "#64748b", marginBottom: 10,
                padding: "8px 10px", background: "#f8fafc",
                borderRadius: 8, border: "1px solid #f1f5f9",
              }}>
                {/* FIX #9: safe route points count */}
                <span>
                  Route pts:{" "}
                  <b style={{ color: "#0f172a" }}>
                    {pathLoading ? "…" : (paths[selected.employeeId] || []).length}
                  </b>
                </span>
                <span>
                  Status:{" "}
                  <b style={{ color: selected.isOnline ? "#16a34a" : "#ef4444" }}>
                    {selected.isOnline ? "Live" : "Offline"}
                  </b>
                </span>
              </div>

              {selected.lastLocation?.timestamp && (
                <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 12px" }}>
                  Last ping: {new Date(selected.lastLocation.timestamp).toLocaleTimeString()}
                </p>
              )}

              {/* Route history picker */}
              <div style={{
                background: "#f8fafc", borderRadius: 10,
                padding: "11px 12px", marginBottom: 10,
                border: "1px solid #f1f5f9",
              }}>
                <label style={{
                  fontSize: 10, fontWeight: 700, color: "#94a3b8",
                  display: "block", marginBottom: 6,
                  textTransform: "uppercase", letterSpacing: "0.5px",
                }}>
                  Route History
                </label>
                <input
                  type="date"
                  value={historyDate}
                  onChange={e => setHistoryDate(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "6px 10px", borderRadius: 7,
                    border: "1.5px solid #e2e8f0", fontSize: 12,
                    color: "#0f172a", background: "#fff", outline: "none",
                  }}
                />
                <button
                  onClick={() => loadRouteHistory(selected.employeeId)}
                  disabled={pathLoading}
                  style={{
                    marginTop: 8, width: "100%", padding: "7px 0",
                    background: pathLoading ? "#ede9fe" : "#6366f1",
                    color:      pathLoading ? "#6366f1" : "#fff",
                    border: "none", borderRadius: 7,
                    fontSize: 12, fontWeight: 600,
                    cursor: pathLoading ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  {pathLoading ? "Loading…" : "Load Route"}
                </button>
              </div>

              {/* Auto-follow + center */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoFollow}
                    onChange={e => setAutoFollow(e.target.checked)}
                    style={{ accentColor: "#6366f1" }}
                  />
                  Auto-follow
                </label>
                <button
                  onClick={() => {
                    const { lat, lng } = selected.lastLocation || {};
                    if (lat && lng && mapRef.current)
                      mapRef.current.flyTo([lat, lng], 17, { duration: 1 });
                  }}
                  style={{
                    background: "none", border: "none", padding: 0,
                    fontSize: 12, color: "#6366f1", fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Center on map
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Marker CSS */}
      <style>{`
        .lm-live    { filter: drop-shadow(0 0 7px rgba(34,197,94,0.75)); }
        .lm-weak    { filter: drop-shadow(0 0 6px rgba(234,179,8,0.75)) hue-rotate(40deg); }
        .lm-offline { filter: grayscale(0.8) brightness(0.8); }
        .leaflet-popup-content-wrapper {
          border-radius: 14px !important;
          box-shadow: 0 6px 28px rgba(15,23,42,0.13) !important;
          border: 1px solid #e2e8f0 !important;
        }
        .leaflet-popup-content { margin: 14px 16px !important; }
        .leaflet-popup-tip-container { display: none !important; }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PopupRow({ label, value, valueColor = "#0f172a", bold = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
      <span style={{ color: "#94a3b8", flexShrink: 0 }}>{label}</span>
      <span style={{ color: valueColor, fontWeight: bold ? 700 : 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function StatBox({ label, value, valueColor = "#0f172a" }) {
  return (
    <div style={{
      background: "#f8fafc", borderRadius: 9, padding: "8px 10px",
      border: "1px solid #f1f5f9",
    }}>
      <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: valueColor }}>
        {value}
      </p>
    </div>
  );
}

function LegendRow({ dot, glow, line, dashed, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, fontSize: 12, color: "#475569" }}>
      {dot && (
        <div style={{
          width: 9, height: 9, borderRadius: "50%",
          background: dot, flexShrink: 0,
          boxShadow: glow ? `0 0 0 3px ${dot}30` : "none",
        }} />
      )}
      {line && (
        <div style={{
          width: 22, flexShrink: 0,
          borderTop: dashed ? `2px dashed ${line}` : `2.5px solid ${line}`,
        }} />
      )}
      <span>{label}</span>
    </div>
  );
}

function BatteryMini({ pct }) {
  const color = pct < 20 ? "#ef4444" : pct < 50 ? "#f59e0b" : "#22c55e";
  const fill  = Math.max(0, Math.min(1, pct / 100));
  return (
    <svg width={14} height={8} viewBox="0 0 14 8" style={{ flexShrink: 0 }}>
      <rect x="0.5" y="0.5" width="11" height="7" rx="1.5" stroke={color} strokeWidth="1.2" fill="none" />
      <rect x="11.5" y="2.5" width="1.8" height="3" rx="0.5" fill={color} />
      <rect x="1.5" y="1.5" width={Math.max(0, Math.round(8 * fill))} height="5" rx="1" fill={color} />
    </svg>
  );
}
