import React from "react";
import { formatCurrency } from "../../../shared/utils/money";
import { formatDateTime } from "../../../shared/utils/dates";
import { formatStatus, formatPaymentStatus } from "../../../shared/utils/status";
import { IcoEye, IcoEdit, IcoCheck } from "../../../utils/icons/BookingIcons";
import ReservationGuestDetails from "./ReservationGuestDetails";

function ReservationRoomRow({
  booking,
  expanded,
  onToggleExpanded,
  onManageGuests,
  onEdit,
}) {
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
                            onClick={onToggleExpanded}
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
                              onClick={onManageGuests}
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
                              onClick={onEdit}
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
                                (guest, guestIndex) => (
                                  <ReservationGuestDetails
                                    key={
                                      guest.booking_guest_id ||
                                      `${booking.booking_id}-${guestIndex}`
                                    }
                                    guest={guest}
                                    guestIndex={guestIndex}
                                    bookingId={booking.booking_id}
                                  />
                                )
                              )
                              )}

                          </div>

                        </td>

                      </tr>
                    )}

                  </React.Fragment>
                );
}

export default ReservationRoomRow;
