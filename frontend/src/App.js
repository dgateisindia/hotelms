import React, { useEffect } from "react";

import {
  SignedIn,
  SignedOut,
  useAuth,
} from "@clerk/clerk-react";

import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import LoginPage from "./pages/Login/LoginPage";
import RegisterPage from "./pages/RegisterPage/RegisterPage";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";

import Dashboard from "./pages/Dashboard/Dashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import QRCodePage from "./pages/QRCodePage";
import CustomerRequestPage from "./pages/CustomerRequestPage";

import PostLoginRedirect from "./components/PostLoginRedirect";
import RequireSuperAdmin from "./routes/RequireSuperAdmin";

import {
  setupApiClientAuth,
} from "./services/apiClient";

import {
  Error400,
  Error401,
  Error403,
  Error404,
  Error500,
  Error503,
} from "./pages/Error/ErrorPages";

/**
 * Connects Clerk session tokens with the centralized Axios client.
 *
 * After this is mounted, authenticated API calls automatically
 * receive the Clerk Bearer token.
 */
function ApiClientAuthBridge() {
  const {
    isLoaded,
    getToken,
  } = useAuth();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    setupApiClientAuth(getToken);
  }, [
    isLoaded,
    getToken,
  ]);

  return null;
}

/**
 * Temporary protected layout for operational dashboard pages.
 *
 * Backend role middleware still performs the final authorization
 * and hotel data isolation.
 */
function ProtectedDashboard({ page }) {
  return (
    <>
      <SignedIn>
        <Dashboard page={page} />
      </SignedIn>

      <SignedOut>
        <Navigate
          to="/login"
          replace
        />
      </SignedOut>
    </>
  );
}

function App() {
  return (
    <>
      <ApiClientAuthBridge />

      <Router>
        <Routes>
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

          {/*
           * Registration must remain mounted after Clerk creates
           * the session because RegisterPage still has to create
           * and verify the MySQL Super Admin profile.
           */}
          <Route
            path="/register"
            element={
              <RegisterPage mode="selfRegister" />
            }
          />

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
                  <Navigate
                    to="/login"
                    replace
                  />
                </SignedOut>
              </>
            }
          />

          <Route
            path="/admin-dashboard"
            element={
              <ProtectedDashboard page="dashboard" />
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedDashboard page="dashboard" />
            }
          />

          <Route
            path="/bookings"
            element={
              <ProtectedDashboard page="bookings" />
            }
          />

          <Route
            path="/rooms"
            element={
              <ProtectedDashboard page="rooms" />
            }
          />

          <Route
            path="/customers"
            element={
              <ProtectedDashboard page="customers" />
            }
          />

          <Route
            path="/billing"
            element={
              <ProtectedDashboard page="billing" />
            }
          />

          <Route
            path="/staff"
            element={
              <ProtectedDashboard page="staff" />
            }
          />

          <Route
            path="/attendance"
            element={
              <ProtectedDashboard page="attendance" />
            }
          />

          <Route
            path="/payroll"
            element={
              <ProtectedDashboard page="payroll" />
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedDashboard page="reports" />
            }
          />

          <Route
            path="/notifications"
            element={
              <ProtectedDashboard page="notifications" />
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedDashboard page="settings" />
            }
          />

          <Route
            path="/qrcode"
            element={
              <>
                <SignedIn>
                  <QRCodePage />
                </SignedIn>

                <SignedOut>
                  <Navigate
                    to="/login"
                    replace
                  />
                </SignedOut>
              </>
            }
          />

          {/*
           * Public QR customer request page.
           * Authentication is intentionally not required here.
           */}
          <Route
            path="/customer-request"
            element={<CustomerRequestPage />}
          />

          <Route
            path="/400"
            element={<Error400 />}
          />

          <Route
            path="/401"
            element={<Error401 />}
          />

          <Route
            path="/403"
            element={<Error403 />}
          />

          <Route
            path="/404"
            element={<Error404 />}
          />

          <Route
            path="/500"
            element={<Error500 />}
          />

          <Route
            path="/503"
            element={<Error503 />}
          />

          <Route
            path="/"
            element={
              <Navigate
                to="/login"
                replace
              />
            }
          />

          <Route
            path="*"
            element={<Error404 />}
          />
        </Routes>
      </Router>
    </>
  );
}

export default App;