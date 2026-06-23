import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Auth Pages
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';

// Dashboard
import Dashboard from './pages/Dashboard/Dashboard';

// Protected Route
import ProtectedRoute from './components/ProtectedRoute';

// Error Pages
import {
  Error400,
  Error401,
  Error403,
  Error404,
  Error500,
  Error503,
} from './pages/Error/ErrorPages';

function App() {
  return (
    <Router>
      <Routes>

        {/* ================= AUTH ================= */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* ================= PROTECTED ROUTES ================= */}

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
            <ProtectedRoute>
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