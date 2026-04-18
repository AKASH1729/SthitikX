/**
 * AlertsPage — ULTRA PREMIUM UX 🔥
 * Filtering, search, pagination, animations, severity badges, employee details
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/Shared/LoadingSpinner';
import { FiSearch, FiFilter, FiRefreshCw, FiCheck, FiX, FiAlertTriangle, FiBell, FiMapPin, FiClock } from 'react-icons/fi';

// Alert type configuration with icons, colors, and severity
const ALERT_TYPES = {
  geofence_exit: { icon: <FiMapPin className="text-red-500" />, label: 'Geofence Exit', severity: 'high', color: 'bg-red-50 border-red-200' },
  geofence_entry: { icon: <FiCheck className="text-green-500" />, label: 'Geofence Entry', severity: 'low', color: 'bg-green-50 border-green-200' },
  late_clockin: { icon: <FiClock className="text-yellow-500" />, label: 'Late Clock‑in', severity: 'medium', color: 'bg-yellow-50 border-yellow-200' },
  no_clockin: { icon: <FiAlertTriangle className="text-red-500" />, label: 'Missing Clock‑in', severity: 'high', color: 'bg-red-50 border-red-200' },
  unusual_movement: { icon: <FiAlertTriangle className="text-blue-500" />, label: 'Unusual Movement', severity: 'medium', color: 'bg-blue-50 border-blue-200' },
};

const severityColors = {
  high: 'text-red-700 bg-red-100',
  medium: 'text-yellow-700 bg-yellow-100',
  low: 'text-green-700 bg-green-100',
};

export default function AlertsPage() {
  const { on, off } = useSocket();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRead, setFilterRead] = useState('unread'); // 'unread', 'all'
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = user?.role !== 'employee';

  // Role protection
  if (user?.role === 'employee') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center p-6 bg-red-50 rounded-xl">
          <FiAlertTriangle className="mx-auto text-red-500 text-4xl mb-3" />
          <h2 className="text-xl font-semibold text-red-700">Access Denied</h2>
          <p className="text-gray-600 mt-1">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  /* ================= FETCH ALERTS (with pagination) ================= */
  const fetchAlerts = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterRead === 'unread') params.append('isRead', 'false');
      params.append('limit', '20');
      if (!reset) params.append('page', page);
      const { data } = await api.get(`/dashboard/alerts?${params.toString()}`);
      const newAlerts = data.alerts || [];
      if (reset) {
        setAlerts(newAlerts);
        setPage(1);
        setHasMore(newAlerts.length === 20);
      } else {
        setAlerts(prev => [...prev, ...newAlerts]);
        setHasMore(newAlerts.length === 20);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [filterRead, page]);

  // Re-fetch when filters change
  useEffect(() => {
    fetchAlerts(true);
  }, [filterRead, filterType, searchTerm]); // searchTerm triggers backend search? For simplicity we'll filter client-side

  /* ================= REAL-TIME SOCKET ================= */
  useEffect(() => {
    const handler = (data) => {
      if (!data?.alert) return;
      setAlerts(prev => [data.alert, ...prev].slice(0, 100));
    };
    on('alert:received', handler);
    return () => off('alert:received', handler);
  }, [on, off]);

  /* ================= MARK READ ================= */
  const markRead = async (id) => {
    try {
      await api.put(`/dashboard/alerts/${id}/read`);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, isRead: true } : a));
    } catch {
      alert('Failed to mark as read');
    }
  };

  const markAllRead = async () => {
    try {
      const unread = alerts.filter(a => !a.isRead);
      await Promise.all(unread.map(a => api.put(`/dashboard/alerts/${a._id}/read`)));
      setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
    } catch {
      alert('Failed to mark all as read');
    }
  };

  /* ================= CLIENT-SIDE FILTERING ================= */
  const filteredAlerts = useMemo(() => {
    let result = alerts;
    if (filterType !== 'all') {
      result = result.filter(a => a.type === filterType);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a =>
        a.message.toLowerCase().includes(term) ||
        (a.employee?.name && a.employee.name.toLowerCase().includes(term)) ||
        (a.geofence?.name && a.geofence.name.toLowerCase().includes(term))
      );
    }
    return result;
  }, [alerts, filterType, searchTerm]);

  const unreadCount = alerts.filter(a => !a.isRead).length;

  // Available alert types for filter dropdown
  const alertTypeOptions = Object.entries(ALERT_TYPES).map(([key, val]) => ({ value: key, label: val.label }));

  /* ================= LOAD MORE ================= */
  const loadMore = () => {
    if (hasMore && !loading) {
      setPage(prev => prev + 1);
      fetchAlerts(false);
    }
  };

  if (loading && alerts.length === 0) return <LoadingSpinner text="Loading alerts..." />;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <FiBell className="text-blue-500" /> Alerts
            {unreadCount > 0 && (
              <span className="ml-2 text-sm bg-red-500 text-white px-2.5 py-0.5 rounded-full font-medium">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-1">System notifications, geofence events, and attendance violations</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => fetchAlerts(true)}
            className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className={`${loading ? 'animate-spin' : ''}`} />
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by message, employee or zone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* Read/Unread Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            {['unread', 'all'].map(f => (
              <button
                key={f}
                onClick={() => setFilterRead(f)}
                className={`px-4 py-2 text-sm font-medium capitalize ${
                  filterRead === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {/* Type Filter */}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="all">All Types</option>
              {alertTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <AnimatePresence>
        {filteredAlerts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
          >
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-medium text-gray-700">No alerts found</h3>
            <p className="text-gray-500 mt-1">
              {searchTerm || filterType !== 'all' ? 'Try adjusting your filters' : 'All clear! No alerts to display.'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert, idx) => {
              const typeConfig = ALERT_TYPES[alert.type] || ALERT_TYPES.unusual_movement;
              const severityClass = severityColors[typeConfig.severity];
              return (
                <motion.div
                  key={alert._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`relative rounded-xl border p-4 transition-all hover:shadow-md ${typeConfig.color} ${
                    !alert.isRead ? 'border-l-4 border-l-blue-500' : 'opacity-80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-shrink-0 text-2xl">{typeConfig.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800">{typeConfig.label}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityClass}`}>
                          {typeConfig.severity.toUpperCase()}
                        </span>
                        {!alert.isRead && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">New</span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm">{alert.message}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <FiClock size={12} />
                          {format(new Date(alert.timestamp), 'dd MMM yyyy · hh:mm a')}
                        </span>
                        {alert.employee?.name && (
                          <span>👤 {alert.employee.name}</span>
                        )}
                        {alert.geofence?.name && (
                          <span>📍 {alert.geofence.name}</span>
                        )}
                      </div>
                    </div>
                    {!alert.isRead && (
                      <button
                        onClick={() => markRead(alert._id)}
                        className="self-start sm:self-center text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 bg-white/60 px-3 py-1 rounded-full"
                      >
                        <FiCheck size={14} /> Mark read
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-5 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}