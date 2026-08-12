import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import apiClient from "../../services/apiClient";

import "../../styles/Bookings.css";

import {
  IcoPlus,
  IcoSearch,
  IcoFilter,
  IcoEye,
  IcoEdit,
  IcoTrash,
  IcoChevL,
  IcoChevR,
  IcoCalendar,
  IcoCheck,
  IcoClock,
  IcoRupee,
  IcoWarn,
  IcoCancel,
} from "../../utils/icons/BookingIcons";


/* ============================================================
   CONSTANTS
============================================================ */

const PER_PAGE = 8;

const STATUS_OPTIONS = [
  {
    value: "all",
    label: "All Statuses",
  },
  {
    value: "pending",
    label: "Pending",
  },
  {
    value: "confirmed",
    label: "Confirmed",
  },
  {
    value: "checked_in",
    label: "Checked In",
  },
  {
    value: "checked_out",
    label: "Checked Out",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

const DATE_FILTER_OPTIONS = [
  {
    value: "all",
    label: "All Dates",
  },
  {
    value: "today",
    label: "Today",
  },
  {
    value: "upcoming",
    label: "Upcoming",
  },
  {
    value: "past",
    label: "Past",
  },
];


/* ============================================================
   HELPERS
============================================================ */

function normalizeText(value) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}


function formatStatus(value) {
  const status =
    normalizeText(value);

  const labels = {
    pending: "Pending",
    confirmed: "Confirmed",
    checked_in: "Checked In",
    checked_out: "Checked Out",
    cancelled: "Cancelled",
  };

  return (
    labels[status] ||
    "Unknown"
  );
}


function formatPaymentStatus(
  value
) {
  const status =
    normalizeText(value);

  const labels = {
    paid: "Paid",
    partial: "Partial",
    unpaid: "Unpaid",
  };

  return (
    labels[status] ||
    "Unknown"
  );
}


function getStatusClass(
  value
) {
  const status =
    normalizeText(value);

  return (
    `booking-status booking-status--${status || "unknown"}`
  );
}


function getPaymentClass(
  value
) {
  const status =
    normalizeText(value);

  return (
    `booking-payment booking-payment--${status || "unknown"}`
  );
}


function formatCurrency(value) {
  const amount =
    Number(value);

  if (
    !Number.isFinite(amount)
  ) {
    return "₹0.00";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(amount);
}


function formatDate(value) {
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

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


function formatDateTime(value) {
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

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


function getStartOfToday() {
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  return today;
}


function getEndOfToday() {
  const today =
    new Date();

  today.setHours(
    23,
    59,
    59,
    999
  );

  return today;
}


function calculateNights(
  checkIn,
  checkOut
) {
  const start =
    new Date(checkIn);

  const end =
    new Date(checkOut);

  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return 0;
  }

  const milliseconds =
    end.getTime() -
    start.getTime();

  if (
    milliseconds <= 0
  ) {
    return 0;
  }

  return Math.max(
    1,
    Math.ceil(
      milliseconds /
        (
          1000 *
          60 *
          60 *
          24
        )
    )
  );
}


function bookingMatchesDateFilter(
  booking,
  filter
) {
  if (
    filter === "all"
  ) {
    return true;
  }

  const checkIn =
    new Date(
      booking.check_in
    );

  const checkOut =
    new Date(
      booking.check_out
    );

  if (
    Number.isNaN(
      checkIn.getTime()
    ) ||
    Number.isNaN(
      checkOut.getTime()
    )
  ) {
    return false;
  }

  const startToday =
    getStartOfToday();

  const endToday =
    getEndOfToday();

  if (
    filter === "today"
  ) {
    return (
      checkIn <=
        endToday &&
      checkOut >=
        startToday
    );
  }

  if (
    filter === "upcoming"
  ) {
    return (
      checkIn >
        endToday &&
      normalizeText(
        booking.booking_status
      ) !== "cancelled"
    );
  }

  if (
    filter === "past"
  ) {
    return (
      checkOut <
      startToday
    );
  }

  return true;
}


function getApiMessage(
  error,
  fallback
) {
  return (
    error?.message ||
    fallback
  );
}


/* ============================================================
   EMPTY STATE
============================================================ */

function BookingEmptyState({
  filtered,
  onNewBooking,
  onClearFilters,
}) {
  return (
    <div className="bookings-empty-state">

      <div
        className="bookings-empty-icon"
        aria-hidden="true"
      >
        <IcoCalendar />
      </div>

      <h3>
        {filtered
          ? "No bookings match your filters"
          : "No bookings yet"}
      </h3>

      <p>
        {filtered
          ? "Change or clear the current filters to see more booking records."
          : "Create the first booking for this hotel using the Booking Desk."}
      </p>

      {filtered ? (
        <button
          type="button"
          className="bookings-empty-action bookings-empty-action--secondary"
          onClick={onClearFilters}
        >
          Clear Filters
        </button>
      ) : (
        <button
          type="button"
          className="bookings-empty-action"
          onClick={onNewBooking}
        >
          <IcoPlus />

          New Booking
        </button>
      )}

    </div>
  );
}


/* ============================================================
   CONFIRM ACTION DIALOG
============================================================ */

function BookingActionDialog({
  action,
  processing,
  error,
  onClose,
  onConfirm,
}) {
  if (!action) {
    return null;
  }

  const isDelete =
    action.type === "delete";

  return (
    <div
      className="booking-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !processing
        ) {
          onClose();
        }
      }}
    >
      <div
        className="booking-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-action-title"
      >

        <div
          className={
            isDelete
              ? "booking-confirm-icon booking-confirm-icon--danger"
              : "booking-confirm-icon booking-confirm-icon--warning"
          }
          aria-hidden="true"
        >
          {isDelete
            ? <IcoWarn />
            : <IcoCancel />}
        </div>

        <h3 id="booking-action-title">
          {isDelete
            ? "Delete Pending Booking?"
            : "Cancel Booking?"}
        </h3>

        <p>
          {isDelete
            ? (
              <>
                Booking{" "}
                <strong>
                  {action.booking.booking_code}
                </strong>{" "}
                will be permanently removed only if it has no
                payment or QR history.
              </>
            )
            : (
              <>
                Booking{" "}
                <strong>
                  {action.booking.booking_code}
                </strong>{" "}
                will remain in history but its status will be
                changed to Cancelled.
              </>
            )}
        </p>

        {error && (
          <div className="booking-dialog-error">
            {error}
          </div>
        )}

        <div className="booking-confirm-actions">

          <button
            type="button"
            className="booking-btn-secondary"
            onClick={onClose}
            disabled={processing}
          >
            Keep Booking
          </button>

          <button
            type="button"
            className={
              isDelete
                ? "booking-btn-danger"
                : "booking-btn-warning"
            }
            onClick={onConfirm}
            disabled={processing}
          >
            {processing
              ? "Processing..."
              : isDelete
                ? "Delete Booking"
                : "Cancel Booking"}
          </button>

        </div>

      </div>
    </div>
  );
}


