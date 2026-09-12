import React, { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import apiClient from "../../../shared/api/apiClient";

import { formatCurrency } from "../../../shared/utils/money";

import { formatDateTime } from "../../../shared/utils/dates";
import { formatStatus, formatPaymentStatus } from "../../../shared/utils/status";

import GroupCheckInDialog from "../actions/GroupCheckInDialog";
import GroupCheckoutDialog from "../actions/GroupCheckoutDialog";
import GroupPaymentDialog from "../actions/GroupPaymentDialog";
import ManageGuestsDialog from "../guests/ManageGuestsDialog";

import { IcoEye, IcoEdit, IcoCheck } from "../../../utils/icons/BookingIcons";


import "../../../styles/Bookings.css";



function ReservationWorkspace() {
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

  const [
    expandedBookingId,
    setExpandedBookingId,
  ] = useState(
    null
  );

  const [
    manageGuestsBooking,
    setManageGuestsBooking,
  ] = useState(
    null
  );

  const [showGroupCheckIn, setShowGroupCheckIn] = useState(false);
  const [showGroupPayment, setShowGroupPayment] = useState(false);
  const [showGroupCheckout, setShowGroupCheckout] = useState(false);


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

  async function refreshGroup() {
    try {
      const response =
        await apiClient.get(
          `/bookings/groups/${groupId}`
        );

      setGroup(
        response.data?.data ||
        null
      );
    } catch {
      /*
      * ManageGuestsDialog already shows the operation result.
      * Do not destroy the current group page only because
      * this lightweight parent refresh failed.
      */
    }
  }


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

  const canGroupCheckIn =
    bookings.some(
      (booking) =>
        [
          "confirmed",
          "checked_in",
        ].includes(
          String(
            booking.booking_status ||
            ""
          )
            .trim()
            .toLowerCase()
        )
    );

  const canGroupPayment =
    bookings.some((booking) => {
      const status =
        String(
          booking.booking_status || ""
        )
          .trim()
          .toLowerCase();

      return (
        [
          "confirmed",
          "checked_in",
          "no_show",
        ].includes(status) &&
        Number(
          booking.outstanding_amount || 0
        ) > 0.009 &&
        Number(
          booking.financial_review_required || 0
        ) !== 1
      );
    });

  const canGroupCheckout =
    bookings.some(
      (booking) =>
        String(
          booking.booking_status || ""
        )
          .trim()
          .toLowerCase() ===
        "checked_in"
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

        <div className="booking-actions">

          <button
            type="button"
            className="booking-btn-secondary"
            disabled={!canGroupCheckIn}
            onClick={() =>
              setShowGroupCheckIn(true)
            }
            title={
              canGroupCheckIn
                ? "Manage actual guest arrivals across this reservation group"
                : "No room currently allows guest check-in"
            }
          >
            Group Check-In
          </button>


          <button
            type="button"
            className="booking-btn-secondary"
            disabled={!canGroupPayment}
            onClick={() =>
              setShowGroupPayment(true)
            }
            title={
              canGroupPayment
                ? "Collect payment across this reservation group"
                : "No eligible outstanding payment is currently available"
            }
          >
            Group Payment
          </button>

          <button
            type="button"
            className="booking-btn-secondary"
            disabled={!canGroupCheckout}
            onClick={() =>
              setShowGroupCheckout(true)
            }
            title={
              canGroupCheckout
                ? "Check out all or selected checked-in rooms"
                : "No checked-in room is currently available for checkout"
            }
          >
            Group Check-Out
          </button>

          <button
            type="button"
            className="booking-new-button"
            disabled={!canAddRoom}
            onClick={() => {
              if (!canAddRoom) {
                return;
              }

              navigate(
                `/booking-desk?group=${group.reservation_group_id}&mode=add-room`
              );
            }}
            title={
              canAddRoom
                ? "Add another room to this reservation group"
                : "Rooms cannot be added because this reservation group has no active booking."
            }
          >
            + Add Room
          </button>

        </div>

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
               Active Guests
            </span>

            <strong className="bstat-value">
              {Number(
                summary.total_guests ||
                0
              )}
            </strong>

            <span className="bstat-change">
              Expected + checked-in allocations
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
              Reservation Contact
            </h4>


            <div className="booking-detail-row">

              <span>
                Contact Name
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
                Pending
              </span>

              <strong>
                {Number(
                  summary.pending_bookings ||
                  0
                )}
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
                Checked Out
              </span>

              <strong>
                {Number(
                  summary.checked_out_bookings ||
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


            <div className="booking-detail-row">
              <span>
                No Show
              </span>

              <strong>
                {Number(
                  summary.no_show_bookings ||
                  0
                )}
              </strong>
            </div>


            <div className="booking-detail-row">
              <span>
                Expired
              </span>

              <strong>
                {Number(
                  summary.expired_bookings ||
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

          <table className="bookings-table reservation-group-bookings-table">

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
                  Occupancy
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

              {bookings.map((booking) => {
                const roomGuests =
                  Array.isArray(
                    booking?.occupancy?.guests
                  )
                    ? booking.occupancy.guests
                    : [];

                const checkedInGuests =
                  roomGuests.filter(
                    (guest) =>
                      String(
                        guest.guest_status || ""
                      )
                        .trim()
                        .toLowerCase() ===
                      "checked_in"
                  );

                const expectedGuests =
                  roomGuests.filter(
                    (guest) =>
                      String(
                        guest.guest_status || ""
                      )
                        .trim()
                        .toLowerCase() ===
                      "expected"
                  );

                const roomCapacity =
                  Number(
                    booking.capacity ||
                    0
                  );

                const bookingStatus =
                  String(
                    booking.booking_status ||
                    ""
                  )
                    .trim()
                    .toLowerCase();


                const canManageGuests =
                  bookingStatus ===
                    "confirmed" ||
                  bookingStatus ===
                    "checked_in";


                const canEdit =
                  bookingStatus ===
                    "pending" ||
                  bookingStatus ===
                    "confirmed";


                const expanded =
                  expandedBookingId ===
                  Number(
                    booking.booking_id
                  );

                return (
                  <React.Fragment
                    key={
                      booking.booking_id
                    }
                  >
                    <tr>

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
                        <div className="booking-room-cell">

                          <strong>
                            Room{" "}
                            {booking.room_number || "—"}
                          </strong>

                          <span>
                            {booking.room_type || "—"}
                          </span>

                        </div>
                      </td>


                      <td>
                        <div className="booking-room-cell">

                          <strong>
                            {booking.stay_type === "day_use"
                              ? "Day Use"
                              : "Overnight"}
                          </strong>

                          <span>
                            In ·{" "}
                            {formatDateTime(
                              booking.check_in
                            )}
                          </span>

                          <span>
                            Out ·{" "}
                            {formatDateTime(
                              booking.check_out
                            )}
                          </span>

                        </div>
                      </td>


                      <td>
                        <div className="booking-room-cell">

                          <strong>
                            {checkedInGuests.length}
                            {" / "}
                            {roomCapacity || "—"}
                            {" staying"}
                          </strong>

                          <span>
                            {expectedGuests.length}
                            {" expected"}
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
                            Paid{" "}
                            {formatCurrency(
                              booking.amount_paid
                            )}
                          </span>

                        </div>
                      </td>


                      <td>
                        <span
                          className={
                            `booking-payment booking-payment--${
                              String(
                                booking.payment_status ||
                                "unpaid"
                              ).toLowerCase()
                            }`
                          }
                        >
                          {formatPaymentStatus(
                            booking.payment_status
                          )}
                        </span>
                      </td>


                      <td>
                        <span
                          className={
                            `booking-status booking-status--${
                              String(
                                booking.booking_status ||
                                "unknown"
                              ).toLowerCase()
                            }`
                          }
                        >
                          {formatStatus(
                            booking.booking_status
                          )}
                        </span>
                      </td>


                      <td>
                        <div className="booking-actions">

                          {/* VIEW GUESTS */}
                          <button
                            type="button"
                            className="booking-action-button booking-action-button--view"
                            onClick={() =>
                              setExpandedBookingId(
                                expanded
                                  ? null
                                  : Number(
                                      booking.booking_id
                                    )
                              )
                            }
                            title={
                              expanded
                                ? "Hide staying guests"
                                : `View staying guests (${roomGuests.length})`
                            }
                            aria-label={
                              expanded
                                ? `Hide guests for ${booking.booking_code}`
                                : `View guests for ${booking.booking_code}`
                            }
                          >
                            <IcoEye />
                          </button>


                          {/* MANAGE GUESTS / CHECK-IN */}
                          {canManageGuests && (
                            <button
                              type="button"
                              className="booking-action-button booking-action-button--edit"
                              onClick={() =>
                                setManageGuestsBooking(
                                  booking
                                )
                              }
                              title="Manage guests / check-in"
                              aria-label={`Manage guests for ${booking.booking_code}`}
                            >
                              <IcoCheck />
                            </button>
                          )}


                          {/* NORMAL BOOKING EDIT */}
                          {canEdit && (
                            <button
                              type="button"
                              className="booking-action-button booking-action-button--edit"
                              onClick={() =>
                                navigate(
                                  `/booking-desk?edit=${booking.booking_id}`
                                )
                              }
                              title="Edit booking"
                              aria-label={`Edit ${booking.booking_code}`}
                            >
                              <IcoEdit />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>


                    {expanded && (
                      <tr className="reservation-group-guests-row">

                        <td
                          colSpan="8"
                          className="reservation-group-guests-cell"
                        >

                          <div className="reservation-group-info-grid">

                            {roomGuests.length === 0 ? (
                              <section className="booking-detail-section">

                                <h4>
                                  Room{" "}
                                  {booking.room_number || "—"} Guests
                                </h4>

                                <div className="booking-special-request">
                                  No staying guest details recorded for this room.
                                </div>

                              </section>
                            ) : (
                              roomGuests.map(
                                (
                                  guest,
                                  guestIndex
                                ) => {
                                  const guestType =
                                    String(
                                      guest.guest_type ||
                                      "adult"
                                    )
                                      .trim()
                                      .toLowerCase();

                                  return (
                                    <section
                                      className="booking-detail-section"
                                      key={
                                        guest.booking_guest_id ||
                                        `${booking.booking_id}-${guestIndex}`
                                      }
                                    >

                                      <h4>
                                        {guest.full_name ||
                                          `Guest ${guestIndex + 1}`}
                                      </h4>


                                      <div className="booking-detail-row">

                                        <span>
                                          Type / Role
                                        </span>

                                        <strong>
                                          {guestType === "child"
                                            ? "Child"
                                            : "Adult"}
                                          {" · "}
                                          {String(
                                            guest.guest_role ||
                                            ""
                                          )
                                            .replaceAll(
                                              "_",
                                              " "
                                            )
                                            .replace(
                                              /\b\w/g,
                                              (character) =>
                                                character.toUpperCase()
                                            ) ||
                                            "—"}
                                        </strong>

                                      </div>


                                      {guest.phone && (
                                        <div className="booking-detail-row">

                                          <span>
                                            Mobile
                                          </span>

                                          <strong>
                                            {guest.phone}
                                          </strong>

                                        </div>
                                      )}


                                      <div className="booking-detail-row">

                                        <span>
                                          Status
                                        </span>

                                        <strong>
                                          {formatStatus(
                                            guest.guest_status
                                          )}
                                        </strong>

                                      </div>


                                      {guestType === "child" && (
                                        <div className="booking-detail-row">

                                          <span>
                                            Age
                                          </span>

                                          <strong>
                                            {guest.age ?? "—"}
                                          </strong>

                                        </div>
                                      )}


                                      <div className="booking-detail-row">

                                        <span>
                                          ID
                                        </span>

                                        <strong>
                                          {guest.id_proof_type &&
                                          guest.id_proof_number
                                            ? `${guest.id_proof_type} · ${guest.id_proof_number}`
                                            : "Not recorded"}
                                        </strong>

                                      </div>


                                      <div className="booking-detail-row">

                                        <span>
                                          Extra Bed
                                        </span>

                                        <strong>
                                          {guest.extra_bed_used === true ||
                                          Number(
                                            guest.extra_bed_used
                                          ) === 1
                                            ? "Used"
                                            : "No"}
                                        </strong>

                                      </div>


                                      {guest.actual_check_in && (
                                        <div className="booking-detail-row">

                                          <span>
                                            Checked In
                                          </span>

                                          <strong>
                                            {formatDateTime(
                                              guest.actual_check_in
                                            )}
                                          </strong>

                                        </div>
                                      )}


                                      {guest.actual_check_out && (
                                        <div className="booking-detail-row">

                                          <span>
                                            Checked Out
                                          </span>

                                          <strong>
                                            {formatDateTime(
                                              guest.actual_check_out
                                            )}
                                          </strong>

                                        </div>
                                      )}

                                    </section>
                                  );
                                }
                              )
                            )}

                          </div>

                        </td>

                      </tr>
                    )}

                  </React.Fragment>
                );
              })}

            </tbody>

          </table>

        </div>

      </div>

      {showGroupPayment && (
        <GroupPaymentDialog
          group={group}
          onClose={() =>
            setShowGroupPayment(false)
          }
          onChanged={refreshGroup}
        />
      )}

      {showGroupCheckout && (
        <GroupCheckoutDialog
          group={group}
          onClose={() =>
            setShowGroupCheckout(false)
          }
          onChanged={refreshGroup}
        />
      )}

      {showGroupCheckIn && (
        <GroupCheckInDialog
          group={
            group
          }
          onClose={() =>
            setShowGroupCheckIn(
              false
            )
          }
          onChanged={() =>
            void refreshGroup()
          }
          onManageRoom={(
            booking
          ) => {
            /*
            * Never stack two operational modals.
            * Close Group Check-In first,
            * then open the canonical room guest manager.
            */
            setShowGroupCheckIn(
              false
            );

            setManageGuestsBooking(
              booking
            );
          }}
        />
      )}

      <ManageGuestsDialog
        booking={
          manageGuestsBooking
        }
        onClose={() =>
          setManageGuestsBooking(
            null
          )
        }
        onChanged={() =>
          void refreshGroup()
        }
      />

    </div>
  );
}


export default ReservationWorkspace;