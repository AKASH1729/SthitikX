/**
 * EmployeeHistoryPage — FINAL SaaS VERSION 🔥
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api from '../services/api';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

export default function EmployeeHistoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polylineRef = useRef(null);

  const [employee, setEmployee] = useState(null);
  const [locations, setLocations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  /* ================= ROLE PROTECTION ================= */
  if (user?.role === "employee") {
    return <p className="text-center mt-20">Access denied</p>;
  }

  /* ================= FETCH EMPLOYEE ================= */
  useEffect(() => {
    api.get(`/users/${id}`)
      .then(res => setEmployee(res.data.user))
      .catch(() => setError("Failed to load employee"));
  }, [id]);

  /* ================= FETCH HISTORY ================= */
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get(`/locations/history/${id}?date=${date}`);
      setLocations(data.locations || []);
      setStats(data.stats || null);
    } catch {
      setError("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [id, date]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  /* ================= MAP LOAD ================= */
  const loadGoogleMaps = () => {
    return new Promise((resolve) => {
      if (window.google) return resolve();

      if (document.getElementById("google-maps")) return resolve();

      const script = document.createElement('script');
      script.id = "google-maps";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}`;
      script.async = true;
      script.onload = resolve;
      document.body.appendChild(script);
    });
  };

  /* ================= DRAW ROUTE ================= */
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || locations.length === 0) return;

    const initMap = async () => {
      await loadGoogleMaps();

      if (!mapInstance.current) {
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
        });
      }

      if (polylineRef.current) polylineRef.current.setMap(null);

      const path = locations.map(l => ({ lat: l.lat, lng: l.lng }));

      polylineRef.current = new window.google.maps.Polyline({
        path,
        strokeColor: '#3b82f6',
        strokeWeight: 3,
        map: mapInstance.current,
      });

      // markers
      new window.google.maps.Marker({ position: path[0], map: mapInstance.current });
      new window.google.maps.Marker({ position: path[path.length - 1], map: mapInstance.current });

      const bounds = new window.google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      mapInstance.current.fitBounds(bounds);
    };

    initMap();

    return () => {
      if (polylineRef.current) polylineRef.current.setMap(null);
    };

  }, [locations]);

  /* ================= STATES ================= */
  if (loading) return <LoadingSpinner text="Loading route..." />;

  if (error) {
    return (
      <div className="text-center mt-20">
        <p className="text-red-500">{error}</p>
        <button onClick={fetchHistory} className="btn-primary mt-3">
          Retry
        </button>
      </div>
    );
  }

  /* ================= UI ================= */
  return (
    <div className="p-6 space-y-4">

      {/* HEADER */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/employees')}>
          ← Back
        </button>

        <div>
          <h1 className="text-xl font-bold">
            Movement History — {employee?.name}
          </h1>
          <p className="text-sm text-gray-500">
            {employee?.employeeId}
          </p>
        </div>
      </div>

      {/* DATE */}
      <div className="flex gap-3">
        <input
          type="date"
          value={date}
          max={format(new Date(), 'yyyy-MM-dd')}
          onChange={(e) => setDate(e.target.value)}
        />
        <button onClick={fetchHistory} className="btn-primary">
          Load
        </button>
      </div>

      {/* MAP */}
      <div style={{ height: 400 }}>
        {locations.length === 0 ? (
          <p>No data</p>
        ) : GOOGLE_MAPS_KEY ? (
          <div ref={mapRef} className="w-full h-full" />
        ) : (
          <p>Map key missing</p>
        )}
      </div>

      {/* TIMELINE */}
      <div>
        {locations.map((loc, i) => (
          <div key={i}>
            {format(new Date(loc.timestamp), "HH:mm")} → {loc.lat}, {loc.lng}
          </div>
        ))}
      </div>

    </div>
  );
}