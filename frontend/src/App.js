import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import Dashboard from './pages/Dashboard/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/dashboard"     element={<Dashboard page="dashboard" />} />
        <Route path="/bookings"      element={<Dashboard page="bookings" />} />
        <Route path="/rooms"         element={<Dashboard page="rooms" />} />
        <Route path="/customers"     element={<Dashboard page="customers" />} />
        <Route path="/room-service"  element={<Dashboard page="room-service" />} />
        <Route path="/billing"       element={<Dashboard page="billing" />} />
        <Route path="/staff"         element={<Dashboard page="staff" />} />
        <Route path="/attendance"    element={<Dashboard page="attendance" />} />
        <Route path="/reports"       element={<Dashboard page="reports" />} />
        <Route path="/notifications" element={<Dashboard page="notifications" />} />
        <Route path="/settings"      element={<Dashboard page="settings" />} />
        <Route path="/"              element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;