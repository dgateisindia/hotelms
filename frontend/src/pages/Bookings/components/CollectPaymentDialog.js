import React from "react";


function formatCurrency(
  value
) {
  const amount =
    Number(value || 0);


  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(amount)
      ? amount
      : 0
  );
}


function CollectPaymentDialog({
  booking,

  amount,
  method,
  transactionId,
  notes,

  processing,
  error,

  onChangeAmount,
  onChangeMethod,
  onChangeTransactionId,
  onChangeNotes,

  onClose,
  onConfirm,
}) {
  if (!booking) {
    return null;
  }


  const outstanding =
    Number(
      booking.outstanding_amount ||
      0
    );


  const isCash =
    method === "cash";


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
        aria-labelledby="collect-payment-title"
      >

        <h3 id="collect-payment-title">
          Collect Payment
        </h3>


        <p>
          Record payment for{" "}

          <strong>
            {booking.booking_code}
          </strong>

          {" "}—{" "}

          <strong>
            {booking.full_name ||
              "Guest"}
          </strong>.
        </p>


        <div className="booking-detail-section">

          <div className="booking-detail-row">

            <span>
              Booking Total
            </span>

            <strong>
              {formatCurrency(
                booking.total_amount
              )}
            </strong>

          </div>


          <div className="booking-detail-row">

            <span>
              Already Paid
            </span>

            <strong>
              {formatCurrency(
                booking.amount_paid
              )}
            </strong>

          </div>


          <div className="booking-detail-row">

            <span>
              Balance Due
            </span>

            <strong>
              {formatCurrency(
                outstanding
              )}
            </strong>

          </div>


          <div className="booking-detail-row">

            <span>
              Amount
            </span>

            <div className="booking-search">

              <input
                type="number"
                min="0.01"
                step="0.01"
                max={
                  outstanding >
                  0
                    ? outstanding
                    : undefined
                }
                value={amount}
                disabled={
                  processing
                }
                onChange={(event) =>
                  onChangeAmount(
                    event.target.value
                  )
                }
                placeholder="Enter amount"
                aria-label="Payment amount"
              />

            </div>

          </div>


          <div className="booking-detail-row">

            <span>
              Payment Method
            </span>

            <div className="booking-filter-control">

              <select
                value={method}
                disabled={
                  processing
                }
                onChange={(event) =>
                  onChangeMethod(
                    event.target.value
                  )
                }
                aria-label="Payment method"
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

          </div>


          {!isCash && (
            <div className="booking-detail-row">

              <span>
                Transaction ID
              </span>

              <div className="booking-search">

                <input
                  type="text"
                  value={
                    transactionId
                  }
                  disabled={
                    processing
                  }
                  onChange={(event) =>
                    onChangeTransactionId(
                      event.target.value
                    )
                  }
                  placeholder="Enter transaction reference"
                  maxLength={255}
                  aria-label="Transaction ID"
                />

              </div>

            </div>
          )}


          <div className="booking-detail-row">

            <span>
              Notes
            </span>

            <div className="booking-search">

              <input
                type="text"
                value={notes}
                disabled={
                  processing
                }
                onChange={(event) =>
                  onChangeNotes(
                    event.target.value
                  )
                }
                placeholder="Optional payment note"
                maxLength={500}
                aria-label="Payment notes"
              />

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
              !amount ||
              Number(amount) <=
                0 ||
              (
                !isCash &&
                !String(
                  transactionId ||
                  ""
                ).trim()
              )
            }
            onClick={
              onConfirm
            }
          >
            {processing
              ? "Recording..."
              : "Collect Payment"}
          </button>

        </div>

      </div>
    </div>
  );
}


export default CollectPaymentDialog;