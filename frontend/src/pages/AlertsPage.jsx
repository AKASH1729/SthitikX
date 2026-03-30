/**
 * AlertsPage — View all system alerts with read/unread management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

const ALERT_ICONS = {
  geofence_exit:      { icon: '🚨', color: 'bg-red-50 border-red-100',     badge: 'badge-danger'  },
  geofence_entry:     { icon: '✅', color: 'bg-green-50 border-green-100',  badge: 'badge-success' },
  late_clockin:       { icon: '⏰', color: 'bg-yellow-50 border-yellow-100', badge: 'badge-warning' },
  no_clockin:         { icon: '❌', color: 'bg-red-50 border-red-100',     badge: 'badge-danger'  },
  unusual_movement:   { icon: '🔍', color: 'bg-blue-50 border-blue-100',    badge: 'badge-info'    },
};

export function AlertsPage() {
  const { on, off } = useSocket();
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('unread'); // 'all' | 'unread'

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'unread' ? '?isRead=false' : '';
      const { data } = await api.get(`/dashboard/alerts${params}&limit=50`);
      setAlerts(data.alerts);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Add new real-time alerts instantly
  useEffect(() => {
    const handler = (data) => {
      setAlerts(prev => [data.alert, ...prev]);
    };
    on('alert:geofence-exit', handler);
    return () => off('alert:geofence-exit', handler);
  }, [on, off]);

  const markRead = async (id) => {
    await api.put(`/dashboard/alerts/${id}/read`);
    setAlerts(prev => prev.map(a => a._id === id ? { ...a, isRead: true } : a));
  };

  const markAllRead = async () => {
    const unread = alerts.filter(a => !a.isRead);
    await Promise.all(unread.map(a => api.put(`/dashboard/alerts/${a._id}/read`)));
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  };

  const unreadCount = alerts.filter(a => !a.isRead).length;

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Alerts
            {unreadCount > 0 && (
              <span className="ml-2 text-sm font-normal bg-red-500 text-white rounded-full px-2 py-0.5">{unreadCount}</span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">System notifications and breach alerts</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-sm">Mark all read</button>
          )}
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {['unread', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                  filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >{f}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner text="Loading alerts…" /> : (
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="card p-12 text-center">
              <span className="text-4xl block mb-3">✅</span>
              <p className="font-medium text-gray-600">No {filter === 'unread' ? 'unread ' : ''}alerts</p>
              <p className="text-sm text-gray-400 mt-1">All clear!</p>
            </div>
          ) : alerts.map(alert => {
            const style = ALERT_ICONS[alert.type] || ALERT_ICONS.unusual_movement;
            return (
              <div key={alert._id}
                className={`card border p-4 flex items-start gap-4 ${style.color} ${!alert.isRead ? 'ring-1 ring-inset ring-current/10' : 'opacity-70'}`}
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">{style.icon}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {alert.employee && (
                      <span className="font-semibold text-gray-900 text-sm">{alert.employee.name}</span>
                    )}
                    <span className={style.badge}>{alert.type.replace(/_/g, ' ')}</span>
                    {alert.severity === 'high' && <span className="badge-danger">HIGH</span>}
                    {!alert.isRead && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{format(new Date(alert.timestamp), 'dd MMM yyyy · hh:mm a')}</span>
                    {alert.geofence && <span>Zone: {alert.geofence.name}</span>}
                  </div>
                </div>

                {!alert.isRead && (
                  <button onClick={() => markRead(alert._id)}
                    className="text-xs text-blue-600 hover:underline flex-shrink-0">
                    Mark read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AlertsPage;
