/**
 * App.jsx — FINAL FIXED VERSION 🚀
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// CONTEXT
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";

// PAGES
import LandingPage from "./pages/LandingPage";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";

import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";

import LiveMapPage from "./pages/LiveMapPage";
import LiveMapLayout from "./pages/LiveMapLayout";
import TimelinePage from "./pages/TimelinePage";
import TrackingDashboard from "./pages/TrackingDashboard";

import AttendancePage from "./pages/AttendancePage";
import EmployeesPage from "./pages/EmployeesPage";
import GeofencePage from "./pages/GeofencePage";
import AlertsPage from "./pages/AlertsPage";
import EmployeeHistoryPage from "./pages/EmployeeHistoryPage";

import UploadExcelPage from "./pages/UploadExcelPage";
import ViewUploadsPage from "./pages/ViewUploadsPage";
import SalarySlip from "./pages/SalarySlip";
import BillingPage from "./pages/BillingPage";

// COMPONENTS
import Layout from "./components/Shared/Layout";
import LoadingSpinner from "./components/Shared/LoadingSpinner";
import VerifyEmail from "./pages/VarifyEmail";
import "./index.css";

/* =========================================
   🔐 PROTECTED ROUTE
========================================= */
const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner fullScreen />;

  if (!user) return <Navigate to="/login" replace />;

  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />; // ✅ FIX
  }

  return children;
};

/* =========================================
   ROUTES
========================================= */
const AppRoutes = () => {
  return (
    <Routes>

      {/* 🔥 LANDING PAGE (NO REDIRECT HERE) */}
      <Route path="/" element={<LandingPage />} />

      {/* SIGNUP */}
      <Route path="/signup" element={<SignupPage />} />

      {/* LOGIN */}
      <Route path="/login" element={<LoginPage />} />
    <Route path="/verify-email/:token" element={<VerifyEmail />} />
      {/* 🔥 PROTECTED APP */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <SocketProvider>
              <Layout />
            </SocketProvider>
          </ProtectedRoute>
        }
      >

        {/* DEFAULT */}
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* SUPER ADMIN */}
        <Route
          path="super-admin"
          element={
            <ProtectedRoute roles={["super_admin"]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* ADMIN DASHBOARD */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute roles={["admin", "super_admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* LIVE MAP */}
        <Route
          path="live-map"
          element={
            <ProtectedRoute roles={["admin"]}>
              <LiveMapLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="live" replace />} />
          <Route path="live" element={<LiveMapPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="dashboard" element={<TrackingDashboard />} />
        </Route>

        {/* OTHER ROUTES */}
        <Route path="attendance" element={<AttendancePage />} />

        <Route
          path="employees"
          element={
            <ProtectedRoute roles={["admin"]}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />

        <Route path="salary-slips" element={<SalarySlip />} />

        <Route
          path="employees/:id/history"
          element={<EmployeeHistoryPage />}
        />

        <Route path="geofences" element={<GeofencePage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="upload-excel" element={<UploadExcelPage />} />
        <Route path="uploads" element={<ViewUploadsPage />} />
	<Route
  path="billing"
  element={
    <ProtectedRoute roles={["admin"]}>
      <BillingPage />
    </ProtectedRoute>
  }
/>
      </Route>

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />

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
