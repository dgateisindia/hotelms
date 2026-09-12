import React from "react";
import { formatCurrency } from "../../../shared/utils/money";


function FinancialSettlementReviewDialog({
  booking,
  review,

  finalPayable,
  reviewNotes,

  loading,
  processing,
  error,

  onChangeFinalPayable,
  onChangeReviewNotes,

  onClose,
  onConfirm,
}) {
  if (!booking) return null;


  const status = String(
    booking.booking_status || ""
  )
    .trim()
    .toLowerCase();


  const settlementLabel =
    review?.settlement_label ||
    (
      status === "cancelled"
        ? "Cancellation"
        : "No Show"
    );


  const originalTotal = Number(
    review?.original_total_amount ??
    booking.total_amount ??
    0
  );


  const currentNetPaid = Number(
    booking.amount_paid ??
    booking.net_paid ??
    0
  );


  const enteredPayable =
    finalPayable === ""
      ? null
      : Number(finalPayable);


  const validPayable =
    enteredPayable !== null &&
    Number.isFinite(enteredPayable) &&
    enteredPayable >= 0 &&
    enteredPayable <=
      originalTotal + 0.009;


  const normalizedNotes =
    String(reviewNotes || "")
      .trim();


  const reviewable =
    review?.settlement_status ===
    "manual_review_required";


  const projectedOutstanding =
    validPayable
      ? Math.max(
          0,
          enteredPayable -
            Math.max(
              0,
              currentNetPaid
            )
        )
      : 0;


  const projectedRefund =
    validPayable
      ? Math.max(
          0,
          currentNetPaid -
            enteredPayable
        )
      : 0;


  const canSubmit =
    !loading &&
    !processing &&
    reviewable &&
    validPayable &&
    normalizedNotes.length > 0 &&
    normalizedNotes.length <= 500;


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
        aria-labelledby="financial-review-title"
      >
        <h3 id="financial-review-title">
          Financial Settlement Review
        </h3>

        <p>
          Review{" "}
          <strong>
            {booking.booking_code}
          </strong>
          {" "}before finalizing the{" "}
          {settlementLabel} payable amount.
        </p>


        {loading ? (
          <div className="bookings-loading">
            Loading financial review...
          </div>
        ) : (
          <>
            <div className="booking-detail-section">

              <div className="booking-detail-row">
                <span>
                  Settlement
                </span>

                <strong>
                  {settlementLabel}
                </strong>
              </div>


              <div className="booking-detail-row">
                <span>
                  Original Booking Amount
                </span>

                <strong>
                  {formatCurrency(
                    originalTotal
                  )}
                </strong>
              </div>


              <div className="booking-detail-row">
                <span>
                  Net Paid
                </span>

                <strong>
                  {formatCurrency(
                    currentNetPaid
                  )}
                </strong>
              </div>


              <div className="booking-detail-row">
                <span>
                  Review Trigger
                </span>

                <strong>
                  {review?.review_notes ||
                    "Manual financial review required."}
                </strong>
              </div>


              <div className="booking-detail-row">
                <span>
                  Final Payable *
                </span>

                <div className="booking-search">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={originalTotal}
                    value={finalPayable}
                    disabled={
                      processing ||
                      !reviewable
                    }
                    placeholder="Enter final payable"
                    aria-label="Final payable amount"
                    onChange={(event) =>
                      onChangeFinalPayable(
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>


              <div className="booking-detail-row">
                <span>
                  Review Notes *
                </span>

                <div className="booking-search">
                  <input
                    type="text"
                    maxLength={500}
                    value={reviewNotes}
                    disabled={
                      processing ||
                      !reviewable
                    }
                    placeholder="Explain the final settlement decision"
                    aria-label="Financial review notes"
                    onChange={(event) =>
                      onChangeReviewNotes(
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>


              {validPayable && (
                <>
                  <div className="booking-detail-row">
                    <span>
                      Balance After Review
                    </span>

                    <strong>
                      {formatCurrency(
                        projectedOutstanding
                      )}
                    </strong>
                  </div>

                  <div className="booking-detail-row">
                    <span>
                      Refund Due After Review
                    </span>

                    <strong>
                      {formatCurrency(
                        projectedRefund
                      )}
                    </strong>
                  </div>
                </>
              )}

            </div>


            <p>
              Original booking amount will remain unchanged.
              This review only finalizes the lifecycle settlement
              payable.
            </p>


            <p>
              Any remaining balance will use the existing payment
              flow. Any overpayment will use the existing refund
              flow.
            </p>


            {!reviewable &&
              review && (
                <div className="booking-dialog-error">
                  This settlement is no longer waiting for
                  manual review.
                </div>
              )}


            {finalPayable !== "" &&
              !validPayable && (
                <div className="booking-dialog-error">
                  Final payable must be between ₹0 and{" "}
                  {formatCurrency(
                    originalTotal
                  )}.
                </div>
              )}
          </>
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
            Close
          </button>

          <button
            type="button"
            className="booking-btn-primary"
            disabled={!canSubmit}
            onClick={onConfirm}
          >
            {processing
              ? "Finalizing..."
              : "Finalize Settlement"}
          </button>
        </div>
      </div>
    </div>
  );
}


export default FinancialSettlementReviewDialog;