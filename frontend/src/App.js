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

/*
 * Legacy shared Admin shell.
 *
 * Kept temporarily for operational pages that have not yet
 * been migrated into the new Admin Workspace.
 */


import { AdminDashboard } from "./features/dashboard";
import { Billing } from "./features/billing";
import { Staff } from "./features/staff";
import { Attendance } from "./features/attendance";
import { Payroll } from "./features/payroll";
import { Reports } from "./features/reports";
import { CustomerRequests } from "./features/customer-requests";

import QRCodePage from "./pages/QRCodePage";

import CustomerRequestPage from "./pages/CustomerRequestPage";

/* ============================================================
   ADMIN LAYOUTS
============================================================ */

import AdminWorkspaceLayout from "./layouts/AdminWorkspaceLayout/AdminWorkspaceLayout";

import { Rooms } from "./features/rooms";

import { Customers } from "./features/customers";

import Bookings from "./pages/Bookings/Bookings";

import { BookingDesk } from "./features/booking-desk";

import ReservationGroupDetails from "./pages/ReservationGroupDetails/ReservationGroupDetails";
import { ReservationWorkspace } from "./features/reservations";

import { Settings } from "./features/settings";

/* ============================================================
   SUPER ADMIN PAGES
============================================================ */

import SuperAdminDashboard from "./pages/SuperAdminDashboard";

import HotelOverview from "./pages/HotelOverview/HotelOverview";

import HotelTeam from "./pages/HotelTeam/HotelTeam";


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

import { setupApiClientAuth } from "./shared/api/apiClient";


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
   LEGACY ADMIN PROTECTED ROUTE

   Temporary compatibility wrapper for Admin pages that still
   use the old Dashboard.js shared shell.

   These pages will be migrated one-by-one.
============================================================ */



/* ============================================================
   NEW HOTEL ADMIN WORKSPACE PROTECTION

   Frontend requires Clerk sign-in.

   Final authorization is performed by:
   GET /api/admin/context

   Backend verifies:
   - Clerk session
   - HMS account
   - Admin role
   - assigned hotel
   - Admin status
   - hotel status
============================================================ */

function ProtectedAdminWorkspace({
  children,
}) {
  return (
    <>
      <SignedIn>
        {children}
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
          ================================================== */}

          <Route
            path="/superadmin/hotels/:hotelDisplayId"
            element={
              <ProtectedSuperAdmin>

                <SelectedHotelLayout />

              </ProtectedSuperAdmin>
            }
          >

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


            <Route
              path="team"
              element={
                <HotelTeam />
              }
            />

          </Route>


          {/* ==================================================
              NEW HOTEL ADMIN WORKSPACE

              This is the first route migrated away from the
              old shared Dashboard.js shell.
          ================================================== */}

          <Route
            element={
              <ProtectedAdminWorkspace>
                <AdminWorkspaceLayout />
              </ProtectedAdminWorkspace>
            }
          >

            <Route
              path="/admin-dashboard"
              element={
                <AdminDashboard />
              }
            />

            <Route
              path="/booking-desk"
              element={
                <BookingDesk />
              }
            />

            <Route
              path="/bookings"
              element={
                <Bookings />
              }
            />

            <Route
              path="/bookings/groups/:groupId"
              element={
                <ReservationGroupDetails />
              }
            />

              <Route
                path="/reservations/:groupId"
                element={
                  <ReservationWorkspace />
                }
              />

            <Route
              path="/rooms"
              element={
                <Rooms />
              }
            />

            <Route
              path="/customers"
              element={
                <Customers />
              }
            />

            
            <Route
              path="/billing"
              element={<Billing />}
            />

            <Route
              path="/staff"
              element={<Staff />}
            />

            <Route
              path="/attendance"
              element={<Attendance />}
            />

            <Route
              path="/payroll"
              element={<Payroll />}
            />

            <Route
              path="/reports"
              element={<Reports />}
            />
            <Route
              path="/notifications"
              element={<CustomerRequests />}
            />
<Route
              path="/settings"
              element={
                <Settings />
              }
            />

          </Route>


          {/* ==================================================
              OLD /dashboard COMPATIBILITY

              Never maintain two separate Admin dashboard URLs.
          ================================================== */}

          <Route
            path="/dashboard"
            element={
              <Navigate
                to="/admin-dashboard"
                replace
              />
            }
          />


          {/* ==================================================
              LEGACY ADMIN OPERATIONAL PAGES

              These remain working while each page is migrated
              into AdminWorkspaceLayout one-by-one.
          ================================================== */}


          {/* ==================================================
              PROFILE & SECURITY TEMPORARY COMPATIBILITY

              Existing Settings page remains available until
              dedicated Admin Profile & Security page is built.
          ================================================== */}

          <Route
            path="/profile-security"
            element={
              <Navigate
                to="/settings"
                replace
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
          ================================================== */}

          <Route
            path="/customer-request/:publicToken"
            element={
              <CustomerRequestPage />
            }
          />


          {/* ==================================================
              ERROR ROUTES
          ================================================== */}

          <Route
            path="/400"
            element={
              <Error400 />
            }
          />


          <Route
            path="/401"
            element={
              <Error401 />
            }
          />


          <Route
            path="/403"
            element={
              <Error403 />
            }
          />


          <Route
            path="/404"
            element={
              <Error404 />
            }
          />


          <Route
            path="/500"
            element={
              <Error500 />
            }
          />


          <Route
            path="/503"
            element={
              <Error503 />
            }
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