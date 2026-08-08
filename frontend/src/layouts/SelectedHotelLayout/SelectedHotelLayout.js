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
  useParams,
} from "react-router-dom";

import SuperAdminLayout from "../SuperAdminLayout/SuperAdminLayout";

import SuperAdminSidebar from "../../components/navigation/SuperAdminSidebar/SuperAdminSidebar";

import SuperAdminTopbar from "../../components/navigation/SuperAdminTopbar/SuperAdminTopbar";

import hotelService from "../../services/hotelService";


/* ============================================================
   HOTEL WORKSPACE SECTIONS
============================================================ */

const SECTION_CONFIG = {
  overview: {
    title: "Hotel Overview",
    breadcrumb: "Overview",
  },

  operations: {
    title: "Hotel Operations",
    breadcrumb: "Operations",
  },

  finance: {
    title: "Hotel Finance",
    breadcrumb: "Finance",
  },

  team: {
    title: "Hotel Team",
    breadcrumb: "Team",
  },

  settings: {
    title: "QR & Settings",
    breadcrumb: "QR & Settings",
  },
};


/* ============================================================
   HELPERS
============================================================ */

function getCurrentSection(
  pathname
) {
  const segments =
    String(pathname || "")
      .split("/")
      .filter(Boolean);

  const lastSegment =
    segments[
      segments.length - 1
    ];

  if (
    SECTION_CONFIG[lastSegment]
  ) {
    return lastSegment;
  }

  return "overview";
}


function normalizeCount(
  value
) {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue < 0
  ) {
    return 0;
  }

  return numberValue;
}


function getErrorMessage(
  error
) {
  return (
    error?.response?.data
      ?.message ||
    error?.response?.data
      ?.error ||
    error?.message ||
    "Hotel information could not be loaded."
  );
}


/* ============================================================
   SELECTED HOTEL LAYOUT
============================================================ */

function SelectedHotelLayout() {
  const {
    hotelDisplayId,
  } = useParams();

  const location =
    useLocation();

  const [
    selectedHotel,
    setSelectedHotel,
  ] = useState(null);

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
  ] = useState("");

  const [
    redirectStatus,
    setRedirectStatus,
  ] = useState(null);


  /* ==========================================================
     LOAD SELECTED HOTEL

     Backend performs the real ownership verification.
  ========================================================== */

  const loadSelectedHotel =
    useCallback(
      async ({
        initialLoad = false,
      } = {}) => {
        if (initialLoad) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");
        setRedirectStatus(null);

        try {
          const result =
            await hotelService
              .getHotelByDisplayId(
                hotelDisplayId
              );

          if (
            result?.success !== true ||
            !result?.hotel
          ) {
            throw new Error(
              "Hotel information could not be loaded."
            );
          }

          setSelectedHotel(
            result.hotel
          );

          return result.hotel;
        } catch (loadError) {
          console.error(
            "[SELECTED_HOTEL_LAYOUT:LOAD]",
            loadError
          );

          const status =
            Number(
              loadError?.status ??
              loadError?.response?.status
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

          /*
           * hotelService validates HT-xxxx
           * before sending the API request.
           */
          if (
            String(
              loadError?.message || ""
            )
              .toLowerCase()
              .includes(
                "hotel id is invalid"
              )
          ) {
            setRedirectStatus(
              404
            );

            return null;
          }

          setError(
            getErrorMessage(
              loadError
            )
          );

          return null;
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [hotelDisplayId]
    );


  useEffect(() => {
    void loadSelectedHotel({
      initialLoad: true,
    });
  }, [loadSelectedHotel]);


  /* ==========================================================
     CURRENT SECTION
  ========================================================== */

  const sectionKey =
    useMemo(
      () =>
        getCurrentSection(
          location.pathname
        ),
      [location.pathname]
    );

  const currentSection =
    SECTION_CONFIG[
      sectionKey
    ];


  /* ==========================================================
     SECURITY / NOT FOUND REDIRECTS
  ========================================================== */

  if (redirectStatus) {
    return (
      <Navigate
        to={`/${redirectStatus}`}
        replace
      />
    );
  }


  /* ==========================================================
     LOADING STATE
  ========================================================== */

  if (loading) {
    return (
      <SuperAdminLayout
        sidebar={
          <SuperAdminSidebar />
        }
        topbar={
          <SuperAdminTopbar
            title="Loading Hotel"
            breadcrumbs={[
              {
                label:
                  "Portfolio",
                to:
                  "/superadmin-dashboard",
              },
              {
                label:
                  "Hotels",
              },
            ]}
          />
        }
      >
        <div className="super-admin-layout__loading">
          <div className="super-admin-layout__loading-card">
            <h2 className="super-admin-layout__loading-title">
              Loading Hotel
            </h2>

            <p className="super-admin-layout__loading-description">
              Hotel information is
              being loaded securely.
            </p>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }


  /* ==========================================================
     API FAILURE
  ========================================================== */

  if (
    error &&
    !selectedHotel
  ) {
    return (
      <SuperAdminLayout
        sidebar={
          <SuperAdminSidebar />
        }
        topbar={
          <SuperAdminTopbar
            title="Hotel"
            breadcrumbs={[
              {
                label:
                  "Portfolio",
                to:
                  "/superadmin-dashboard",
              },
              {
                label:
                  "Hotels",
              },
            ]}
          />
        }
      >
        <div className="super-admin-layout__loading">
          <div className="super-admin-layout__loading-card">
            <div
              className="alert alert-error"
              role="alert"
            >
              {error}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={
                refreshing
              }
              onClick={() => {
                void loadSelectedHotel();
              }}
            >
              {refreshing
                ? "Retrying..."
                : "Retry"}
            </button>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }


  /* ==========================================================
     SAFETY FALLBACK
  ========================================================== */

  if (!selectedHotel) {
    return (
      <Navigate
        to="/404"
        replace
      />
    );
  }


  /* ==========================================================
     HOTEL CONTEXT
  ========================================================== */

  const hotelBasePath =
    `/superadmin/hotels/${encodeURIComponent(
      selectedHotel.displayId
    )}`;

  const pendingRequests =
    normalizeCount(
      selectedHotel
        ?.pendingRequests
    );


  const sidebar = (
    <SuperAdminSidebar
      selectedHotel={
        selectedHotel
      }
      pendingRequests={
        pendingRequests
      }
    />
  );


  const topbar = (
    <SuperAdminTopbar
      title={
        currentSection.title
      }
      selectedHotel={
        selectedHotel
      }
      pendingRequests={
        pendingRequests
      }
      showActionCenter
      breadcrumbs={[
        {
          label:
            "Portfolio",
          to:
            "/superadmin-dashboard",
        },

        {
          label:
            "Hotels",
          to:
            "/superadmin/hotels",
        },

        {
          label:
            selectedHotel.name,
          to:
            `${hotelBasePath}/overview`,
        },

        {
          label:
            currentSection
              .breadcrumb,
        },
      ]}
      onRefresh={() =>
        loadSelectedHotel()
      }
      isRefreshing={
        refreshing
      }
    />
  );


  /* ==========================================================
     WORKSPACE

     Child pages receive the verified selected hotel through
     React Router Outlet context.
  ========================================================== */

  return (
    <SuperAdminLayout
      sidebar={sidebar}
      topbar={topbar}
    >
      <Outlet
        context={{
          selectedHotel,

          refreshSelectedHotel:
            loadSelectedHotel,
        }}
      />
    </SuperAdminLayout>
  );
}


export default SelectedHotelLayout;