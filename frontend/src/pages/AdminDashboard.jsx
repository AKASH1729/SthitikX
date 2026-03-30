/**
 * AdminDashboard — Overview page with KPIs, charts, and alerts
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { format, parseISO } from 'date-fns';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import StatCard from '../components/Shared/StatCard';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

export default function AdminDashboard() {
  const { on, off } = useSocket();
  const navigate = useNavigate();
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Refresh stats on real-time events
    const refresh = () => fetchStats();
    on('employee:clocked-in',  refresh);
    on('employee:clocked-out', refresh);
    on('alert:geofence-exit',  refresh);

    return () => {
      off('employee:clocked-in',  refresh);
      off('employee:clocked-out', refresh);
      off('alert:geofence-exit',  refresh);
    };
  }, [fetchStats, on, off]);

  const markRead = async (id) => {
    await api.put(`/dashboard/alerts/${id}/read`);
    setStats(s => ({
      ...s,
      recentAlerts: s.recentAlerts.filter(a => a._id !== id),
    }));
  };

  if (loading) return <LoadingSpinner fullScreen text="Loading dashboard…" />;

  const chartData = stats?.weeklyAttendance?.map(d => ({
    day:   format(parseISO(d.date), 'EEE'),
    count: d.count,
  })) || [];

  const attendanceRate = stats?.totalEmployees
    ? Math.round((stats.todayPresent / stats.totalEmployees) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => navigate('/live-map')} className="btn-primary text-sm flex items-center gap-2">
          <span>🗺</span> Live Map
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Employees"
          value={stats?.totalEmployees ?? '—'}
          icon="👥" color="blue"
          subtitle="Active workforce"
        />
        <StatCard
          title="Present Today"
          value={stats?.todayPresent ?? '—'}
          icon="✅" color="green"
          subtitle={`${attendanceRate}% attendance rate`}
        />
        <StatCard
          title="Absent Today"
          value={stats?.todayAbsent ?? '—'}
          icon="❌" color="red"
          subtitle="Not clocked in"
        />
        <StatCard
          title="Tracking Now"
          value={stats?.activeNow ?? '—'}
          icon="📡" color="purple"
          subtitle="Live GPS active"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Attendance Bar Chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Weekly Attendance</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)', fontSize: 12 }}
              />
              <Bar dataKey="count" name="Present" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Today's Donut summary */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Today's Summary</h3>
          <div className="space-y-3">
            {[
              { label: 'Present',  value: stats?.todayPresent,  color: 'bg-green-500'  },
              { label: 'Absent',   value: stats?.todayAbsent,   color: 'bg-red-400'    },
              { label: 'Tracking', value: stats?.activeNow,     color: 'bg-blue-500'   },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${item.color} transition-all`}
                    style={{ width: `${stats?.totalEmployees ? (item.value / stats.totalEmployees) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-3 border-t border-gray-100 text-center">
              <span className="text-3xl font-bold text-gray-900">{attendanceRate}%</span>
              <p className="text-xs text-gray-500 mt-0.5">Attendance Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Recent Alerts
            {stats?.unreadAlerts > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{stats.unreadAlerts}</span>
            )}
          </h3>
          <button onClick={() => navigate('/alerts')} className="text-xs text-blue-600 hover:underline">View all</button>
        </div>

        {stats?.recentAlerts?.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            <span className="text-2xl block mb-2">✅</span>
            No unread alerts
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {stats?.recentAlerts?.slice(0, 5).map(alert => (
              <div key={alert._id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  alert.severity === 'high' ? 'bg-red-500' :
                  alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                }`} />

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                    {alert.employee?.name?.charAt(0)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{alert.message}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <button
                  onClick={() => markRead(alert._id)}
                  className="text-xs text-gray-400 hover:text-blue-600 flex-shrink-0"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
