/**
 * GeoTrack Mobile PWA — Main Employee App
 * Single-screen app: login → clock-in → live tracking → clock-out
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from './services/api';
import { SocketProvider, useSocket } from './context/SocketContext';
import { useGPS } from './hooks/useGPS';
import './index.css';
import Dashboard from "./pages/Dashboard";

// ── Clock component ───────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center">
      <p className="text-4xl font-bold text-white tracking-tight font-mono">
        {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-blue-300 text-sm mt-1">
        {time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
    </div>
  );
}

// ── GPS Accuracy bar ──────────────────────────────────────────────────────────
function AccuracyBar({ accuracy }) {
  const level = accuracy == null ? 0 : accuracy < 10 ? 3 : accuracy < 30 ? 2 : accuracy < 80 ? 1 : 0;
  const labels = ['Poor', 'Fair', 'Good', 'Excellent'];
  const colors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-400', 'bg-green-400'];

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`w-1 rounded-sm transition-all ${i <= level ? colors[level] : 'bg-gray-600'}`}
            style={{ height: 6 + i * 3 }} />
        ))}
      </div>
      <span className="text-xs text-gray-400">
        {accuracy != null ? `GPS ${labels[level]} (±${accuracy}m)` : 'Acquiring GPS…'}
      </span>
    </div>
  );
}

// ── Main tracking screen ──────────────────────────────────────────────────────
function TrackingScreen({ user, token, onLogout }) {
  const { connected } = useSocket();

  const [attendance,   setAttendance]   = useState(null);
  const [isTracking,   setIsTracking]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [statusMsg,    setStatusMsg]    = useState('');
  const [geofenceOk,   setGeofenceOk]   = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);

  const { position, error: gpsError, accuracy, isWatching } = useGPS({
    attendanceId: attendance?._id,
    isTracking,
  });

  // Load today's attendance on mount
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/attendance/today');
        if (data.attendance) {
          setAttendance(data.attendance);
          // If clocked in but not out — resume tracking
          if (data.attendance.clockIn?.timestamp && !data.attendance.clockOut?.timestamp) {
            setIsTracking(true);
          }
        }
      } catch { /* no record today */ }
      finally { setTodayLoading(false); }
    };
    load();
  }, []);

  const clockIn = useCallback(async () => {
    if (!position) { setStatusMsg('⏳ Waiting for GPS fix…'); return; }
    setLoading(true); setStatusMsg('');
    try {
      const { data } = await api.post('/attendance/clock-in', {
        lat: position.lat, lng: position.lng, address: 'Current Location',
      });
      setAttendance(data.attendance);
      setGeofenceOk(data.isWithinGeofence);
      setIsTracking(true);
      setStatusMsg(data.isWithinGeofence ? '✅ Clocked in successfully!' : '⚠️ Clocked in — outside work zone');
    } catch (err) {
      setStatusMsg(err.response?.data?.message || '❌ Clock-in failed');
    } finally {
      setLoading(false);
    }
  }, [position]);

  const clockOut = useCallback(async () => {
    if (!position) { setStatusMsg('⏳ Waiting for GPS fix…'); return; }
    if (!window.confirm('Clock out now?')) return;
    setLoading(true); setStatusMsg('');
    try {
      const { data } = await api.post('/attendance/clock-out', {
        lat: position.lat, lng: position.lng, address: 'Current Location',
      });
      setAttendance(data.attendance);
      setIsTracking(false);
      setStatusMsg(`✅ Clocked out — ${data.attendance.totalHours}h worked`);
    } catch (err) {
      setStatusMsg(err.response?.data?.message || '❌ Clock-out failed');
    } finally {
      setLoading(false);
    }
  }, [position]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const isClockedIn  = !!attendance?.clockIn?.timestamp;
  const isClockedOut = !!attendance?.clockOut?.timestamp;
  const clockInTime  = attendance?.clockIn?.timestamp
    ? new Date(attendance.clockIn.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null;

  if (todayLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-safe pt-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{user.name}</p>
            <p className="text-blue-300 text-xs">{user.employeeId || user.department}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Socket connection */}
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}
            title={connected ? 'Connected' : 'Offline'} />
          <button onClick={onLogout} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
            Sign out
          </button>
        </div>
      </div>

      {/* Main scroll area */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-5">
        {/* Clock */}
        <div className="bg-gray-800 rounded-2xl p-6 text-center">
          <Clock />
        </div>

        {/* GPS Status */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">GPS Status</span>
            {isWatching && <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Active
            </span>}
          </div>
          <AccuracyBar accuracy={accuracy} />
          {position && (
            <p className="text-xs font-mono text-gray-500 mt-2">
              {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </p>
          )}
          {gpsError && <p className="text-xs text-red-400 mt-1">{gpsError}</p>}
        </div>

        {/* Attendance Status */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-3">Today's Attendance</span>

          <div className="flex justify-around text-center">
            <div>
              <p className="text-xs text-gray-500">Clock In</p>
              <p className={`text-lg font-bold mt-1 ${isClockedIn ? 'text-green-400' : 'text-gray-600'}`}>
                {clockInTime || '—'}
              </p>
            </div>
            <div className="w-px bg-gray-700" />
            <div>
              <p className="text-xs text-gray-500">Clock Out</p>
              <p className={`text-lg font-bold mt-1 ${isClockedOut ? 'text-blue-400' : 'text-gray-600'}`}>
                {attendance?.clockOut?.timestamp
                  ? new Date(attendance.clockOut.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </p>
            </div>
            <div className="w-px bg-gray-700" />
            <div>
              <p className="text-xs text-gray-500">Hours</p>
              <p className={`text-lg font-bold mt-1 ${attendance?.totalHours ? 'text-purple-400' : 'text-gray-600'}`}>
                {attendance?.totalHours ? `${attendance.totalHours}h` : '—'}
              </p>
            </div>
          </div>

          {geofenceOk !== null && (
            <div className={`mt-3 text-xs text-center py-1.5 rounded-lg ${
              geofenceOk ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
            }`}>
              {geofenceOk ? '✅ Within assigned work zone' : '⚠️ Outside assigned work zone'}
            </div>
          )}
        </div>

        {/* Tracking indicator */}
        {isTracking && !isClockedOut && (
          <div className="bg-blue-900/40 border border-blue-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-50" />
            </div>
            <div>
              <p className="text-blue-300 text-sm font-medium">Live Tracking Active</p>
              <p className="text-blue-400/60 text-xs">Location updating every 15s</p>
            </div>
          </div>
        )}

        {/* Status message */}
        {statusMsg && (
          <div className={`rounded-xl p-3 text-sm text-center font-medium ${
            statusMsg.startsWith('✅') ? 'bg-green-900/50 text-green-300' :
            statusMsg.startsWith('⚠️') ? 'bg-yellow-900/50 text-yellow-300' :
            'bg-red-900/50 text-red-300'
          }`}>
            {statusMsg}
          </div>
        )}

        {/* Primary action button */}
        {!isClockedIn ? (
          <button
            onClick={clockIn}
            disabled={loading || !position}
            className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-95
              bg-gradient-to-r from-green-500 to-emerald-600
              disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400
              shadow-lg shadow-green-500/25"
          >
            {loading ? 'Clocking In…' : !position ? 'Acquiring GPS…' : '🟢 Clock In'}
          </button>
        ) : !isClockedOut ? (
          <button
            onClick={clockOut}
            disabled={loading || !position}
            className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-95
              bg-gradient-to-r from-red-500 to-rose-600
              disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400
              shadow-lg shadow-red-500/25"
          >
            {loading ? 'Clocking Out…' : '🔴 Clock Out'}
          </button>
        ) : (
          <div className="w-full py-4 rounded-2xl bg-gray-800 text-center">
            <p className="text-gray-300 font-semibold">✅ Work completed for today</p>
            <p className="text-gray-500 text-sm mt-0.5">Total: {attendance?.totalHours}h</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      if (data.user.role !== 'employee') {
        setError('Please use the admin dashboard for admin accounts.');
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-safe">
      <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-6 shadow-lg shadow-blue-500/30">
        G
      </div>
      <h1 className="text-2xl font-bold text-white mb-1">MAHADEV ASSOCIATE</h1>
      <p className="text-gray-400 text-sm mb-8">Employee Attendance App</p>

      <form onSubmit={handleSubmit} className="w-full space-y-3">
        {error && (
          <div className="bg-red-900/50 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
        <div>
          <input
            type="email" required placeholder="Email address"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <input
            type="password" required placeholder="Password"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <button
        onClick={() => setForm({ email: 'rahul@geotrack.com', password: 'Emp@123' })}
        className="mt-6 text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        Use demo credentials
      </button>
    </div>
  );
}

// ── Root app ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Restore session on mount
  useEffect(() => {
    const t = localStorage.getItem('token');
    if (t) {
      api.get('/auth/me').then(({ data }) => {
        if (data.user.role === 'employee') { setUser(data.user); setToken(t); }
        else { localStorage.clear(); }
      }).catch(() => { localStorage.clear(); setToken(null); });
    }
  }, []);

  const handleLogin = (userData, tok) => { setUser(userData); setToken(tok); };
  const handleLogout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.clear();
    setUser(null); setToken(null);
  };

  return (
    <div className="min-h-dvh bg-gray-900 flex flex-col max-w-md mx-auto relative">
      {user && token ? (
        <SocketProvider token={token}>
          <TrackingScreen user={user} token={token} onLogout={handleLogout} />
        </SocketProvider>
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </div>
  );
}
