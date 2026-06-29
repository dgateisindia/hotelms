import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Auth Pages
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/RegisterPage/SuperAdminRegisterPage';

// Dashboard
import Dashboard from './pages/Dashboard/Dashboard';

// Protected Route
import ProtectedRoute from './components/ProtectedRoute';
// Role Protected Route
//import RoleProtectedRoute from './components/RoleProtectedRoute';
// Staff Management
import ManageStaff from './pages/ManageStaff';
// Super Admin Dashboard
import SuperAdminDashboard from './pages/SuperAdminDashboard';
// Super Admin Register Page
import SuperAdminRegisterPage from "./pages/RegisterPage/SuperAdminRegisterPage";

// Error Pages
import {
  Error400,
  Error401,
  Error403,
  Error404,
  Error500,
  Error503,
} from './pages/Error/ErrorPages';

import CreateHotelPage from "./pages/CreateHotelPage/CreateHotelPage";
import RegisterAdminPage from "./pages/RegisterAdminPage/RegisterAdminPage";
function App() {
  return (
    <Router>
      <Routes>

        {/* ================= AUTH ================= */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/setup/super-admin" element={<SuperAdminRegisterPage />} />


        {/* ================= PROTECTED ROUTES ================= */}
        <Route
  path="/super-admin"
  element={
    <ProtectedRoute allowedRoles={['super_admin']}>
      <SuperAdminDashboard />
    </ProtectedRoute>
  }
/>
<Route
  path="/create-hotel"
  element={
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <CreateHotelPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/register-admin"
  element={
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <RegisterAdminPage />
    </ProtectedRoute>
  }
/>

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard page="dashboard" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <Dashboard page="bookings" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rooms"
          element={
            <ProtectedRoute>
              <Dashboard page="rooms" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <Dashboard page="customers" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/room-service"
          element={
            <ProtectedRoute>
              <Dashboard page="room-service" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <Dashboard page="billing" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <Dashboard page="staff" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <Dashboard page="attendance" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Dashboard page="reports" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Dashboard page="notifications" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Dashboard page="settings" />
            </ProtectedRoute>
          }
        />

        {/* ================= ERROR PAGES ================= */}

        <Route path="/400" element={<Error400 />} />
        <Route path="/401" element={<Error401 />} />
        <Route path="/403" element={<Error403 />} />
        <Route path="/404" element={<Error404 />} />
        <Route path="/500" element={<Error500 />} />
        <Route path="/503" element={<Error503 />} />

        {/* ================= DEFAULT ROUTES ================= */}

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Error404 />} />

      </Routes>
    </Router>
  );
}

export default App;