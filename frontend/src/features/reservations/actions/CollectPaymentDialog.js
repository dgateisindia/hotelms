import React from "react";
import { formatCurrency } from "../../../shared/utils/money";

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
  if (!booking) return null;

  const status = String(
    booking.booking_status || ""
  )
    .trim()
    .toLowerCase();

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
      : isNoShow
        ? "No-Show"
        : null;

  const originalTotal =
    Number(
      booking.total_amount || 0
    );

  const finalPayable =
    isLifecycleSettlement
      ? Number(
          booking.final_payable_amount || 0
        )
      : originalTotal;

  const netPaid =
    Number(
      booking.amount_paid || 0
    );

  const outstanding =
    Number(
      booking.outstanding_amount || 0
    );

  const financialReviewRequired =
    Number(
      booking.financial_review_required || 0
    ) === 1;

  const enteredAmount =
    Number(amount);

  const isCash =
    method === "cash";

  const transactionReference =
    String(
      transactionId || ""
    ).trim();

  const validAmount =
    Number.isFinite(
      enteredAmount
    ) &&
    enteredAmount > 0 &&
    enteredAmount <=
      outstanding + 0.009;

  const canSubmit =
    !processing &&
    !financialReviewRequired &&
    validAmount &&
    (
      isCash ||
      transactionReference
    );

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
          {isLifecycleSettlement
            ? `Collect ${settlementLabel} Charge`
            : "Collect Payment"}
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
              {isLifecycleSettlement
                ? "Original Booking Amount"
                : "Booking Total"}
            </span>

            <strong>
              {formatCurrency(
                originalTotal
              )}
            </strong>
          </div>

          {isLifecycleSettlement && (
            <div className="booking-detail-row">
              <span>
                Final {settlementLabel} Payable
              </span>

              <strong>
                {financialReviewRequired
                  ? "Pending Review"
                  : formatCurrency(
                      finalPayable
                    )}
              </strong>
            </div>
          )}

          {isCancellation &&
            booking.cancellation_source && (
            <div className="booking-detail-row">
              <span>
                Cancellation Source
              </span>

              <strong>
                {booking.cancellation_source ===
                "hotel"
                  ? "Hotel Initiated"
                  : "Customer Requested"}
              </strong>
            </div>
          )}

          <div className="booking-detail-row">
            <span>
              Net Paid
            </span>

            <strong>
              {formatCurrency(
                netPaid
              )}
            </strong>
          </div>

          <div className="booking-detail-row">
            <span>
              Balance Due
            </span>

            <strong>
              {financialReviewRequired
                ? "Pending Review"
                : formatCurrency(
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
                  outstanding > 0
                    ? outstanding
                    : undefined
                }
                value={amount}
                disabled={
                  processing ||
                  financialReviewRequired
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
                disabled={processing}
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
                Transaction ID *
              </span>

              <div className="booking-search">
                <input
                  type="text"
                  value={transactionId}
                  disabled={processing}
                  maxLength={255}
                  placeholder="Enter transaction reference"
                  aria-label="Transaction ID"
                  onChange={(event) =>
                    onChangeTransactionId(
                      event.target.value
                    )
                  }
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
                disabled={processing}
                maxLength={500}
                placeholder="Optional payment note"
                aria-label="Payment notes"
                onChange={(event) =>
                  onChangeNotes(
                    event.target.value
                  )
                }
              />
            </div>
          </div>
        </div>

        {isLifecycleSettlement && (
          <p>
            Payment is collected against the finalized{" "}
            {settlementLabel} settlement, not against the
            original booking amount.
          </p>
        )}

        {financialReviewRequired && (
          <div className="booking-dialog-error">
            Financial review must be completed before
            payment can be collected.
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
            Cancel
          </button>

          <button
            type="button"
            className="booking-btn-primary"
            disabled={!canSubmit}
            onClick={onConfirm}
          >
            {processing
              ? "Recording..."
              : isLifecycleSettlement
                ? `Collect ${formatCurrency(
                    enteredAmount || 0
                  )}`
                : "Collect Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CollectPaymentDialog;