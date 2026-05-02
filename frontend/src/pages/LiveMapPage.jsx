/**
 * LiveMapPage.jsx — Enterprise live tracking dashboard.
 *
 * MAP: OpenStreetMap "Hot" style — full color, easy to read roads/buildings.
 *      Toggle to satellite (Esri) for ground-level context.
 *
 * ALL FIXES:
 *  B1  isGoodBattery: 0 valid, null/undefined/NaN excluded
 *  B2  fmtBattery: 0→"0%", null/undefined→"--"
 *  B3  Polling merge: preserve existing battery only when incoming is null/undefined
 *  B4  Socket: battery=0 valid; undefined→preserve existing
 *  B5  Selected card: same guard
 *  S1  Speed 0 is VALID — shown as "0 km/h" not "—" in detail card
 *  S2  Speed in sidebar chip only shown when > 0 (no chip for stationary)
 *  #1  isOnline only when lat+lng real
 *  #2  Selected isOnline same guard
 *  #4  Speed typeof guard
 *  #5  Polling online: uses lastSeen (always fresh) not lastLocation.timestamp
 *  #6  Marker icon: requires lastLocation.lat
 *  #7  Popup network: offline-first
 *  #8  Active dot: requires lat+lng
 *  #9  Route pts: (|| []).length
 *  #10 Timestamp fallback preserved
 *  M1  Marker key includes lat+lng
 *  M2  New object reference on socket update
 *  M3  Cluster key tied to position hash
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import {
  MapContainer, TileLayer, Marker, Popup, Polyline, useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

// ─── Leaflet icon fix ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Map tile configs ──────────────────────────────────────────────────────────
const TILES = {
  color: {
    url:   "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attr:  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles courtesy of HOT',
    label: "Satellite view",
    icon:  "🛰",
  },
  satellite: {
    url:   "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr:  "Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA",
    label: "Map view",
    icon:  "🗺",
  },
};

// ─── Custom SVG markers ────────────────────────────────────────────────────────
const makePinIcon = (fillColor, borderColor, pulse) =>
  new L.DivIcon({
    className: "",
    iconSize:    [38, 50],
    iconAnchor:  [19, 50],
    popupAnchor: [0, -52],
    html: `
      <svg width="38" height="50" viewBox="0 0 38 50" xmlns="http://www.w3.org/2000/svg">
        ${pulse ? `
          <circle cx="19" cy="19" r="17" fill="${fillColor}" opacity="0.15">
            <animate attributeName="r"       values="10;22;10" dur="2.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.2;0;0.2" dur="2.2s" repeatCount="indefinite"/>
          </circle>` : ""}
        <circle cx="19" cy="19" r="15" fill="${borderColor}" />
        <circle cx="19" cy="19" r="11" fill="${fillColor}" />
        <circle cx="19" cy="19" r="5"  fill="white" />
        <path d="M19 34 L13 24 L25 24 Z" fill="${fillColor}" />
        <path d="M19 34 L13 24 L25 24 Z" fill="${borderColor}" opacity="0.3" />
      </svg>`,
  });

const ICONS = {
  live:    makePinIcon("#10b981", "#065f46", true),
  weak:    makePinIcon("#f59e0b", "#92400e", true),
  offline: makePinIcon("#94a3b8", "#475569", false),
};

const getIcon = (emp) => { // FIX #6
  if (!emp.isOnline || !emp.lastLocation?.lat) return ICONS.offline;
  if (emp.networkQuality === "weak")            return ICONS.weak;
  return ICONS.live;
};

// ─── Auto-fly ─────────────────────────────────────────────────────────────────
function FlyToSelected({ selected, autoFollow }) {
  const map = useMap();
  useEffect(() => {
    const { lat, lng } = selected?.lastLocation || {};
    if (lat && lng && autoFollow) map.flyTo([lat, lng], 17, { duration: 1.2 });
  }, [selected?.lastLocation?.lat, selected?.lastLocation?.lng, autoFollow, map]);
  return null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtCoord = (v) => (v == null ? "—" : Number(v).toFixed(6));

// B2: 0 → "0%", null/undefined → "--"
const fmtBattery = (b) => {
  if (b === null || b === undefined) return "--";
  const n = Number(b);
  if (isNaN(n) || n < 0 || n > 100) return "--";
  return `${Math.round(n)}%`;
};

// B1: 0 is valid
const isGoodBattery = (b) => {
  if (b === null || b === undefined) return false;
  const n = Number(b);
  return !isNaN(n) && n >= 0 && n <= 100;
};

// S1: Speed 0 is valid — show "0 km/h"
const fmtSpeed = (s) => {
  if (typeof s !== "number" || isNaN(s) || s < 0) return "—";
  return `${s} km/h`;
};

const fmtDate = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const batteryColor = (b) => {
  if (!isGoodBattery(b)) return "#94a3b8";
  const n = Number(b);
  if (n < 20) return "#ef4444";
  if (n < 50) return "#f59e0b";
  return "#10b981";
};

const batteryBg = (b) => {
  if (!isGoodBattery(b)) return "#f8fafc";
  const n = Number(b);
  if (n < 20) return "#fef2f2";
  if (n < 50) return "#fffbeb";
  return "#f0fdf4";
};

const relTime = (ts) => {
  if (!ts) return null;
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 10)    return "Just now";
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ─── Auth ──────────────────────────────────────────────────────────────────────
const authH        = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const authHNoCache = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Cache-Control": "no-cache" } });

// ─── Re-render every 30s for relative times ───────────────────────────────────
function useTick(ms = 30000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set(t => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// ══════════════════════════════════════════════════════════════════════════════
export default function LiveMapPage() {
  const { socket, on, off } = useSocket();
  const mapRef = useRef();
  useTick(30000);

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
  const [tab,           setTab]           = useState("team");
  const [tileKey,       setTileKey]       = useState("color");

  // ── Fetch snapshot ────────────────────────────────────────────────────────
  const fetchEmployees = useCallback(async (bustCache = false) => {
    try {
      const res     = await api.get("/locations/live", bustCache ? authHNoCache() : authH());
      const newData = res.data?.employees || [];

      setEmployees(prev =>
        newData.map(incoming => {
          const existing = prev.find(e => e._id === incoming._id);
          if (!existing) return { ...incoming };

          // FIX #5: use lastSeen for online check
          let online = existing.isOnline;
          if (incoming.lastLocation?.lat && incoming.lastLocation?.lng) {
            const ts  = incoming.lastSeen || incoming.lastLocation?.timestamp;
            const age = ts ? Date.now() - new Date(ts).getTime() : Infinity;
            if (age < 10 * 60 * 1000) online = true;
          }

          // FIX B3: preserve existing battery only when incoming is null/undefined
          const battery = isGoodBattery(incoming.battery)
            ? incoming.battery
            : isGoodBattery(existing.battery)
              ? existing.battery
              : incoming.battery;

          // FIX S1: speed 0 from API is valid — don't fall back
          const speed = typeof incoming.speed === "number" ? incoming.speed : existing.speed;

          return { ...existing, ...incoming, battery, speed, isOnline: online };
        })
      );

      // Also sync selected card from fresh data
      setSelected(prev => {
        if (!prev) return prev;
        const fresh = newData.find(e => e._id === prev._id);
        if (!fresh) return prev;
        return {
          ...prev,
          battery: isGoodBattery(fresh.battery) ? fresh.battery : (isGoodBattery(prev.battery) ? prev.battery : fresh.battery),
          speed:   typeof fresh.speed === "number" ? fresh.speed : prev.speed,
          lastLocation:   fresh.lastLocation   ?? prev.lastLocation,
          networkQuality: fresh.networkQuality ?? prev.networkQuality,
          isOnline:       fresh.isOnline       ?? prev.isOnline,
          lastSeen:       fresh.lastSeen       ?? prev.lastSeen,
          lastPingTime:   fresh.lastPingTime   ?? prev.lastPingTime,
        };
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error("fetchEmployees:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    const id = setInterval(() => fetchEmployees(false), 30000);
    return () => clearInterval(id);
  }, [fetchEmployees]);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onLocationUpdate = (data) => {
      setLastUpdated(new Date());
      const hasCoords = !!(data.lat && data.lng);

      // FIX B4: undefined battery → don't overwrite
      const incomingBattery = isGoodBattery(data.battery) ? data.battery : undefined;
      // FIX #4 + S1: speed 0 valid
      const incomingSpeed   = typeof data.speed === "number" ? data.speed : undefined;

      // FIX M2: always new reference
      setEmployees(prev => prev.map(emp => {
        if (emp._id !== data.employeeId && emp.employeeId !== data.employeeId) return emp;
        return {
          ...emp,
          lastLocation: {
            lat:       data.lat,
            lng:       data.lng,
            timestamp: data.timestamp || new Date().toISOString(), // FIX #10
          },
          battery:        incomingBattery !== undefined
            ? incomingBattery
            : (isGoodBattery(emp.battery) ? emp.battery : null),
          speed:          incomingSpeed !== undefined ? incomingSpeed : (emp.speed ?? 0),
          networkQuality: data.networkQuality ?? emp.networkQuality,
          isTracking:     true,
          isOnline:       hasCoords ? true : emp.isOnline, // FIX #1
          lastPingTime:   data.timestamp || new Date().toISOString(),
        };
      }));

      // FIX B5 + #2: selected card
      setSelected(prev => {
        if (!prev) return prev;
        if (prev._id !== data.employeeId && prev.employeeId !== data.employeeId) return prev;
        return {
          ...prev,
          lastLocation: {
            lat:       data.lat,
            lng:       data.lng,
            timestamp: data.timestamp || new Date().toISOString(),
          },
          battery:        incomingBattery !== undefined
            ? incomingBattery
            : (isGoodBattery(prev.battery) ? prev.battery : null),
          speed:          incomingSpeed !== undefined ? incomingSpeed : (prev.speed ?? 0),
          networkQuality: data.networkQuality ?? prev.networkQuality,
          isOnline:       hasCoords ? true : prev.isOnline, // FIX #2
          isTracking:     true,
          lastPingTime:   data.timestamp || new Date().toISOString(),
        };
      });

      if (hasCoords) {
        setPaths(prev => {
          const cur  = prev[data.employeeId] || [];
          const pt   = [data.lat, data.lng];
          const last = cur[cur.length - 1];
          if (last && last[0] === pt[0] && last[1] === pt[1]) return prev;
          return { ...prev, [data.employeeId]: [...cur, pt].slice(-500) };
        });
      }
    };

    const onOffline = (data) => setEmployees(prev =>
      prev.map(emp =>
        emp._id === data.employeeId || emp.employeeId === data.employeeId
          ? { ...emp, isTracking: false, isOnline: false } : emp
      )
    );
    const onOnline = (data) => setEmployees(prev =>
      prev.map(emp =>
        emp._id === data.employeeId || emp.employeeId === data.employeeId
          ? { ...emp, isOnline: true } : emp
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

  // ── Route history ─────────────────────────────────────────────────────────
  const loadRouteHistory = useCallback(async (employeeId, date = historyDate) => {
    if (!employeeId) return;
    try {
      setPathLoading(true);
      const res    = await api.get(`/locations/history/${employeeId}?date=${fmtDate(date)}`, authH());
      const coords = (res.data?.data || []).filter(l => l.lat && l.lng).map(l => [l.lat, l.lng]);
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
  }, [selected?.employeeId, loadRouteHistory]);

  useEffect(() => {
    if (!selected) return;
    const id = setInterval(() => loadRouteHistory(selected.employeeId, historyDate), 30000);
    return () => clearInterval(id);
  }, [selected?.employeeId, historyDate, loadRouteHistory]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleSelect  = (emp) => { setSelected(emp); setTab("detail"); };
  const clearSelected = ()    => { setSelected(null); setHistoryPoints([]); setTab("team"); };

  const filtered    = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employeeId?.toLowerCase().includes(search.toLowerCase())
  );
  const onlineCount = employees.filter(e => e.isOnline).length;

  // M3
  const clusterKey = employees
    .map(e => `${e._id}:${e.lastLocation?.lat?.toFixed(4)}:${e.lastLocation?.lng?.toFixed(4)}`)
    .join("|");

  const tile = TILES[tileKey];
  const isSat = tileKey === "satellite";

  if (loading) return <LoadingSpinner fullScreen text="Loading live map…" />;

  return (
    <div style={S.root}>
      <style>{GLOBAL_CSS}</style>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside style={S.sidebar}>

        {/* Brand bar */}
        <div style={S.brand}>
          <div style={S.brandIcon}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5" fill="white"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: "#0f172a", letterSpacing: "-0.4px" }}>SthitiX</p>
            <p style={{ margin: 0, fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>Live Tracking</p>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: onlineCount > 0 ? "#ecfdf5" : "#f8fafc",
            color:      onlineCount > 0 ? "#059669" : "#64748b",
            border:    `1px solid ${onlineCount > 0 ? "#a7f3d0" : "#e2e8f0"}`,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: onlineCount > 0 ? "#10b981" : "#cbd5e1", display: "inline-block",
              boxShadow: onlineCount > 0 ? "0 0 0 3px rgba(16,185,129,0.2)" : "none" }} />
            {onlineCount}/{employees.length} online
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabBar}>
          {[
            { key: "team",   label: "Team",   badge: onlineCount > 0 ? onlineCount : null },
            { key: "detail", label: "Detail", disabled: !selected },
          ].map(t => (
            <button key={t.key} disabled={!!t.disabled}
              onClick={() => !t.disabled && setTab(t.key)}
              style={{ ...S.tab, ...(tab === t.key ? S.tabActive : {}), opacity: t.disabled ? 0.3 : 1 }}
            >
              {t.label}
              {t.badge && (
                <span style={{ marginLeft: 4, background: "#6366f1", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10 }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TEAM TAB ─────────────────────────────────────────────────────── */}
        {tab === "team" && (
          <>
            <div style={{ padding: "10px 14px 8px" }}>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                  width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input type="text" placeholder="Search employee…" value={search}
                  onChange={e => setSearch(e.target.value)} style={S.searchInput}
                  onFocus={e => (e.target.style.borderColor = "#6366f1")}
                  onBlur={e  => (e.target.style.borderColor = "#e2e8f0")}
                />
              </div>
            </div>

            {lastUpdated && (
              <div style={S.syncStrip}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                Synced {lastUpdated.toLocaleTimeString()}
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto" }}>
              {filtered.length === 0 && (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth={1.5}>
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "#94a3b8" }}>No employees found</p>
                </div>
              )}

              {filtered.map(emp => {
                const hasLoc = !!(emp.lastLocation?.lat && emp.lastLocation?.lng);
                const isSel  = selected?._id === emp._id;
                const active = !!(emp.isOnline && hasLoc); // FIX #8
                const batOk  = isGoodBattery(emp.battery);
                const rt     = relTime(emp.lastPingTime || emp.lastSeen || emp.lastLocation?.timestamp);

                return (
                  <div key={emp._id} className="emp-row" onClick={() => handleSelect(emp)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "10px 14px", cursor: "pointer",
                      borderBottom: "1px solid #f8fafc",
                      borderLeft: `3px solid ${isSel ? "#6366f1" : "transparent"}`,
                      background:  isSel ? "#fafaff" : "transparent",
                      transition:  "background 0.1s",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 14,
                        background: isSel ? "#ede9fe" : active ? "#ecfdf5" : "#f1f5f9",
                        color:      isSel ? "#6366f1" : active ? "#059669" : "#64748b",
                        border:    `2px solid ${isSel ? "#c4b5fd" : active ? "#a7f3d0" : "#e2e8f0"}`,
                      }}>
                        {emp.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span style={{
                        position: "absolute", bottom: -1, right: -1,
                        width: 10, height: 10, borderRadius: "50%",
                        background: active ? "#10b981" : "#e2e8f0",
                        border: "2px solid #fff",
                        boxShadow: active ? "0 0 0 2px rgba(16,185,129,0.25)" : "none",
                      }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 4 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {emp.name}
                        </p>
                        {rt && <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>{rt}</span>}
                      </div>
                      <p style={{ margin: "1px 0 5px", fontSize: 10, color: "#94a3b8" }}>{emp.employeeId}</p>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 5px" }}>
                        {batOk && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: batteryBg(emp.battery), color: batteryColor(emp.battery) }}>
                            <BatteryMini pct={Number(emp.battery)} />
                            {fmtBattery(emp.battery)}
                          </span>
                        )}
                        {!hasLoc && <Chip bg="#fffbeb" color="#d97706">No GPS</Chip>}
                        {/* S2: chip only when moving */}
                        {typeof emp.speed === "number" && emp.speed > 0 && (
                          <Chip bg="#f0f9ff" color="#0284c7">{emp.speed} km/h</Chip>
                        )}
                        {emp.networkQuality === "weak" && <Chip bg="#fffbeb" color="#d97706">Weak signal</Chip>}
                        {!emp.isOnline && <Chip bg="#fef2f2" color="#dc2626">Offline</Chip>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── DETAIL TAB ───────────────────────────────────────────────────── */}
        {tab === "detail" && selected && (
          <div style={{ flex: 1, overflowY: "auto" }}>

            {/* Header */}
            <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 18,
                  background: selected.isOnline ? "#ecfdf5" : "#f1f5f9",
                  color:      selected.isOnline ? "#059669" : "#64748b",
                  border:    `2px solid ${selected.isOnline ? "#a7f3d0" : "#e2e8f0"}`,
                }}>
                  {selected.name?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#0f172a", letterSpacing: "-0.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selected.name}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94a3b8" }}>{selected.employeeId}</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusPill active={selected.isOnline} activeText="Live" inactiveText="Offline"
                  activeBg="#ecfdf5" inactiveBg="#fef2f2"
                  activeColor="#059669" inactiveColor="#dc2626"
                  activeBorder="#a7f3d0" inactiveBorder="#fecaca" />
                {selected.isOnline && (
                  <StatusPill
                    active={selected.networkQuality !== "weak"}
                    activeText="Good signal" inactiveText="Weak signal"
                    activeBg="#f0fdf4" inactiveBg="#fffbeb"
                    activeColor="#059669" inactiveColor="#d97706"
                    activeBorder="#a7f3d0" inactiveBorder="#fde68a"
                  />
                )}
              </div>
            </div>

            {/* ── Stats grid (all 6 always visible) ── */}
            <div style={{ padding: "12px 14px 0" }}>
              <p style={S.sectionLabel}>Live Data</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>

                <DetailStat label="Latitude"
                  value={fmtCoord(selected.lastLocation?.lat)} />

                <DetailStat label="Longitude"
                  value={fmtCoord(selected.lastLocation?.lng)} />

                {/* Battery — always shown, "--" if unknown */}
                <DetailStat
                  label="Battery"
                  value={fmtBattery(selected.battery)}
                  valueColor={batteryColor(selected.battery)}
                  bg={batteryBg(selected.battery)}
                  extra={
                    isGoodBattery(selected.battery)
                      ? <BatteryBar pct={Number(selected.battery)} />
                      : <p style={{ margin: "4px 0 0", fontSize: 9, color: "#94a3b8" }}>Awaiting ping…</p>
                  }
                />

                {/* Speed — S1: 0 is valid, always shown */}
                <DetailStat
                  label="Speed"
                  value={fmtSpeed(selected.speed)}
                  valueColor={
                    typeof selected.speed === "number" && selected.speed > 5
                      ? "#0284c7" : "#0f172a"
                  }
                  bg={typeof selected.speed === "number" && selected.speed > 5 ? "#f0f9ff" : "#f8fafc"}
                  extra={
                    typeof selected.speed === "number" && selected.speed === 0
                      ? <p style={{ margin: "4px 0 0", fontSize: 9, color: "#94a3b8" }}>Stationary</p>
                      : null
                  }
                />

                {/* FIX #9 */}
                <DetailStat
                  label="Route pts"
                  value={pathLoading ? "…" : String((paths[selected.employeeId] || []).length)}
                />

                <DetailStat
                  label="Network"
                  value={!selected.isOnline ? "Offline" : selected.networkQuality === "weak" ? "Weak" : "Good"} // FIX #7
                  valueColor={!selected.isOnline ? "#dc2626" : selected.networkQuality === "weak" ? "#d97706" : "#059669"}
                />
              </div>
            </div>

            {/* Last ping info */}
            {(selected.lastPingTime || selected.lastLocation?.timestamp) && (
              <div style={{ padding: "10px 14px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "#f8fafc", borderRadius: 8, border: "1px solid #f1f5f9", fontSize: 11, color: "#64748b" }}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                  <span>
                    Last ping: <b style={{ color: "#0f172a" }}>
                      {new Date(selected.lastPingTime || selected.lastLocation.timestamp).toLocaleTimeString()}
                    </b>
                    {" · "}
                    {relTime(selected.lastPingTime || selected.lastLocation?.timestamp)}
                  </span>
                </div>
              </div>
            )}

            {/* Route history */}
            <div style={{ padding: "12px 14px 0" }}>
              <p style={S.sectionLabel}>Route History</p>
              <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 11px", border: "1px solid #f1f5f9" }}>
                <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 12, color: "#0f172a", background: "#fff", outline: "none", marginBottom: 7 }}
                />
                <button onClick={() => loadRouteHistory(selected.employeeId)} disabled={pathLoading}
                  style={{ width: "100%", padding: "8px 0", background: pathLoading ? "#ede9fe" : "#6366f1", color: pathLoading ? "#6366f1" : "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: pathLoading ? "not-allowed" : "pointer" }}>
                  {pathLoading ? "Loading…" : "Load Route"}
                </button>
              </div>
            </div>

            {/* Controls */}
            <div style={{ padding: "11px 14px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b", cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={autoFollow} onChange={e => setAutoFollow(e.target.checked)} style={{ accentColor: "#6366f1" }} />
                Auto-follow
              </label>
              <button
                onClick={() => {
                  const { lat, lng } = selected.lastLocation || {};
                  if (lat && lng && mapRef.current) mapRef.current.flyTo([lat, lng], 18, { duration: 1 });
                }}
                style={{ background: "none", border: "none", fontSize: 12, color: "#6366f1", fontWeight: 600, cursor: "pointer" }}
              >
                Center map
              </button>
            </div>

            <div style={{ padding: "11px 14px 18px" }}>
              <button onClick={clearSelected}
                style={{ width: "100%", padding: "8px 0", background: "#fff", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ← Back to team
              </button>
            </div>
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
          <TileLayer key={tileKey} url={tile.url} attribution={tile.attr} maxZoom={19} />

          {/* M3 */}
          <MarkerClusterGroup
            chunkedLoading
            key={clusterKey}
            showCoverageOnHover={false}
            iconCreateFunction={cluster => new L.DivIcon({
              html: `<div style="
                width:38px;height:38px;border-radius:50%;
                background:linear-gradient(135deg,#6366f1,#8b5cf6);
                color:#fff;display:flex;align-items:center;justify-content:center;
                font-size:13px;font-weight:800;
                box-shadow:0 3px 14px rgba(99,102,241,0.5);
                border:3px solid #fff;
              ">${cluster.getChildCount()}</div>`,
              className: "", iconSize: [38, 38], iconAnchor: [19, 19],
            })}
          >
            {employees
              .filter(emp => !selected || emp._id === selected._id)
              .map(emp => {
                if (!emp.lastLocation?.lat || !emp.lastLocation?.lng) return null;
                const { lat, lng } = emp.lastLocation;
                return (
                  // M1
                  <Marker key={`${emp._id}-${lat}-${lng}`} position={[lat, lng]}
                    icon={getIcon(emp)} eventHandlers={{ click: () => handleSelect(emp) }}
                  >
                    <Popup>
                      <div style={{ fontSize: 13, minWidth: 210, fontFamily: "'DM Sans','Segoe UI',sans-serif", lineHeight: 1.6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: emp.isOnline ? "#ecfdf5" : "#f1f5f9", color: emp.isOnline ? "#059669" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, border: `2px solid ${emp.isOnline ? "#a7f3d0" : "#e2e8f0"}`, flexShrink: 0 }}>
                            {emp.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{emp.name}</p>
                            <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>{emp.employeeId}</p>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 10px", borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                          <MiniStat label="Battery"  value={fmtBattery(emp.battery)}  color={batteryColor(emp.battery)} />
                          {/* S1: speed 0 is valid */}
                          <MiniStat label="Speed"    value={fmtSpeed(emp.speed)} />
                          <MiniStat label="Lat"      value={fmtCoord(lat)} />
                          <MiniStat label="Lng"      value={fmtCoord(lng)} />
                          {/* FIX #7 */}
                          <MiniStat label="Network"
                            value={!emp.isOnline ? "Offline" : emp.networkQuality === "weak" ? "Weak" : "Good"}
                            color={!emp.isOnline ? "#dc2626" : emp.networkQuality === "weak" ? "#d97706" : "#059669"}
                          />
                          <MiniStat label="Status"
                            value={emp.isOnline ? "Live" : "Offline"}
                            color={emp.isOnline ? "#059669" : "#dc2626"}
                          />
                        </div>

                        {(emp.lastPingTime || emp.lastLocation?.timestamp) && (
                          <p style={{ margin: "8px 0 0", fontSize: 10, color: "#94a3b8" }}>
                            {relTime(emp.lastPingTime || emp.lastLocation.timestamp)}
                          </p>
                        )}

                        <button onClick={() => handleSelect(emp)}
                          style={{ marginTop: 10, width: "100%", padding: "7px 0", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          View details →
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MarkerClusterGroup>

          {/* Live path */}
          {selected && (paths[selected.employeeId] || []).length > 1 && (
            <Polyline positions={paths[selected.employeeId]}
              pathOptions={{ color: "#6366f1", weight: 4, opacity: 0.9 }} />
          )}

          {/* Historical */}
          {selected && historyPoints.length > 1 && (
            <Polyline positions={historyPoints}
              pathOptions={{ color: isSat ? "#fbbf24" : "#94a3b8", weight: 2.5, opacity: 0.6, dashArray: "7,5" }} />
          )}

          <FlyToSelected selected={selected} autoFollow={autoFollow} />
        </MapContainer>

        {/* ── Map controls ──────────────────────────────────────────────── */}
        <div style={{ position: "absolute", top: 14, left: 14, zIndex: 1000, display: "flex", gap: 8 }}>
          <button className="map-btn" onClick={() => fetchEmployees(true)} style={S.mapBtn}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
            </svg>
            Refresh
          </button>
          <button className="map-btn" onClick={() => setTileKey(k => k === "color" ? "satellite" : "color")} style={S.mapBtn}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              {tileKey === "color"
                ? <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>
                : <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>
              }
            </svg>
            {tile.label}
          </button>
        </div>

        {/* Legend */}
        <div style={{
          ...S.legend,
          background: isSat ? "rgba(15,23,42,0.88)" : "#fff",
          border:    `1px solid ${isSat ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
        }}>
          <p style={{ margin: "0 0 9px", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.6px", color: isSat ? "#fff" : "#0f172a" }}>
            Legend
          </p>
          <LegRow color="#10b981" label="Live · good"  pulse sat={isSat} />
          <LegRow color="#f59e0b" label="Live · weak"  pulse sat={isSat} />
          <LegRow color="#94a3b8" label="Offline"             sat={isSat} />
          <div style={{ borderTop: `1px solid ${isSat ? "rgba(255,255,255,0.1)" : "#f1f5f9"}`, margin: "7px 0" }} />
          <LegLine color="#6366f1"                              label="Live route"    sat={isSat} />
          <LegLine color={isSat ? "#fbbf24" : "#94a3b8"} dashed label="History route" sat={isSat} />
        </div>

        {/* Mini bar — shows when detail tab open */}
        {selected && tab === "detail" && (
          <div style={S.miniBar}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: selected.isOnline ? "#10b981" : "#94a3b8",
                boxShadow:  selected.isOnline ? "0 0 0 3px rgba(16,185,129,0.2)" : "none" }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selected.name}
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, flexShrink: 0 }}>
              {/* Always show battery in mini bar even if "--" */}
              <span style={{ color: batteryColor(selected.battery), fontWeight: 700 }}>
                🔋 {fmtBattery(selected.battery)}
              </span>
              {/* S1: speed 0 valid */}
              <span style={{ color: "#64748b" }}>
                ⚡ {fmtSpeed(selected.speed)}
              </span>
              {(selected.lastPingTime || selected.lastLocation?.timestamp) && (
                <span style={{ color: "#94a3b8" }}>
                  {relTime(selected.lastPingTime || selected.lastLocation?.timestamp)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function Chip({ bg, color, children }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: bg, color }}>
      {children}
    </span>
  );
}

function StatusPill({ active, activeText, inactiveText, activeBg, inactiveBg, activeColor, inactiveColor, activeBorder, inactiveBorder }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: active ? activeBg  : inactiveBg,
      color:      active ? activeColor : inactiveColor,
      border:    `1px solid ${active ? activeBorder : inactiveBorder}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {active ? activeText : inactiveText}
    </div>
  );
}

function MiniStat({ label, value, color = "#0f172a" }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 9, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</p>
      <p style={{ margin: "1px 0 0", fontSize: 12, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function DetailStat({ label, value, valueColor = "#0f172a", bg = "#f8fafc", extra = null }) {
  return (
    <div style={{ background: bg, borderRadius: 9, padding: "9px 10px", border: "1px solid #f1f5f9", marginBottom: 7 }}>
      <p style={{ margin: "0 0 2px", fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: valueColor, letterSpacing: "-0.3px" }}>
        {value}
      </p>
      {extra}
    </div>
  );
}

function BatteryBar({ pct }) {
  const color = pct < 20 ? "#ef4444" : pct < 50 ? "#f59e0b" : "#10b981";
  return (
    <div style={{ marginTop: 5, height: 3, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
    </div>
  );
}

function BatteryMini({ pct }) {
  const color = pct < 20 ? "#ef4444" : pct < 50 ? "#f59e0b" : "#10b981";
  const fill  = Math.max(0, Math.min(1, pct / 100));
  return (
    <svg width={13} height={7} viewBox="0 0 13 7" style={{ flexShrink: 0 }}>
      <rect x="0.5" y="0.5" width="10" height="6" rx="1.2" stroke={color} strokeWidth="1.1" fill="none"/>
      <rect x="10.5" y="2" width="1.8" height="3" rx="0.5" fill={color}/>
      <rect x="1.2" y="1.2" width={Math.max(0, Math.round(7.6 * fill))} height="4.6" rx="0.7" fill={color}/>
    </svg>
  );
}

function LegRow({ color, label, pulse, sat }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, fontSize: 11, color: sat ? "#cbd5e1" : "#64748b" }}>
      <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        {pulse && <div style={{ position: "absolute", inset: -2, borderRadius: "50%", border: `1.5px solid ${color}`, opacity: 0.35 }} />}
      </div>
      {label}
    </div>
  );
}

function LegLine({ color, label, dashed, sat }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, fontSize: 11, color: sat ? "#cbd5e1" : "#64748b" }}>
      <div style={{ width: 18, borderTop: dashed ? `2px dashed ${color}` : `2.5px solid ${color}`, flexShrink: 0 }} />
      {label}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  root:    { display: "flex", height: "100vh", fontFamily: "'DM Sans','Segoe UI',-apple-system,sans-serif", background: "#f8fafc" },
  sidebar: { width: 300, flexShrink: 0, display: "flex", flexDirection: "column", background: "#fff", borderRight: "1px solid #e2e8f0", zIndex: 10, overflow: "hidden" },
  brand:   { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid #f1f5f9" },
  brandIcon: { width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(99,102,241,0.35)" },
  tabBar:  { display: "flex", padding: "0 14px", borderBottom: "1px solid #f1f5f9", gap: 2 },
  tab:     { flex: 1, padding: "9px 0", background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "#94a3b8", cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: -1, transition: "color 0.15s, border-color 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 },
  tabActive: { color: "#6366f1", borderBottomColor: "#6366f1" },
  searchInput: { width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 27px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: "#0f172a", background: "#f8fafc", outline: "none", transition: "border-color 0.15s" },
  syncStrip: { padding: "4px 14px", fontSize: 10, color: "#94a3b8", background: "#fafbfd", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 5 },
  sectionLabel: { margin: "0 0 7px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px" },
  mapBtn:  { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 12, fontWeight: 600, color: "#374151", boxShadow: "0 1px 8px rgba(0,0,0,0.09)", cursor: "pointer" },
  legend:  { position: "absolute", top: 14, right: 14, zIndex: 1000, borderRadius: 11, padding: "11px 13px", boxShadow: "0 2px 16px rgba(0,0,0,0.1)", minWidth: 148, transition: "background 0.3s" },
  miniBar: { position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "#fff", borderRadius: 12, padding: "10px 18px", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 16, minWidth: 300, maxWidth: "70vw" },
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
  .emp-row:hover { background: #f8faff !important; }
  .map-btn:hover { background: #f8fafc !important; box-shadow: 0 2px 12px rgba(0,0,0,0.12) !important; }
  .leaflet-popup-content-wrapper { border-radius: 14px !important; box-shadow: 0 8px 32px rgba(15,23,42,0.15) !important; border: 1px solid #e2e8f0 !important; padding: 0 !important; }
  .leaflet-popup-content { margin: 14px 15px !important; }
  .leaflet-popup-tip-container { display: none !important; }
  .leaflet-control-zoom { border: 1px solid #e2e8f0 !important; border-radius: 10px !important; box-shadow: 0 1px 8px rgba(0,0,0,0.07) !important; overflow: hidden; }
  .leaflet-control-zoom a { color: #374151 !important; }
  .leaflet-control-zoom a:hover { background: #f8fafc !important; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
`;
