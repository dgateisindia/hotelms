import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiClient from "../../services/apiClient";
import ExtendStayDialog from "./components/ExtendStayDialog";
import CollectPaymentDialog from "./components/CollectPaymentDialog";
import NoShowRefundDialog from "./components/NoShowRefundDialog";
import CancellationDialog from "./components/CancellationDialog";
import FinancialSettlementReviewDialog from "./components/FinancialSettlementReviewDialog";
import ManageGuestsDialog from "./components/ManageGuestsDialog";
import AppAlert from "../../components/common/AppAlert";

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
  {
    value: "no_show",
    label: "No Show",
  },
  {
    value: "expired",
    label: "Expired",
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
    no_show: "No Show",
    expired: "Expired",
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
    review_required: "Review Required",
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

function formatFinancialChargeRule(
  booking
) {
  const method =
    normalizeText(
      booking
        ?.financial_charge_method
    );


  const value =
    Number(
      booking
        ?.financial_charge_value ||
      0
    );


  switch (method) {
    case "percentage":
      return `${value}%`;

    case "fixed_amount":
      return formatCurrency(
        value
      );

    case "night_count":
      return `${value} ${
        value === 1
          ? "night"
          : "nights"
      }`;

    case "actual_nights":
      return "Actual nights";

    case "full_booking":
      return "Full booking amount";

    case "percentage_of_remaining":
      return `${value}% of remaining amount`;

    case "none":
      return "No charge";

    case "manual":
      return "Manual review";

    default:
      return "Pending review";
  }
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
  const startPart =
    String(
      checkIn || ""
    ).slice(
      0,
      10
    );

  const endPart =
    String(
      checkOut || ""
    ).slice(
      0,
      10
    );


  const startMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      startPart
    );

  const endMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      endPart
    );


  if (
    !startMatch ||
    !endMatch
  ) {
    return 0;
  }


  const start =
    Date.UTC(
      Number(startMatch[1]),
      Number(startMatch[2]) - 1,
      Number(startMatch[3])
    );

  const end =
    Date.UTC(
      Number(endMatch[1]),
      Number(endMatch[2]) - 1,
      Number(endMatch[3])
    );


  if (
    end <= start
  ) {
    return 0;
  }


  return Math.round(
    (
      end -
      start
    ) /
    (
      1000 *
      60 *
      60 *
      24
    )
  );
}


function calculateStayMinutes(
  checkIn,
  checkOut
) {
  const start =
    new Date(
      checkIn
    );

  const end =
    new Date(
      checkOut
    );


  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    ) ||
    end <= start
  ) {
    return 0;
  }


  return (
    end.getTime() -
    start.getTime()
  ) / (
    60 *
    1000
  );
}


