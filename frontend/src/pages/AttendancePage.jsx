/**
 * AttendancePage — View and filter attendance records
 * Admins see all employees, employees see only their own records
 */

import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

const STATUS_BADGE = {
  present:  'badge-success',
  late:     'badge-warning',
  'half-day': 'badge-warning',
  absent:   'badge-danger',
  'on-leave': 'badge-info',
};

const formatHours = (h) => {
  if (!h) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
};

export default function AttendancePage() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [employees,  setEmployees]  = useState([]);
  const [pagination, setPagination] = useState({});

  const [filters, setFilters] = useState({
    startDate:  format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd'),
    endDate:    format(new Date(), 'yyyy-MM-dd'),
    employeeId: '',
    page:       1,
  });

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate:  filters.startDate,
        endDate:    filters.endDate,
        page:       filters.page,
        limit:      20,
        ...(filters.employeeId && { employeeId: filters.employeeId }),
      });
      const { data } = await api.get(`/attendance?${params}`);
      setRecords(data.records);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    if (isAdmin) {
      api.get('/users?limit=100').then(res => setEmployees(res.data.users)).catch(() => {});
    }
  }, [isAdmin]);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }));

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? 'All employee attendance records' : 'Your attendance records'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const csv = [
                ['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status'].join(','),
                ...records.map(r => [
                  r.employee?.name,
                  r.date,
                  r.clockIn?.timestamp ? format(parseISO(r.clockIn.timestamp), 'HH:mm') : '',
                  r.clockOut?.timestamp ? format(parseISO(r.clockOut.timestamp), 'HH:mm') : '',
                  r.totalHours,
                  r.status,
                ].join(','))
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `attendance-${filters.startDate}-${filters.endDate}.csv`;
              a.click();
            }}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <span>⬇</span> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" className="input w-36 text-sm" value={filters.startDate}
              onChange={e => setFilter('startDate', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" className="input w-36 text-sm" value={filters.endDate}
              onChange={e => setFilter('endDate', e.target.value)} />
          </div>

          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Employee</label>
              <select className="input w-44 text-sm" value={filters.employeeId}
                onChange={e => setFilter('employeeId', e.target.value)}>
                <option value="">All employees</option>
                {employees.map(e => (
                  <option key={e._id} value={e._id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}

          <button onClick={fetchRecords} className="btn-primary text-sm">Apply</button>
          <button onClick={() => setFilters({
            startDate: format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd'),
            endDate:   format(new Date(), 'yyyy-MM-dd'),
            employeeId: '', page: 1,
          })} className="btn-secondary text-sm">Reset</button>
        </div>
      </div>

      {/* Summary row */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Records',  value: pagination.total || 0,                           color: 'text-gray-900' },
            { label: 'Present',        value: records.filter(r => r.status === 'present').length, color: 'text-green-600' },
            { label: 'Late',           value: records.filter(r => r.status === 'late').length,    color: 'text-yellow-600' },
            { label: 'Avg Hours',
              value: records.length ? (records.reduce((a, r) => a + r.totalHours, 0) / records.length).toFixed(1) + 'h' : '—',
              color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="card p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner text="Loading records…" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {isAdmin && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Employee</th>}
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Clock In</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Clock Out</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Hours</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Location ✓</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-gray-400 text-sm">
                      No records found for the selected filters.
                    </td>
                  </tr>
                ) : records.map(record => (
                  <tr key={record._id} className="hover:bg-gray-50 transition-colors">
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                            {record.employee?.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{record.employee?.name}</p>
                            <p className="text-xs text-gray-400">{record.employee?.employeeId}</p>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-700">
                      {format(parseISO(record.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {record.clockIn?.timestamp
                        ? format(new Date(record.clockIn.timestamp), 'hh:mm a')
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {record.clockOut?.timestamp
                        ? format(new Date(record.clockOut.timestamp), 'hh:mm a')
                        : <span className="text-gray-400 text-xs">Working…</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatHours(record.totalHours)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE[record.status] || 'badge-info'}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span title={record.clockIn?.isWithinGeofence ? 'Clocked in within zone' : 'Outside zone'}>
                        {record.clockIn?.isWithinGeofence ? '✅' : '⚠️'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.pages} · {pagination.total} records
            </p>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setFilter('page', filters.page - 1)}
                className="btn-secondary text-xs py-1 px-2 disabled:opacity-40"
              >← Prev</button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setFilter('page', filters.page + 1)}
                className="btn-secondary text-xs py-1 px-2 disabled:opacity-40"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
