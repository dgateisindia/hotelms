import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

import LoginPage from "./pages/Login/LoginPage";
import RegisterPage from "./pages/RegisterPage/RegisterPage";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import Dashboard from "./pages/Dashboard/Dashboard";
import PostLoginRedirect from "./components/PostLoginRedirect";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import RequireSuperAdmin from "./routes/RequireSuperAdmin";
import { setupApiClientAuth } from "./services/apiClient";
import QRCodePage from './pages/QRCodePage';
import Payroll from './pages/Payroll'
import Staff from './pages/Staff/Staff'
import Attendance from './pages/Attendance/Attendance'
import Reports from './pages/Reports/Reports'
import Notifications from './pages/Notifications'
import CustomerRequestPage from './pages/CustomerRequestPage'

import {
  Error400,
  Error401,
  Error403,
  Error404,
  Error500,
  Error503,
} from "./pages/Error/ErrorPages";

// Small helper so every protected Dashboard page follows the same
// SignedIn / SignedOut pattern instead of repeating it per route.
const ProtectedDashboard = ({ page }) => (
  <>
    <SignedIn>
      <Dashboard page={page} />
    </SignedIn>
    <SignedOut>
      <Navigate to="/login" replace />
    </SignedOut>
  </>
);

function App() {
  return (
    <Router>
      <Routes>

        {/* Login */}
        <Route
          path="/login"
          element={
            <>
              <SignedOut>
                <LoginPage />
              </SignedOut>

              <SignedIn>
                <PostLoginRedirect />
              </SignedIn>
            </>
          }
        />

        {/* Register — public self-registration */}
        <Route path="/register" element={<RegisterPage mode="selfRegister" />} />

        {/* Create Admin — super_admin only */}
        <Route
          path="/create-admin"
          element={
            <>
              <SignedIn>
                <RequireSuperAdmin>
                  <RegisterPage mode="createByAdmin" />
                </RequireSuperAdmin>
              </SignedIn>
              <SignedOut>
                <Navigate to="/login" replace />
              </SignedOut>
            </>
          }
        />

        {/* Forgot Password */}
        <Route
          path="/forgot-password"
          element={
            <>
              <SignedOut>
                <ForgotPassword />
              </SignedOut>

              <SignedIn>
                <PostLoginRedirect />
              </SignedIn>
            </>
          }
        />

        {/* Super Admin Dashboard */}
        <Route
          path="/superadmin-dashboard"
          element={
            <>
              <SignedIn>
                <RequireSuperAdmin>
                  <SuperAdminDashboard />
                </RequireSuperAdmin>
              </SignedIn>
              <SignedOut>
                <Navigate to="/login" replace />
              </SignedOut>
            </>
          }
        />

{/* QR Code Page */}
<Route
  path="/qrcode"
  element={
    <>
      <SignedIn>
        <QRCodePage />
      </SignedIn>
      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  }
/>
{/* Customer Request Page */}
<Route
  path="/customer-request"
  element={<CustomerRequestPage />}
/>

        {/* Regular Admin Dashboard */}
        <Route path="/admin-dashboard" element={<ProtectedDashboard page="dashboard" />} />

        {/* Dashboard (staff roles / fallback) */}
        <Route path="/dashboard" element={<ProtectedDashboard page="dashboard" />} />

        <Route path="/bookings" element={<ProtectedDashboard page="bookings" />} />

        <Route path="/rooms" element={<ProtectedDashboard page="rooms" />} />

        <Route path="/customers" element={<ProtectedDashboard page="customers" />} />

        <Route path="/billing" element={<ProtectedDashboard page="billing" />} />

        {/* Staff */}
        <Route path="/staff" element={<ProtectedDashboard page="staff" />} />

        <Route path="/attendance" element={<ProtectedDashboard page="attendance" />} />

        <Route path="/payroll" element={<ProtectedDashboard page="payroll" />} />

        <Route path="/reports" element={<ProtectedDashboard page="reports" />} />

        <Route path="/notifications" element={<ProtectedDashboard page="notifications" />} />

        <Route path="/settings" element={<ProtectedDashboard page="settings" />} />

        <Route path="/400" element={<Error400 />} />
        <Route path="/401" element={<Error401 />} />
        <Route path="/403" element={<Error403 />} />
        <Route path="/404" element={<Error404 />} />
        <Route path="/500" element={<Error500 />} />
        <Route path="/503" element={<Error503 />} />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Error404 />} />
      </Routes>
    </Router>
  );
}

export default App;