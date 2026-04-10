/**
 * EmployeesPage — FINAL (ZONE BASED + CLEAN)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

/* =========================
   MODAL
========================= */
function EmployeeModal({ employee, geofences, onClose, onSave }) {
  const isEdit = !!employee;

  const [form, setForm] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    password: '',
    department: employee?.department || '',
    phone: employee?.phone || '',
    assignedGeofence: employee?.assignedGeofence?._id || '',
    isActive: employee?.isActive ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = { ...form };

      if (!isEdit && !payload.password) {
        setError('Password required');
        setSaving(false);
        return;
      }

      if (!payload.password) delete payload.password;
      if (!payload.assignedGeofence) payload.assignedGeofence = null;

      if (isEdit) {
        await api.put(`/users/${employee._id}`, payload);
      } else {
        await api.post('/users', payload);
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
      <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold">
          {isEdit ? 'Edit Employee' : 'Add Employee'}
        </h3>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <input
          className="input"
          placeholder="Name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />

        <input
          className="input"
          placeholder="Email"
          value={form.email}
          disabled={isEdit}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        />

        {!isEdit && (
          <input
            className="input"
            placeholder="Password"
            type="password"
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          />
        )}

        <input
          className="input"
          placeholder="Department"
          value={form.department}
          onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
        />

        <select
          className="input"
          value={form.assignedGeofence}
          onChange={e => setForm(f => ({ ...f, assignedGeofence: e.target.value }))}
        >
          <option value="">No Zone</option>
          {geofences.map(g => (
            <option key={g._id} value={g._id}>{g.name}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <button className="btn-primary" onClick={handleSubmit}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   MAIN PAGE
========================= */
export default function EmployeesPage() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, geoRes] = await Promise.all([
        api.get(`/users?search=${encodeURIComponent(search)}&limit=50`),
        api.get('/geofences/all'),
      ]);

      setEmployees(empRes.data.users || []);
      setGeofences(geoRes.data.geofences || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  /* =========================
     GROUP BY ZONE
  ========================= */
  const groupedZones = geofences.map(zone => ({
    ...zone,
    employees: employees.filter(
      emp => emp.assignedGeofence?._id === zone._id
    )
  }));

  const noZone = employees.filter(emp => !emp.assignedGeofence);

  return (
    <div className="p-6 space-y-4">

      {/* HEADER */}
      <div className="flex justify-between">
        <h1 className="text-xl font-bold">Employees</h1>
        <button onClick={() => setModal('add')} className="btn-primary">
          + Add
        </button>
      </div>

      {/* SEARCH */}
      <input
        className="input"
        placeholder="Search..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* TABLE */}
      <div className="card">
        {loading ? <LoadingSpinner /> : (
          <table className="w-full text-sm">

            <tbody>

              {/* ZONES */}
              {groupedZones.map(zone => (
                <React.Fragment key={zone._id}>

                  <tr className="bg-blue-100">
                    <td colSpan="6" className="p-2 font-semibold">
                      📍 {zone.name} ({zone.employees.length})
                    </td>
                  </tr>

                  {zone.employees.map(emp => (
                    <tr key={emp._id}>
                      <td>{emp.name}</td>
                      <td>{emp.employeeId}</td>
                      <td>{emp.department || '-'}</td>
                      <td>{emp.isTracking ? '🟢 Live' : 'Offline'}</td>
                      <td>
                        <button onClick={() => setModal(emp)}>Edit</button>
                      </td>
                    </tr>
                  ))}

                </React.Fragment>
              ))}

              {/* NO ZONE */}
              <tr className="bg-gray-200">
                <td colSpan="6" className="p-2 font-semibold">
                  No Zone ({noZone.length})
                </td>
              </tr>

              {noZone.map(emp => (
                <tr key={emp._id}>
                  <td>{emp.name}</td>
                  <td>{emp.employeeId}</td>
                  <td>{emp.department || '-'}</td>
                  <td>{emp.isTracking ? '🟢 Live' : 'Offline'}</td>
                  <td>
                    <button onClick={() => setModal(emp)}>Edit</button>
                  </td>
                </tr>
              ))}

            </tbody>
          </table>
        )}
      </div>

      {/* MODAL */}
      {modal && (
        <EmployeeModal
          employee={modal === 'add' ? null : modal}
          geofences={geofences}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}