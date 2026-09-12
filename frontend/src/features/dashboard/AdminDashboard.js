import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  Navigate,
  useOutletContext,
} from "react-router-dom";

import dashboardService from "../../services/dashboardService";

import "./AdminDashboard.css";


/* ============================================================
   ICON BASE
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
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}


/* ============================================================
   ICONS
============================================================ */

function BookingIcon() {
  return (
    <IconBase>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
      />

      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M3 10h18" />
      <path d="m8 15 2 2 5-5" />
    </IconBase>
  );
}


function ArrivalIcon() {
  return (
    <IconBase>
      <path d="M4 20V8" />
      <path d="M20 20V8" />
      <path d="M4 16h16" />

      <path d="M12 3v9" />
      <path d="m8 8 4 4 4-4" />
    </IconBase>
  );
}


function DepartureIcon() {
  return (
    <IconBase>
      <path d="M4 20V8" />
      <path d="M20 20V8" />
      <path d="M4 16h16" />

      <path d="M12 12V3" />
      <path d="m8 7 4-4 4 4" />
    </IconBase>
  );
}


function OccupiedIcon() {
  return (
    <IconBase>
      <path d="M3 20V8" />
      <path d="M21 20V8" />
      <path d="M3 16h18" />

      <path d="M6 16v-5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v5" />

      <path d="M13 12h5a3 3 0 0 1 3 3v1" />
    </IconBase>
  );
}


function AvailableIcon() {
  return (
    <IconBase>
      <rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="2"
      />

      <path d="M9 12h6" />
      <path d="m12 9 3 3-3 3" />
    </IconBase>
  );
}


function RevenueIcon() {
  return (
    <IconBase>
      <path d="M7 4h10" />
      <path d="M7 8h10" />
      <path d="M8 4c4 0 6 1.5 6 4s-2 4-6 4h-1" />
      <path d="m8 12 7 8" />
    </IconBase>
  );
}


function RequestIcon() {
  return (
    <IconBase>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />

      <path d="M10 21h4" />
    </IconBase>
  );
}


function ArrowIcon() {
  return (
    <IconBase>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </IconBase>
  );
}


function RoomsIcon() {
  return (
    <IconBase>
      <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />

      <path d="M2 21h20" />

      <path d="M8 7h2" />
      <path d="M14 7h2" />

      <path d="M8 11h2" />
      <path d="M14 11h2" />

      <path d="M10 21v-5h4v5" />
    </IconBase>
  );
}


function CustomerIcon() {
  return (
    <IconBase>
      <circle
        cx="12"
        cy="8"
        r="4"
      />

      <path d="M4 21a8 8 0 0 1 16 0" />
    </IconBase>
  );
}


/* ============================================================
   DATE HELPERS
============================================================ */

function getTodayString() {
  const date =
    new Date();


  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


function formatDate(
  value
) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return date
    .toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
}


function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return date
    .toLocaleString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
}


/* ============================================================
   VALUE HELPERS
============================================================ */

function numberValue(
  value
) {
  const number =
    Number(value);


  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


function formatMoney(
  value
) {
  return new Intl
    .NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }
    )
    .format(
      numberValue(
        value
      )
    );
}


function normalizeStatus(
  status
) {
  return String(
    status || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /_/g,
      "-"
    );
}


function formatStatusLabel(
  status
) {
  return String(
    status || "pending"
  )
    .trim()
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function statusClassName(
  status
) {
  const normalized =
    normalizeStatus(
      status
    );


  const allowed = [
    "confirmed",
    "checked-in",
    "checked-out",
    "pending",
    "cancelled",
  ];


  return allowed.includes(
    normalized
  )
    ? normalized
    : "pending";
}


/* ============================================================
   BOOKING LIST ITEM
============================================================ */

function BookingListItem({
  booking,
}) {
  return (
    <div className="admin-dashboard-page__booking-item">

      <div className="admin-dashboard-page__booking-room">
        {booking?.room_number ||
          "—"}
      </div>


      <div className="admin-dashboard-page__booking-copy">

        <span className="admin-dashboard-page__booking-name">
          {booking?.customer_name ||
            "Guest"}
        </span>


        <div className="admin-dashboard-page__booking-meta">

          <span className="admin-dashboard-page__booking-id">
            {booking?.booking_code ||
              booking?.display_id ||
              "Booking"}
          </span>


          <span>
            Room{" "}
            {booking?.room_number ||
              "—"}
          </span>


          {booking?.total_guests && (
            <span>
              {booking.total_guests}{" "}
              guest
              {Number(
                booking.total_guests
              ) === 1
                ? ""
                : "s"}
            </span>
          )}

        </div>

      </div>


      <span
        className={[
          "admin-dashboard-page__status",

          `admin-dashboard-page__status--${statusClassName(
            booking?.booking_status
          )}`,
        ].join(" ")}
      >
        {formatStatusLabel(
          booking?.booking_status
        )}
      </span>

    </div>
  );
}


/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
  title,
  text,
}) {
  return (
    <div className="admin-dashboard-page__empty">

      <p className="admin-dashboard-page__empty-title">
        {title}
      </p>


      <p className="admin-dashboard-page__empty-text">
        {text}
      </p>

    </div>
  );
}


