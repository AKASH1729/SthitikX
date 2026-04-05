import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

/* ===============================
   MODAL
=============================== */
function GeofenceModal({ geofence, onClose, onSave }) {
  const isEdit = !!geofence;

  const [form, setForm] = useState({
    name: geofence?.name || '',
    description: geofence?.description || '',
    center: {
      lat: geofence?.center?.lat || 28.6139,
      lng: geofence?.center?.lng || 77.2090,
    },
    radius: geofence?.radius || 200,
    address: geofence?.address || '',
    color: geofence?.color || '#3b82f6',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (isEdit) {
        await api.put(`/geofence/update/${geofence._id}`, form);
      } else {
        await api.post('/geofence/create', form);
      }

      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">

        <h3 className="font-semibold text-gray-900">
          {isEdit ? 'Edit Geofence' : 'Create Geofence'}
        </h3>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <input
          placeholder="Zone Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input"
        />

        <input
          placeholder="Latitude"
          type="number"
          value={form.center.lat}
          onChange={(e) =>
            setForm({
              ...form,
              center: { ...form.center, lat: parseFloat(e.target.value) },
            })
          }
          className="input"
        />

        <input
          placeholder="Longitude"
          type="number"
          value={form.center.lng}
          onChange={(e) =>
            setForm({
              ...form,
              center: { ...form.center, lng: parseFloat(e.target.value) },
            })
          }
          className="input"
        />

        <input
          type="range"
          min="50"
          max="2000"
          value={form.radius}
          onChange={(e) =>
            setForm({ ...form, radius: parseInt(e.target.value) })
          }
        />

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={saving} onClick={handleSubmit}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}

/* ===============================
   PAGE
=============================== */
export default function GeofencePage() {
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const fetchGeofences = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/geofence/all');
      setGeofences(data.geofences || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGeofences();
  }, [fetchGeofences]);

  const deleteGeo = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;

    try {
      await api.delete(`/geofence/delete/${id}`);
      fetchGeofences();
    } catch (err) {
      alert("Delete failed");
    }
  };

  return (
    <div className="p-6">

      <div className="flex justify-between mb-4">
        <h1 className="text-xl font-bold">Geofences</h1>
        <button onClick={() => setModal('add')} className="btn-primary">
          + Add
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid gap-4">

          {geofences.map((geo) => (
            <div key={geo._id} className="card p-4">

              <h3 className="font-bold">{geo.name}</h3>

              <p className="text-sm text-gray-500">
                {geo.center?.lat?.toFixed(4)}, {geo.center?.lng?.toFixed(4)}
              </p>

              <p className="text-sm">Radius: {geo.radius}m</p>

              <div className="flex gap-2 mt-2">
                <button onClick={() => setModal(geo)} className="text-blue-500">Edit</button>
                <button onClick={() => deleteGeo(geo._id, geo.name)} className="text-red-500">Delete</button>
              </div>

            </div>
          ))}

        </div>
      )}

      {modal && (
        <GeofenceModal
          geofence={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            fetchGeofences();
          }}
        />
      )}
    </div>
  );
}