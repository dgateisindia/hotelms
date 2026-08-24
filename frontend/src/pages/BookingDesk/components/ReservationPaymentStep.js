import React from "react";

import {
  IcoRupee,
} from "../../../utils/icons/BookingIcons";

import {
  formatCurrency,
} from "../bookingUtils";


function ReservationPaymentStep({
  booking,
  payment,
  isEditMode,
  existingPaymentStatus,

  updateBooking,
  updatePayment,

  selectedRooms,
  grandTotal,
  paymentNow,
  balanceDue,
  paymentPreviewStatus,

  refund,
  updateRefund,
  pricingQuote,
  refundRequired,
  refundRequiredAmount,
}) {
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
            Step 3
          </span>

          <h2>
            Reservation & Payment
          </h2>

          <p>
            {isEditMode &&
            refundRequired
              ? "Confirm the reservation changes and record the required refund."
              : isEditMode
                ? "Confirm the reservation details before saving the changes."
                : "Confirm the reservation status and record any payment received at the front desk."}
          </p>

        </div>

      </div>


      <div className="booking-desk-form-grid">


        {/* ====================================================
            RESERVATION STATUS
        ==================================================== */}

        <div className="booking-desk-field">

          <label htmlFor="booking-status">
            Reservation Status
            <span>*</span>
          </label>

          <select
            id="booking-status"
            value={
              booking.booking_status
            }
            onChange={(
              event
            ) =>
              updateBooking(
                "booking_status",
                event.target.value
              )
            }
          >

            <option value="pending">
              Pending
            </option>

            <option value="confirmed">
              Confirmed
            </option>

          </select>

        </div>


        {/* ====================================================
            NEW BOOKING PAYMENT
        ==================================================== */}

        {!isEditMode && (
          <>

            <div className="booking-desk-field">

              <label htmlFor="booking-payment-mode">
                Payment at Booking
              </label>

              <select
                id="booking-payment-mode"
                value={
                  payment.mode
                }
                onChange={(
                  event
                ) =>
                  updatePayment(
                    "mode",
                    event.target.value
                  )
                }
              >

                <option value="none">
                  No Payment
                </option>

                <option value="advance">
                  Advance Payment
                </option>

                <option value="full">
                  Full Payment
                </option>

              </select>

            </div>


            {payment.mode ===
              "advance" && (
              <div className="booking-desk-field">

                <label htmlFor="booking-payment-amount">
                  Amount Received
                  <span>*</span>
                </label>

                <input
                  id="booking-payment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    payment.amount
                  }
                  placeholder="Enter advance amount"
                  onChange={(
                    event
                  ) =>
                    updatePayment(
                      "amount",
                      event.target.value
                    )
                  }
                />

              </div>
            )}


            {payment.mode !==
              "none" && (
              <>

                <div className="booking-desk-field">

                  <label htmlFor="booking-payment-method">
                    Payment Method
                    <span>*</span>
                  </label>

                  <select
                    id="booking-payment-method"
                    value={
                      payment.payment_method
                    }
                    onChange={(
                      event
                    ) =>
                      updatePayment(
                        "payment_method",
                        event.target.value
                      )
                    }
                  >

                    <option value="cash">
                      Cash
                    </option>

                    <option value="upi">
                      UPI
                    </option>

                    <option value="card">
                      Card
                    </option>

                    <option value="bank_transfer">
                      Bank Transfer
                    </option>

                  </select>

                </div>


                <div className="booking-desk-field">

                  <label htmlFor="booking-transaction-id">
                    Transaction ID
                  </label>

                  <input
                    id="booking-transaction-id"
                    type="text"
                    value={
                      payment.transaction_id
                    }
                    placeholder={
                      payment.payment_method ===
                      "cash"
                        ? "Optional for cash"
                        : "UPI/Card/Bank reference"
                    }
                    maxLength={255}
                    onChange={(
                      event
                    ) =>
                      updatePayment(
                        "transaction_id",
                        event.target.value
                      )
                    }
                  />

                </div>


                <div className="booking-desk-field booking-desk-field--full">

                  <label htmlFor="booking-payment-notes">
                    Payment Notes
                  </label>

                  <input
                    id="booking-payment-notes"
                    type="text"
                    value={
                      payment.notes
                    }
                    placeholder="Optional payment note"
                    maxLength={450}
                    onChange={(
                      event
                    ) =>
                      updatePayment(
                        "notes",
                        event.target.value
                      )
                    }
                  />

                </div>

              </>
            )}

          </>
        )}


        {/* ====================================================
            EDIT MODE PAYMENT STATUS
        ==================================================== */}

        {isEditMode && (
          <div className="booking-desk-field">

            <label>
              Current Payment Status
            </label>

            <div className="booking-desk-readonly-field">

              <IcoRupee />

              <span className="booking-desk-capitalize">
                {
                  existingPaymentStatus
                }
              </span>

            </div>

            <small>
              Status is derived from the payment ledger.
            </small>

          </div>
        )}


        {/* ====================================================
            EDIT MODE REFUND DETAILS
        ==================================================== */}

        {isEditMode &&
          refundRequired && (
          <>

            <div className="booking-desk-field">

              <label>
                Refund Required
              </label>

              <div className="booking-desk-readonly-field">

                <IcoRupee />

                <strong>
                  {formatCurrency(
                    refundRequiredAmount
                  )}
                </strong>

              </div>

              <small>
                This amount is calculated automatically by
                the backend from the updated reservation total.
              </small>

            </div>


            <div className="booking-desk-field">

              <label htmlFor="booking-refund-method">
                Refund Method
                <span>*</span>
              </label>

              <select
                id="booking-refund-method"
                value={
                  refund.payment_method
                }
                onChange={(
                  event
                ) =>
                  updateRefund(
                    "payment_method",
                    event.target.value
                  )
                }
              >

                <option value="cash">
                  Cash
                </option>

                <option value="upi">
                  UPI
                </option>

                <option value="card">
                  Card
                </option>

                <option value="bank_transfer">
                  Bank Transfer
                </option>

              </select>

            </div>


            {refund.payment_method !==
              "cash" && (
              <div className="booking-desk-field">

                <label htmlFor="booking-refund-transaction-id">
                  Refund Transaction ID
                  <span>*</span>
                </label>

                <input
                  id="booking-refund-transaction-id"
                  type="text"
                  value={
                    refund.transaction_id
                  }
                  maxLength={255}
                  placeholder="UPI/Card/Bank refund reference"
                  onChange={(
                    event
                  ) =>
                    updateRefund(
                      "transaction_id",
                      event.target.value
                    )
                  }
                />

              </div>
            )}


            <div className="booking-desk-field booking-desk-field--full">

              <label htmlFor="booking-refund-notes">
                Refund Reason
                <span>*</span>
              </label>

              <textarea
                id="booking-refund-notes"
                rows="3"
                value={
                  refund.notes
                }
                maxLength={500}
                placeholder="Example: Refund due to reduced reservation duration."
                onChange={(
                  event
                ) =>
                  updateRefund(
                    "notes",
                    event.target.value
                  )
                }
              />

              <small>
                {
                  refund.notes.length
                }
                /500
              </small>

            </div>

          </>
        )}


        {/* ====================================================
            SPECIAL REQUEST
        ==================================================== */}

        <div className="booking-desk-field booking-desk-field--full">

          <label htmlFor="booking-special-request">
            Special Request
          </label>

          <textarea
            id="booking-special-request"
            rows="4"
            value={
              booking.special_request
            }
            maxLength={5000}
            placeholder="Airport pickup, extra bed, late arrival, dietary request..."
            onChange={(
              event
            ) =>
              updateBooking(
                "special_request",
                event.target.value
              )
            }
          />

          <small>
            {
              booking.special_request.length
            }
            /5000
          </small>

        </div>

      </div>


      {/* ======================================================
          PRICE SUMMARY
      ====================================================== */}

      <div className="booking-desk-price-summary">

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
            {isEditMode
              ? "Updated Booking Total"
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
                Refund Required
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
              Amount Received
            </span>

            <strong>
              {formatCurrency(
                paymentNow
              )}
            </strong>

          </div>
        )}


        <div className="booking-desk-price-summary__total">

          <span>
            Balance Due
          </span>

          <strong>
            {formatCurrency(
              balanceDue
            )}
          </strong>

        </div>

      </div>


      {isEditMode &&
      refundRequired ? (
        <div className="booking-desk-note">

          <strong>
            Refund confirmation:
          </strong>{" "}

          {formatCurrency(
            refundRequiredAmount
          )}{" "}
          will be recorded together with the reservation
          update in one transaction.

          The refund amount cannot be manually changed.

        </div>
      ) : (
        <div className="booking-desk-note">

          Payment Status:{" "}

          <strong>
            {
              paymentPreviewStatus
            }
          </strong>

          . Status is calculated from successful payment
          records and is not manually selected.

        </div>
      )}

    </div>
  );
}


export default ReservationPaymentStep;