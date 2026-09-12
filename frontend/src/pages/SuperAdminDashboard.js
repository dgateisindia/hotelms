import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import SuperAdminLayout from "../layouts/SuperAdminLayout/SuperAdminLayout";

import SuperAdminSidebar from "../components/navigation/SuperAdminSidebar/SuperAdminSidebar";

import SuperAdminTopbar from "../components/navigation/SuperAdminTopbar/SuperAdminTopbar";

import HotelCard from "../components/hotels/HotelCard/HotelCard";

import CreateHotelModal from "../components/hotels/CreateHotelModal/CreateHotelModal";

import hotelService from "../services/hotelService";

import "./SuperAdminDashboard.css";

/* ============================================================
   ICONS
============================================================ */

function IconBase({
  children,
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function HotelIcon() {
  return (
    <IconBase>
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <path d="M3 21h18" />
      <path d="M9 7h1" />
      <path d="M14 7h1" />
      <path d="M9 11h1" />
      <path d="M14 11h1" />
      <path d="M10 21v-4h4v4" />
    </IconBase>
  );
}

function BookingIcon() {
  return (
    <IconBase>
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
      />

      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 9h16" />
      <path d="M8 13h3" />
      <path d="M8 16h5" />
    </IconBase>
  );
}

function RevenueIcon() {
  return (
    <IconBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="M8 8h8" />
      <path d="M8 11h8" />
      <path d="M9 8c4 0 5 1.5 5 3s-1 3-5 3" />
      <path d="m9 14 5 5" />
    </IconBase>
  );
}

function OccupancyIcon() {
  return (
    <IconBase>
      <path d="M4 19V9" />
      <path d="M20 19V7" />
      <path d="M4 14h16" />
      <path d="M7 14v-3h5a3 3 0 0 1 3 3" />
      <path d="M4 19h16" />
    </IconBase>
  );
}

function RequestIcon() {
  return (
    <IconBase>
      <path d="M12 3 2.8 19h18.4L12 3z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </IconBase>
  );
}

function PlusIcon() {
  return (
    <IconBase>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function normalizeNumber(
  value
) {
  const parsedValue =
    Number(value);

  if (
    !Number.isFinite(
      parsedValue
    ) ||
    parsedValue < 0
  ) {
    return 0;
  }

  return parsedValue;
}

function formatCurrency(
  value
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(
    normalizeNumber(value)
  );
}

function getApiErrorMessage(
  error
) {
  return (
    error?.response?.data
      ?.message ||
    error?.response?.data
      ?.error ||
    error?.message ||
    "Your hotel portfolio could not be loaded."
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

function SuperAdminDashboard() {
  const [
    hotels,
    setHotels,
  ] = useState([]);

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
    notice,
    setNotice,
  ] = useState("");

  const [
    isCreateHotelOpen,
    setIsCreateHotelOpen,
  ] = useState(false);

  /* ==========================================================
     LOAD HOTEL PORTFOLIO
  ========================================================== */

  const loadPortfolio =
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

        try {
          const result =
            await hotelService.getHotels();

          if (
            result?.success !== true
          ) {
            throw new Error(
              "The hotel portfolio could not be loaded."
            );
          }

          setHotels(
            Array.isArray(
              result.hotels
            )
              ? result.hotels
              : []
          );
        } catch (
          portfolioError
        ) {
          console.error(
            "[SUPER_ADMIN_DASHBOARD:HOTELS]",
            portfolioError
          );

          setError(
            getApiErrorMessage(
              portfolioError
            )
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadPortfolio({
      initialLoad: true,
    });
  }, [loadPortfolio]);

  /* ==========================================================
     PORTFOLIO METRICS
  ========================================================== */

  const portfolio =
    useMemo(() => {
      return hotels.reduce(
        (
          summary,
          hotel
        ) => {
          const status =
            String(
              hotel?.status ||
                ""
            )
              .trim()
              .toLowerCase();

          const rooms =
            hotel?.rooms || {};

          const today =
            hotel?.today || {};

          summary.totalHotels += 1;

          if (
            status ===
            "active"
          ) {
            summary.activeHotels += 1;
          }

          if (
            status ===
            "pending"
          ) {
            summary.pendingHotels += 1;
          }

          if (
            status ===
            "inactive"
          ) {
            summary.inactiveHotels += 1;
          }

          if (
            status ===
            "rejected"
          ) {
            summary.rejectedHotels += 1;
          }

          summary.adminCount +=
            normalizeNumber(
              hotel?.admins?.count
            );

          summary.totalRooms +=
            normalizeNumber(
              rooms.total
            );

          summary.occupiedRooms +=
            normalizeNumber(
              rooms.occupied
            );

          summary.availableRooms +=
            normalizeNumber(
              rooms.available
            );

          summary.todayBookings +=
            normalizeNumber(
              today.bookings
            );

          summary.todayRevenue +=
            normalizeNumber(
              today.revenue
            );

          summary.pendingRequests +=
            normalizeNumber(
              hotel?.pendingRequests
            );

          return summary;
        },
        {
          totalHotels: 0,
          activeHotels: 0,
          pendingHotels: 0,
          inactiveHotels: 0,
          rejectedHotels: 0,

          adminCount: 0,

          totalRooms: 0,
          occupiedRooms: 0,
          availableRooms: 0,

          todayBookings: 0,
          todayRevenue: 0,

          pendingRequests: 0,
        }
      );
    }, [hotels]);

  const occupancyRate =
    portfolio.totalRooms > 0
      ? Math.round(
          (
            portfolio.occupiedRooms /
            portfolio.totalRooms
          ) *
            100
        )
      : null;

  const hasHotels =
    portfolio.totalHotels > 0;

  /* ==========================================================
     HOTEL CREATED
  ========================================================== */

  const handleHotelCreated =
    useCallback(
      (
        createdHotel,
        message
      ) => {
        if (
          !createdHotel ||
          typeof createdHotel !==
            "object"
        ) {
          return;
        }

        setHotels(
          (currentHotels) => {
            const createdDisplayId =
              String(
                createdHotel.displayId ||
                  ""
              )
                .trim()
                .toUpperCase();

            const alreadyExists =
              currentHotels.some(
                (hotel) =>
                  String(
                    hotel?.displayId ||
                      ""
                  )
                    .trim()
                    .toUpperCase() ===
                  createdDisplayId
              );

            if (
              alreadyExists
            ) {
              return currentHotels;
            }

            return [
              createdHotel,
              ...currentHotels,
            ];
          }
        );

        setError("");

        setNotice(
          message ||
            `${createdHotel.name || "Hotel"} was added to your portfolio.`
        );
      },
      []
    );

  /* ==========================================================
     LAYOUT PROPS
  ========================================================== */

  const sidebar = (
    <SuperAdminSidebar
      selectedHotel={null}
      hotelCount={
        portfolio.totalHotels
      }
      adminCount={
        portfolio.adminCount
      }
      pendingRequests={
        portfolio.pendingRequests
      }
    />
  );

  const topbar = (
    <SuperAdminTopbar
      title="Portfolio Overview"
      breadcrumbs={[
        {
          label: "Portfolio",
        },
        {
          label: "Overview",
        },
      ]}
      selectedHotel={null}
      pendingRequests={
        portfolio.pendingRequests
      }
      onRefresh={() => {
        void loadPortfolio({
          initialLoad: false,
        });
      }}
      isRefreshing={
        refreshing
      }
    />
  );

  /* ==========================================================
     INITIAL LOADING
  ========================================================== */

  if (loading) {
    return (
      <SuperAdminLayout
        sidebar={
          <SuperAdminSidebar />
        }
        topbar={
          <SuperAdminTopbar
            title="Portfolio Overview"
            breadcrumbs={[
              {
                label: "Portfolio",
              },
              {
                label: "Overview",
              },
            ]}
          />
        }
      >
        <div className="super-admin-layout__loading">
          <div className="super-admin-layout__loading-card">
            <h2 className="super-admin-layout__loading-title">
              Loading Portfolio
            </h2>

            <p className="super-admin-layout__loading-description">
              Your hotel portfolio is
              being loaded securely.
            </p>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  /* ==========================================================
     INITIAL API FAILURE

     Important:
     Do not show "Create First Hotel" when the API failed,
     because that could falsely imply that no hotels exist.
  ========================================================== */

  if (
    error &&
    hotels.length === 0
  ) {
    return (
      <SuperAdminLayout
        sidebar={sidebar}
        topbar={topbar}
      >
        <div className="sa-dashboard">
          <section className="sa-card sa-dashboard-error-state">
            <div className="sa-dashboard-error-state__icon">
              <RequestIcon />
            </div>

            <h2>
              Portfolio could not be loaded
            </h2>

            <p>
              {error}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              disabled={
                refreshing
              }
              onClick={() => {
                void loadPortfolio({
                  initialLoad: false,
                });
              }}
            >
              {refreshing
                ? "Retrying..."
                : "Retry"}
            </button>
          </section>
        </div>
      </SuperAdminLayout>
    );
  }

  /* ==========================================================
     MAIN DASHBOARD
  ========================================================== */

  return (
    <SuperAdminLayout
      sidebar={sidebar}
      topbar={topbar}
    >
      <div className="sa-dashboard">

        {/* ====================================================
            ALERTS
        ==================================================== */}

        {error && (
          <div
            className="alert alert-error"
            role="alert"
          >
            <strong>
              Portfolio refresh failed.
            </strong>

            <span>
              {error}
            </span>
          </div>
        )}

        {notice && (
          <div
            className="alert alert-success"
            role="status"
          >
            {notice}
          </div>
        )}

        {/* ====================================================
            ZERO-HOTEL ONBOARDING
        ==================================================== */}

        {!hasHotels ? (
          <>
            <div className="sa-dashboard-intro">
              <div>
                <h2>
                  Business Portfolio
                </h2>

                <p>
                  Start by adding your
                  first hotel to this
                  Super Admin account.
                </p>
              </div>
            </div>

            <section className="sa-card sa-onboarding-card">
              <div className="sa-onboarding-card__icon">
                <HotelIcon />
              </div>

              <div className="sa-onboarding-card__content">
                <span className="sa-onboarding-card__eyebrow">
                  GET STARTED
                </span>

                <h2>
                  Set up your first hotel
                </h2>

                <p>
                  Create a hotel first.
                  After that you can add
                  multiple Hotel Admins,
                  configure rooms and
                  start hotel operations.
                </p>

                <div className="sa-onboarding-card__steps">
                  <span>
                    1. Create Hotel
                  </span>

                  <span>
                    2. Add Admins
                  </span>

                  <span>
                    3. Configure Rooms
                  </span>

                  <span>
                    4. Start Bookings
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary sa-create-hotel-button"
                  onClick={() => {
                    setNotice("");
                    setIsCreateHotelOpen(
                      true
                    );
                  }}
                >
                  <PlusIcon />
                  Create First Hotel
                </button>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* =================================================
                INTRO
            ================================================= */}

            <div className="sa-dashboard-intro sa-dashboard-intro--with-action">
              <div>
                <h2>
                  Business Portfolio
                </h2>

                <p>
                  Manage and monitor all
                  hotels owned by this
                  Super Admin account.
                </p>

                <div className="sa-dashboard-intro__meta">
                  {
                    portfolio.activeHotels
                  }{" "}
                  active of{" "}
                  {
                    portfolio.totalHotels
                  }{" "}
                  {
                    portfolio.totalHotels ===
                    1
                      ? "hotel"
                      : "hotels"
                  }
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary sa-create-hotel-button"
                onClick={() => {
                  setNotice("");
                  setIsCreateHotelOpen(
                    true
                  );
                }}
              >
                <PlusIcon />
                Add Hotel
              </button>
            </div>

            {/* =================================================
                PORTFOLIO KPI CARDS
            ================================================= */}

            <div className="sa-stats-grid sa-stats-grid--portfolio">
              <StatCard
                icon={<HotelIcon />}
                label="Total Hotels"
                value={
                  portfolio.totalHotels
                }
                hint={`${portfolio.activeHotels} active`}
                accent="blue"
              />

              <StatCard
                icon={<BookingIcon />}
                label="Today's Bookings"
                value={
                  portfolio.todayBookings
                }
                hint="Across all hotels"
                accent="green"
              />

              <StatCard
                icon={<RevenueIcon />}
                label="Today's Revenue"
                value={formatCurrency(
                  portfolio.todayRevenue
                )}
                hint="Successful payments"
                accent="purple"
              />

              <StatCard
                icon={<OccupancyIcon />}
                label="Occupancy"
                value={
                  occupancyRate ===
                  null
                    ? "—"
                    : `${occupancyRate}%`
                }
                hint={
                  portfolio.totalRooms ===
                  0
                    ? "No rooms configured"
                    : `${portfolio.occupiedRooms} of ${portfolio.totalRooms} rooms`
                }
                accent="orange"
              />

              <StatCard
                icon={<RequestIcon />}
                label="Pending Requests"
                value={
                  portfolio.pendingRequests
                }
                hint={
                  portfolio.pendingRequests ===
                  0
                    ? "No pending actions"
                    : "Requires Admin attention"
                }
                accent="orange"
              />
            </div>

            {/* =================================================
                HOTEL PORTFOLIO
            ================================================= */}

            <section className="sa-hotels-section">
              <div className="sa-section-header sa-hotels-section__header">
                <div>
                  <h3>
                    Your Hotels
                  </h3>

                  <p>
                    Open a property to
                    manage its Admins,
                    rooms, operations,
                    finance and QR
                    settings.
                  </p>
                </div>

                <span className="sa-hotels-section__count">
                  {
                    portfolio.totalHotels
                  }{" "}
                  {
                    portfolio.totalHotels ===
                    1
                      ? "Property"
                      : "Properties"
                  }
                </span>
              </div>

              <div className="sa-hotels-grid">
                {hotels.map(
                  (hotel) => (
                    <HotelCard
                      key={
                        hotel.displayId ||
                        hotel.name
                      }
                      hotel={hotel}
                    />
                  )
                )}
              </div>
            </section>
          </>
        )}

        {/* ====================================================
            CREATE HOTEL MODAL
        ==================================================== */}

        <CreateHotelModal
          isOpen={
            isCreateHotelOpen
          }
          onClose={() => {
            setIsCreateHotelOpen(
              false
            );
          }}
          onCreated={
            handleHotelCreated
          }
        />
      </div>
    </SuperAdminLayout>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}) {
  return (
    <article className="sa-card sa-stat-card">
      <div
        className={`sa-stat-icon sa-icon-${accent}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className="sa-stat-text">
        <span className="sa-stat-label">
          {label}
        </span>

        <strong className="sa-stat-value">
          {value}
        </strong>

        {hint && (
          <span className="sa-stat-hint">
            {hint}
          </span>
        )}
      </div>
    </article>
  );
}

export default SuperAdminDashboard;