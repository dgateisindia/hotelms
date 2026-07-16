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

import {
  Error400,
  Error401,
  Error403,
  Error404,
  Error500,
  Error503,
} from "./pages/Error/ErrorPages";

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

        {/* Regular Admin Dashboard */}
        <Route
          path="/admin-dashboard"
          element={
            <>
              <SignedIn>
                <Dashboard page="dashboard" />
              </SignedIn>
              <SignedOut>
                <Navigate to="/login" replace />
              </SignedOut>
            </>
          }
        />

        {/* Dashboard (staff roles / fallback) */}
        <Route
          path="/dashboard"
          element={
            <>
              <SignedIn>
                <Dashboard page="dashboard" />
              </SignedIn>

              <SignedOut>
                <Navigate to="/login" replace />
              </SignedOut>
            </>
          }
        />

        <Route
          path="/bookings"
          element={
            <SignedIn>
              <Dashboard page="bookings" />
            </SignedIn>
          }
        />

        <Route
          path="/rooms"
          element={
            <SignedIn>
              <Dashboard page="rooms" />
            </SignedIn>
          }
        />

        <Route
          path="/customers"
          element={
            <SignedIn>
              <Dashboard page="customers" />
            </SignedIn>
          }
        />

        <Route
          path="/billing"
          element={
            <SignedIn>
              <Dashboard page="billing" />
            </SignedIn>
          }
        />

        <Route
          path="/staff"
          element={
            <SignedIn>
              <Dashboard page="staff" />
            </SignedIn>
          }
        />

        <Route
          path="/attendance"
          element={
            <SignedIn>
              <Dashboard page="attendance" />
            </SignedIn>
          }
        />
        <Route
  path="/payroll"
  element={
    <>
      <SignedIn>
        <Dashboard page="payroll" />
      </SignedIn>
      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  }
/>

<Route
  path="/notifications"
  element={
    <>
      <SignedIn>
        <Dashboard page="notifications" />
      </SignedIn>
      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  }
/>

<Route
  path="/settings"
  element={
    <>
      <SignedIn>
        <Dashboard page="settings" />
      </SignedIn>
      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  }
/>

        <Route
          path="/reports"
          element={
            <SignedIn>
              <Dashboard page="reports" />
            </SignedIn>
          }
        />

        <Route
          path="/notifications"
          element={
            <SignedIn>
              <Dashboard page="notifications" />
            </SignedIn>
          }
        />

        <Route
          path="/settings"
          element={
            <SignedIn>
              <Dashboard page="settings" />
            </SignedIn>
          }
        />

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