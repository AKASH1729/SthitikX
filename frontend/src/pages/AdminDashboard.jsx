/**
 * AdminDashboard — AI-Powered SaaS Dashboard 🚀
 * Enhanced with modern aesthetics, animations, and impressive charts.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import {
  FiAlertCircle, FiMapPin, FiUsers, FiCheckCircle,
  FiXCircle, FiTrendingUp, FiClock, FiUserCheck
} from 'react-icons/fi';

import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

import StatCard from '../components/Shared/StatCard';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

const chartVariants = {
  hidden: { opacity: 0, scale: 0.98 },
  show: { opacity: 1, scale: 1, transition: { delay: 0.2, duration: 0.5 } }
};

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-2 border border-gray-200">
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-blue-600 text-sm">{`Attendance: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const { on, off } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [parent] = useAutoAnimate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Role protection
  if (user?.role === "employee") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center mt-20 text-red-500 font-semibold"
      >
        Access Denied – Admin only.
      </motion.div>
    );
  }

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get('/dashboard/stats');
      setStats(prev => ({
        ...data.stats,
        totalEmployees: data.stats.totalEmployees,
        todayPresent: data.stats.todayPresent,
        todayAbsent: data.stats.todayAbsent,
        activeNow: data.stats.activeNow,
        attendanceRate: data.stats.totalEmployees
          ? Math.round((data.stats.todayPresent / data.stats.totalEmployees) * 100)
          : 0
      }));
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    const refresh = () => fetchStats();

    on('employee:clocked-in', refresh);
    on('employee:clocked-out', refresh);
    on('alert:geofence-exit', refresh);

    const interval = setInterval(fetchStats, 30000);

    return () => {
      off('employee:clocked-in', refresh);
      off('employee:clocked-out', refresh);
      off('alert:geofence-exit', refresh);
      clearInterval(interval);
    };
  }, [fetchStats, on, off]);

  const markRead = async (id) => {
    await api.put(`/dashboard/alerts/${id}/read`);
    setStats((s) => ({
      ...s,
      recentAlerts: s.recentAlerts.filter(a => a._id !== id),
      unreadAlerts: s.unreadAlerts - 1
    }));
  };

  if (loading) return <LoadingSpinner fullScreen text="Loading dashboard…" />;
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center mt-20"
      >
        <p className="text-red-500">{error}</p>
        <motion.button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg shadow"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Retry
        </motion.button>
      </motion.div>
    );
  }
  if (!stats) return <LoadingSpinner fullScreen text="Preparing dashboard..." />;

  // Prepare chart data
  const chartData = stats.weeklyAttendance?.map(d => ({
    day: format(parseISO(d.date), 'EEE'),
    count: d.count,
  })) || [];

  // Pie data for attendance distribution
  const pieData = [
    { name: 'Present', value: stats.todayPresent, color: '#22c55e' },
    { name: 'Absent', value: stats.todayAbsent, color: '#ef4444' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 space-y-6"
    >
      {/* Header with glassmorphism */}
      <motion.div
        className="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-md shadow-lg p-6 border border-white/20"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 100 }}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              <FiClock className="text-blue-500" />
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {user?.role === 'super_admin' ? '👑 Super Admin' : `Company: ${user?.companyId}`}
            </p>
          </div>
          <motion.button
            onClick={() => navigate('/app/live-map')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <FiMapPin className="text-lg" /> Live Tracking Map
          </motion.button>
        </div>
      </motion.div>

      {/* KPI Cards - Enhanced with gradients and animations */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <StatCard
            title="Total Employees"
            value={stats.totalEmployees}
            icon={<FiUsers className="text-blue-500" size={22} />}
            color="blue"
            animate={true}
            gradient="from-blue-50 to-blue-100"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Present Today"
            value={stats.todayPresent}
            icon={<FiCheckCircle className="text-green-500" size={22} />}
            color="green"
            animate={true}
            gradient="from-green-50 to-green-100"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Absent Today"
            value={stats.todayAbsent}
            icon={<FiXCircle className="text-red-500" size={22} />}
            color="red"
            animate={true}
            gradient="from-red-50 to-red-100"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Live Tracking"
            value={stats.activeNow}
            icon={<FiMapPin className="text-purple-500" size={22} />}
            color="purple"
            animate={true}
            gradient="from-purple-50 to-purple-100"
            suffix="now"
          />
        </motion.div>
      </motion.div>

      {/* Charts Row: Area Chart + Attendance Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Attendance Trend (Area Chart) */}
        <motion.div
          className="lg:col-span-2 bg-white rounded-2xl shadow-md p-5 border border-gray-100"
          variants={chartVariants}
          initial="hidden"
          animate="show"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FiTrendingUp className="text-blue-500" /> Weekly Attendance Trend
            </h3>
            <span className="text-xs text-gray-400">Last 7 days</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorCount)"
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Attendance Rate - Circular Progress */}
        <motion.div
          className="bg-white rounded-2xl shadow-md p-5 border border-gray-100 flex flex-col items-center justify-center"
          variants={chartVariants}
          initial="hidden"
          animate="show"
        >
          <h3 className="font-semibold text-gray-700 mb-2">Today's Attendance Rate</h3>
          <div className="relative w-36 h-36">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - stats.attendanceRate / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                className="transition-all duration-1000"
              />
              <text
                x="50"
                y="55"
                textAnchor="middle"
                fontSize="20"
                fontWeight="bold"
                fill="#1f2937"
              >
                {stats.attendanceRate}%
              </text>
            </svg>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            {stats.todayPresent} out of {stats.totalEmployees} employees
          </p>
        </motion.div>
      </div>

      {/* Second row: Pie chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Distribution Pie */}
        <motion.div
          className="bg-white rounded-2xl shadow-md p-5 border border-gray-100"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <FiUserCheck className="text-blue-500" /> Attendance Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                animationDuration={800}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" height={36} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Alerts Section - Enhanced */}
        <motion.div
          className="lg:col-span-2 bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex justify-between items-center p-5 border-b bg-gray-50/50">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FiAlertCircle className="text-amber-500" /> Recent Alerts
              {stats.unreadAlerts > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {stats.unreadAlerts} new
                </span>
              )}
            </h3>
            <motion.button
              onClick={() => navigate('/app/alerts')}
              className="text-blue-500 text-sm font-medium hover:underline"
              whileHover={{ scale: 1.02 }}
            >
              View all →
            </motion.button>
          </div>

          <div ref={parent} className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {stats.recentAlerts.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                <FiCheckCircle className="text-green-400 text-3xl" />
                <p>All clear – no alerts</p>
              </div>
            ) : (
              <AnimatePresence>
                {stats.recentAlerts.slice(0, 5).map(alert => (
                  <motion.div
                    key={alert._id}
                    className="p-4 flex justify-between items-start hover:bg-gray-50 transition"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex-1">
                      <p className="text-gray-800 text-sm">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <motion.button
                      onClick={() => markRead(alert._id)}
                      className="text-blue-500 text-xs font-medium ml-4"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Dismiss
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}