/**
 * EmployeesPage — Admin CRUD panel for employees
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

function EmployeeModal({ employee, geofences, onClose, onSave }) {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    name:            employee?.name            || '',
    email:           employee?.email           || '',
    password:        '',
    department:      employee?.department      || '',
    phone:           employee?.phone           || '',
    assignedGeofence: employee?.assignedGeofence?._id || '',
    isActive:        employee?.isActive ?? true,
  });
  const [saving, setSaving]  = useState(false);
  const [error,  setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (!payload.password && !isEdit) { setError('Password required'); setSaving(false); return; }
      if (!payload.password) delete payload.password;
      if (!payload.assignedGeofence) payload.assignedGeofence = null;

      if (isEdit) await api.put(`/users/${employee._id}`, payload);
      else        await api.post('/users', payload);

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
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Edit Employee' : 'Add Employee'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Full Name *</label>
              <input className="input text-sm" value={form.name} required
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Email *</label>
              <input type="email" className="input text-sm" value={form.email} required disabled={isEdit}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            {!isEdit && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Password *</label>
                <input type="password" className="input text-sm" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            )}
            <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Department
          </label>
          <input
                type="text"
                className="input text-sm"
                placeholder="Enter department"
                value={form.department || ''}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              />
        </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Phone</label>
              <input className="input text-sm" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Assigned Zone</label>
              <select className="input text-sm" value={form.assignedGeofence}
                onChange={e => setForm(f => ({ ...f, assignedGeofence: e.target.value }))}>
                <option value="">No zone</option>
                {geofences.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <label htmlFor="active" className="text-sm text-gray-700">Account active</label>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : (isEdit ? 'Update' : 'Create Employee')}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [employees,  setEmployees]  = useState([]);
  const [geofences,  setGeofences]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [modal,      setModal]      = useState(null); // null | 'add' | employee object

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, geoRes] = await Promise.all([
        api.get(`/users?search=${search}&limit=50`),
        api.get('/geofences'),
      ]);
      setEmployees(empRes.data.users);
      setGeofences(geoRes.data.geofences);
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

  const deactivate = async (id, name) => {
    if (!window.confirm(`Deactivate ${name}?`)) return;
    await api.delete(`/users/${id}`);
    fetchData();
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">{employees.length} team members</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary text-sm flex items-center gap-1.5">
          + Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <input
          type="text" className="input text-sm" placeholder="Search by name, email, or ID…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner text="Loading employees…" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Zone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tracking</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map(emp => (
                  <tr key={emp._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 text-xs">{emp.employeeId}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.department || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {emp.assignedGeofence?.name || <span className="text-gray-400">No zone</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={emp.isActive ? 'badge-success' : 'badge-danger'}>
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={emp.isTracking ? 'badge-success' : 'text-xs text-gray-400'}>
                        {emp.isTracking ? '● Live' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/employees/${emp._id}/history`)}
                          className="text-xs text-blue-600 hover:underline"
                        >History</button>
                        <button
                          onClick={() => setModal(emp)}
                          className="text-xs text-gray-600 hover:underline"
                        >Edit</button>
                        {emp.isActive && (
                          <button
                            onClick={() => deactivate(emp._id, emp.name)}
                            className="text-xs text-red-500 hover:underline"
                          >Deactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <EmployeeModal
          employee={modal === 'add' ? null : modal}
          geofences={geofences}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchData(); }}
        />
      )}
    </div>
  );
}
