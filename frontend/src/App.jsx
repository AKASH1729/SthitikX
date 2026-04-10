/**
 * App.jsx — FINAL PAGARGEO TABS VERSION
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// CONTEXT
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// PAGES
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import LiveMapPage from './pages/LiveMapPage';
import LiveMapLayout from './pages/LiveMapLayout';   // 🔥 IMPORTANT
import TimelinePage from './pages/TimelinePage';
import TrackingDashboard from './pages/TrackingDashboard';
import AttendancePage from './pages/AttendancePage';
import EmployeesPage from './pages/EmployeesPage';
import GeofencePage from './pages/GeofencePage';
import AlertsPage from './pages/AlertsPage';
import EmployeeHistoryPage from './pages/EmployeeHistoryPage';
import UploadExcelPage from './pages/UploadExcelPage';
import ViewUploadsPage from './pages/ViewUploadsPage';

// COMPONENTS
import Layout from './components/Shared/Layout';
import LoadingSpinner from './components/Shared/LoadingSpinner';
import "./index.css";


/* =========================================
   PROTECTED ROUTE
========================================= */
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner fullScreen />;

  if (!user) return <Navigate to="/login" replace />;

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};


/* =========================================
   ROUTES
========================================= */
const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>

      {/* LOGIN */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" /> : <LoginPage />}
      />

      {/* MAIN PROTECTED */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <SocketProvider>
              <Layout />
            </SocketProvider>
          </ProtectedRoute>
        }
      >

        {/* DEFAULT */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* DASHBOARD */}
        <Route path="dashboard" element={<AdminDashboard />} />

        {/* 🔥 LIVE MAP WITH TABS */}
        <Route
          path="live-map"
          element={
            <ProtectedRoute adminOnly>
              <LiveMapLayout />
            </ProtectedRoute>
          }
        >
          {/* DEFAULT TAB */}
          <Route index element={<Navigate to="live" replace />} />

          {/* TABS */}
          <Route path="live" element={<LiveMapPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="dashboard" element={<TrackingDashboard />} />

          {/* OPTIONAL */}
          <Route path="tasks" element={<div className="p-4">Tasks Coming Soon</div>} />
          <Route path="settings" element={<div className="p-4">Settings Coming Soon</div>} />
        </Route>

        {/* ATTENDANCE */}
        <Route path="attendance" element={<AttendancePage />} />

        {/* EMPLOYEES */}
        <Route
          path="employees"
          element={
            <ProtectedRoute adminOnly>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />

        {/* EMPLOYEE HISTORY */}
        <Route
          path="employees/:id/history"
          element={
            <ProtectedRoute adminOnly>
              <EmployeeHistoryPage />
            </ProtectedRoute>
          }
        />

        {/* GEOFENCES */}
        <Route
          path="geofences"
          element={
            <ProtectedRoute adminOnly>
              <GeofencePage />
            </ProtectedRoute>
          }
        />

        {/* ALERTS */}
        <Route
          path="alerts"
          element={
            <ProtectedRoute adminOnly>
              <AlertsPage />
            </ProtectedRoute>
          }
        />

        {/* UPLOAD */}
        <Route
          path="upload-excel"
          element={
            <ProtectedRoute adminOnly>
              <UploadExcelPage />
            </ProtectedRoute>
          }
        />

        {/* VIEW UPLOADS */}
        <Route path="uploads" element={<ViewUploadsPage />} />

      </Route>

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />

    </Routes>
  );
};


/* =========================================
   ROOT
========================================= */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}