function formatStayDuration(
  minutes
) {
  const total =
    Number(
      minutes || 0
    );


  if (
    !Number.isFinite(
      total
    ) ||
    total <= 0
  ) {
    return "—";
  }


  const hours =
    Math.floor(
      total / 60
    );

  const mins =
    Math.round(
      total % 60
    );


  if (!mins) {
    return `${hours} hr${
      hours === 1
        ? ""
        : "s"
    }`;
  }


  return `${hours} hr${
    hours === 1
      ? ""
      : "s"
  } ${mins} min`;
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


function getNextDateValue(
  value
) {
  const datePart =
    String(
      value || ""
    ).slice(
      0,
      10
    );


  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      datePart
    );


  if (!match) {
    return "";
  }


  const date =
    new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      )
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  date.setUTCDate(
    date.getUTCDate() + 1
  );


  return date
    .toISOString()
    .slice(
      0,
      10
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

  const isCheckout =
    action.type === "checkout";

  let title =
    "Booking Action";

  let description =
    null;

  let buttonLabel =
    "Confirm";

  let buttonClass =
    "booking-btn-primary";

  if (isDelete) {
    title =
      "Delete Pending Booking?";

    buttonLabel =
      "Delete Booking";

    buttonClass =
      "booking-btn-danger";

    description = (
      <>
        Booking{" "}
        <strong>
          {action.booking.booking_code}
        </strong>{" "}
        will be permanently removed only if it has no
        payment or QR history.
      </>
    );
  } else if (isCheckout) {
    title =
      "Checkout Guest?";

    buttonLabel =
      "Checkout Guest";

    description = (
      <>
        Guest{" "}
        <strong>
          {action.booking.full_name ||
            "Guest"}
        </strong>{" "}
        will be checked out from Room{" "}
        <strong>
          {action.booking.room_number ||
            "—"}
        </strong>.
        The stay will be completed and the room will move
        to Cleaning status.
      </>
    );
  }

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
            : <IcoCheck />}
        </div>

        <h3 id="booking-action-title">
          {title}
        </h3>

        <p>{description}</p>

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
            {isCheckout
              ? "Not Now"
              : "Keep Booking"}
          </button>

          <button
            type="button"
            className={buttonClass}
            onClick={onConfirm}
            disabled={processing}
          >
            {processing
              ? "Processing..."
              : buttonLabel}
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

  const status =
    normalizeText(
      booking?.booking_status
    );

  const isNoShow =
    status === "no_show";

  const isCancellation =
    status === "cancelled";

  const isLifecycleSettlement =
    isNoShow ||
    isCancellation;

  const settlementLabel =
    isCancellation
      ? "Cancellation"
      : "No Show";


  const financialReviewRequired =
    Number(
      booking
        ?.financial_review_required ||
      0
    ) === 1;

  const grossPaidAmount = Number(
    booking?.gross_paid || 0
  );

  const refundedAmount = Number(
    booking?.refunded_amount || 0
  );

  const netPaidAmount = Number(
    booking?.amount_paid || 0
  );

  const hasRefund =
    refundedAmount > 0.009;

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

              <h4>Reservation Contact</h4>

              <div className="booking-detail-row">
                <span>Contact Name</span>
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
                <span>
                  Stay Type
                </span>

                <strong>
                  {booking.stay_type ===
                    "day_use"
                    ? "Day Use / Short Stay"
                    : "Overnight Stay"}
                </strong>
              </div>


              <div className="booking-detail-row">
                <span>
                  Check In
                </span>

                <strong>
                  {booking.stay_type ===
                    "day_use"
                    ? formatDateTime(
                        booking.check_in
                      )
                    : formatDate(
                        booking.check_in
                      )}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>
                  {booking.stay_type ===
                    "day_use"
                    ? "Check Out"
                    : "Expected Check Out"}
                </span>

                <strong>
                  {booking.stay_type ===
                    "day_use"
                    ? formatDateTime(
                        booking.check_out
                      )
                    : formatDate(
                        booking.check_out
                      )}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>
                  {booking.stay_type ===
                    "day_use"
                    ? "Stay Duration"
                    : "Nights"}
                </span>

                <strong>
                  {booking.stay_type ===
                    "day_use"
                    ? formatStayDuration(
                        calculateStayMinutes(
                          booking.check_in,
                          booking.check_out
                        )
                      )
                    : calculateNights(
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
                <span>
                  {isLifecycleSettlement
                    ? "Original Booking Amount"
                    : "Booking Amount"}
                </span>

                <strong>
                  {formatCurrency(
                    booking.total_amount
                  )}
                </strong>
              </div>

              {isLifecycleSettlement && (
                <>
                  <div className="booking-detail-row">
                    <span>
                      {settlementLabel} Charge
                    </span>

                    <strong>
                      {formatFinancialChargeRule(
                        booking
                      )}
                    </strong>
                  </div>

                  <div className="booking-detail-row">
                    <span>
                      Final Payable
                    </span>

                    <strong>
                      {financialReviewRequired
                        ? "Pending Review"
                        : formatCurrency(
                            booking.final_payable_amount
                          )}
                    </strong>
                  </div>

                  {financialReviewRequired && (
                    <div className="booking-detail-row">
                      <span>
                        Financial Review
                      </span>

                      <strong>
                        Required
                      </strong>
                    </div>
                  )}
                </>
              )}

              {hasRefund ? (
                <>
                  <div className="booking-detail-row">
                    <span>Gross Paid</span>

                    <strong>
                      {formatCurrency(
                        grossPaidAmount
                      )}
                    </strong>
                  </div>

                  <div className="booking-detail-row">
                    <span>Refunded</span>

                    <strong>
                      -{formatCurrency(
                        refundedAmount
                      )}
                    </strong>
                  </div>

                  <div className="booking-detail-row">
                    <span>Net Paid</span>

                    <strong>
                      {formatCurrency(
                        netPaidAmount
                      )}
                    </strong>
                  </div>
                </>
              ) : (
                <div className="booking-detail-row">
                  <span>Amount Paid</span>

                  <strong>
                    {formatCurrency(
                      netPaidAmount
                    )}
                  </strong>
                </div>
              )}

              <div className="booking-detail-row">
                <span>Outstanding</span>

                <strong>
                  {financialReviewRequired
                    ? "Pending Review"
                    : formatCurrency(
                        booking
                          .outstanding_amount
                      )}
                </strong>
              </div>

              {isLifecycleSettlement &&
                !financialReviewRequired &&
                Number(
                  booking.overpaid_amount || 0
                ) > 0.009 && (
                  <div className="booking-detail-row">
                    <span>Refund Due</span>

                    <strong>
                      {formatCurrency(
                        booking.overpaid_amount
                      )}
                    </strong>
                  </div>
                )}

              <div className="booking-detail-row">
                <span>Created On</span>
                <strong>
                  {formatDateTime(
                    booking.created_at
                  )}
                </strong>
              </div>

            </section>
            
            {isCancellation && (
              <section className="booking-detail-section">
                <h4>
                  Cancellation Details
                </h4>

                <div className="booking-detail-row">
                  <span>Source</span>

                  <strong>
                    {booking.cancellation_source ===
                    "hotel"
                      ? "Hotel Initiated"
                      : "Customer Requested"}
                  </strong>
                </div>

                <div className="booking-detail-row">
                  <span>
                    Cancelled On
                  </span>

                  <strong>
                    {formatDateTime(
                      booking.cancelled_at
                    )}
                  </strong>
                </div>

                <div className="booking-detail-row">
                  <span>Reason</span>

                  <strong>
                    {booking.cancellation_reason ||
                      "—"}
                  </strong>
                </div>
              </section>
            )}

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

              <h4>Payment & Refund History</h4>

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
                    (payment) => {
                      const isRefund =
                        normalizeText(
                          payment.transaction_type
                        ) === "refund";

                      const transactionLabel =
                        isRefund
                          ? "Refund"
                          : "Payment";

                      return (
                        <div
                          className="booking-payment-history-row"
                          key={payment.payment_id}
                        >
                          <div>
                            <span
                              className={
                                isRefund
                                  ? "booking-payment booking-payment--partial"
                                  : "booking-payment booking-payment--paid"
                              }
                            >
                              {transactionLabel}
                            </span>

                            <strong>
                              {isRefund ? "-" : "+"}
                              {formatCurrency(
                                payment.amount
                              )}
                            </strong>

                            <span>
                              {String(
                                payment.payment_method ||
                                  "—"
                              )
                                .replaceAll("_", " ")}
                            </span>
                          </div>

                          <div>
                            <strong>
                              {normalizeText(
                                payment.payment_status
                              ) === "success"
                                ? "Success"
                                : formatPaymentStatus(
                                    payment.payment_status
                                  )}
                            </strong>

                            <span>
                              {formatDateTime(
                                payment.payment_date
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    }
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

  const [manageGuestsBooking, setManageGuestsBooking] = useState(null);

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

  const [
    cancellationBooking,
    setCancellationBooking,
  ] = useState(null);

  const [
    cancellationSource,
    setCancellationSource,
  ] = useState("customer");

  const [
    cancellationReason,
    setCancellationReason,
  ] = useState("");

  const [
    cancellationProcessing,
    setCancellationProcessing,
  ] = useState(false);

  const [
    cancellationError,
    setCancellationError,
  ] = useState("");

  const [
    cancellationSuccess,
    setCancellationSuccess,
  ] = useState("");

  const [financialReviewBooking, setFinancialReviewBooking] = useState(null);
  const [financialReviewData, setFinancialReviewData] = useState(null);
  const [financialReviewFinalPayable, setFinancialReviewFinalPayable] = useState("");
  const [financialReviewNotes, setFinancialReviewNotes] = useState("");
  const [financialReviewLoading, setFinancialReviewLoading] = useState(false);
  const [financialReviewProcessing, setFinancialReviewProcessing] = useState(false);
  const [financialReviewError, setFinancialReviewError] = useState("");
  const [financialReviewSuccess, setFinancialReviewSuccess] = useState("");

  const [
    extendBooking,
    setExtendBooking,
  ] = useState(null);

  const [
    extendNewCheckOut,
    setExtendNewCheckOut,
  ] = useState("");

  const [
    extendReason,
    setExtendReason,
  ] = useState(
    "guest_request"
  );

  const [
    extendProcessing,
    setExtendProcessing,
  ] = useState(false);

  const [
    extendError,
    setExtendError,
  ] = useState("");

    const [
    paymentBooking,
    setPaymentBooking,
  ] = useState(null);

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("cash");

  const [
    paymentTransactionId,
    setPaymentTransactionId,
  ] = useState("");

  const [
    paymentNotes,
    setPaymentNotes,
  ] = useState("");

  const [
    paymentProcessing,
    setPaymentProcessing,
  ] = useState(false);

  const [
    paymentError,
    setPaymentError,
  ] = useState("");

  const [refundBooking, setRefundBooking] = useState(null);
  const [refundMethod, setRefundMethod] = useState("cash");
  const [refundTransactionId, setRefundTransactionId] = useState("");
  const [refundNotes, setRefundNotes] = useState("");
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refundSuccess, setRefundSuccess] = useState("");

  const [editOpeningId, setEditOpeningId] = useState(null);
  const [editGuardMessage, setEditGuardMessage] = useState("");

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
                booking.group_code,
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


  async function openEditBooking(
    booking
  ) {
    const bookingId =
      Number(
        booking?.booking_id
      );

    if (
      !Number.isSafeInteger(
        bookingId
      ) ||
      bookingId <= 0
    ) {
      setEditGuardMessage(
        "This booking could not be opened for editing."
      );

      return;
    }

    if (editOpeningId) {
      return;
    }

    setEditOpeningId(
      bookingId
    );

    setEditGuardMessage("");

    try {
      /*
      * GET /bookings/:id also performs the authoritative
      * lifecycle reconciliation on the backend.
      *
      * Therefore we must verify the latest booking status
      * before opening Booking Desk.
      */
      const response =
        await apiClient.get(
          `/bookings/${bookingId}`
        );

      const latestBooking =
        response.data || {};

      const latestStatus =
        normalizeText(
          latestBooking.booking_status
        );

      if (
        latestStatus !== "pending" &&
        latestStatus !== "confirmed"
      ) {
        await loadBookings();

        setEditGuardMessage(
          latestStatus === "no_show"
            ? `${booking.booking_code} is now No Show and can no longer be edited as an active reservation. The booking list has been refreshed.`
            : latestStatus === "expired"
              ? `${booking.booking_code} has expired and can no longer be edited. The booking list has been refreshed.`
              : `${booking.booking_code} is now ${formatStatus(
                  latestStatus
                )} and can no longer be edited through normal Edit.`
        );

        return;
      }

      navigate(
        `/booking-desk?edit=${bookingId}`
      );
    } catch (requestError) {
      /*
      * Never open Edit when the latest booking state
      * could not be verified.
      */
      setEditGuardMessage(
        getApiMessage(
          requestError,
          "The latest booking status could not be verified. Please try again."
        )
      );

      await loadBookings();
    } finally {
      setEditOpeningId(
        null
      );
    }
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

  function openManageGuests(booking) {
    setManageGuestsBooking(booking);
  }

  function closeManageGuests() {
    setManageGuestsBooking(null);
  }

  /* ==========================================================
    CANCELLATION
  ========================================================== */

  function openCancellation(
    booking
  ) {
    setCancellationBooking(
      booking
    );

    setCancellationSource(
      "customer"
    );

    setCancellationReason(
      ""
    );

    setCancellationError(
      ""
    );
  }

  function closeCancellation() {
    if (
      cancellationProcessing
    ) {
      return;
    }

    setCancellationBooking(
      null
    );

    setCancellationSource(
      "customer"
    );

    setCancellationReason(
      ""
    );

    setCancellationError(
      ""
    );
  }

  async function confirmCancellation() {
    if (!cancellationBooking) {
      return;
    }

    setCancellationProcessing(
      true
    );

    setCancellationError(
      ""
    );

    setCancellationSuccess(
      ""
    );

    try {
      const response =
        await apiClient.put(
          `/bookings/${cancellationBooking.booking_id}/cancel`,
          {
            cancellation_source:
              cancellationSource,

            cancellation_reason:
              cancellationReason
                .trim() ||
              null,
          }
        );

      setCancellationBooking(
        null
      );

      setCancellationSource(
        "customer"
      );

      setCancellationReason(
        ""
      );

      setCancellationError(
        ""
      );

      setCancellationSuccess(
        response.data?.message ||
          "Booking cancelled successfully."
      );

      await loadBookings();
    } catch (
      cancellationRequestError
    ) {
      setCancellationError(
        getApiMessage(
          cancellationRequestError,
          "The booking could not be cancelled."
        )
      );
    } finally {
      setCancellationProcessing(
        false
      );
    }
  }

  /* ==========================================================
    FINANCIAL SETTLEMENT REVIEW
  ========================================================== */

  async function openFinancialSettlementReview(booking) {
    setFinancialReviewBooking(booking);
    setFinancialReviewData(null);
    setFinancialReviewFinalPayable("");
    setFinancialReviewNotes("");
    setFinancialReviewError("");
    setFinancialReviewLoading(true);

    try {
      const response = await apiClient.get(
        `/bookings/${booking.booking_id}/financial-settlement-review`
      );

      const review = response.data?.data || null;

      setFinancialReviewData(review);

      setFinancialReviewFinalPayable(
        review?.final_payable_amount === null ||
        review?.final_payable_amount === undefined
          ? ""
          : String(review.final_payable_amount)
      );
    } catch (reviewLoadError) {
      setFinancialReviewError(
        getApiMessage(
          reviewLoadError,
          "The financial settlement review could not be loaded."
        )
      );
    } finally {
      setFinancialReviewLoading(false);
    }
  }

  function closeFinancialSettlementReview() {
    if (financialReviewProcessing) return;

    setFinancialReviewBooking(null);
    setFinancialReviewData(null);
    setFinancialReviewFinalPayable("");
    setFinancialReviewNotes("");
    setFinancialReviewError("");
  }

  async function confirmFinancialSettlementReview() {
    if (!financialReviewBooking || !financialReviewData) return;

    const finalPayable = Number(financialReviewFinalPayable);
    const originalTotal = Number(
      financialReviewData.original_total_amount || 0
    );
    const notes = financialReviewNotes.trim();

    if (
      !Number.isFinite(finalPayable) ||
      finalPayable < 0 ||
      finalPayable > originalTotal + 0.009
    ) {
      setFinancialReviewError(
        "Enter a valid final payable amount within the original booking amount."
      );
      return;
    }

    if (!notes) {
      setFinancialReviewError(
        "Enter review notes explaining the final settlement amount."
      );
      return;
    }

    if (notes.length > 500) {
      setFinancialReviewError(
        "Financial review notes cannot exceed 500 characters."
      );
      return;
    }

    setFinancialReviewProcessing(true);
    setFinancialReviewError("");
    setFinancialReviewSuccess("");

    try {
      const response = await apiClient.post(
        `/bookings/${financialReviewBooking.booking_id}/financial-settlement-review/finalize`,
        {
          final_payable_amount: finalPayable,
          review_notes: notes,
        }
      );

      setFinancialReviewBooking(null);
      setFinancialReviewData(null);
      setFinancialReviewFinalPayable("");
      setFinancialReviewNotes("");
      setFinancialReviewError("");

      setFinancialReviewSuccess(
        response.data?.message ||
          "Financial settlement review finalized successfully."
      );

      await loadBookings();
    } catch (reviewFinalizeError) {
      setFinancialReviewError(
        getApiMessage(
          reviewFinalizeError,
          "The financial settlement review could not be finalized."
        )
      );
    } finally {
      setFinancialReviewProcessing(false);
    }
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
      if (action.type === "checkout") {
        await apiClient.post(
          `/bookings/${action.booking.booking_id}/checkout`
        );
      } else if (action.type === "delete") {
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
    EXTEND STAY
  ========================================================== */

  function openExtendStay(
    booking
  ) {
    setExtendBooking(
      booking
    );

    setExtendNewCheckOut(
      getNextDateValue(
        booking.check_out
      )
    );

    setExtendReason(
      "guest_request"
    );

    setExtendError("");
  }


  function closeExtendStay() {
    if (
      extendProcessing
    ) {
      return;
    }

    setExtendBooking(null);
    setExtendNewCheckOut("");
    setExtendReason(
      "guest_request"
    );
    setExtendError("");
  }


  async function confirmExtendStay() {
    if (
      !extendBooking ||
      !extendNewCheckOut
    ) {
      return;
    }


    setExtendProcessing(true);
    setExtendError("");


    try {
      await apiClient.post(
        `/bookings/${extendBooking.booking_id}/extend-stay`,
        {
          new_check_out:
            extendNewCheckOut,

          reason:
            extendReason,
        }
      );


      setExtendBooking(null);
      setExtendNewCheckOut("");
      setExtendReason(
        "guest_request"
      );

      await loadBookings();
    } catch (extendRequestError) {
      setExtendError(
        getApiMessage(
          extendRequestError,
          "The stay could not be extended."
        )
      );
    } finally {
      setExtendProcessing(false);
    }
  }

    /* ==========================================================
     COLLECT PAYMENT
  ========================================================== */

  function openCollectPayment(
    booking
  ) {
    const outstanding =
      Number(
        booking
          .outstanding_amount ||
        0
      );


    setPaymentBooking(
      booking
    );

    setPaymentAmount(
      outstanding > 0
        ? outstanding.toFixed(2)
        : ""
    );

    setPaymentMethod(
      "cash"
    );

    setPaymentTransactionId(
      ""
    );

    setPaymentNotes(
      ""
    );

    setPaymentError(
      ""
    );
  }


  function closeCollectPayment() {
    if (
      paymentProcessing
    ) {
      return;
    }


    setPaymentBooking(
      null
    );

    setPaymentAmount(
      ""
    );

    setPaymentMethod(
      "cash"
    );

    setPaymentTransactionId(
      ""
    );

    setPaymentNotes(
      ""
    );

    setPaymentError(
      ""
    );
  }


  async function confirmCollectPayment() {
    if (!paymentBooking) {
      return;
    }


    const amount =
      Number(
        paymentAmount
      );


    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      setPaymentError(
        "Enter a valid payment amount."
      );

      return;
    }


    const outstanding =
      Number(
        paymentBooking
          .outstanding_amount ||
        0
      );


    setPaymentProcessing(
      true
    );

    setPaymentError(
      ""
    );


    try {
      await apiClient.post(
        `/bookings/${paymentBooking.booking_id}/payments`,
        {
          amount,

          payment_method:
            paymentMethod,

          payment_stage:
            [
              "no_show",
              "cancelled",
            ].includes(
              normalizeText(
                paymentBooking.booking_status
              )
            )
              ? "other"
              : amount + 0.009 >=
                  outstanding
                ? "checkout"
                : "during_stay",

          transaction_id:
            paymentMethod ===
              "cash"
              ? null
              : paymentTransactionId
                  .trim(),

          notes:
            paymentNotes
              .trim() ||
            null,
        }
      );


      setPaymentBooking(
        null
      );

      setPaymentAmount(
        ""
      );

      setPaymentMethod(
        "cash"
      );

      setPaymentTransactionId(
        ""
      );

      setPaymentNotes(
        ""
      );


      await loadBookings();
    } catch (
      paymentRequestError
    ) {
      setPaymentError(
        getApiMessage(
          paymentRequestError,
          "The payment could not be recorded."
        )
      );
    } finally {
      setPaymentProcessing(
        false
      );
    }
  }

  /* ==========================================================
    LIFECYCLE SETTLEMENT REFUND
  ========================================================== */

  function openLifecycleRefund(
    booking
  ) {
    setRefundBooking(
      booking
    );

    setRefundMethod(
      "cash"
    );

    setRefundTransactionId(
      ""
    );

    setRefundNotes(
      ""
    );

    setRefundError(
      ""
    );
  }

  function closeLifecycleRefund() {
    if (refundProcessing) {
      return;
    }

    setRefundBooking(
      null
    );

    setRefundMethod(
      "cash"
    );

    setRefundTransactionId(
      ""
    );

    setRefundNotes(
      ""
    );

    setRefundError(
      ""
    );
  }

  async function confirmLifecycleRefund() {
    if (!refundBooking) {
      return;
    }

    const status =
      normalizeText(
        refundBooking.booking_status
      );

    const refundPath =
      status === "cancelled"
        ? "cancellation-refund"
        : status === "no_show"
          ? "no-show-refund"
          : null;

    if (!refundPath) {
      setRefundError(
        "This booking is not eligible for a lifecycle settlement refund."
      );
      return;
    }

    const transactionId =
      refundTransactionId.trim();

    if (
      refundMethod !== "cash" &&
      !transactionId
    ) {
      setRefundError(
        "Transaction ID is required for non-cash refunds."
      );
      return;
    }

    setRefundProcessing(true);
    setRefundError("");
    setRefundSuccess("");

    try {
      const response =
        await apiClient.post(
          `/bookings/${refundBooking.booking_id}/${refundPath}`,
          {
            refund_method:
              refundMethod,

            transaction_id:
              refundMethod === "cash"
                ? null
                : transactionId,

            notes:
              refundNotes.trim() ||
              null,
          }
        );

      setRefundBooking(null);
      setRefundMethod("cash");
      setRefundTransactionId("");
      setRefundNotes("");
      setRefundError("");

      setRefundSuccess(
        response.data?.message ||
          (
            status === "cancelled"
              ? "Cancellation refund processed successfully."
              : "No Show refund processed successfully."
          )
      );

      await loadBookings();
    } catch (requestError) {
      setRefundError(
        getApiMessage(
          requestError,
          status === "cancelled"
            ? "The cancellation refund could not be processed."
            : "The No Show refund could not be processed."
        )
      );
    } finally {
      setRefundProcessing(false);
    }
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="bookings-page">

      <AppAlert
        type="success"
        message={refundSuccess}
        onClose={() =>
          setRefundSuccess("")
        }
      />

      <AppAlert
        type="success"
        message={cancellationSuccess}
        onClose={() =>
          setCancellationSuccess("")
        }
      />

      <AppAlert
        type="success"
        message={financialReviewSuccess}
        onClose={() =>
          setFinancialReviewSuccess("")
        }
      />

      <AppAlert
        type="error"
        message={editGuardMessage}
        autoClose
        duration={6000}
        onClose={() =>
          setEditGuardMessage("")
        }
      />

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
              placeholder="Search booking, contact, phone or room..."
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
                    <th>Booking</th>
                    <th>Contact</th>
                    <th>Room</th>
                    <th>Stay</th>
                    <th>Occupancy</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>

                  {paginatedBookings.map(
                    (booking) => {
                      const status = normalizeText(
                        booking.booking_status
                      );

                      const groupRoomCount = Math.max(
                        1,
                        Number(booking.group_booking_count || 1)
                      );

                      const hasReservationGroup =
                        Number(booking.reservation_group_id) > 0 &&
                        Boolean(booking.group_code);

                      const canEdit =
                        status === "pending" ||
                        status === "confirmed";

                      const canCancel =
                        status ===
                          "pending" ||
                        status ===
                          "confirmed";

                      const canDelete =
                        status ===
                        "pending";

                      const canManageGuests =
                        status === "confirmed" || status === "checked_in";

                      const outstandingAmount =
                        Number(
                          booking.outstanding_amount ||
                          0
                        );

                      const financialReviewRequired =
                        Number(
                          booking
                            .financial_review_required ||
                          0
                        ) === 1;

                      const overpaidAmount =
                        Number(
                          booking.overpaid_amount || 0
                        );

                      const isLifecycleSettlement =
                        status === "no_show" ||
                        status === "cancelled";

                      const canReviewFinancialSettlement =
                        isLifecycleSettlement &&
                        financialReviewRequired;

                      const canRefundLifecycle =
                        isLifecycleSettlement &&
                        !financialReviewRequired &&
                        overpaidAmount > 0.009;

                      const canCollectPayment =
                        (
                          status === "checked_in" ||
                          (
                            isLifecycleSettlement &&
                            !financialReviewRequired
                          )
                        ) &&
                        outstandingAmount > 0.009;

                      const canExtendStay =
                        status ===
                          "checked_in" &&
                        booking.stay_type !==
                          "day_use";

                      const canCheckout =
                        status ===
                          "checked_in" &&
                        outstandingAmount <=
                          0.009;

                      const checkedInGuests = Number(
                        booking.checked_in_guest_count || 0
                      );

                      const expectedGuests = Number(
                        booking.expected_guest_count || 0
                      );

                      const roomCapacity = Number(
                        booking.capacity || 0
                      );

                      const stayDuration =
                        booking.stay_type === "day_use"
                          ? `Day Use · ${formatStayDuration(
                              calculateStayMinutes(
                                booking.check_in,
                                booking.check_out
                              )
                            )}`
                          : `${calculateNights(
                              booking.check_in,
                              booking.check_out
                            )} night${
                              calculateNights(
                                booking.check_in,
                                booking.check_out
                              ) === 1
                                ? ""
                                : "s"
                            }`;

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

                              {hasReservationGroup && (
                                <button
                                  type="button"
                                  className="booking-clear-filters"
                                  onClick={() =>
                                    navigate(
                                      `/bookings/groups/${booking.reservation_group_id}`
                                    )
                                  }
                                  title={`Open reservation ${booking.group_code}`}
                                >
                                  {booking.group_code}
                                  {" · "}
                                  {groupRoomCount}
                                  {groupRoomCount === 1 ? " room" : " rooms"}
                                </button>
                              )}

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
                            <div className="booking-room-cell">
                              <strong>{stayDuration}</strong>

                              <span>
                                In · {formatDateTime(booking.check_in)}
                              </span>

                              <span>
                                Out · {formatDateTime(booking.check_out)}
                              </span>
                            </div>
                          </td>
                          
                          <td>
                            <div className="booking-room-cell">
                              <strong>
                                {checkedInGuests} / {roomCapacity || "—"} staying
                              </strong>

                              <span>
                                {expectedGuests} expected
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="booking-amount-cell">
                              <strong>
                                {formatCurrency(
                                  booking.total_amount
                                )}
                              </strong>

                              <span>
                                {Number(
                                  booking.refunded_amount || 0
                                ) > 0.009
                                  ? `Net ${formatCurrency(
                                      booking.amount_paid
                                    )} · Refunded ${formatCurrency(
                                      booking.refunded_amount
                                    )}`
                                  : `Paid ${formatCurrency(
                                      booking.amount_paid
                                    )}`}
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

                              {canReviewFinancialSettlement && (
                                <button
                                  type="button"
                                  className="booking-action-button booking-action-button--edit"
                                  onClick={() =>
                                    void openFinancialSettlementReview(booking)
                                  }
                                  title="Review financial settlement"
                                  aria-label={`Review financial settlement for ${booking.booking_code}`}
                                >
                                  <IcoWarn />
                                </button>
                              )}
                              
                              {canManageGuests && (
                                <button
                                  type="button"
                                  className="booking-action-button booking-action-button--edit"
                                  onClick={() => openManageGuests(booking)}
                                  title="Manage guests / check-in"
                                  aria-label={`Manage guests for ${booking.booking_code}`}
                                >
                                  <IcoCheck />
                                </button>
                              )}

                              {canCollectPayment && (
                                <button
                                  type="button"
                                  className="booking-action-button booking-action-button--edit"
                                  onClick={() =>
                                    openCollectPayment(
                                      booking
                                    )
                                  }
                                  title="Collect payment"
                                  aria-label={`Collect payment for ${booking.booking_code}`}
                                >
                                  <IcoRupee />
                                </button>
                              )}

                              {canRefundLifecycle && (
                                <button
                                  type="button"
                                  className="booking-action-button booking-action-button--cancel"
                                  onClick={() =>
                                    openLifecycleRefund(
                                      booking
                                    )
                                  }
                                  title={`Refund ${formatCurrency(
                                    overpaidAmount
                                  )} ${
                                    status === "cancelled"
                                      ? "Cancellation"
                                      : "No-Show"
                                  } overpayment`}
                                  aria-label={`Refund ${
                                    status === "cancelled"
                                      ? "Cancellation"
                                      : "No Show"
                                  } overpayment for ${booking.booking_code}`}
                                >
                                  <IcoRupee />
                                </button>
                              )}

                              {canExtendStay && (
                                <button
                                  type="button"
                                  className="booking-action-button booking-action-button--edit"
                                  onClick={() =>
                                    openExtendStay(
                                      booking
                                    )
                                  }
                                  title="Extend stay"
                                  aria-label={`Extend stay for ${booking.booking_code}`}
                                >
                                  <IcoClock />
                                </button>
                              )}

                              {canCheckout && (
                                <button
                                  type="button"
                                  className="booking-action-button booking-action-button--edit"
                                  onClick={() =>
                                    requestAction(
                                      "checkout",
                                      booking
                                    )
                                  }
                                  title="Checkout guest"
                                  aria-label={`Checkout ${booking.booking_code}`}
                                >
                                  <IcoCheck />
                                </button>
                              )}

                              {canEdit && (
                                <button
                                  type="button"
                                  className="booking-action-button booking-action-button--edit"
                                  disabled={
                                    Number(editOpeningId) ===
                                    Number(booking.booking_id)
                                  }
                                  aria-busy={
                                    Number(editOpeningId) ===
                                    Number(booking.booking_id)
                                  }
                                  onClick={() =>
                                    void openEditBooking(
                                      booking
                                    )
                                  }
                                  title={
                                    Number(editOpeningId) ===
                                    Number(booking.booking_id)
                                      ? "Checking latest booking status..."
                                      : "Edit booking"
                                  }
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
                                    openCancellation(
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
        booking={viewBooking}
        loading={viewLoading}
        error={viewError}
        onClose={closeViewBooking}
      />

      <ManageGuestsDialog
        booking={manageGuestsBooking}
        onClose={closeManageGuests}
        onChanged={() => void loadBookings()}
      />

      <BookingActionDialog
        action={action}
        processing={actionProcessing}
        error={actionError}
        onClose={closeAction}
        onConfirm={() => void confirmAction()}
      />

      <CancellationDialog
        booking={
          cancellationBooking
        }
        source={
          cancellationSource
        }
        reason={
          cancellationReason
        }
        processing={
          cancellationProcessing
        }
        error={
          cancellationError
        }
        onChangeSource={
          setCancellationSource
        }
        onChangeReason={
          setCancellationReason
        }
        onClose={
          closeCancellation
        }
        onConfirm={() =>
          void confirmCancellation()
        }
      />

      <FinancialSettlementReviewDialog
        booking={financialReviewBooking}
        review={financialReviewData}
        finalPayable={financialReviewFinalPayable}
        reviewNotes={financialReviewNotes}
        loading={financialReviewLoading}
        processing={financialReviewProcessing}
        error={financialReviewError}
        onChangeFinalPayable={setFinancialReviewFinalPayable}
        onChangeReviewNotes={setFinancialReviewNotes}
        onClose={closeFinancialSettlementReview}
        onConfirm={() =>
          void confirmFinancialSettlementReview()
        }
      />

      <ExtendStayDialog
        booking={
          extendBooking
        }
        newCheckOut={
          extendNewCheckOut
        }
        minCheckOut={
          extendBooking
            ? getNextDateValue(
                extendBooking.check_out
              )
            : ""
        }
        reason={
          extendReason
        }
        processing={
          extendProcessing
        }
        error={
          extendError
        }
        onChangeCheckOut={
          setExtendNewCheckOut
        }
        onChangeReason={
          setExtendReason
        }
        onClose={
          closeExtendStay
        }
        onConfirm={() =>
          void confirmExtendStay()
        }
      />

      <CollectPaymentDialog
        booking={
          paymentBooking
        }
        amount={
          paymentAmount
        }
        method={
          paymentMethod
        }
        transactionId={
          paymentTransactionId
        }
        notes={
          paymentNotes
        }
        processing={
          paymentProcessing
        }
        error={
          paymentError
        }
        onChangeAmount={
          setPaymentAmount
        }
        onChangeMethod={
          setPaymentMethod
        }
        onChangeTransactionId={
          setPaymentTransactionId
        }
        onChangeNotes={
          setPaymentNotes
        }
        onClose={
          closeCollectPayment
        }
        onConfirm={() =>
          void confirmCollectPayment()
        }
      />

      <NoShowRefundDialog
        booking={refundBooking}

        method={refundMethod}
        transactionId={refundTransactionId}
        notes={refundNotes}

        processing={refundProcessing}
        error={refundError}

        onChangeMethod={setRefundMethod}
        onChangeTransactionId={
          setRefundTransactionId
        }
        onChangeNotes={setRefundNotes}

        onClose={
          closeLifecycleRefund
        }
        onConfirm={() =>
          void confirmLifecycleRefund()
        }
      />

    </div>
  );
}


export default Bookings;