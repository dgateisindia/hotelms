import React from "react";

import {
  splitStoredPhone,
  formatCurrency,
  formatDate,
  maskIdNumber,
} from "../bookingUtils";


function ReviewStep({
  guest,
  matchedCustomer,

  booking,
  payment,
  isEditMode,
  existingPaymentStatus,

  nights,
  selectedRooms,
  totalGuests,
  roomTotals,

  grandTotal,
  paymentNow,
  balanceDue,
  paymentPreviewStatus,
}) {
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
            Verify guest, room and payment information before
            saving.
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
              Check In
            </span>

            <strong>
              {formatDate(
                booking.check_in
              )}
            </strong>
          </div>


          <div>
            <span>
              Expected Check Out
            </span>

            <strong>
              {formatDate(
                booking.check_out
              )}
            </strong>
          </div>


          <div>
            <span>
              Nights
            </span>

            <strong>
              {nights}
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
              Booking Total
            </span>

            <strong>
              {formatCurrency(
                grandTotal
              )}
            </strong>
          </div>


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
              Status
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
              Payment Method
            </span>

            <strong className="booking-desk-capitalize">

              {isEditMode
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


      {/* ======================================================
          ROOMS
      ====================================================== */}

      <section className="booking-desk-review-rooms">

        <h3>
          Room Details
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
                  {formatCurrency(
                    room.price_per_night
                  )}
                  /night
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
            Grand Total
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
        Room availability and final room rate will be
        verified again when the reservation is confirmed.
      </div>

    </div>
  );
}


export default ReviewStep;