/* ============================================================
   ADMIN DASHBOARD
============================================================ */

function AdminDashboard() {
  const {
    selectedHotel,
    pendingRequests = 0,
  } = useOutletContext();


  const TODAY =
    useMemo(
      () =>
        getTodayString(),
      []
    );


  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    TODAY
  );


  const [
    stats,
    setStats,
  ] = useState(null);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState(null);


  const [
    redirectStatus,
    setRedirectStatus,
  ] = useState(null);


  const requestIdRef =
    useRef(0);


  /* ==========================================================
     LOAD DASHBOARD
  ========================================================== */

  const loadDashboard =
    useCallback(
      async (
        date
      ) => {
        const requestId =
          requestIdRef.current +
          1;


        requestIdRef.current =
          requestId;


        setLoading(true);

        setError(null);

        setRedirectStatus(
          null
        );


        try {
          const response =
            await dashboardService
              .getAdminDailyStats(
                date
              );


          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }


          if (
            !response?.success ||
            !response?.stats
          ) {
            throw new Error(
              response?.message ||
              "Dashboard data could not be loaded."
            );
          }


          setStats(
            response.stats
          );
        } catch (
          loadError
        ) {
          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }


          console.error(
            "[ADMIN_DASHBOARD:LOAD]",
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
            status === 403
          ) {
            setRedirectStatus(
              status
            );


            return;
          }


          setError(
            loadError
          );
        } finally {
          if (
            requestId ===
            requestIdRef.current
          ) {
            setLoading(
              false
            );
          }
        }
      },
      []
    );


  /* ==========================================================
     DATE CHANGE / INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    void loadDashboard(
      selectedDate
    );
  }, [
    loadDashboard,
    selectedDate,
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
     KPI DATA
  ========================================================== */

  const kpis =
    stats
      ? [
          {
            label:
              "Bookings Created",

            value:
              numberValue(
                stats
                  .bookingsForDate
              ),

            icon:
              <BookingIcon />,
          },

          {
            label:
              "Arrivals",

            value:
              numberValue(
                stats
                  .arrivalsForDate
              ),

            icon:
              <ArrivalIcon />,
          },

          {
            label:
              "Departures",

            value:
              numberValue(
                stats
                  .departuresForDate
              ),

            icon:
              <DepartureIcon />,
          },

          {
            label:
              "Occupied Rooms",

            value:
              numberValue(
                stats
                  .occupiedRooms
              ),

            icon:
              <OccupiedIcon />,
          },

          {
            label:
              "Available Rooms",

            value:
              numberValue(
                stats
                  .availableRooms
              ),

            icon:
              <AvailableIcon />,
          },

          {
            label:
              "Revenue",

            value:
              formatMoney(
                stats
                  .revenueForDate ??
                stats
                  .todaysRevenue
              ),

            icon:
              <RevenueIcon />,
          },

          {
            label:
              "Pending Requests",

            value:
              numberValue(
                pendingRequests
              ),

            icon:
              <RequestIcon />,
          },
        ]
      : [];


  const arrivals =
    Array.isArray(
      stats?.todayArrivals
    )
      ? stats.todayArrivals
      : [];


  const departures =
    Array.isArray(
      stats?.todayDepartures
    )
      ? stats.todayDepartures
      : [];


  const latestBookings =
    Array.isArray(
      stats?.latestBookings
    )
      ? stats.latestBookings
      : [];


  const roomStatus =
    stats?.roomStatus || {
      occupied: 0,
      available: 0,
      cleaning: 0,
      maintenance: 0,
      total: 0,
    };


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="admin-dashboard-page">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="admin-dashboard-page__header">

        <div className="admin-dashboard-page__heading">

          <h2 className="admin-dashboard-page__title">
            Hotel Operations
          </h2>


          <p className="admin-dashboard-page__subtitle">
            {selectedHotel?.name
              ? `Operational overview for ${selectedHotel.name}.`
              : "Operational overview of your assigned hotel."}
          </p>

        </div>


        <div className="admin-dashboard-page__date-control">

          <label
            className="admin-dashboard-page__date-label"
            htmlFor="admin-dashboard-date"
          >
            Dashboard Date
          </label>


          <input
            id="admin-dashboard-date"
            type="date"
            className="admin-dashboard-page__date-input"
            value={
              selectedDate
            }
            max={
              TODAY
            }
            onChange={(
              event
            ) => {
              setSelectedDate(
                event.target
                  .value
              );
            }}
          />

        </div>

      </div>


      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div
          className="admin-dashboard-page__error"
          role="alert"
        >
          {error?.message ||
            "Dashboard data could not be loaded."}
        </div>
      )}


      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading &&
      !stats ? (
        <div className="admin-dashboard-page__loading">
          Loading hotel dashboard...
        </div>
      ) : (
        <>

          {/* ==================================================
              KPI CARDS
          ================================================== */}

          <div className="admin-dashboard-page__kpis">

            {kpis.map(
              (item) => (
                <article
                  key={
                    item.label
                  }
                  className="admin-dashboard-page__kpi"
                >

                  <div className="admin-dashboard-page__kpi-icon">
                    {item.icon}
                  </div>


                  <div className="admin-dashboard-page__kpi-copy">

                    <span className="admin-dashboard-page__kpi-label">
                      {item.label}
                    </span>


                    <span className="admin-dashboard-page__kpi-value">
                      {item.value}
                    </span>

                  </div>

                </article>
              )
            )}

          </div>


          {/* ==================================================
              GRID
          ================================================== */}

          <div className="admin-dashboard-page__grid">

            {/* =================================================
                ARRIVALS
            ================================================= */}

            <section className="admin-dashboard-page__panel admin-dashboard-page__panel--half">

              <div className="admin-dashboard-page__panel-header">

                <div className="admin-dashboard-page__panel-heading">

                  <h3 className="admin-dashboard-page__panel-title">
                    Arrivals
                  </h3>


                  <span className="admin-dashboard-page__panel-subtitle">
                    Scheduled for{" "}
                    {formatDate(
                      selectedDate
                    )}
                  </span>

                </div>


                <Link
                  to="/bookings"
                  className="admin-dashboard-page__panel-link"
                >
                  View Bookings
                  <ArrowIcon />
                </Link>

              </div>


              <div className="admin-dashboard-page__panel-body">

                {arrivals.length >
                0 ? (
                  <div className="admin-dashboard-page__booking-list">

                    {arrivals
                      .slice(
                        0,
                        5
                      )
                      .map(
                        (
                          booking
                        ) => (
                          <BookingListItem
                            key={
                              booking
                                .booking_id
                            }
                            booking={
                              booking
                            }
                          />
                        )
                      )}

                  </div>
                ) : (
                  <EmptyState
                    title="No arrivals"
                    text="No guest arrivals are scheduled for this date."
                  />
                )}

              </div>

            </section>


            {/* =================================================
                DEPARTURES
            ================================================= */}

            <section className="admin-dashboard-page__panel admin-dashboard-page__panel--half">

              <div className="admin-dashboard-page__panel-header">

                <div className="admin-dashboard-page__panel-heading">

                  <h3 className="admin-dashboard-page__panel-title">
                    Departures
                  </h3>


                  <span className="admin-dashboard-page__panel-subtitle">
                    Scheduled for{" "}
                    {formatDate(
                      selectedDate
                    )}
                  </span>

                </div>


                <Link
                  to="/bookings"
                  className="admin-dashboard-page__panel-link"
                >
                  View Bookings
                  <ArrowIcon />
                </Link>

              </div>


              <div className="admin-dashboard-page__panel-body">

                {departures.length >
                0 ? (
                  <div className="admin-dashboard-page__booking-list">

                    {departures
                      .slice(
                        0,
                        5
                      )
                      .map(
                        (
                          booking
                        ) => (
                          <BookingListItem
                            key={
                              booking
                                .booking_id
                            }
                            booking={
                              booking
                            }
                          />
                        )
                      )}

                  </div>
                ) : (
                  <EmptyState
                    title="No departures"
                    text="No guest departures are scheduled for this date."
                  />
                )}

              </div>

            </section>


            {/* =================================================
                ROOM STATUS
            ================================================= */}

            <section className="admin-dashboard-page__panel admin-dashboard-page__panel--third">

              <div className="admin-dashboard-page__panel-header">

                <div className="admin-dashboard-page__panel-heading">

                  <h3 className="admin-dashboard-page__panel-title">
                    Room Status
                  </h3>


                  <span className="admin-dashboard-page__panel-subtitle">
                    Current room availability
                  </span>

                </div>


                <Link
                  to="/rooms"
                  className="admin-dashboard-page__panel-link"
                >
                  Rooms
                  <ArrowIcon />
                </Link>

              </div>


              <div className="admin-dashboard-page__panel-body">

                <div className="admin-dashboard-page__room-status">

                  <div className="admin-dashboard-page__room-status-item">

                    <div className="admin-dashboard-page__room-status-label">

                      <span className="admin-dashboard-page__room-status-dot admin-dashboard-page__room-status-dot--available" />

                      Available

                    </div>


                    <span className="admin-dashboard-page__room-status-value">
                      {numberValue(
                        roomStatus
                          .available
                      )}
                    </span>

                  </div>


                  <div className="admin-dashboard-page__room-status-item">

                    <div className="admin-dashboard-page__room-status-label">

                      <span className="admin-dashboard-page__room-status-dot admin-dashboard-page__room-status-dot--occupied" />

                      Occupied

                    </div>


                    <span className="admin-dashboard-page__room-status-value">
                      {numberValue(
                        roomStatus
                          .occupied
                      )}
                    </span>

                  </div>


                  <div className="admin-dashboard-page__room-status-item">

                    <div className="admin-dashboard-page__room-status-label">

                      <span className="admin-dashboard-page__room-status-dot admin-dashboard-page__room-status-dot--cleaning" />

                      Cleaning

                    </div>


                    <span className="admin-dashboard-page__room-status-value">
                      {numberValue(
                        roomStatus
                          .cleaning
                      )}
                    </span>

                  </div>


                  <div className="admin-dashboard-page__room-status-item">

                    <div className="admin-dashboard-page__room-status-label">

                      <span className="admin-dashboard-page__room-status-dot admin-dashboard-page__room-status-dot--maintenance" />

                      Maintenance

                    </div>


                    <span className="admin-dashboard-page__room-status-value">
                      {numberValue(
                        roomStatus
                          .maintenance
                      )}
                    </span>

                  </div>

                </div>

              </div>

            </section>


            {/* =================================================
                CUSTOMER REQUESTS
            ================================================= */}

            <section className="admin-dashboard-page__panel admin-dashboard-page__panel--third">

              <div className="admin-dashboard-page__panel-header">

                <div className="admin-dashboard-page__panel-heading">

                  <h3 className="admin-dashboard-page__panel-title">
                    Customer Requests
                  </h3>


                  <span className="admin-dashboard-page__panel-subtitle">
                    Pending hotel requests
                  </span>

                </div>


                <Link
                  to="/notifications"
                  className="admin-dashboard-page__panel-link"
                >
                  Open
                  <ArrowIcon />
                </Link>

              </div>


              <div className="admin-dashboard-page__panel-body">

                <div className="admin-dashboard-page__request-summary">

                  <div className="admin-dashboard-page__request-icon">
                    <RequestIcon />
                  </div>


                  <div className="admin-dashboard-page__request-copy">

                    <span className="admin-dashboard-page__request-value">
                      {numberValue(
                        pendingRequests
                      )}
                    </span>


                    <span className="admin-dashboard-page__request-label">
                      Requests waiting for Admin action
                    </span>

                  </div>

                </div>

              </div>

            </section>


            {/* =================================================
                QUICK ACTIONS
            ================================================= */}

            <section className="admin-dashboard-page__panel admin-dashboard-page__panel--third">

              <div className="admin-dashboard-page__panel-header">

                <div className="admin-dashboard-page__panel-heading">

                  <h3 className="admin-dashboard-page__panel-title">
                    Quick Actions
                  </h3>


                  <span className="admin-dashboard-page__panel-subtitle">
                    Common hotel operations
                  </span>

                </div>

              </div>


              <div className="admin-dashboard-page__panel-body">

                <div className="admin-dashboard-page__quick-actions">

                  <Link
                    to="/bookings"
                    className="admin-dashboard-page__quick-action"
                  >

                    <span className="admin-dashboard-page__quick-action-icon">
                      <BookingIcon />
                    </span>


                    <span className="admin-dashboard-page__quick-action-label">
                      Manage Bookings
                    </span>

                  </Link>


                  <Link
                    to="/rooms"
                    className="admin-dashboard-page__quick-action"
                  >

                    <span className="admin-dashboard-page__quick-action-icon">
                      <RoomsIcon />
                    </span>


                    <span className="admin-dashboard-page__quick-action-label">
                      Manage Rooms
                    </span>

                  </Link>


                  <Link
                    to="/customers"
                    className="admin-dashboard-page__quick-action"
                  >

                    <span className="admin-dashboard-page__quick-action-icon">
                      <CustomerIcon />
                    </span>


                    <span className="admin-dashboard-page__quick-action-label">
                      Customers
                    </span>

                  </Link>


                  <Link
                    to="/notifications"
                    className="admin-dashboard-page__quick-action"
                  >

                    <span className="admin-dashboard-page__quick-action-icon">
                      <RequestIcon />
                    </span>


                    <span className="admin-dashboard-page__quick-action-label">
                      Customer Requests
                    </span>

                  </Link>

                </div>

              </div>

            </section>


            {/* =================================================
                LATEST BOOKINGS
            ================================================= */}

            <section className="admin-dashboard-page__panel admin-dashboard-page__panel--full">

              <div className="admin-dashboard-page__panel-header">

                <div className="admin-dashboard-page__panel-heading">

                  <h3 className="admin-dashboard-page__panel-title">
                    Latest Bookings
                  </h3>


                  <span className="admin-dashboard-page__panel-subtitle">
                    Recently created hotel bookings
                  </span>

                </div>


                <Link
                  to="/bookings"
                  className="admin-dashboard-page__panel-link"
                >
                  View All
                  <ArrowIcon />
                </Link>

              </div>


              {latestBookings.length >
              0 ? (
                <div className="admin-dashboard-page__table-wrap">

                  <table className="admin-dashboard-page__table">

                    <thead>
                      <tr>
                        <th>
                          Booking
                        </th>

                        <th>
                          Customer
                        </th>

                        <th>
                          Room
                        </th>

                        <th>
                          Check In
                        </th>

                        <th>
                          Check Out
                        </th>

                        <th>
                          Amount
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Created
                        </th>
                      </tr>
                    </thead>


                    <tbody>

                      {latestBookings.map(
                        (
                          booking
                        ) => (
                          <tr
                            key={
                              booking
                                .booking_id
                            }
                          >

                            <td className="admin-dashboard-page__table-primary">
                              {booking
                                .booking_code ||
                                booking
                                  .display_id ||
                                "—"}
                            </td>


                            <td>
                              {booking
                                .customer_name ||
                                "—"}
                            </td>


                            <td>
                              {booking
                                .room_number ||
                                "—"}
                            </td>


                            <td>
                              {formatDate(
                                booking
                                  .check_in
                              )}
                            </td>


                            <td>
                              {formatDate(
                                booking
                                  .check_out
                              )}
                            </td>


                            <td>
                              {formatMoney(
                                booking
                                  .total_amount
                              )}
                            </td>


                            <td>
                              <span
                                className={[
                                  "admin-dashboard-page__status",

                                  `admin-dashboard-page__status--${statusClassName(
                                    booking
                                      .booking_status
                                  )}`,
                                ].join(
                                  " "
                                )}
                              >
                                {formatStatusLabel(
                                  booking
                                    .booking_status
                                )}
                              </span>
                            </td>


                            <td>
                              {formatDateTime(
                                booking
                                  .created_at
                              )}
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>
              ) : (
                <EmptyState
                  title="No bookings found"
                  text="New bookings will appear here once they are created."
                />
              )}

            </section>

          </div>

        </>
      )}

    </div>
  );
}


export default AdminDashboard;