/* ============================================================
   BOOKING VIEW DIALOG
============================================================ */

function BookingViewDialog({
  booking,
  loading,
  error,
  onClose,
}) {
  if (
    !loading &&
    !booking &&
    !error
  ) {
    return null;
  }

  return (
    <div
      className="booking-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="booking-view-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-view-title"
      >

        <div className="booking-modal-header">

          <div>
            <h3 id="booking-view-title">
              Booking Details
            </h3>

            <p>
              {booking?.booking_code ||
                "Loading booking..."}
            </p>
          </div>

          <button
            type="button"
            className="booking-modal-close"
            onClick={onClose}
            aria-label="Close booking details"
          >
            ×
          </button>

        </div>

        {loading ? (
          <div className="booking-view-loading">
            Loading booking details...
          </div>
        ) : error ? (
          <div className="booking-view-error">
            {error}
          </div>
        ) : (
          <div className="booking-view-body">

            <section className="booking-detail-section">

              <h4>
                Guest Information
              </h4>

              <div className="booking-detail-row">
                <span>Customer</span>
                <strong>
                  {booking.full_name || "—"}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Phone</span>
                <strong>
                  {booking.phone || "—"}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Email</span>
                <strong>
                  {booking.email || "—"}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Nationality</span>
                <strong>
                  {booking.nationality || "—"}
                </strong>
              </div>

            </section>


            <section className="booking-detail-section">

              <h4>
                Stay Details
              </h4>

              <div className="booking-detail-row">
                <span>Room</span>
                <strong>
                  Room {booking.room_number || "—"}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Room Type</span>
                <strong>
                  {booking.room_type || "—"}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Check In</span>
                <strong>
                  {formatDateTime(
                    booking.check_in
                  )}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Check Out</span>
                <strong>
                  {formatDateTime(
                    booking.check_out
                  )}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Nights</span>
                <strong>
                  {calculateNights(
                    booking.check_in,
                    booking.check_out
                  )}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Total Guests</span>
                <strong>
                  {Number(
                    booking.total_guests ||
                      0
                  )}
                </strong>
              </div>

            </section>


            <section className="booking-detail-section">

              <h4>
                Booking & Payment
              </h4>

              <div className="booking-detail-row">
                <span>Booking Status</span>

                <strong>
                  <span
                    className={getStatusClass(
                      booking.booking_status
                    )}
                  >
                    {formatStatus(
                      booking.booking_status
                    )}
                  </span>
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Payment Status</span>

                <strong>
                  <span
                    className={getPaymentClass(
                      booking.payment_status
                    )}
                  >
                    {formatPaymentStatus(
                      booking.payment_status
                    )}
                  </span>
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Booking Amount</span>
                <strong>
                  {formatCurrency(
                    booking.total_amount
                  )}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Amount Paid</span>
                <strong>
                  {formatCurrency(
                    booking.amount_paid
                  )}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Outstanding</span>
                <strong>
                  {formatCurrency(
                    booking.outstanding_amount
                  )}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Created On</span>
                <strong>
                  {formatDateTime(
                    booking.created_at
                  )}
                </strong>
              </div>

            </section>


            {booking.special_request && (
              <section className="booking-detail-section">

                <h4>
                  Special Request
                </h4>

                <div className="booking-special-request">
                  {booking.special_request}
                </div>

              </section>
            )}


            <section className="booking-detail-section">

              <h4>
                Payment History
              </h4>

              {!Array.isArray(
                booking.payments
              ) ||
              booking.payments.length ===
                0 ? (
                <div className="booking-payment-empty">
                  No payment transactions recorded.
                </div>
              ) : (
                <div className="booking-payment-history">

                  {booking.payments.map(
                    (payment) => (
                      <div
                        className="booking-payment-history-row"
                        key={payment.payment_id}
                      >
                        <div>
                          <strong>
                            {formatCurrency(
                              payment.amount
                            )}
                          </strong>

                          <span>
                            {String(
                              payment.payment_method ||
                                "—"
                            )
                              .replaceAll(
                                "_",
                                " "
                              )}
                          </span>
                        </div>

                        <div>
                          <strong>
                            {String(
                              payment.payment_status ||
                                "—"
                            )}
                          </strong>

                          <span>
                            {formatDateTime(
                              payment.payment_date
                            )}
                          </span>
                        </div>
                      </div>
                    )
                  )}

                </div>
              )}

            </section>

          </div>
        )}

        <div className="booking-modal-footer">

          <button
            type="button"
            className="booking-btn-primary"
            onClick={onClose}
          >
            Close
          </button>

        </div>

      </div>
    </div>
  );
}


