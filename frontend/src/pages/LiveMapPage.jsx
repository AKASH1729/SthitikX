import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import LoadingSpinner from "../components/Shared/LoadingSpinner";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Live (green) marker
const liveIcon = new L.Icon({
  iconUrl:
    "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

// Offline (gray) marker
const offlineIcon = new L.DivIcon({
  html: `<div style="
    width:28px;height:28px;
    background:#9ca3af;
    border-radius:50%;
    border:3px solid white;
    box-shadow:0 2px 6px rgba(0,0,0,0.3);
    display:flex;align-items:center;
    justify-content:center;
    color:white;font-size:12px;
  ">📍</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  className: "",
});

const safe = (v) =>
  v == null ? "N/A" : Number(v).toFixed(5);

export default function LiveMapPage() {
  const { socket, on, off } = useSocket();
  const mapRef = useRef();

  const [employees, setEmployees] = useState([]);
  const [paths, setPaths] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");
  const [pathLoading, setPathLoading] = useState(false);

  /* ================= FETCH EMPLOYEES ================= */
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get("/locations/live");
      setEmployees(res.data.employees || []);
    } catch (err) {
      console.error("Live locations error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    // Refresh every 30 seconds
    const interval = setInterval(fetchEmployees, 30000);
    return () => clearInterval(interval);
  }, [fetchEmployees]);

  /* ================= LOAD ROUTE HISTORY ================= */
  const loadRouteHistory = useCallback(async (employeeId) => {
    try {
      setPathLoading(true);
      const today = new Date().toISOString().split("T")[0];
      const res = await api.get(
        `/locations/history/${employeeId}?date=${today}`
      );
      const logs = res.data.logs || [];
      console.log(
        `📍 Route history for ${employeeId}:`,
        logs.length,
        "points"
      );
      const coords = logs
        .filter((l) => l.lat && l.lng)
        .map((l) => [l.lat, l.lng]);

      setPaths((prev) => ({
        ...prev,
        [employeeId]: coords,
      }));
    } catch (err) {
      console.error("Route history error:", err);
    } finally {
      setPathLoading(false);
    }
  }, []);

  /* ================= SOCKET LIVE UPDATES ================= */
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data) => {
      console.log("⚡ Live location update:", data);
      setLastUpdated(new Date());

      // Update employee in list
      setEmployees((prev) =>
        prev.map((emp) =>
          emp._id === data.employeeId
            ? {
                ...emp,
                lastLocation: {
                  lat: data.lat,
                  lng: data.lng,
                  timestamp: data.timestamp,
                },
                battery: data.battery ?? emp.battery,
                speed: data.speed ?? 0,
                isTracking: true,
                isOnline: true,
              }
            : emp
        )
      );

      // Append to path
      setPaths((prev) => {
        const old = prev[data.employeeId] || [];
        return {
          ...prev,
          [data.employeeId]: [
            ...old,
            [data.lat, data.lng],
          ].slice(-300),
        };
      });

      // Auto follow selected employee
      if (
        mapRef.current &&
        selected &&
        data.employeeId === selected._id
      ) {
        mapRef.current.flyTo(
          [data.lat, data.lng],
          17,
          { duration: 1.5 }
        );
      }
    };

    const handleOffline = (data) => {
      console.log("🔴 Employee offline:", data);
      setEmployees((prev) =>
        prev.map((emp) =>
          emp._id === data.employeeId
            ? { ...emp, isTracking: false, isOnline: false }
            : emp
        )
      );
    };

    const handleOnline = (data) => {
      console.log("🟢 Employee online:", data);
      setEmployees((prev) =>
        prev.map((emp) =>
          emp._id === data.employeeId
            ? { ...emp, isOnline: true }
            : emp
        )
      );
    };

    on("location:update", handleUpdate);
    on("system:employee-offline", handleOffline);
    on("system:employee-online", handleOnline);

    return () => {
      off("location:update", handleUpdate);
      off("system:employee-offline", handleOffline);
      off("system:employee-online", handleOnline);
    };
  }, [socket, selected, on, off]);

  /* ================= SELECT EMPLOYEE ================= */
  const handleSelect = (emp) => {
    setSelected(emp);
    loadRouteHistory(emp.employeeId);

    const lat = emp?.lastLocation?.lat;
    const lng = emp?.lastLocation?.lng;

    if (lat && lng && mapRef.current) {
      mapRef.current.flyTo([lat, lng], 17);
    }
  };

  /* ================= HELPERS ================= */
  const getCoords = (emp) => ({
    lat: emp?.lastLocation?.lat,
    lng: emp?.lastLocation?.lng,
  });

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = employees.filter(
    (e) => e.isTracking
  ).length;

  if (loading)
    return <LoadingSpinner fullScreen text="Loading live map..." />;

  return (
    <div className="flex h-screen bg-gray-100">

      {/* ===== SIDEBAR ===== */}
      <div className="w-72 bg-white border-r flex flex-col shadow-sm">

        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 text-lg">
              Live Map
            </h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
              {onlineCount} 🟢
            </span>
          </div>

          <input
            type="text"
            placeholder="🔍 Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <div className="px-4 py-1.5 text-xs text-gray-400 bg-gray-50 border-b">
            ⚡ Live update:{" "}
            {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        {/* Employee list */}
        <div className="flex-1 overflow-y-auto">
          {filteredEmployees.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">
              No employees found
            </div>
          )}

          {filteredEmployees.map((emp) => {
            const { lat, lng } = getCoords(emp);
            const hasLocation = lat && lng;
            const isSelected = selected?._id === emp._id;

            return (
              <div
                key={emp._id}
                onClick={() => handleSelect(emp)}
                className={`p-3 cursor-pointer border-b hover:bg-gray-50 transition-all ${
                  isSelected
                    ? "bg-blue-50 border-l-4 border-l-blue-500"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
                    {emp.name?.charAt(0)?.toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">
                      {emp.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {emp.employeeId}
                    </p>
                  </div>

                  {/* Status */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      emp.isTracking
                        ? "bg-green-500 animate-pulse"
                        : "bg-gray-300"
                    }`}
                  />
                </div>

                {/* Battery + GPS */}
                <div className="mt-1 ml-11 flex items-center gap-2">
                  {emp.battery != null && (
                    <span
                      className={`text-xs ${
                        emp.battery < 20
                          ? "text-red-500"
                          : "text-gray-400"
                      }`}
                    >
                      🔋 {emp.battery}%
                    </span>
                  )}
                  {!hasLocation && (
                    <span className="text-xs text-orange-400">
                      No GPS
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {selected && (
          <div className="p-3 border-t bg-gray-50">
            <button
              onClick={() => {
                setSelected(null);
                setPaths({});
              }}
              className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              👥 Show all employees
            </button>
          </div>
        )}
      </div>

      {/* ===== MAP ===== */}
      <div className="flex-1 relative">
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(map) => (mapRef.current = map)}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />

          {/* MARKERS */}
          {employees
            .filter(
              (emp) => !selected || emp._id === selected._id
            )
            .map((emp) => {
              const { lat, lng } = getCoords(emp);
              if (!lat || !lng) return null;

              return (
                <Marker
                  key={emp._id}
                  position={[lat, lng]}
                  icon={emp.isTracking ? liveIcon : offlineIcon}
                  eventHandlers={{
                    click: () => handleSelect(emp),
                  }}
                >
                  <Popup>
                    <div className="text-sm space-y-1">
                      <p className="font-bold text-base">
                        {emp.name}
                      </p>
                      <p className="text-gray-500">
                        🆔 {emp.employeeId}
                      </p>
                      <p>📍 {safe(lat)}, {safe(lng)}</p>
                      <p>🔋 {emp.battery ?? "N/A"}%</p>
                      <p
                        className={
                          emp.isTracking
                            ? "text-green-600 font-medium"
                            : "text-red-500"
                        }
                      >
                        {emp.isTracking
                          ? "🟢 Live"
                          : "🔴 Offline"}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* SELECTED EMPLOYEE PATH */}
          {selected && paths[selected.employeeId]?.length > 1 && (
            <Polyline
              positions={paths[selected.employeeId]}
              pathOptions={{
                color: "#3b82f6",
                weight: 4,
                opacity: 0.8,
                dashArray: "8 4",
              }}
            />
          )}

          {/* ALL PATHS (no employee selected) */}
          {!selected &&
            Object.entries(paths).map(([empId, coords]) =>
              coords?.length > 1 ? (
                <Polyline
                  key={empId}
                  positions={coords}
                  pathOptions={{
                    color: "#6b7280",
                    weight: 2,
                    opacity: 0.4,
                  }}
                />
              ) : null
            )}
        </MapContainer>

        {/* ===== BOTTOM INFO CARD ===== */}
        {selected &&
          (() => {
            const { lat, lng } = getCoords(selected);
            const pathPoints =
              paths[selected.employeeId]?.length || 0;

            return (
              <div className="absolute bottom-4 left-4 bg-white shadow-2xl rounded-2xl p-4 w-72 border border-gray-100 z-[1000]">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-lg">
                    {selected.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">
                      {selected.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {selected.employeeId}
                    </p>
                  </div>
                </div>

                {/* Info */}
                <div className="text-sm space-y-1.5 border-t pt-3">
                  <p className="text-gray-600">
                    📍 {safe(lat)}, {safe(lng)}
                  </p>
                  <p className="text-gray-600">
                    🔋 Battery:{" "}
                    <span
                      className={
                        selected.battery < 20
                          ? "text-red-500 font-bold"
                          : "text-gray-800"
                      }
                    >
                      {selected.battery ?? "N/A"}%
                    </span>
                  </p>
                  <p className="text-gray-600">
                    🛣 Path points:{" "}
                    {pathLoading ? (
                      <span className="text-blue-400">
                        Loading...
                      </span>
                    ) : (
                      <span className="font-medium">
                        {pathPoints}
                      </span>
                    )}
                  </p>
                  <p
                    className={`font-medium ${
                      selected.isTracking
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {selected.isTracking
                      ? "🟢 Live Tracking"
                      : "🔴 Offline"}
                  </p>
                </div>

                {/* Refresh button */}
                <button
                  onClick={() =>
                    loadRouteHistory(selected.employeeId)
                  }
                  disabled={pathLoading}
                  className="mt-3 w-full text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-lg font-medium disabled:opacity-50"
                >
                  {pathLoading
                    ? "⏳ Loading route..."
                    : "🔄 Refresh Route"}
                </button>
              </div>
            );
          })()}

        {/* ===== LEGEND ===== */}
        <div className="absolute top-4 right-4 bg-white rounded-xl shadow-lg p-3 z-[1000] text-xs space-y-2 border">
          <p className="font-semibold text-gray-700 mb-1">
            Legend
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-gray-600">Live tracking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            <span className="text-gray-600">Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 border-t-2 border-blue-500 border-dashed" />
            <span className="text-gray-600">Route path</span>
          </div>
        </div>

        {/* ===== REFRESH BUTTON ===== */}
        <button
          onClick={fetchEmployees}
          className="absolute top-4 left-4 bg-white shadow-lg rounded-xl px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 z-[1000] border"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
}
