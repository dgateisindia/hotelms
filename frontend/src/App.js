import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import Dashboard from './pages/Dashboard/Dashboard';
import RegisterPage from "./pages/RegisterPage/RegisterPage";
import { Error400, Error401, Error403, Error404, Error500, Error503 } from './pages/Error/ErrorPages';

function App() {
  return (
    <Router>
      <Routes>
        {/* ── Auth ── */}
        <Route path="/login"          element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* ── Dashboard pages (sidebar layout) ── */}
        <Route path="/dashboard"      element={<Dashboard page="dashboard" />} />
        <Route path="/bookings"       element={<Dashboard page="bookings" />} />
        <Route path="/rooms"          element={<Dashboard page="rooms" />} />
        <Route path="/customers"      element={<Dashboard page="customers" />} />
        <Route path="/room-service"   element={<Dashboard page="room-service" />} />
        <Route path="/billing"        element={<Dashboard page="billing" />} />
        <Route path="/staff"          element={<Dashboard page="staff" />} />
        <Route path="/attendance"     element={<Dashboard page="attendance" />} />
        <Route path="/reports"        element={<Dashboard page="reports" />} />
        <Route path="/notifications"  element={<Dashboard page="notifications" />} />
        <Route path="/settings"       element={<Dashboard page="settings" />} />

        {/* ── Error pages ── */}
        <Route path="/400"            element={<Error400 />} />
        <Route path="/401"            element={<Error401 />} />
        <Route path="/403"            element={<Error403 />} />
        <Route path="/404"            element={<Error404 />} />
        <Route path="/500"            element={<Error500 />} />
        <Route path="/503"            element={<Error503 />} />

        {/* ── Default ── */}
        <Route path="/"               element={<Navigate to="/login" replace />} />
        <Route path="*"               element={<Error404 />} />
      </Routes>
    </Router>
  );
}

export default App;
