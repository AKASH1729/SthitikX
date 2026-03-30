



/**
 * App.jsx — Root component with routing and providers
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import LiveMapPage from './pages/LiveMapPage';
import AttendancePage from './pages/AttendancePage';
import EmployeesPage from './pages/EmployeesPage';
import GeofencePage from './pages/GeofencePage';
import AlertsPage from './pages/AlertsPage';
import EmployeeHistoryPage from './pages/EmployeeHistoryPage';
import UploadExcelPage from "./pages/UploadExcelPage";
import ViewUploadsPage from "./pages/ViewUploadsPage"; // ✅ ADDED

// Components
import Layout from './components/Shared/Layout';
import LoadingSpinner from './components/Shared/LoadingSpinner';

// 🔐 Protected Route
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>

      {/* Login */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" /> : <LoginPage />}
      />

      {/* Protected Layout */}
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
        {/* Default */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard */}
        <Route path="dashboard" element={<AdminDashboard />} />

        {/* Admin only */}
        <Route
          path="live-map"
          element={
            <ProtectedRoute adminOnly>
              <LiveMapPage />
            </ProtectedRoute>
          }
        />

        <Route path="attendance" element={<AttendancePage />} />

        <Route
          path="employees"
          element={
            <ProtectedRoute adminOnly>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="employees/:id/history"
          element={
            <ProtectedRoute adminOnly>
              <EmployeeHistoryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="geofences"
          element={
            <ProtectedRoute adminOnly>
              <GeofencePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="alerts"
          element={
            <ProtectedRoute adminOnly>
              <AlertsPage />
            </ProtectedRoute>
          }
        />

        {/* 🔥 Upload Excel */}
        <Route path="upload-excel" element={<UploadExcelPage />} />

        {/* 🔥 View Uploaded Data (NEW) */}
        <Route path="uploads" element={<ViewUploadsPage />} />

      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />

    </Routes>
  );
};

// Root App
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}