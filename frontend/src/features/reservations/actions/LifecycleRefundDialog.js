import React from "react";
import { formatCurrency } from "../../../shared/utils/money";


function formatSource(value) {
  return value === "hotel"
    ? "Hotel Initiated"
    : "Customer Requested";
}

function LifecycleRefundDialog({
  booking,
  method,
  transactionId,
  notes,
  processing,
  error,
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

  const isCancellation =
    status === "cancelled";

  const settlementLabel =
    isCancellation
      ? "Cancellation"
      : "No-Show";

  const originalAmount =
    Number(
      booking.total_amount || 0
    );

  const finalPayable =
    Number(
      booking.final_payable_amount || 0
    );

  const netPaid =
    Number(
      booking.amount_paid || 0
    );

  const refundDue =
    Number(
      booking.overpaid_amount || 0
    );

  const financialReviewRequired =
    Number(
      booking.financial_review_required || 0
    ) === 1;

  const isCash =
    method === "cash";

  const transactionReference =
    String(
      transactionId || ""
    ).trim();

  const canSubmit =
    !processing &&
    !financialReviewRequired &&
    refundDue > 0.009 &&
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
        aria-labelledby="lifecycle-refund-title"
      >
        <h3 id="lifecycle-refund-title">
          Process {settlementLabel} Refund
        </h3>

        <p>
          Refund overpayment for{" "}
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
              Original Booking Amount
            </span>

            <strong>
              {formatCurrency(
                originalAmount
              )}
            </strong>
          </div>

          {isCancellation && (
            <div className="booking-detail-row">
              <span>
                Cancellation Source
              </span>

              <strong>
                {formatSource(
                  booking
                    .cancellation_source
                )}
              </strong>
            </div>
          )}

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
              Refund Due
            </span>

            <strong>
              {financialReviewRequired
                ? "Pending Review"
                : formatCurrency(
                    refundDue
                  )}
            </strong>
          </div>

          <div className="booking-detail-row">
            <span>
              Refund Method
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
                aria-label="Refund method"
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
                  placeholder="Enter refund transaction reference"
                  aria-label="Refund transaction ID"
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
                placeholder="Optional refund note"
                aria-label="Refund notes"
                onChange={(event) =>
                  onChangeNotes(
                    event.target.value
                  )
                }
              />
            </div>
          </div>
        </div>

        <p>
          Refund amount is calculated automatically
          from the finalized {settlementLabel} settlement
          and cannot be edited.
        </p>

        {financialReviewRequired && (
          <div className="booking-dialog-error">
            Financial review must be completed before
            this refund can be processed.
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
              ? "Processing..."
              : `Refund ${formatCurrency(
                  refundDue
                )}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LifecycleRefundDialog;