import React from "react";
import { formatCurrency } from "../../../shared/utils/money";


function CancellationDialog({
  booking,

  source,
  reason,

  processing,
  error,

  onChangeSource,
  onChangeReason,

  onClose,
  onConfirm,
}) {
  if (!booking) {
    return null;
  }


  const normalizedSource =
    String(source || "")
      .trim()
      .toLowerCase();


  const validSource =
    [
      "customer",
      "hotel",
    ].includes(
      normalizedSource
    );


  const normalizedReason =
    String(reason || "");


  const canSubmit =
    !processing &&
    validSource &&
    normalizedReason.length <= 500;


  const sourceMessage =
    normalizedSource === "hotel"
      ? "The booking-time hotel cancellation rule will be applied."
      : "The booking-time customer cancellation slabs or same-day rule will be applied.";


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
        aria-labelledby="booking-cancellation-title"
      >
        <h3 id="booking-cancellation-title">
          Cancel Booking
        </h3>

        <p>
          Cancel{" "}
          <strong>
            {booking.booking_code}
          </strong>
          {" "}for{" "}
          <strong>
            {booking.full_name ||
              "Reservation Contact"}
          </strong>
          ?
        </p>


        <div className="booking-detail-section">
          <div className="booking-detail-row">
            <span>
              Room
            </span>

            <strong>
              Room{" "}
              {booking.room_number ||
                "—"}
              {booking.room_type
                ? ` · ${booking.room_type}`
                : ""}
            </strong>
          </div>


          <div className="booking-detail-row">
            <span>
              Original Booking Amount
            </span>

            <strong>
              {formatCurrency(
                booking.total_amount
              )}
            </strong>
          </div>


          <div className="booking-detail-row">
            <span>
              Cancellation Source
            </span>

            <div className="booking-filter-control">
              <select
                value={source}
                disabled={processing}
                onChange={(event) =>
                  onChangeSource(
                    event.target.value
                  )
                }
                aria-label="Cancellation source"
              >
                <option value="customer">
                  Customer Requested
                </option>

                <option value="hotel">
                  Hotel Initiated
                </option>
              </select>
            </div>
          </div>


          <div className="booking-detail-row">
            <span>
              Reason
            </span>

            <div className="booking-search">
              <input
                type="text"
                value={reason}
                disabled={processing}
                maxLength={500}
                placeholder="Enter cancellation reason"
                aria-label="Cancellation reason"
                onChange={(event) =>
                  onChangeReason(
                    event.target.value
                  )
                }
              />
            </div>
          </div>
        </div>


        <p>
          {sourceMessage}
        </p>

        <p>
          The exact cancellation charge is calculated by
          the backend from this booking&apos;s saved policy.
          The original booking amount will remain unchanged
          in history.
        </p>


        {normalizedSource ===
          "hotel" && (
          <div className="booking-dialog-error">
            Use Hotel Initiated only when the hotel is
            responsible for cancelling this reservation.
          </div>
        )}


        {error && (
          <div className="booking-dialog-error">
            {error}
          </div>
        )}


        <div className="booking-confirm-actions">
          <button
            type="button"
            className="booking-btn-secondary"
            disabled={processing}
            onClick={onClose}
          >
            Keep Booking
          </button>

          <button
            type="button"
            className="booking-btn-warning"
            disabled={!canSubmit}
            onClick={onConfirm}
          >
            {processing
              ? "Cancelling..."
              : "Cancel Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}


export default CancellationDialog;