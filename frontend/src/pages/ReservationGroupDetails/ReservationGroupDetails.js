import React, {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import apiClient from "../../services/apiClient";

import "../../styles/Bookings.css";


function formatCurrency(
  value
) {
  const amount =
    Number(value);


  if (
    !Number.isFinite(
      amount
    )
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
  ).format(
    amount
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


function formatStatus(
  value
) {
  const status =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();


  const labels = {
    pending:
      "Pending",

    confirmed:
      "Confirmed",

    checked_in:
      "Checked In",

    checked_out:
      "Checked Out",

    cancelled:
      "Cancelled",
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
    String(
      value || ""
    )
      .trim()
      .toLowerCase();


  const labels = {
    paid:
      "Paid",

    partial:
      "Partial",

    unpaid:
      "Unpaid",
  };


  return (
    labels[status] ||
    "Unknown"
  );
}


function ReservationGroupDetails() {
  const navigate =
    useNavigate();


  const {
    groupId,
  } =
    useParams();


  const [
    group,
    setGroup,
  ] = useState(
    null
  );


  const [
    loading,
    setLoading,
  ] = useState(
    true
  );


  const [
    error,
    setError,
  ] = useState(
    ""
  );


  useEffect(
    () => {
      let active =
        true;


      async function loadGroup() {
        setLoading(
          true
        );

        setError(
          ""
        );


        try {
          const response =
            await apiClient.get(
              `/bookings/groups/${groupId}`
            );


          if (!active) {
            return;
          }


          setGroup(
            response.data
              ?.data ||
            null
          );
        } catch (
          loadError
        ) {
          if (!active) {
            return;
          }


          setError(
            loadError
              ?.message ||
            "Reservation group could not be loaded."
          );
        } finally {
          if (active) {
            setLoading(
              false
            );
          }
        }
      }


      void loadGroup();


      return () => {
        active =
          false;
      };
    },
    [
      groupId,
    ]
  );


  if (
    loading
  ) {
    return (
      <div className="bookings-page">

        <div className="bookings-card">

          <div className="bookings-loading">
            Loading reservation group...
          </div>

        </div>

      </div>
    );
  }


  if (
    error ||
    !group
  ) {
    return (
      <div className="bookings-page">

        <div className="bookings-error-banner">

          <span>
            {error ||
              "Reservation group was not found."}
          </span>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/bookings"
              )
            }
          >
            Back to Bookings
          </button>

        </div>

      </div>
    );
  }


  const summary =
    group.summary ||
    {};


  const customer =
    group.customer ||
    {};


  const bookings =
    Array.isArray(
      group.bookings
    )
      ? group.bookings
      : [];

  const canAddRoom =
    bookings.some(
      (booking) =>
        [
          "pending",
          "confirmed",
          "checked_in",
        ].includes(
          String(
            booking.booking_status ||
            ""
          ).toLowerCase()
        )
    );

  return (
    <div className="bookings-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="bookings-page-header">

        <div>

          <button
            type="button"
            className="booking-clear-filters"
            onClick={() =>
              navigate(
                "/bookings"
              )
            }
          >
            ← Back to Bookings
          </button>


          <h1>
            Reservation Group{" "}
            {group.group_code}
          </h1>


          <p>
            Manage all room reservations created under this
            customer reservation.
          </p>

        </div>

        {canAddRoom && (
          <button
            type="button"
            className="booking-new-button"
            onClick={() =>
              navigate(
                `/booking-desk?group=${group.reservation_group_id}&mode=add-room`
              )
            }
          >
            + Add Room
          </button>
        )}

      </div>


      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <div className="booking-stats">

        <div className="bstat-card">

          <div className="bstat-info">

            <span className="bstat-label">
              Rooms
            </span>

            <strong className="bstat-value">
              {Number(
                summary.total_rooms ||
                0
              )}
            </strong>

            <span className="bstat-change">
              Reservation bookings
            </span>

          </div>

        </div>


        <div className="bstat-card">

          <div className="bstat-info">

            <span className="bstat-label">
              Guests
            </span>

            <strong className="bstat-value">
              {Number(
                summary.total_guests ||
                0
              )}
            </strong>

            <span className="bstat-change">
              Active reservation guests
            </span>

          </div>

        </div>


        <div className="bstat-card">

          <div className="bstat-info">

            <span className="bstat-label">
              Booking Total
            </span>

            <strong className="bstat-value">
              {formatCurrency(
                summary.booking_total
              )}
            </strong>

            <span className="bstat-change">
              Active room bookings
            </span>

          </div>

        </div>


        <div className="bstat-card">

          <div className="bstat-info">

            <span className="bstat-label">
              Balance Due
            </span>

            <strong className="bstat-value">
              {formatCurrency(
                summary.outstanding_amount
              )}
            </strong>

            <span className="bstat-change">
              Net paid{" "}
              {formatCurrency(
                summary.net_paid
              )}
            </span>

          </div>

        </div>

      </div>


      {/* ======================================================
          CUSTOMER
      ====================================================== */}

      <div className="bookings-card">

        <div className="reservation-group-info-grid">

          <section className="booking-detail-section">

            <h4>
              Primary Guest
            </h4>


            <div className="booking-detail-row">

              <span>
                Guest
              </span>

              <strong>
                {customer.full_name ||
                  "—"}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Phone
              </span>

              <strong>
                {customer.phone ||
                  "—"}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Email
              </span>

              <strong>
                {customer.email ||
                  "—"}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Nationality
              </span>

              <strong>
                {customer.nationality ||
                  "—"}
              </strong>

            </div>

          </section>


          <section className="booking-detail-section">

            <h4>
              Reservation Summary
            </h4>


            <div className="booking-detail-row">

              <span>
                Group Code
              </span>

              <strong>
                {group.group_code}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Confirmed
              </span>

              <strong>
                {Number(
                  summary.confirmed_bookings ||
                  0
                )}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Checked In
              </span>

              <strong>
                {Number(
                  summary.checked_in_bookings ||
                  0
                )}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Cancelled
              </span>

              <strong>
                {Number(
                  summary.cancelled_bookings ||
                  0
                )}
              </strong>

            </div>

          </section>

        </div>

      </div>


      {/* ======================================================
          FINANCIAL SUMMARY
      ====================================================== */}

      <div className="bookings-card">

        <div className="reservation-group-info-grid">

          <section className="booking-detail-section">

            <h4>
              Group Payment Summary
            </h4>


            <div className="booking-detail-row">

              <span>
                Gross Paid
              </span>

              <strong>
                {formatCurrency(
                  summary.gross_paid
                )}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Refunded
              </span>

              <strong>
                {formatCurrency(
                  summary.refunded_amount
                )}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Net Paid
              </span>

              <strong>
                {formatCurrency(
                  summary.net_paid
                )}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Outstanding
              </span>

              <strong>
                {formatCurrency(
                  summary.outstanding_amount
                )}
              </strong>

            </div>

          </section>


          <section className="booking-detail-section">

            <h4>
              Financial Review
            </h4>


            <div className="booking-detail-row">

              <span>
                Overpaid
              </span>

              <strong>
                {formatCurrency(
                  summary.overpaid_amount
                )}
              </strong>

            </div>


            <div className="booking-detail-row">

              <span>
                Refund Review
              </span>

              <strong>
                {summary
                  .refund_review_required
                  ? "Required"
                  : "Not Required"}
              </strong>

            </div>

          </section>

        </div>

      </div>


      {/* ======================================================
          ROOM BOOKINGS
      ====================================================== */}

      <div className="bookings-card">

        <div className="bookings-table-wrap">

          <table className="bookings-table">

            <thead>

              <tr>

                <th>
                  Booking
                </th>

                <th>
                  Room
                </th>

                <th>
                  Stay
                </th>

                <th>
                  Guests
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

              {bookings.map(
                (
                  booking
                ) => (
                  <tr
                    key={
                      booking
                        .booking_id
                    }
                  >

                    <td>

                      <div className="booking-id-cell">

                        <strong>
                          {
                            booking
                              .booking_code
                          }
                        </strong>

                        <span>
                          #
                          {
                            booking
                              .booking_id
                          }
                        </span>

                      </div>

                    </td>


                    <td>

                      <div className="booking-room-cell">

                        <strong>
                          Room{" "}
                          {
                            booking
                              .room_number ||
                            "—"
                          }
                        </strong>

                        <span>
                          {
                            booking
                              .room_type ||
                            "—"
                          }
                        </span>

                      </div>

                    </td>


                    <td>

                      <div className="booking-room-cell">

                        <strong>
                          {booking.stay_type ===
                          "day_use"
                            ? "Day Use"
                            : "Overnight"}
                        </strong>

                        <span>
                          {formatDateTime(
                            booking
                              .check_in
                          )}
                          {" → "}
                          {formatDateTime(
                            booking
                              .check_out
                          )}
                        </span>

                      </div>

                    </td>


                    <td>
                      {
                        booking
                          .total_guests
                      }
                    </td>


                    <td>

                      <div className="booking-amount-cell">

                        <strong>
                          {formatCurrency(
                            booking
                              .total_amount
                          )}
                        </strong>

                        <span>
                          Paid{" "}
                          {formatCurrency(
                            booking
                              .amount_paid
                          )}
                        </span>

                      </div>

                    </td>


                    <td>

                      <span
                        className={
                          `booking-payment booking-payment--${
                            String(
                              booking
                                .payment_status ||
                              "unpaid"
                            ).toLowerCase()
                          }`
                        }
                      >
                        {formatPaymentStatus(
                          booking
                            .payment_status
                        )}
                      </span>

                    </td>


                    <td>

                      <span
                        className={
                          `booking-status booking-status--${
                            String(
                              booking
                                .booking_status ||
                              "unknown"
                            ).toLowerCase()
                          }`
                        }
                      >
                        {formatStatus(
                          booking
                            .booking_status
                        )}
                      </span>

                    </td>


                    <td>

                      <button
                        type="button"
                        className="booking-btn-secondary"
                        onClick={() =>
                          navigate(
                            `/booking-desk?edit=${booking.booking_id}`
                          )
                        }
                        disabled={
                          ![
                            "pending",
                            "confirmed",
                          ].includes(
                            String(
                              booking
                                .booking_status ||
                              ""
                            ).toLowerCase()
                          )
                        }
                      >
                        Edit
                      </button>

                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}


export default ReservationGroupDetails;