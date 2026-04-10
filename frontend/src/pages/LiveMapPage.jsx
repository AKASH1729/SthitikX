import React, { useEffect, useState, useRef } from "react";
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

// 🔥 Marker icon (better UI)
const markerIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

const safe = (v) => (v == null ? "N/A" : Number(v).toFixed(5));

export default function LiveMapPage() {
  const { socket, on, off } = useSocket();
  const mapRef = useRef();

  const [employees, setEmployees] = useState([]);
  const [paths, setPaths] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH INITIAL ================= */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/locations/live");
        setEmployees(res.data.employees || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* ================= SOCKET ================= */
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data) => {
      // update employee
      setEmployees((prev) =>
        prev.map((emp) =>
          emp._id === data.employeeId
            ? {
                ...emp,
                lastLocation: { lat: data.lat, lng: data.lng },
                battery: data.battery ?? emp.battery,
                isTracking: true,
              }
            : emp
        )
      );

      // update path
      setPaths((prev) => {
        const old = prev[data.employeeId] || [];
        return {
          ...prev,
          [data.employeeId]: [...old, [data.lat, data.lng]].slice(-100),
        };
      });

      // follow selected employee
      if (mapRef.current && data.employeeId === selected?._id) {
        mapRef.current.flyTo([data.lat, data.lng], 17, { duration: 1.5 });
      }
    };

    on("location:update", handleUpdate);
    return () => off("location:update", handleUpdate);
  }, [socket, selected]);

  const getCoords = (emp) => ({
    lat: emp?.lastLocation?.lat,
    lng: emp?.lastLocation?.lng,
  });

  if (loading) return <LoadingSpinner fullScreen text="Loading..." />;

  return (
    <div className="flex h-screen bg-gray-100">

      {/* ================= SIDEBAR ================= */}
      <div className="w-72 bg-white border-r overflow-y-auto">
        <div className="p-4 border-b font-semibold text-lg">
          Live Employees
        </div>

        {employees.map((emp) => (
          <div
            key={emp._id}
            onClick={() => {
              setSelected(emp);
              const { lat, lng } = getCoords(emp);

              if (lat && lng && mapRef.current) {
                mapRef.current.flyTo([lat, lng], 17);
              }
            }}
            className={`p-3 cursor-pointer border-b hover:bg-gray-100 ${
              selected?._id === emp._id ? "bg-blue-100" : ""
            }`}
          >
            <p className="font-medium">{emp.name}</p>
            <p className="text-xs text-gray-500">{emp.employeeId}</p>
          </div>
        ))}
      </div>

      {/* ================= MAP ================= */}
      <div className="flex-1 relative">

        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: "100%" }}
          whenCreated={(map) => (mapRef.current = map)}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* MARKERS */}
          {employees
            .filter((emp) => !selected || emp._id === selected._id)
            .map((emp) => {
              const { lat, lng } = getCoords(emp);
              if (!lat || !lng) return null;

              return (
                <Marker
                  key={emp._id}
                  position={[lat, lng]}
                  icon={markerIcon}
                >
                  <Popup>
                    <b>{emp.name}</b>
                    <br />
                    📍 {safe(lat)}, {safe(lng)}
                    <br />
                    🔋 {emp.battery ?? "N/A"}%
                  </Popup>
                </Marker>
              );
            })}

          {/* PATH */}
          {selected && paths[selected._id] && (
            <Polyline
              positions={paths[selected._id]}
              pathOptions={{ color: "blue", weight: 4 }}
            />
          )}
        </MapContainer>

        {/* ================= BOTTOM CARD ================= */}
        {selected && (() => {
          const { lat, lng } = getCoords(selected);

          return (
            <div className="absolute bottom-4 left-4 bg-white shadow-xl rounded-xl p-4 w-72 border">
              <h3 className="font-bold text-lg">{selected.name}</h3>
              <p className="text-sm text-gray-500">{selected.employeeId}</p>

              <div className="mt-2 text-sm space-y-1">
                <p>📍 {safe(lat)}, {safe(lng)}</p>
                <p>🔋 Battery: {selected.battery ?? "N/A"}%</p>
                <p
                  className={
                    selected.isTracking
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {selected.isTracking ? "🟢 Live" : "🔴 Offline"}
                </p>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}