/**
 * EmployeeHistoryPage — Shows movement history and route for a single employee
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api from '../services/api';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

export default function EmployeeHistoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const polylineRef = useRef(null);

  const [employee,  setEmployee]  = useState(null);
  const [locations, setLocations] = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Fetch employee info
  useEffect(() => {
    api.get(`/users?limit=100`).then(res => {
      const emp = res.data.users.find(u => u._id === id);
      setEmployee(emp);
    });
  }, [id]);

  // Fetch movement history
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/locations/history/${id}?date=${date}`);
      setLocations(data.locations);
      setStats(data.stats);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id, date]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Draw route on map
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !mapRef.current || locations.length === 0) return;

    const drawRoute = () => {
      if (!mapInstance.current) {
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          zoom: 14,
          mapTypeId: 'roadmap',
          disableDefaultUI: true,
          zoomControl: true,
        });
      }

      // Clear previous polyline
      if (polylineRef.current) polylineRef.current.setMap(null);

      const path = locations.map(l => ({ lat: l.lat, lng: l.lng }));

      // Draw route polyline
      polylineRef.current = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: mapInstance.current,
      });

      // Start marker (green)
      new window.google.maps.Marker({
        position: path[0],
        map: mapInstance.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: 'Start',
      });

      // End marker (red)
      new window.google.maps.Marker({
        position: path[path.length - 1],
        map: mapInstance.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: 'End',
      });

      // Fit map to route
      const bounds = new window.google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      mapInstance.current.fitBounds(bounds);
    };

    if (window.google) {
      drawRoute();
    } else {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}`;
      script.async = true;
      script.onload = drawRoute;
      document.head.appendChild(script);
    }
    setMapLoaded(true);
  }, [locations]);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/employees')} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Movement History {employee && `— ${employee.name}`}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{employee?.employeeId} · {employee?.department}</p>
        </div>
      </div>

      {/* Date picker */}
      <div className="card p-4 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Date:</label>
        <input type="date" className="input w-44 text-sm" value={date}
          max={format(new Date(), 'yyyy-MM-dd')}
          onChange={e => setDate(e.target.value)} />
        <button onClick={fetchHistory} className="btn-primary text-sm">Load Route</button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.totalPoints}</p>
            <p className="text-xs text-gray-500 mt-0.5">GPS Pings</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.distanceKm} km</p>
            <p className="text-xs text-gray-500 mt-0.5">Distance Traveled</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{format(parseISO(date), 'dd MMM')}</p>
            <p className="text-xs text-gray-500 mt-0.5">Date</p>
          </div>
        </div>
      )}

      {/* Map + timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="card overflow-hidden lg:col-span-2" style={{ height: 420 }}>
          {loading ? (
            <LoadingSpinner text="Loading route…" />
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <span className="text-4xl mb-2">📍</span>
              <p className="text-sm font-medium">No location data for this date</p>
              <p className="text-xs mt-1">Employee may not have been tracked</p>
            </div>
          ) : GOOGLE_MAPS_KEY ? (
            <div ref={mapRef} className="w-full h-full" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Route Preview (Map key required)</p>
              <div className="space-y-1 w-full max-h-64 overflow-y-auto">
                {locations.slice(0, 20).map((loc, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-1.5 shadow-sm">
                    <span className="text-gray-400">{i + 1}</span>
                    <span className={`w-2 h-2 rounded-full ${loc.isInsideGeofence ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-mono">{loc.lat?.toFixed(5)}, {loc.lng?.toFixed(5)}</span>
                    <span className="text-gray-400 ml-auto">
                      {format(new Date(loc.timestamp), 'HH:mm')}
                    </span>
                  </div>
                ))}
                {locations.length > 20 && (
                  <p className="text-center text-xs text-gray-400 pt-1">+{locations.length - 20} more points</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Location timeline */}
        <div className="card p-4 overflow-y-auto" style={{ height: 420 }}>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Location Timeline</h3>
          {loading ? <LoadingSpinner size="sm" /> : locations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-8">No data</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-100" />
              <div className="space-y-3 ml-8">
                {locations.filter((_, i) => i % Math.max(1, Math.floor(locations.length / 20)) === 0).map((loc, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-8 w-3 h-3 rounded-full border-2 border-white ${
                      loc.isInsideGeofence ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs font-mono text-gray-600">
                        {format(new Date(loc.timestamp), 'HH:mm:ss')}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {loc.lat?.toFixed(5)}, {loc.lng?.toFixed(5)}
                      </p>
                      {!loc.isInsideGeofence && (
                        <span className="text-xs text-red-600 font-medium">⚠ Outside zone</span>
                      )}
                      {loc.speed != null && (
                        <p className="text-xs text-gray-400">{(loc.speed * 3.6).toFixed(1)} km/h</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
