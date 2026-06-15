import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import Guests from './pages/Guests';
import Reports from './pages/Reports';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/guests" element={<Guests />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