/* ============================================================
   MAIN PAGE
============================================================ */

function Bookings() {
  const navigate =
    useNavigate();

  const [
    bookings,
    setBookings,
  ] = useState([]);

  const [
    stats,
    setStats,
  ] = useState({
    totalBookings: 0,
    confirmedBookings: 0,
    pendingBookings: 0,
    checkedInBookings: 0,
    checkedOutBookings: 0,
    cancelledBookings: 0,
    totalBookedValue: 0,
    totalRevenue: 0,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    dateFilter,
    setDateFilter,
  ] = useState("all");

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    viewBooking,
    setViewBooking,
  ] = useState(null);

  const [
    viewLoading,
    setViewLoading,
  ] = useState(false);

  const [
    viewError,
    setViewError,
  ] = useState("");

  const [
    action,
    setAction,
  ] = useState(null);

  const [
    actionProcessing,
    setActionProcessing,
  ] = useState(false);

  const [
    actionError,
    setActionError,
  ] = useState("");


  /* ==========================================================
     LOAD BOOKINGS
  ========================================================== */

  const loadBookings =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            bookingResponse,
            statsResponse,
          ] = await Promise.all([
            apiClient.get(
              "/bookings"
            ),

            apiClient.get(
              "/bookings/stats"
            ),
          ]);

          const bookingRows =
            Array.isArray(
              bookingResponse.data
            )
              ? bookingResponse.data
              : [];

          setBookings(
            bookingRows
          );

          const statsData =
            statsResponse
              .data
              ?.data || {};

          setStats({
            totalBookings:
              Number(
                statsData.totalBookings ||
                  0
              ),

            confirmedBookings:
              Number(
                statsData.confirmedBookings ||
                  0
              ),

            pendingBookings:
              Number(
                statsData.pendingBookings ||
                  0
              ),

            checkedInBookings:
              Number(
                statsData.checkedInBookings ||
                  0
              ),

            checkedOutBookings:
              Number(
                statsData.checkedOutBookings ||
                  0
              ),

            cancelledBookings:
              Number(
                statsData.cancelledBookings ||
                  0
              ),

            totalBookedValue:
              Number(
                statsData.totalBookedValue ||
                  0
              ),

            totalRevenue:
              Number(
                statsData.totalRevenue ||
                  0
              ),
          });
        } catch (loadError) {
          setError(
            getApiMessage(
              loadError,
              "Bookings could not be loaded."
            )
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );


  useEffect(() => {
    void loadBookings();
  }, [
    loadBookings,
  ]);


  /* ==========================================================
     FILTERING
  ========================================================== */

  const filteredBookings =
    useMemo(
      () => {
        const query =
          normalizeText(
            search
          );

        return bookings.filter(
          (booking) => {
            if (
              statusFilter !==
                "all" &&
              normalizeText(
                booking.booking_status
              ) !== statusFilter
            ) {
              return false;
            }

            if (
              !bookingMatchesDateFilter(
                booking,
                dateFilter
              )
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            const searchable =
              [
                booking.booking_code,
                booking.full_name,
                booking.phone,
                booking.email,
                booking.room_number,
                booking.room_type,
              ]
                .map(
                  normalizeText
                )
                .join(" ");

            return searchable.includes(
              query
            );
          }
        );
      },
      [
        bookings,
        search,
        statusFilter,
        dateFilter,
      ]
    );


  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    dateFilter,
  ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredBookings.length /
          PER_PAGE
      )
    );


  useEffect(() => {
    if (
      page > totalPages
    ) {
      setPage(
        totalPages
      );
    }
  }, [
    page,
    totalPages,
  ]);


  const paginatedBookings =
    useMemo(
      () => {
        const start =
          (
            page -
            1
          ) *
          PER_PAGE;

        return filteredBookings.slice(
          start,
          start +
            PER_PAGE
        );
      },
      [
        filteredBookings,
        page,
      ]
    );


  const hasFilters =
    Boolean(
      search.trim() ||
      statusFilter !==
        "all" ||
      dateFilter !==
        "all"
    );


  /* ==========================================================
     CLEAR FILTERS
  ========================================================== */

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setDateFilter("all");
    setPage(1);
  }


  /* ==========================================================
     BOOKING DESK
  ========================================================== */

  function openNewBooking() {
    navigate(
      "/booking-desk"
    );
  }


  function openEditBooking(
    booking
  ) {
    navigate(
      `/booking-desk?edit=${booking.booking_id}`
    );
  }


  /* ==========================================================
     VIEW BOOKING
  ========================================================== */

  async function openViewBooking(
    bookingId
  ) {
    setViewBooking(null);
    setViewError("");
    setViewLoading(true);

    try {
      const response =
        await apiClient.get(
          `/bookings/${bookingId}`
        );

      setViewBooking(
        response.data
      );
    } catch (viewLoadError) {
      setViewError(
        getApiMessage(
          viewLoadError,
          "Booking details could not be loaded."
        )
      );
    } finally {
      setViewLoading(false);
    }
  }


  function closeViewBooking() {
    if (viewLoading) {
      return;
    }

    setViewBooking(null);
    setViewError("");
    setViewLoading(false);
  }


  /* ==========================================================
     CANCEL / DELETE
  ========================================================== */

  function requestAction(
    type,
    booking
  ) {
    setAction({
      type,
      booking,
    });

    setActionError("");
  }


  function closeAction() {
    if (
      actionProcessing
    ) {
      return;
    }

    setAction(null);
    setActionError("");
  }


  async function confirmAction() {
    if (!action) {
      return;
    }

    setActionProcessing(true);
    setActionError("");

    try {
      if (
        action.type ===
        "cancel"
      ) {
        await apiClient.put(
          `/bookings/${action.booking.booking_id}/cancel`
        );
      } else {
        await apiClient.delete(
          `/bookings/${action.booking.booking_id}`
        );
      }

      setAction(null);

      await loadBookings();
    } catch (actionRequestError) {
      setActionError(
        getApiMessage(
          actionRequestError,
          "The booking could not be updated."
        )
      );
    } finally {
      setActionProcessing(false);
    }
  }


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="bookings-page">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="bookings-page-header">

        <div>
          <h1>
            Bookings
          </h1>

          <p>
            Manage reservations, guest stays and booking activity
            for your assigned hotel.
          </p>
        </div>

        <button
          type="button"
          className="booking-new-button"
          onClick={
            openNewBooking
          }
        >
          <IcoPlus />

          New Booking
        </button>

      </div>


      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="bookings-error-banner">

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              void loadBookings()
            }
          >
            Retry
          </button>

        </div>
      )}


      {/* ======================================================
          STATS
      ====================================================== */}

      <div className="booking-stats">

        <div className="bstat-card">

          <div className="bstat-icon blue">
            <IcoCalendar />
          </div>

          <div className="bstat-info">
            <span className="bstat-label">
              Total Bookings
            </span>

            <strong className="bstat-value">
              {stats.totalBookings}
            </strong>

            <span className="bstat-change">
              All booking records
            </span>
          </div>

        </div>


        <div className="bstat-card">

          <div className="bstat-icon green">
            <IcoCheck />
          </div>

          <div className="bstat-info">
            <span className="bstat-label">
              Confirmed
            </span>

            <strong className="bstat-value">
              {stats.confirmedBookings}
            </strong>

            <span className="bstat-change">
              Active confirmed stays
            </span>
          </div>

        </div>


        <div className="bstat-card">

          <div className="bstat-icon orange">
            <IcoClock />
          </div>

          <div className="bstat-info">
            <span className="bstat-label">
              Pending
            </span>

            <strong className="bstat-value">
              {stats.pendingBookings}
            </strong>

            <span className="bstat-change">
              Awaiting confirmation
            </span>
          </div>

        </div>


        <div className="bstat-card">

          <div className="bstat-icon purple">
            <IcoRupee />
          </div>

          <div className="bstat-info">
            <span className="bstat-label">
              Revenue Received
            </span>

            <strong className="bstat-value bstat-value--money">
              {formatCurrency(
                stats.totalRevenue
              )}
            </strong>

            <span className="bstat-change">
              Successful payments
            </span>
          </div>

        </div>

      </div>


      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="bookings-toolbar">

        <div className="bookings-toolbar-left">

          <div className="booking-search">

            <IcoSearch />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search booking, customer, phone or room..."
              aria-label="Search bookings"
            />

          </div>


          <div className="booking-filter-control">

            <IcoFilter />

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              aria-label="Filter booking status"
            >
              {STATUS_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

          </div>


          <div className="booking-filter-control">

            <IcoCalendar />

            <select
              value={
                dateFilter
              }
              onChange={(event) =>
                setDateFilter(
                  event.target.value
                )
              }
              aria-label="Filter booking dates"
            >
              {DATE_FILTER_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

          </div>

        </div>


        <div className="bookings-toolbar-right">

          <span className="bookings-result-count">
            <strong>
              {filteredBookings.length}
            </strong>{" "}
            {filteredBookings.length ===
            1
              ? "booking"
              : "bookings"}
          </span>

          {hasFilters && (
            <button
              type="button"
              className="booking-clear-filters"
              onClick={
                clearFilters
              }
            >
              Clear Filters
            </button>
          )}

        </div>

      </div>


      {/* ======================================================
          TABLE
      ====================================================== */}

      <div className="bookings-card">

        {loading ? (
          <div className="bookings-loading">
            Loading bookings...
          </div>
        ) : filteredBookings.length ===
          0 ? (
          <BookingEmptyState
            filtered={
              hasFilters
            }
            onNewBooking={
              openNewBooking
            }
            onClearFilters={
              clearFilters
            }
          />
        ) : (
          <>
            <div className="bookings-table-wrap">

              <table className="bookings-table">

                <thead>
                  <tr>
                    <th>
                      Booking
                    </th>

                    <th>
                      Guest
                    </th>

                    <th>
                      Room
                    </th>

                    <th>
                      Stay
                    </th>

                    <th>
                      Nights
                    </th>

                    <th>
                      Amount
                    </th>

                    <th>
                      Payment
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {paginatedBookings.map(
                    (booking) => {
                      const status =
                        normalizeText(
                          booking.booking_status
                        );

                      const canEdit =
                        status ===
                          "pending" ||
                        status ===
                          "confirmed";

                      const canCancel =
                        status ===
                          "pending" ||
                        status ===
                          "confirmed" ||
                        status ===
                          "checked_in";

                      const canDelete =
                        status ===
                        "pending";

                      return (
                        <tr
                          key={
                            booking.booking_id
                          }
                        >

                          <td>
                            <div className="booking-id-cell">
                              <strong>
                                {booking.booking_code}
                              </strong>

                              <span>
                                #{booking.booking_id}
                              </span>
                            </div>
                          </td>


                          <td>
                            <div className="booking-guest-cell">
                              <strong>
                                {booking.full_name ||
                                  "Unknown Guest"}
                              </strong>

                              <span>
                                {booking.phone ||
                                  "No phone"}
                              </span>
                            </div>
                          </td>


                          <td>
                            <div className="booking-room-cell">
                              <strong>
                                Room{" "}
                                {booking.room_number ||
                                  "—"}
                              </strong>

                              <span>
                                {booking.room_type ||
                                  "—"}
                              </span>
                            </div>
                          </td>


                          <td>
                            <div className="booking-stay-cell">
                              <span>
                                {formatDate(
                                  booking.check_in
                                )}
                              </span>

                              <span className="booking-stay-arrow">
                                →
                              </span>

                              <span>
                                {formatDate(
                                  booking.check_out
                                )}
                              </span>
                            </div>
                          </td>


                          <td>
                            <strong className="booking-nights">
                              {calculateNights(
                                booking.check_in,
                                booking.check_out
                              )}
                            </strong>
                          </td>


                          <td>
                            <div className="booking-amount-cell">
                              <strong>
                                {formatCurrency(
                                  booking.total_amount
                                )}
                              </strong>

                              <span>
                                Paid{" "}
                                {formatCurrency(
                                  booking.amount_paid
                                )}
                              </span>
                            </div>
                          </td>


                          <td>
                            <span
                              className={getPaymentClass(
                                booking.payment_status
                              )}
                            >
                              {formatPaymentStatus(
                                booking.payment_status
                              )}
                            </span>
                          </td>


                          <td>
                            <span
                              className={getStatusClass(
                                booking.booking_status
                              )}
                            >
                              {formatStatus(
                                booking.booking_status
                              )}
                            </span>
                          </td>


                          <td>
                            <div className="booking-actions">

                              <button
                                type="button"
                                className="booking-action-button booking-action-button--view"
                                onClick={() =>
                                  void openViewBooking(
                                    booking.booking_id
                                  )
                                }
                                title="View booking"
                                aria-label={`View ${booking.booking_code}`}
                              >
                                <IcoEye />
                              </button>


                              {canEdit && (
                                <button
                                  type="button"
                                  className="booking-action-button booking-action-button--edit"
                                  onClick={() =>
                                    openEditBooking(
                                      booking
                                    )
                                  }
                                  title="Edit booking"
                                  aria-label={`Edit ${booking.booking_code}`}
                                >
                                  <IcoEdit />
                                </button>
                              )}


                              {canCancel && (
                                <button
                                  type="button"
                                  className="booking-action-button booking-action-button--cancel"
                                  onClick={() =>
                                    requestAction(
                                      "cancel",
                                      booking
                                    )
                                  }
                                  title="Cancel booking"
                                  aria-label={`Cancel ${booking.booking_code}`}
                                >
                                  <IcoCancel />
                                </button>
                              )}


                              {canDelete && (
                                <button
                                  type="button"
                                  className="booking-action-button booking-action-button--delete"
                                  onClick={() =>
                                    requestAction(
                                      "delete",
                                      booking
                                    )
                                  }
                                  title="Delete pending booking"
                                  aria-label={`Delete ${booking.booking_code}`}
                                >
                                  <IcoTrash />
                                </button>
                              )}

                            </div>
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>


            {/* ==================================================
                PAGINATION
            ================================================== */}

            <div className="bookings-pagination">

              <span>
                Showing{" "}
                {(
                  page -
                  1
                ) *
                  PER_PAGE +
                  1}
                {" – "}
                {Math.min(
                  page *
                    PER_PAGE,
                  filteredBookings.length
                )}
                {" of "}
                {filteredBookings.length}
              </span>


              <div className="bookings-pagination-actions">

                <button
                  type="button"
                  className="booking-page-button"
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current -
                            1
                        )
                    )
                  }
                  disabled={
                    page === 1
                  }
                  aria-label="Previous page"
                >
                  <IcoChevL />
                </button>


                {Array.from(
                  {
                    length:
                      totalPages,
                  },
                  (
                    _,
                    index
                  ) =>
                    index + 1
                )
                  .filter(
                    (pageNumber) =>
                      pageNumber ===
                        1 ||
                      pageNumber ===
                        totalPages ||
                      Math.abs(
                        pageNumber -
                          page
                      ) <= 1
                  )
                  .map(
                    (
                      pageNumber,
                      index,
                      visiblePages
                    ) => {
                      const previous =
                        visiblePages[
                          index -
                            1
                        ];

                      return (
                        <React.Fragment
                          key={
                            pageNumber
                          }
                        >
                          {previous &&
                            pageNumber -
                              previous >
                              1 && (
                              <span className="booking-pagination-ellipsis">
                                …
                              </span>
                            )}

                          <button
                            type="button"
                            className={
                              pageNumber ===
                              page
                                ? "booking-page-button active"
                                : "booking-page-button"
                            }
                            onClick={() =>
                              setPage(
                                pageNumber
                              )
                            }
                          >
                            {pageNumber}
                          </button>
                        </React.Fragment>
                      );
                    }
                  )}


                <button
                  type="button"
                  className="booking-page-button"
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.min(
                          totalPages,
                          current +
                            1
                        )
                    )
                  }
                  disabled={
                    page ===
                    totalPages
                  }
                  aria-label="Next page"
                >
                  <IcoChevR />
                </button>

              </div>

            </div>
          </>
        )}

      </div>


      {/* ======================================================
          MODALS
      ====================================================== */}

      <BookingViewDialog
        booking={
          viewBooking
        }
        loading={
          viewLoading
        }
        error={
          viewError
        }
        onClose={
          closeViewBooking
        }
      />


      <BookingActionDialog
        action={
          action
        }
        processing={
          actionProcessing
        }
        error={
          actionError
        }
        onClose={
          closeAction
        }
        onConfirm={() =>
          void confirmAction()
        }
      />

    </div>
  );
}


export default Bookings;