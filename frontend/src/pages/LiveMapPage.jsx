import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle
} from 'react-leaflet';

import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix marker icon issue (VERY IMPORTANT)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

export default function LiveMapPage() {
  const { on, off } = useSocket();

  const [employees, setEmployees] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch initial data ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, geoRes] = await Promise.all([
          api.get('/locations/live'),
          api.get('/geofences'),
        ]);

        setEmployees(empRes.data.employees);
        setGeofences(geoRes.data.geofences);
      } catch (err) {
        console.error('Error fetching data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ── Socket updates ──
  useEffect(() => {
    const handleLocationUpdate = (data) => {
      setEmployees(prev =>
        prev.map(emp =>
          emp._id === data.employeeId
            ? {
                ...emp,
                lastLocation: {
                  lat: data.lat,
                  lng: data.lng,
                  timestamp: data.timestamp
                },
                isTracking: true
              }
            : emp
        )
      );
    };

    const handleOffline = (data) => {
      setEmployees(prev =>
        prev.map(emp =>
          emp._id === data.employeeId
            ? { ...emp, isTracking: false }
            : emp
        )
      );
    };

    on('location:update', handleLocationUpdate);
    on('system:employee-offline', handleOffline);

    return () => {
      off('location:update', handleLocationUpdate);
      off('system:employee-offline', handleOffline);
    };
  }, [on, off]);

  if (loading) return <LoadingSpinner fullScreen text="Loading map..." />;

  const activeCount = employees.filter(e => e.isTracking).length;

  return (
    <div className="flex h-full">

      {/* ── Sidebar ── */}
      <div className="w-72 bg-white border-r overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Live Tracking</h2>
          <p className="text-sm text-gray-500">
            {activeCount} active · {employees.length} total
          </p>
        </div>

        {employees.map(emp => (
          <div
            key={emp._id}
            onClick={() => setSelected(emp)}
            className={`p-3 cursor-pointer hover:bg-gray-50 ${
              selected?._id === emp._id ? 'bg-blue-50' : ''
            }`}
          >
            <p className="font-medium">{emp.name}</p>
            <p className="text-xs text-gray-500">{emp.employeeId}</p>
          </div>
        ))}
      </div>

      {/* ── Map ── */}
      <div className="flex-1">
        <MapContainer
          center={[28.6139, 77.2090]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* 🔥 CLUSTERING */}
          <MarkerClusterGroup>

            {/* Employees */}
            {employees.map(emp => {
              if (!emp.lastLocation?.lat) return null;

              return (
                <Marker
                  key={emp._id}
                  position={[
                    emp.lastLocation.lat,
                    emp.lastLocation.lng
                  ]}
                  eventHandlers={{
                    click: () => setSelected(emp)
                  }}
                >
                  <Popup>
                    <b>{emp.name}</b><br />
                    {emp.employeeId}<br />
                    Status: {emp.isTracking ? "Live" : "Offline"}
                  </Popup>
                </Marker>
              );
            })}

          </MarkerClusterGroup>

          {/* Geofences */}
          {geofences.map(geo => (
            <Circle
              key={geo._id}
              center={[geo.center.lat, geo.center.lng]}
              radius={geo.radius}
              pathOptions={{
                color: geo.color || "blue",
                fillOpacity: 0.1
              }}
            />
          ))}
        </MapContainer>
      </div>

      {/* ── Selected Employee Card ── */}
      {selected && (
        <div className="absolute bottom-4 left-80 bg-white p-4 rounded shadow w-64">
          <h3 className="font-semibold">{selected.name}</h3>
          <p className="text-sm text-gray-500">{selected.employeeId}</p>

          <p className="text-sm mt-2">
            Status: {selected.isTracking ? "Live" : "Offline"}
          </p>

          {selected.lastLocation && (
            <p className="text-xs mt-1">
              {selected.lastLocation.lat.toFixed(4)},{" "}
              {selected.lastLocation.lng.toFixed(4)}
            </p>
          )}

          <button
            onClick={() => setSelected(null)}
            className="text-xs text-red-500 mt-2"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}