/**
 * GeofencePage — Premium UX/UI Edition 🚀 | Full Width
 */

import React, { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { FiMapPin, FiEdit2, FiTrash2, FiPlus, FiSearch, FiLoader, FiX } from "react-icons/fi";
import { FaMapMarkerAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

// ================= GEOFENCE MODAL =================
function GeofenceModal({ geofence, onClose, onSave }) {
  const isEdit = !!geofence;
  const [form, setForm] = useState({
    name: "",
    center: { lat: "", lng: "" },
    radius: 200,
  });
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (geofence) setForm(geofence);
  }, [geofence]);

  // Auto-location fetch with debounce
  useEffect(() => {
    if (!form.name || form.name.length < 3) return;
    const delay = setTimeout(async () => {
      try {
        setSearching(true);
        setError("");
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.name)}`
        );
        if (!res.ok) throw new Error("Location service unavailable");
        const data = await res.json();
        if (data?.length > 0) {
          setForm(prev => ({
            ...prev,
            center: {
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon),
            },
          }));
        } else {
          setError("Location not found. Try a more specific name.");
        }
      } catch (err) {
        setError("Failed to fetch location. Please enter coordinates manually.");
      } finally {
        setSearching(false);
      }
    }, 1000);
    return () => clearTimeout(delay);
  }, [form.name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return setError("Name is required");
    if (!form.center.lat || !form.center.lng) return setError("Valid coordinates are required");
    setLoading(true);
    setError("");
    try {
      const endpoint = isEdit ? `/geofences/update/${geofence._id}` : "/geofences/create";
      const method = isEdit ? "put" : "post";
      const res = await api[method](endpoint, form);
      onSave(res.data.geofence);
    } catch (err) {
      setError(err.response?.data?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[9999] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FaMapMarkerAlt />
            {isEdit ? "Edit Geofence" : "Create Geofence"}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <FiX size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <FiMapPin size={14} /> Location Name
            </label>
            <input
              placeholder="e.g. Kolkata Office, Delhi HQ"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {searching && (
            <div className="flex items-center gap-2 text-blue-600 text-sm bg-blue-50 p-2 rounded-lg">
              <FiLoader className="animate-spin" />
              <span>Searching for location...</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={form.center.lat}
                onChange={(e) => setForm({ ...form, center: { ...form.center, lat: e.target.value } })}
                className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={form.center.lng}
                onChange={(e) => setForm({ ...form, center: { ...form.center, lng: e.target.value } })}
                className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">Radius: {form.radius}m</label>
              <span className="text-xs text-gray-500">50m – 10km</span>
            </div>
            <input
              type="range"
              min="50"
              max="10000"
              step="10"
              value={form.radius}
              onChange={(e) => setForm({ ...form, radius: +e.target.value })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <FiLoader className="animate-spin" />
                  {isEdit ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{isEdit ? "Update Geofence" : "Create Geofence"}</>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-200 hover:bg-gray-300 p-3 rounded-xl font-medium transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ================= MAIN PAGE - FULL WIDTH =================
export default function GeofencePage() {
  const { user } = useAuth();
  const [geofences, setGeofences] = useState([]);
  const [geoModal, setGeoModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const isEmployee = user?.role === "employee";

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/geofences/all");
      setGeofences(res.data?.geofences || []);
    } catch (err) {
      console.error("Failed to load geofences:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const deleteGeo = async (id) => {
    if (!window.confirm("Delete this geofence? This action cannot be undone.")) return;
    try {
      await api.delete(`/geofences/delete/${id}`);
      setGeofences(prev => prev.filter(x => x._id !== id));
    } catch {
      alert("Delete failed. Please try again.");
    }
  };

  const saveGeo = (geo) => {
    setGeoModal(null);
    setGeofences(prev => {
      const exists = prev.find(g => g._id === geo._id);
      return exists ? prev.map(g => (g._id === geo._id ? geo : g)) : [geo, ...prev];
    });
  };

  const filteredGeofences = geofences.filter(geo =>
    geo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isEmployee) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-md text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Restricted</h2>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex items-center gap-3 text-blue-600">
          <FiLoader className="animate-spin text-3xl" />
          <span className="text-lg">Loading geofences...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-6 w-full">
      {/* Header - Full Width */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Geofence Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            {geofences.length} {geofences.length === 1 ? 'geofence' : 'geofences'} configured
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search geofences..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setGeoModal("add")}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm"
          >
            <FiPlus size={18} />
            <span className="whitespace-nowrap">New Geofence</span>
          </button>
        </div>
      </div>

      {/* Geofence Cards - Responsive Grid, Full Width */}
      {filteredGeofences.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {filteredGeofences.map((geo) => (
              <motion.div
                key={geo._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-3 rounded-full">
                        <FaMapMarkerAlt className="text-blue-600 text-xl" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">{geo.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Radius: {geo.radius}m</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setGeoModal(geo)}
                        className="text-gray-500 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteGeo(geo._id)}
                        className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-1">Coordinates</div>
                    <div className="font-mono text-sm bg-gray-50 p-2 rounded-lg break-all">
                      {geo.center.lat.toFixed(6)}, {geo.center.lng.toFixed(6)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center"
        >
          {searchTerm ? (
            <>
              <FiSearch className="mx-auto text-gray-400 text-5xl mb-4" />
              <h3 className="text-xl font-medium text-gray-700">No matching geofences</h3>
              <p className="text-gray-500 mt-1">
                No geofences found for "{searchTerm}". Try a different search term.
              </p>
            </>
          ) : (
            <>
              <FaMapMarkerAlt className="mx-auto text-gray-400 text-5xl mb-4" />
              <h3 className="text-xl font-medium text-gray-700">No geofences configured</h3>
              <p className="text-gray-500 mt-1">Get started by creating your first geofence.</p>
              <button
                onClick={() => setGeoModal("add")}
                className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl inline-flex items-center gap-2 transition-all shadow-sm"
              >
                <FiPlus size={18} />
                Create Geofence
              </button>
            </>
          )}
        </motion.div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {geoModal && (
          <GeofenceModal
            geofence={geoModal === "add" ? null : geoModal}
            onClose={() => setGeoModal(null)}
            onSave={saveGeo}
          />
        )}
      </AnimatePresence>
    </div>
  );
}