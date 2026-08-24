import React from "react";

import {
  splitStoredPhone,
  formatCurrency,
  formatDate,
  maskIdNumber,
} from "../bookingUtils";


/* ============================================================
   HELPERS
============================================================ */

function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  ).format(
    date
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


/* ============================================================
   COMPONENT
============================================================ */

function ReviewStep({
  guest,
  matchedCustomer,

  booking,
  payment,
  isEditMode,
  existingPaymentStatus,

  isAddRoomMode,
  reservationGroup,

  nights,
  selectedRooms,
  totalGuests,
  roomTotals,

  grandTotal,
  paymentNow,
  balanceDue,
  paymentPreviewStatus,

  refund,
  pricingQuote,
  refundRequired,
  refundRequiredAmount,
}) {
  const isDayUse =
    booking.stay_type ===
    "day_use";


  const stayDurationMinutes =
    isDayUse
      ? calculateStayMinutes(
          booking.check_in,
          booking.check_out
        )
      : 0;


  const stayDurationLabel =
    formatStayDuration(
      stayDurationMinutes
    );

  const currentAmountPaid =
    Number(
      pricingQuote
        ?.amount_paid ??
      paymentNow ??
      0
    );

  return (
    <div className="booking-desk-section">

      <div className="booking-desk-section__header">

        <div>

          <span className="booking-desk-eyebrow">
            Step 4
          </span>

          <h2>
            Review Reservation
          </h2>

          <p>
            {isAddRoomMode
              ? `Verify the room being added to ${
                  reservationGroup?.group_code ||
                  "this reservation group"
                }.`
              : "Verify guest, room and payment information before saving."}
          </p>

        </div>

      </div>


      <div className="booking-desk-review-grid">


        {/* ====================================================
            GUEST
        ==================================================== */}

        <section className="booking-desk-review-card">

          <h3>
            Guest
          </h3>

          <div>
            <span>
              Name
            </span>

            <strong>
              {
                guest.guest_name
              }
            </strong>
          </div>


          <div>
            <span>
              Phone
            </span>

            <strong>
              {matchedCustomer
                ? splitStoredPhone(
                    matchedCustomer.phone
                  )
                : guest.phone}
            </strong>
          </div>


          <div>
            <span>
              Email
            </span>

            <strong>
              {
                guest.email ||
                "—"
              }
            </strong>
          </div>


          <div>
            <span>
              ID Proof
            </span>

            <strong>
              {
                guest.id_proof_type ||
                "—"
              }

              {guest.id_proof_number
                ? ` · ${maskIdNumber(
                    guest.id_proof_number
                  )}`
                : ""}
            </strong>
          </div>

        </section>


        {/* ====================================================
            STAY
        ==================================================== */}

        <section className="booking-desk-review-card">

          <h3>
            Stay
          </h3>


          <div>
            <span>
              Stay Type
            </span>

            <strong>
              {isDayUse
                ? "Day Use / Short Stay"
                : "Overnight Stay"}
            </strong>
          </div>


          <div>
            <span>
              Check In
            </span>

            <strong>
              {isDayUse
                ? formatDateTime(
                    booking.check_in
                  )
                : formatDate(
                    booking.check_in
                  )}
            </strong>
          </div>


          <div>
            <span>
              {isDayUse
                ? "Check Out"
                : "Expected Check Out"}
            </span>

            <strong>
              {isDayUse
                ? formatDateTime(
                    booking.check_out
                  )
                : formatDate(
                    booking.check_out
                  )}
            </strong>
          </div>


          <div>
            <span>
              {isDayUse
                ? "Stay Duration"
                : "Nights"}
            </span>

            <strong>
              {isDayUse
                ? stayDurationLabel
                : nights}
            </strong>
          </div>

        </section>


        {/* ====================================================
            PAYMENT
        ==================================================== */}

        <section className="booking-desk-review-card">

          <h3>
            Payment
          </h3>

          <div>
            <span>
              {isEditMode
                ? "Updated Booking Total"
                : isAddRoomMode
                  ? selectedRooms.length > 1
                    ? "Added Rooms Total"
                    : "Added Room Total"
                  : "Booking Total"}
            </span>

            <strong>
              {formatCurrency(
                grandTotal
              )}
            </strong>
          </div>

          {isEditMode &&
          refundRequired ? (
            <>

              <div>
                <span>
                  Currently Paid
                </span>

                <strong>
                  {formatCurrency(
                    currentAmountPaid
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Refund
                </span>

                <strong>
                  -{formatCurrency(
                    refundRequiredAmount
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Net Paid After Refund
                </span>

                <strong>
                  {formatCurrency(
                    paymentNow
                  )}
                </strong>
              </div>

            </>
          ) : (
            <div>
              <span>
                Received
              </span>

              <strong>
                {formatCurrency(
                  paymentNow
                )}
              </strong>
            </div>
          )}

          <div>
            <span>
              Balance Due
            </span>

            <strong>
              {formatCurrency(
                balanceDue
              )}
            </strong>
          </div>

          <div>
            <span>
              {isEditMode &&
              refundRequired
                ? "Projected Status"
                : "Status"}
            </span>

            <strong>
              {
                paymentPreviewStatus
              }
            </strong>
          </div>

        </section>

        {/* ====================================================
            RESERVATION
        ==================================================== */}

        <section className="booking-desk-review-card">

          <h3>
            Reservation
          </h3>

          {isAddRoomMode && (
            <div>
              <span>
                Reservation Group
              </span>

              <strong>
                {reservationGroup?.group_code ||
                  "—"}
              </strong>
            </div>
          )}

          <div>
            <span>
              Status
            </span>

            <strong className="booking-desk-capitalize">
              {
                booking.booking_status
              }
            </strong>
          </div>


          <div>
            <span>
              Rooms
            </span>

            <strong>
              {
                selectedRooms.length
              }
            </strong>
          </div>


          <div>
            <span>
              Guests
            </span>

            <strong>
              {
                totalGuests
              }
            </strong>
          </div>

          <div>
            <span>
              {isEditMode &&
              refundRequired
                ? "Refund Method"
                : isEditMode
                  ? "Payment Status"
                  : "Payment Method"}
            </span>

            <strong className="booking-desk-capitalize">

              {isEditMode &&
              refundRequired
                ? refund.payment_method.replaceAll(
                    "_",
                    " "
                  )
                : isEditMode
                  ? existingPaymentStatus
                  : payment.mode ===
                    "none"
                    ? "No payment"
                    : payment.payment_method.replaceAll(
                        "_",
                        " "
                      )}

            </strong>
          </div>

        </section>

      </div>

      {isEditMode &&
        refundRequired && (
          <section className="booking-desk-review-rooms">

            <h3>
              Refund Details
            </h3>

            <div className="booking-desk-review-room">

              <div>
                <strong>
                  Refund Amount
                </strong>

                <span>
                  Backend calculated from the payment ledger
                </span>
              </div>

              <div>
                <strong>
                  {formatCurrency(
                    refundRequiredAmount
                  )}
                </strong>
              </div>

            </div>

            <div className="booking-desk-review-room">

              <div>
                <strong>
                  Refund Method
                </strong>

                <span className="booking-desk-capitalize">
                  {refund.payment_method.replaceAll(
                    "_",
                    " "
                  )}
                </span>
              </div>

              {refund.payment_method !==
                "cash" && (
                <div>
                  <span>
                    Transaction ID
                  </span>

                  <strong>
                    {refund.transaction_id ||
                      "—"}
                  </strong>
                </div>
              )}

            </div>

            <div className="booking-desk-review-room">

              <div>
                <strong>
                  Refund Reason
                </strong>

                <span>
                  {refund.notes ||
                    "—"}
                </span>
              </div>

            </div>

            <div className="booking-desk-review-note">

              The refund and reservation update will be recorded
              together when Save Changes is confirmed.

            </div>

          </section>
        )}

      {/* ======================================================
          ROOMS
      ====================================================== */}

      <section className="booking-desk-review-rooms">

        <h3>
          {isAddRoomMode
            ? selectedRooms.length > 1
              ? "Rooms Being Added"
              : "Room Being Added"
            : "Room Details"}
        </h3>

        {roomTotals.map(
          (
            room
          ) => (
            <div
              className="booking-desk-review-room"
              key={
                room.room_id
              }
            >

              <div>

                <strong>
                  Room{" "}
                  {
                    room.room_number
                  }
                </strong>

                <span>
                  {
                    room.room_type
                  }

                  {" · "}

                  {isDayUse
                    ? `Standard rate ${formatCurrency(
                        room.price_per_night
                      )}/night`
                    : `${formatCurrency(
                        room.price_per_night
                      )}/night`}
                </span>

              </div>


              <div>

                <span>
                  {
                    room.total_guests
                  }{" "}
                  guest
                  {
                    room.total_guests ===
                    1
                      ? ""
                      : "s"
                  }

                  {isDayUse
                    ? ` · ${stayDurationLabel}`
                    : ` · ${nights} night${
                        nights === 1
                          ? ""
                          : "s"
                      }`}
                </span>

                <strong>
                  {formatCurrency(
                    room.total_amount
                  )}
                </strong>

              </div>

            </div>
          )
        )}


        <div className="booking-desk-review-total">

          <span>
            {isAddRoomMode
              ? selectedRooms.length > 1
                ? "Added Rooms Total"
                : "Added Room Total"
              : "Grand Total"}
          </span>

          <strong>
            {formatCurrency(
              grandTotal
            )}
          </strong>

        </div>

      </section>


      {/* ======================================================
          SPECIAL REQUEST
      ====================================================== */}

      {booking.special_request && (
        <section className="booking-desk-review-request">

          <h3>
            Special Request
          </h3>

          <p>
            {
              booking.special_request
            }
          </p>

        </section>
      )}


      <div className="booking-desk-review-note">
        {isAddRoomMode
          ? `The selected room will be added to ${
              reservationGroup?.group_code ||
              "the existing reservation group"
            }. Existing room bookings and their payments will not be changed. Availability and pricing will be verified again before saving.`
          : "Room availability and pricing will be verified again by the system before the reservation is saved."}
      </div>

    </div>
  );
}


export default ReviewStep;