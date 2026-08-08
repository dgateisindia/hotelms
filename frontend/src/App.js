import React, {
  useEffect,
} from "react";

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


/* ============================================================
   AUTH PAGES
============================================================ */

import LoginPage from "./pages/Login/LoginPage";

import RegisterPage from "./pages/RegisterPage/RegisterPage";

import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";


/* ============================================================
   ADMIN PAGES
============================================================ */

import Dashboard from "./pages/Dashboard/Dashboard";

import QRCodePage from "./pages/QRCodePage";

import CustomerRequestPage from "./pages/CustomerRequestPage";


/* ============================================================
   SUPER ADMIN PAGES
============================================================ */

import SuperAdminDashboard from "./pages/SuperAdminDashboard";

import HotelOverview from "./pages/HotelOverview/HotelOverview";


/* ============================================================
   SUPER ADMIN LAYOUTS
============================================================ */

import SelectedHotelLayout from "./layouts/SelectedHotelLayout/SelectedHotelLayout";


/* ============================================================
   AUTH / ROUTE HELPERS
============================================================ */

import PostLoginRedirect from "./components/PostLoginRedirect";

import RequireSuperAdmin from "./routes/RequireSuperAdmin";


/* ============================================================
   API
============================================================ */

import {
  setupApiClientAuth,
} from "./services/apiClient";


/* ============================================================
   ERROR PAGES
============================================================ */

import {
  Error400,
  Error401,
  Error403,
  Error404,
  Error500,
  Error503,
} from "./pages/Error/ErrorPages";


/* ============================================================
   API CLIENT AUTH BRIDGE

   Connect Clerk session token with centralized Axios client.
============================================================ */

function ApiClientAuthBridge() {
  const {
    isLoaded,
    getToken,
  } = useAuth();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    setupApiClientAuth(
      getToken
    );
  }, [
    isLoaded,
    getToken,
  ]);

  return null;
}


/* ============================================================
   ADMIN PROTECTED ROUTE

   Backend performs final role and hotel authorization.
============================================================ */

function ProtectedDashboard({
  page,
}) {
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


/* ============================================================
   SUPER ADMIN PROTECTED ROUTE

   Reused by every Super Admin page.
============================================================ */

function ProtectedSuperAdmin({
  children,
}) {
  return (
    <>
      <SignedIn>
        <RequireSuperAdmin>
          {children}
        </RequireSuperAdmin>
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


/* ============================================================
   APPLICATION
============================================================ */

function App() {
  return (
    <>
      <ApiClientAuthBridge />

      <Router>
        <Routes>

          {/* ==================================================
              AUTH
          ================================================== */}

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
           * Registration remains mounted after Clerk creates
           * the session because RegisterPage still needs to
           * create and verify the MySQL Super Admin profile.
           */}
          <Route
            path="/register"
            element={
              <RegisterPage
                mode="selfRegister"
              />
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


          {/* ==================================================
              SUPER ADMIN PORTFOLIO
          ================================================== */}

          <Route
            path="/superadmin-dashboard"
            element={
              <ProtectedSuperAdmin>
                <SuperAdminDashboard />
              </ProtectedSuperAdmin>
            }
          />


          {/*
           * Hotels list page has not been built yet.
           *
           * Until that page exists, the Hotels sidebar item
           * safely returns to Portfolio Overview instead of
           * sending the user to a 404 page.
           */}
          <Route
            path="/superadmin/hotels"
            element={
              <ProtectedSuperAdmin>
                <Navigate
                  to="/superadmin-dashboard"
                  replace
                />
              </ProtectedSuperAdmin>
            }
          />


          {/* ==================================================
              SELECTED HOTEL WORKSPACE

              SelectedHotelLayout:
              - reads HT-xxxx from URL
              - loads hotel from backend
              - backend verifies Super Admin ownership
              - provides selectedHotel through Outlet context
          ================================================== */}

          <Route
            path="/superadmin/hotels/:hotelDisplayId"
            element={
              <ProtectedSuperAdmin>
                <SelectedHotelLayout />
              </ProtectedSuperAdmin>
            }
          >

            {/*
             * /superadmin/hotels/HT-0001
             * automatically becomes:
             * /superadmin/hotels/HT-0001/overview
             */}
            <Route
              index
              element={
                <Navigate
                  to="overview"
                  replace
                />
              }
            />


            <Route
              path="overview"
              element={
                <HotelOverview />
              }
            />

          </Route>


          {/* ==================================================
              HOTEL ADMIN DASHBOARD
          ================================================== */}

          <Route
            path="/admin-dashboard"
            element={
              <ProtectedDashboard
                page="dashboard"
              />
            }
          />


          <Route
            path="/dashboard"
            element={
              <ProtectedDashboard
                page="dashboard"
              />
            }
          />


          <Route
            path="/bookings"
            element={
              <ProtectedDashboard
                page="bookings"
              />
            }
          />


          <Route
            path="/rooms"
            element={
              <ProtectedDashboard
                page="rooms"
              />
            }
          />


          <Route
            path="/customers"
            element={
              <ProtectedDashboard
                page="customers"
              />
            }
          />


          <Route
            path="/billing"
            element={
              <ProtectedDashboard
                page="billing"
              />
            }
          />


          <Route
            path="/staff"
            element={
              <ProtectedDashboard
                page="staff"
              />
            }
          />


          <Route
            path="/attendance"
            element={
              <ProtectedDashboard
                page="attendance"
              />
            }
          />


          <Route
            path="/payroll"
            element={
              <ProtectedDashboard
                page="payroll"
              />
            }
          />


          <Route
            path="/reports"
            element={
              <ProtectedDashboard
                page="reports"
              />
            }
          />


          <Route
            path="/notifications"
            element={
              <ProtectedDashboard
                page="notifications"
              />
            }
          />


          <Route
            path="/settings"
            element={
              <ProtectedDashboard
                page="settings"
              />
            }
          />


          {/* ==================================================
              HOTEL ADMIN QR PAGE
          ================================================== */}

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


          {/* ==================================================
              PUBLIC QR CUSTOMER REQUEST

              Authentication intentionally not required.
          ================================================== */}

          <Route
            path="/customer-request"
            element={
              <CustomerRequestPage />
            }
          />


          {/* ==================================================
              ERROR ROUTES
          ================================================== */}

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


          {/* ==================================================
              ROOT / FALLBACK
          ================================================== */}

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
            element={
              <Error404 />
            }
          />

        </Routes>
      </Router>
    </>
  );
}


export default App;