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

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom icons
const liveIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: "live-marker",
});

const offlineIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: "offline-marker",
});

const weakIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: "weak-marker",
});

function FlyToSelected({ selected, autoFollow }) {
  const map = useMap();
  useEffect(() => {
    if (selected && selected.lastLocation?.lat && selected.lastLocation?.lng && autoFollow) {
      map.flyTo([selected.lastLocation.lat, selected.lastLocation.lng], 17, {
        duration: 1.5,
      });
    }
  }, [selected, autoFollow, map]);
  return null;
}

const formatCoord = (v) => (v == null ? "—" : Number(v).toFixed(5));

const formatDateForAPI = (date) => {
  if (!date) return new Date().toISOString().split("T")[0];
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return d.toISOString().split("T")[0];
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  };
};

// ✅ Only treat explicit false as offline
const getIcon = (emp) => {
  if (emp.isOnline === false) return offlineIcon;
  if (emp.networkQuality === "weak") return weakIcon;
  return liveIcon;
};

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
  const [autoFollow, setAutoFollow] = useState(true);
  const [historyDate, setHistoryDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [historyPoints, setHistoryPoints] = useState([]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get(`/locations/live?t=${Date.now()}`, getAuthHeaders());
      const newData = res.data.employees || [];

      // ✅ Smart merge – update only changed employees, prevent UI flicker
      setEmployees(prev => {
        return newData.map(newEmp => {
          const oldEmp = prev.find(e => e._id === newEmp._id);
          return oldEmp ? { ...oldEmp, ...newEmp } : newEmp;
        });
      });
    } catch (err) {
      console.error("Failed to fetch live locations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Poll only when socket is NOT available (optional optimisation)
  useEffect(() => {
    fetchEmployees();

    if (socket) {
      // Real‑time connection exists – no need for polling
      return;
    }

    const interval = setInterval(fetchEmployees, 10000);
    return () => clearInterval(interval);
  }, [fetchEmployees, socket]);

  const loadRouteHistory = useCallback(async (employeeId, date = historyDate) => {
    if (!employeeId) return;
    try {
      setPathLoading(true);
      const formattedDate = formatDateForAPI(date);
      const res = await api.get(
        `/locations/history/${employeeId}?date=${formattedDate}&t=${Date.now()}`,
        getAuthHeaders()
      );
      const logs = res.data.data || [];
      const coords = logs.filter(l => l.lat && l.lng).map(l => [l.lat, l.lng]);
      setHistoryPoints(coords);
      setPaths(prev => ({
        ...prev,
        [employeeId]: coords,
      }));
    } catch (err) {
      console.error("Route history error:", err);
    } finally {
      setPathLoading(false);
    }
  }, [historyDate]);

  useEffect(() => {
    if (selected) {
      loadRouteHistory(selected.employeeId);
    }
  }, [selected, loadRouteHistory]);

  useEffect(() => {
    if (!socket) return;

    const handleLocationUpdate = (data) => {
      console.log("Live location update:", data);
      setLastUpdated(new Date());

      setEmployees(prev =>
        prev.map(emp =>
          (emp._id === data.employeeId || emp.employeeId === data.employeeId)
            ? {
                ...emp,
                lastLocation: {
                  lat: data.lat,
                  lng: data.lng,
                  timestamp: data.timestamp || new Date(),
                },
                battery: data.battery !== undefined ? data.battery : emp.battery,
                speed: data.speed ?? emp.speed ?? 0,
                networkQuality: data.networkQuality ?? emp.networkQuality,
                isTracking: true,
                isOnline: true,
              }
            : emp
        )
      );

      setPaths(prev => {
        const currentPath = prev[data.employeeId] || [];
        const newPoint = [data.lat, data.lng];
        const last = currentPath[currentPath.length - 1];
        if (last && last[0] === newPoint[0] && last[1] === newPoint[1]) return prev;
        return {
          ...prev,
          [data.employeeId]: [...currentPath, newPoint].slice(-500),
        };
      });
    };

    const handleOffline = (data) => {
      setEmployees(prev =>
        prev.map(emp =>
          (emp._id === data.employeeId || emp.employeeId === data.employeeId)
            ? { ...emp, isTracking: false, isOnline: false }
            : emp
        )
      );
    };

    const handleOnline = (data) => {
      setEmployees(prev =>
        prev.map(emp =>
          (emp._id === data.employeeId || emp.employeeId === data.employeeId)
            ? { ...emp, isOnline: true }
            : emp
        )
      );
    };

    on("location:update", handleLocationUpdate);
    on("system:employee-offline", handleOffline);
    on("system:employee-online", handleOnline);

    return () => {
      off("location:update", handleLocationUpdate);
      off("system:employee-offline", handleOffline);
      off("system:employee-online", handleOnline);
    };
  }, [socket, on, off]);

  const handleSelect = (emp) => {
    setSelected(emp);
  };

  const clearSelected = () => {
    setSelected(null);
    setHistoryPoints([]);
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(search.toLowerCase()) ||
    emp.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = employees.filter(e => e.isOnline === true).length;

  if (loading) return <LoadingSpinner fullScreen text="Loading live map..." />;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r flex flex-col shadow-lg z-10">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 text-lg">Live Tracking</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              {onlineCount} active
            </span>
          </div>
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {lastUpdated && (
          <div className="px-4 py-1.5 text-xs text-gray-400 bg-gray-50 border-b">
            Last update: {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredEmployees.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">
              No employees found
            </div>
          )}
          {filteredEmployees.map(emp => {
            const hasLocation = emp.lastLocation?.lat && emp.lastLocation?.lng;
            const isSelected = selected?._id === emp._id;
            const active = emp.isOnline === true;
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
                <div className="mt-1 ml-12 flex items-center gap-2 text-xs">
                  {emp.battery != null && !isNaN(emp.battery) && (
                    <span className={emp.battery < 20 ? "text-red-500" : "text-gray-500"}>
                      Battery {emp.battery}%
                    </span>
                  )}
                  {!hasLocation && <span className="text-orange-400">No GPS</span>}
                  {emp.speed > 0 && <span className="text-gray-500">{emp.speed} km/h</span>}
                  {emp.networkQuality === "weak" && (
                    <span className="text-yellow-600">📶 weak signal</span>
                  )}
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

      {/* Map Area */}
      <div className="flex-1 relative">
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(map) => (mapRef.current = map)}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />

          {/* ✅ Stable key prevents full re-renders on data updates */}
          <MarkerClusterGroup chunkedLoading key="stable-cluster">
            {employees
              .filter(emp => !selected || emp._id === selected._id)
              .map(emp => {
                const { lat, lng } = emp.lastLocation || {};
                if (!lat || !lng) return null;
                return (
                  <Marker
                    key={emp._id}
                    position={[lat, lng]}
                    icon={getIcon(emp)}
                    eventHandlers={{ click: () => handleSelect(emp) }}
                  >
                    <Popup>
                      <div className="text-sm space-y-1">
                        <p className="font-bold text-base">{emp.name}</p>
                        <p>ID: {emp.employeeId}</p>
                        <p>Location: {formatCoord(lat)}, {formatCoord(lng)}</p>
                        <p>Battery: {emp.battery != null && !isNaN(emp.battery) ? `${emp.battery}%` : "N/A"}</p>
                        <p>
                          Network:{" "}
                          {emp.networkQuality === "weak"
                            ? "⚠️ Weak signal"
                            : emp.isOnline === true
                            ? "Good"
                            : "Offline"}
                        </p>
                        <p>Status: {emp.isOnline === true ? "Live" : "Offline"}</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MarkerClusterGroup>

          {/* Path for selected employee */}
          {selected && paths[selected.employeeId]?.length > 1 && (
            <Polyline
              positions={paths[selected.employeeId]}
              pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.8 }}
            />
          )}
          {selected && historyPoints.length > 1 && (
            <Polyline
              positions={historyPoints}
              pathOptions={{ color: "#9ca3af", weight: 2, opacity: 0.5, dashArray: "5,5" }}
            />
          )}

          <FlyToSelected selected={selected} autoFollow={autoFollow} />
        </MapContainer>

        {/* Info card */}
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
              <p>Location: {formatCoord(selected.lastLocation?.lat)}, {formatCoord(selected.lastLocation?.lng)}</p>
              <p>
                Battery:{" "}
                <span className={selected.battery < 20 ? "text-red-500 font-bold" : ""}>
                  {selected.battery != null && !isNaN(selected.battery) ? `${selected.battery}%` : "N/A"}
                </span>
              </p>
              <p>Speed: {selected.speed ? `${selected.speed} km/h` : "—"}</p>
              <p>
                Network:{" "}
                {selected.networkQuality === "weak"
                  ? "⚠️ Weak signal"
                  : selected.isOnline === true
                  ? "Good"
                  : "Offline"}
              </p>
              <p>Route points: {pathLoading ? "Loading..." : (paths[selected.employeeId]?.length || 0)}</p>
              <p className={selected.isOnline === true ? "text-green-600 font-medium" : "text-red-500"}>
                {selected.isOnline === true ? "Live tracking active" : "Offline"}
              </p>
            </div>

            <div className="mt-3">
              <label className="text-xs text-gray-500 block mb-1">Show route for date</label>
              <input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="w-full text-sm border rounded px-2 py-1"
              />
              <button
                onClick={() => loadRouteHistory(selected.employeeId)}
                disabled={pathLoading}
                className="mt-2 w-full text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 py-1.5 rounded font-medium"
              >
                {pathLoading ? "Loading..." : "Load route"}
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <label className="text-sm text-gray-600 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoFollow}
                  onChange={(e) => setAutoFollow(e.target.checked)}
                />
                Auto-follow on map
              </label>
              <button
                onClick={() => {
                  const { lat, lng } = selected.lastLocation || {};
                  if (lat && lng && mapRef.current) {
                    mapRef.current.flyTo([lat, lng], 17, { duration: 1 });
                  }
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Center on map
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow p-3 text-xs space-y-1.5 z-[1000]">
          <p className="font-semibold text-gray-700">Legend</p>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span>Live (good network)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
            <span>Live (weak network)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            <span>Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 border-t-2 border-blue-500" />
            <span>Today's route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 border-t-2 border-gray-400 border-dashed" />
            <span>Historical route</span>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchEmployees}
          className="absolute top-4 left-4 bg-white shadow rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 z-[1000] border"
        >
          Refresh data
        </button>
      </div>

      <style jsx>{`
        .live-marker {
          filter: drop-shadow(0 0 4px #22c55e);
        }
        .offline-marker {
          filter: grayscale(0.5);
        }
        .weak-marker {
          filter: hue-rotate(60deg) brightness(1.1);
        }
      `}</style>
    </div>
  );
}
