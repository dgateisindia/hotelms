import React from "react";


function ExtendStayDialog({
  booking,
  newCheckOut,
  minCheckOut,
  reason,
  processing,
  error,
  onChangeCheckOut,
  onChangeReason,
  onClose,
  onConfirm,
}) {
  if (!booking) {
    return null;
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
        aria-labelledby="extend-stay-title"
      >

        <h3 id="extend-stay-title">
          Extend Stay
        </h3>


        <p>
          Extend{" "}
          <strong>
            {booking.booking_code}
          </strong>{" "}
          for{" "}
          <strong>
            {booking.full_name || "Guest"}
          </strong>{" "}
          in Room{" "}
          <strong>
            {booking.room_number || "—"}
          </strong>.
        </p>


        <div className="booking-detail-section">

          <div className="booking-detail-row">
            <span>
              Current Checkout
            </span>

            <strong>
              {String(
                booking.check_out ||
                ""
              ).slice(
                0,
                10
              ) || "—"}
            </strong>
          </div>


          <div className="booking-detail-row">
            <span>
              New Checkout
            </span>

            <div className="booking-search">

              <input
                type="date"
                value={
                  newCheckOut
                }
                min={
                  minCheckOut
                }
                disabled={
                  processing
                }
                onChange={(event) =>
                  onChangeCheckOut(
                    event.target.value
                  )
                }
                aria-label="New expected checkout date"
              />

            </div>
          </div>


          <div className="booking-detail-row">
            <span>
              Reason
            </span>

            <div className="booking-filter-control">

              <select
                value={
                  reason
                }
                disabled={
                  processing
                }
                onChange={(event) =>
                  onChangeReason(
                    event.target.value
                  )
                }
                aria-label="Stay extension reason"
              >
                <option value="guest_request">
                  Guest Request
                </option>

                <option value="hotel_policy">
                  Hotel Policy
                </option>

                <option value="hotel_operational">
                  Hotel Operational
                </option>

                <option value="maintenance">
                  Maintenance
                </option>

                <option value="other">
                  Other
                </option>
              </select>

            </div>
          </div>

        </div>


        {error && (
          <div className="booking-dialog-error">
            {error}
          </div>
        )}


        <div className="booking-confirm-actions">

          <button
            type="button"
            className="booking-btn-secondary"
            disabled={
              processing
            }
            onClick={
              onClose
            }
          >
            Cancel
          </button>


          <button
            type="button"
            className="booking-btn-primary"
            disabled={
              processing ||
              !newCheckOut
            }
            onClick={
              onConfirm
            }
          >
            {processing
              ? "Extending..."
              : "Extend Stay"}
          </button>

        </div>

      </div>
    </div>
  );
}


export default ExtendStayDialog;