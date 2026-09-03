import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import apiClient from "../../../services/apiClient";
import AppAlert from "../../../components/common/AppAlert";
import {
  formatCurrency,
  getApiMessage,
} from "../../BookingDesk/bookingUtils";

const PAYMENT_METHODS = [
  ["cash", "Cash"],
  ["card", "Card"],
  ["upi", "UPI"],
  ["bank_transfer", "Bank Transfer"],
];

const PAYMENT_STATUSES = new Set([
  "confirmed",
  "checked_in",
  "no_show",
]);

function GroupPaymentDialog({
  group,
  onClose,
  onChanged,
}) {
  const [mode, setMode] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const hasFinancialReview = useMemo(
    () =>
      Array.isArray(group?.bookings) &&
      group.bookings.some(
        (booking) =>
          Number(
            booking.financial_review_required || 0
          ) === 1
      ),
    [group]
  );


  const eligibleBookings = useMemo(() => {
    const bookings = Array.isArray(group?.bookings)
      ? group.bookings
      : [];

    return bookings.filter((booking) => {
      const status = String(
        booking.booking_status || ""
      )
        .trim()
        .toLowerCase();

      const outstanding = Number(
        booking.outstanding_amount || 0
      );

      const reviewRequired =
        Number(
          booking.financial_review_required || 0
        ) === 1;

      return (
        PAYMENT_STATUSES.has(status) &&
        outstanding > 0.009 &&
        !reviewRequired
      );
    });
  }, [group]);


  useEffect(() => {
    if (
      hasFinancialReview &&
      mode === "all"
    ) {
      setMode("selected");
      setAmount("");
      setError("");
      setResult(null);
    }
  }, [
    hasFinancialReview,
    mode,
  ]);

  const selectedBookings =
    mode === "all"
      ? eligibleBookings
      : eligibleBookings.filter((booking) =>
          selectedIds.includes(
            Number(booking.booking_id)
          )
        );

  const selectedOutstanding = Number(
    selectedBookings
      .reduce(
        (total, booking) =>
          total +
          Number(
            booking.outstanding_amount || 0
          ),
        0
      )
      .toFixed(2)
  );

  if (!group) return null;

  function toggleBooking(bookingId) {
    const id = Number(bookingId);

    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );

    setError("");
    setResult(null);
  }

  function useFullOutstanding() {
    if (selectedOutstanding > 0) {
      setAmount(
        selectedOutstanding.toFixed(2)
      );
    }
  }

  function validate() {
    const paymentAmount = Number(amount);

    if (
        mode === "all" &&
        hasFinancialReview
    ) {
        return (
        "Entire-group payment is unavailable until all financial reviews are resolved. Select specific room bookings instead."
        );
    }

    if (
      mode === "selected" &&
      selectedIds.length === 0
    ) {
      return "Select at least one room booking.";
    }

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      return "Enter a valid payment amount.";
    }

    if (
      paymentAmount >
      selectedOutstanding + 0.009
    ) {
      return `Maximum payable amount is ${formatCurrency(
        selectedOutstanding
      )}.`;
    }

    if (
      !PAYMENT_METHODS.some(
        ([value]) => value === method
      )
    ) {
      return "Select a valid payment method.";
    }

    if (
      method !== "cash" &&
      !transactionId.trim()
    ) {
      return "Transaction ID is required for non-cash payments.";
    }

    if (transactionId.trim().length > 255) {
      return "Transaction ID is too long.";
    }

    if (notes.trim().length > 500) {
      return "Notes cannot exceed 500 characters.";
    }

    return "";
  }

  async function submitPayment() {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        amount: Number(amount),
        payment_method: method,
        transaction_id:
          method === "cash"
            ? null
            : transactionId.trim(),
        notes: notes.trim() || null,
      };

      if (mode === "selected") {
        payload.booking_ids = selectedIds;
      }

      const response = await apiClient.post(
        `/bookings/groups/${group.reservation_group_id}/payments`,
        payload
      );

      const paymentResult =
        response.data?.data || null;

      setResult(paymentResult);

      if (typeof onChanged === "function") {
        await onChanged(paymentResult);
      }
    } catch (requestError) {
      setError(
        getApiMessage(
          requestError,
          "The group payment could not be recorded."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="booking-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !submitting
        ) {
          onClose();
        }
      }}
    >
      <div
        className="booking-view-modal group-payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-payment-title"
      >
        <div className="booking-modal-header">
          <div>
            <h3 id="group-payment-title">
              Group Payment
            </h3>
            <p>{group.group_code}</p>
          </div>

          <button
            type="button"
            className="booking-modal-close"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close group payment"
          >
            ×
          </button>
        </div>

        <AppAlert
          type="error"
          message={error}
          onClose={() => setError("")}
        />

        <div className="booking-view-body">
          <section className="booking-detail-section">
            <h4>Payment Scope</h4>

            <label className="group-payment-option">
              <input
                type="radio"
                name="group-payment-mode"
                checked={mode === "all"}
                disabled={
                    submitting ||
                    hasFinancialReview
                }
                onChange={() => {
                  setMode("all");
                  setError("");
                  setResult(null);
                }}
              />
              Entire eligible reservation group
            </label>

            <label className="group-payment-option">
              <input
                type="radio"
                name="group-payment-mode"
                checked={mode === "selected"}
                disabled={submitting}
                onChange={() => {
                  setMode("selected");
                  setError("");
                  setResult(null);
                }}
              />
              Selected room bookings
            </label>
          </section>

          {hasFinancialReview && (
            <div className="booking-special-request">
              One or more rooms require financial review.
              Entire-group payment is temporarily unavailable.
              You can still collect payment for specific eligible rooms.
            </div>
          )}

          <section className="booking-detail-section">
            <h4>Room Outstanding</h4>

            {eligibleBookings.length === 0 ? (
              <div className="booking-special-request">
                No booking currently has an eligible outstanding payment.
              </div>
            ) : (
              eligibleBookings.map((booking) => {
                const bookingId = Number(
                  booking.booking_id
                );

                return (
                  <label
                    key={bookingId}
                    className="group-payment-room"
                  >
                    {mode === "selected" && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(
                          bookingId
                        )}
                        disabled={submitting}
                        onChange={() =>
                          toggleBooking(bookingId)
                        }
                      />
                    )}

                    <span>
                      <strong>
                        {booking.booking_code}
                        {" · "}
                        Room {booking.room_number}
                      </strong>

                      <small>
                        {String(
                          booking.booking_status ||
                          ""
                        ).replaceAll("_", " ")}
                      </small>
                    </span>

                    <strong>
                      {formatCurrency(
                        booking.outstanding_amount
                      )}
                    </strong>
                  </label>
                );
              })
            )}

            <div className="booking-detail-row">
              <span>Selected Outstanding</span>
              <strong>
                {formatCurrency(
                  selectedOutstanding
                )}
              </strong>
            </div>
          </section>

          {!result && eligibleBookings.length > 0 && (
            <section className="booking-detail-section">
              <h4>Payment Details</h4>

              <div className="group-payment-field">
                <label htmlFor="group-payment-amount">
                  Amount
                </label>

                <div className="group-payment-amount-row">
                  <input
                    id="group-payment-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    disabled={submitting}
                    onChange={(event) =>
                      setAmount(event.target.value)
                    }
                  />

                  <button
                    type="button"
                    className="booking-btn-secondary"
                    disabled={
                      submitting ||
                      selectedOutstanding <= 0
                    }
                    onClick={useFullOutstanding}
                  >
                    Full Due
                  </button>
                </div>
              </div>

              <div className="group-payment-field">
                <label htmlFor="group-payment-method">
                  Payment Method
                </label>

                <select
                  id="group-payment-method"
                  value={method}
                  disabled={submitting}
                  onChange={(event) => {
                    const nextMethod =
                      event.target.value;

                    setMethod(nextMethod);

                    if (nextMethod === "cash") {
                      setTransactionId("");
                    }
                  }}
                >
                  {PAYMENT_METHODS.map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {method !== "cash" && (
                <div className="group-payment-field">
                  <label htmlFor="group-payment-reference">
                    Transaction ID
                  </label>

                  <input
                    id="group-payment-reference"
                    type="text"
                    maxLength="255"
                    value={transactionId}
                    disabled={submitting}
                    onChange={(event) =>
                      setTransactionId(
                        event.target.value
                      )
                    }
                  />
                </div>
              )}

              <div className="group-payment-field">
                <label htmlFor="group-payment-notes">
                  Notes
                </label>

                <textarea
                  id="group-payment-notes"
                  rows="3"
                  maxLength="500"
                  value={notes}
                  disabled={submitting}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                />
              </div>
            </section>
          )}

          {result && (
            <section className="booking-detail-section">
              <h4>Payment Recorded</h4>

              <div className="booking-detail-row">
                <span>Amount Received</span>
                <strong>
                  {formatCurrency(
                    result.amountReceived
                  )}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Remaining Outstanding</span>
                <strong>
                  {formatCurrency(
                    result.outstandingAfter
                  )}
                </strong>
              </div>

              {(result.allocations || []).map(
                (allocation) => (
                  <div
                    className="booking-detail-row"
                    key={allocation.paymentId}
                  >
                    <span>
                      {allocation.bookingCode}
                    </span>

                    <strong>
                      {formatCurrency(
                        allocation.allocatedAmount
                      )}
                    </strong>
                  </div>
                )
              )}
            </section>
          )}
        </div>

        <div className="booking-confirm-actions">
          <button
            type="button"
            className="booking-btn-secondary"
            disabled={submitting}
            onClick={onClose}
          >
            {result ? "Done" : "Close"}
          </button>

          {!result && (
            <button
              type="button"
              className="booking-btn-primary"
              disabled={
                submitting ||
                eligibleBookings.length === 0 ||
                selectedOutstanding <= 0
              }
              onClick={() =>
                void submitPayment()
              }
            >
              {submitting
                ? "Recording..."
                : "Collect Payment"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupPaymentDialog;