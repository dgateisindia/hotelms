import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import AdminLayout from "../AdminLayout/AdminLayout";

import AdminSidebar from "../../components/admins/AdminSidebar/AdminSidebar";

import AdminTopbar from "../../components/admins/AdminTopbar/AdminTopbar";

import adminContextService from "../../services/adminContextService";

import "./AdminWorkspaceLayout.css";


/* ============================================================
   PAGE CONFIGURATION
============================================================ */

const PAGE_CONFIG = {
  "/admin-dashboard": {
    title: "Dashboard",

    breadcrumbs: [
      {
        label: "Dashboard",
      },
    ],
  },


  "/dashboard": {
    title: "Dashboard",

    breadcrumbs: [
      {
        label: "Dashboard",
      },
    ],
  },


  "/booking-desk": {
    title: "Booking Desk",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Front Desk",
      },

      {
        label: "Booking Desk",
      },
    ],
  },


  "/bookings": {
    title: "Bookings",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Front Desk",
      },

      {
        label: "Bookings",
      },
    ],
  },


  "/rooms": {
    title: "Rooms",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Front Desk",
      },

      {
        label: "Rooms",
      },
    ],
  },


  "/customers": {
    title: "Customers",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Front Desk",
      },

      {
        label: "Customers",
      },
    ],
  },


  "/billing": {
    title: "Billing",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Finance",
      },

      {
        label: "Billing",
      },
    ],
  },


  "/reports": {
    title: "Reports",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Finance",
      },

      {
        label: "Reports",
      },
    ],
  },


  "/staff": {
    title: "Staff",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Team",
      },

      {
        label: "Staff",
      },
    ],
  },


  "/attendance": {
    title: "Attendance",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Team",
      },

      {
        label: "Attendance",
      },
    ],
  },


  "/payroll": {
    title: "Payroll",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Team",
      },

      {
        label: "Payroll",
      },
    ],
  },


  "/notifications": {
    title: "Customer Requests",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Requests",
      },

      {
        label: "Customer Requests",
      },
    ],
  },


  "/profile-security": {
    title: "Profile & Security",

    breadcrumbs: [
      {
        label: "Dashboard",
        to: "/admin-dashboard",
      },

      {
        label: "Account",
      },

      {
        label: "Profile & Security",
      },
    ],
  },
};


/* ============================================================
   HELPERS
============================================================ */

function normalizePathname(
  pathname
) {
  const normalized =
    String(pathname || "")
      .trim()
      .replace(/\/+$/, "");


  return normalized || "/";
}


function normalizeCount(
  value
) {
  const numberValue =
    Number(value);


  if (
    !Number.isFinite(
      numberValue
    ) ||
    numberValue < 0
  ) {
    return 0;
  }


  return Math.floor(
    numberValue
  );
}


function getErrorMessage(
  error
) {
  return (
    error?.message ||
    "The Hotel Admin workspace could not be loaded."
  );
}


/* ============================================================
   ERROR ICON
============================================================ */

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="M12 7v6" />

      <path d="M12 17h.01" />
    </svg>
  );
}


/* ============================================================
   ADMIN WORKSPACE LAYOUT
============================================================ */

function AdminWorkspaceLayout() {
  const location =
    useLocation();


  const [
    adminProfile,
    setAdminProfile,
  ] = useState(null);


  const [
    selectedHotel,
    setSelectedHotel,
  ] = useState(null);


  const [
    pendingRequests,
    setPendingRequests,
  ] = useState(0);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState(null);


  const [
    redirectStatus,
    setRedirectStatus,
  ] = useState(null);


  /* ==========================================================
     CURRENT PAGE
  ========================================================== */

  const currentPath =
    useMemo(
      () =>
        normalizePathname(
          location.pathname
        ),
      [
        location.pathname,
      ]
    );


  const currentPage =
    useMemo(
      () =>
        PAGE_CONFIG[
          currentPath
        ] || {
          title:
            "Hotel Admin",

          breadcrumbs: [
            {
              label:
                "Dashboard",

              to:
                "/admin-dashboard",
            },

            {
              label:
                "Hotel Admin",
            },
          ],
        },
      [
        currentPath,
      ]
    );


  /* ==========================================================
     LOAD SECURE ADMIN CONTEXT
  ========================================================== */

  const loadAdminContext =
    useCallback(
      async ({
        initialLoad = false,
      } = {}) => {
        if (
          initialLoad
        ) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }


        setError(null);

        setRedirectStatus(
          null
        );


        try {
          const result =
            await adminContextService
              .getContext();


          if (
            !result?.admin ||
            !result?.hotel
          ) {
            const contextError =
              new Error(
                "The Hotel Admin account is not linked to a valid hotel workspace."
              );


            contextError.code =
              "ADMIN_CONTEXT_INVALID";


            throw contextError;
          }


          setAdminProfile(
            result.admin
          );


          setSelectedHotel(
            result.hotel
          );


          setPendingRequests(
            normalizeCount(
              result
                .pendingRequests
            )
          );


          return result;
        } catch (
          loadError
        ) {
          console.error(
            "[ADMIN_WORKSPACE:LOAD]",
            loadError
          );


          const status =
            Number(
              loadError
                ?.status ??
              loadError
                ?.response
                ?.status
            );


          if (
            status === 401 ||
            status === 403 ||
            status === 404
          ) {
            setRedirectStatus(
              status
            );


            return null;
          }


          setError(
            loadError
          );


          return null;
        } finally {
          setLoading(false);

          setRefreshing(
            false
          );
        }
      },
      []
    );


  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    void loadAdminContext({
      initialLoad: true,
    });
  }, [
    loadAdminContext,
  ]);


  /* ==========================================================
     SECURITY REDIRECT
  ========================================================== */

  if (
    redirectStatus
  ) {
    return (
      <Navigate
        to={`/${redirectStatus}`}
        replace
      />
    );
  }


  /* ==========================================================
     LOADING
  ========================================================== */

  if (
    loading
  ) {
    return (
      <AdminLayout
        sidebar={
          <AdminSidebar />
        }
        topbar={
          <AdminTopbar
            title="Loading Workspace"
          />
        }
        breadcrumbs={[
          {
            label:
              "Dashboard",
          },
        ]}
      >
        <div className="admin-workspace">

          <div className="admin-workspace__state">

            <div className="admin-workspace__state-card">

              <div
                className="admin-workspace__spinner"
                aria-hidden="true"
              />


              <h2 className="admin-workspace__state-title">
                Loading Hotel Workspace
              </h2>


              <p className="admin-workspace__state-description">
                Your Admin account and assigned hotel are being loaded securely.
              </p>

            </div>

          </div>

        </div>
      </AdminLayout>
    );
  }


  /* ==========================================================
     API / NETWORK FAILURE
  ========================================================== */

  if (
    error &&
    (
      !adminProfile ||
      !selectedHotel
    )
  ) {
    return (
      <AdminLayout
        sidebar={
          <AdminSidebar />
        }
        topbar={
          <AdminTopbar
            title="Hotel Admin"
          />
        }
        breadcrumbs={[
          {
            label:
              "Dashboard",
          },
        ]}
      >
        <div className="admin-workspace">

          <div className="admin-workspace__state">

            <div className="admin-workspace__state-card">

              <div className="admin-workspace__state-icon">
                <ErrorIcon />
              </div>


              <h2 className="admin-workspace__state-title">
                Workspace Could Not Be Loaded
              </h2>


              <p className="admin-workspace__state-description">
                {getErrorMessage(
                  error
                )}
              </p>


              {error?.code && (
                <span className="admin-workspace__error-code">
                  {error.code}
                </span>
              )}


              <div className="admin-workspace__actions">

                <button
                  type="button"
                  className="admin-workspace__retry"
                  disabled={
                    refreshing
                  }
                  onClick={() => {
                    void loadAdminContext();
                  }}
                >
                  {refreshing
                    ? "Retrying..."
                    : "Retry"}
                </button>

              </div>

            </div>

          </div>

        </div>
      </AdminLayout>
    );
  }


  /* ==========================================================
     SAFETY FALLBACK
  ========================================================== */

  if (
    !adminProfile ||
    !selectedHotel
  ) {
    return (
      <Navigate
        to="/404"
        replace
      />
    );
  }


  /* ==========================================================
     SIDEBAR
  ========================================================== */

  const sidebar = (
    <AdminSidebar
      selectedHotel={
        selectedHotel
      }
      adminProfile={
        adminProfile
      }
      pendingRequests={
        pendingRequests
      }
    />
  );


  /* ==========================================================
     TOPBAR
  ========================================================== */

  const topbar = (
    <AdminTopbar
      title={
        currentPage.title
      }
      selectedHotel={
        selectedHotel
      }
      adminProfile={
        adminProfile
      }
      pendingRequests={
        pendingRequests
      }
      refreshing={
        refreshing
      }
      onRefresh={() =>
        loadAdminContext()
      }
    />
  );


  /* ==========================================================
     WORKSPACE

     Every nested Admin page receives the authenticated
     workspace context through React Router Outlet context.

     No page receives a client-selected hotel ID.
  ========================================================== */

  return (
    <AdminLayout
      sidebar={
        sidebar
      }
      topbar={
        topbar
      }
      breadcrumbs={
        currentPage
          .breadcrumbs
      }
    >
      <div className="admin-workspace">

        <div className="admin-workspace__page">

          <Outlet
            context={{
              adminProfile,

              selectedHotel,

              pendingRequests,

              refreshAdminContext:
                loadAdminContext,
            }}
          />

        </div>

      </div>
    </AdminLayout>
  );
}


export default AdminWorkspaceLayout;