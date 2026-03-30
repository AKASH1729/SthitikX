/**
 * Layout — Sidebar + Top bar shell for all authenticated pages
 */

import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import logo from "../../assets/logo.jpeg";

// 🔥 NAV ITEMS WITH ROLE CONTROL
const NAV_ITEMS = [
  { to: '/dashboard',  icon: '⊞',  label: 'Dashboard' },

  { to: '/live-map',   icon: '🗺',  label: 'Live Map',     adminOnly: true },
  { to: '/employees',  icon: '👥',  label: 'Employees',    adminOnly: true },
  { to: '/geofences',  icon: '📍',  label: 'Geo-Fences',   adminOnly: true },
  { to: '/alerts',     icon: '🚨',  label: 'Alerts',       adminOnly: true },

  { to: '/attendance', icon: '📋',  label: 'Attendance' },

  // ✅ ADMIN ONLY
  { to: '/upload-excel', icon: '📤', label: 'Upload Excel', adminOnly: true },

  // ✅ EMPLOYEE ONLY
  { to: '/uploads', icon: '📄', label: 'My Uploads', employeeOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // 🔥 ROLE-BASED FILTERING
  const navItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    if (item.employeeOnly && user?.role !== 'employee') return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} transition-all duration-300 bg-gray-900 flex flex-col flex-shrink-0`}>
        
        {/* Logo */}
        {/* Logo */}
<div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
  <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
    <img
      src={logo}
      alt="Mahadev Associate"
      className="w-full h-full object-cover"
    />
  </div>

  {sidebarOpen && (
    <span className="font-semibold text-white text-sm">
      MAHADEV ASSOCIATES
    </span>
  )}
</div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>

            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">
                  {user?.name}
                </p>
                <p className="text-gray-500 text-xs capitalize">
                  {user?.role}
                </p>
              </div>
            )}
          </div>

          {sidebarOpen && (
            <button
              onClick={handleLogout}
              className="mt-3 w-full text-left text-xs text-gray-500 hover:text-red-400 transition-colors px-1"
            >
              Sign out →
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
          
          <button
            onClick={() => setSidebarOpen(s => !s)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
          >
            ☰
          </button>

          <div className="flex items-center gap-3">
            
            {/* Socket Status */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {isConnected ? 'Live' : 'Offline'}
            </div>

            {/* Date */}
            <span className="text-xs text-gray-400">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })}
            </span>

          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

      </div>
    </div>
  );
}