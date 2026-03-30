/**
 * GeofencePage — Create and manage geo-fencing zones
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

function GeofenceModal({ geofence, onClose, onSave }) {
  const isEdit = !!geofence;
  const [form, setForm] = useState({
    name:        geofence?.name        || '',
    description: geofence?.description || '',
    center: {
      lat: geofence?.center?.lat || 28.6139,
      lng: geofence?.center?.lng || 77.2090,
    },
    radius:  geofence?.radius  || 200,
    address: geofence?.address || '',
    color:   geofence?.color   || '#3b82f6',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (isEdit) await api.put(`/geofences/${geofence._id}`, form);
      else        await api.post('/geofences', form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Edit Geofence' : 'Create Geofence'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Zone Name *</label>
            <input className="input text-sm" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. HQ Office" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
            <input className="input text-sm" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Address</label>
            <input className="input text-sm" value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Latitude *</label>
              <input type="number" step="any" className="input text-sm" required value={form.center.lat}
                onChange={e => setForm(f => ({ ...f, center: { ...f.center, lat: parseFloat(e.target.value) }}))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Longitude *</label>
              <input type="number" step="any" className="input text-sm" required value={form.center.lng}
                onChange={e => setForm(f => ({ ...f, center: { ...f.center, lng: parseFloat(e.target.value) }}))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Radius: <span className="font-bold text-gray-900">{form.radius}m</span>
            </label>
            <input type="range" min="50" max="2000" step="50" value={form.radius}
              onChange={e => setForm(f => ({ ...f, radius: parseInt(e.target.value) }))}
              className="w-full accent-blue-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>50m</span><span>2km</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Zone Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-9 h-9 rounded cursor-pointer border border-gray-200" />
              <span className="text-sm text-gray-600">{form.color}</span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : (isEdit ? 'Update Zone' : 'Create Zone')}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function GeofencePage() {
  const [geofences, setGeofences] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);

  const fetchGeofences = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/geofences');
      setGeofences(data.geofences);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGeofences(); }, [fetchGeofences]);

  const deleteGeo = async (id, name) => {
    if (!window.confirm(`Deactivate zone "${name}"?`)) return;
    await api.delete(`/geofences/${id}`);
    fetchGeofences();
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Geofences</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define employee work zones</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary text-sm">+ New Zone</button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {geofences.map(geo => (
            <div key={geo._id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: geo.color }} />
                  <h3 className="font-semibold text-gray-900">{geo.name}</h3>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModal(geo)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => deleteGeo(geo._id, geo.name)} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              </div>

              {geo.description && <p className="text-xs text-gray-500 mb-3">{geo.description}</p>}

              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-400">Radius</span>
                  <span className="font-medium">{geo.radius}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Center</span>
                  <span className="font-mono">{geo.center.lat.toFixed(4)}, {geo.center.lng.toFixed(4)}</span>
                </div>
                {geo.address && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Address</span>
                    <span className="text-right max-w-[140px] truncate">{geo.address}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Employees</span>
                  <span className="font-medium">{geo.employeeCount || 0}</span>
                </div>
              </div>

              {/* Visual radius indicator */}
              <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{
                  background: geo.color,
                  width: `${Math.min((geo.radius / 2000) * 100, 100)}%`
                }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>50m</span><span>2km</span>
              </div>
            </div>
          ))}

          {/* Add card */}
          <button
            onClick={() => setModal('add')}
            className="card p-5 border-dashed border-2 border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors min-h-[160px]"
          >
            <span className="text-2xl">+</span>
            <span className="text-sm font-medium">Add Zone</span>
          </button>
        </div>
      )}

      {modal && (
        <GeofenceModal
          geofence={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchGeofences(); }}
        />
      )}
    </div>
  );
}

export default GeofencePage;
