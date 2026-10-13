import React, { useEffect, useMemo, useState } from "react";
import apiClient, { getApiErrorMessage } from "../../../shared/api/apiClient";
import AppAlert from "../../../shared/components/ui/AppAlert";
import { formatCurrency } from "../../../shared/utils/money";
import "./GroupPaymentDialog.css";

/*
 * Mirrors the backend reservation-group allocation contract:
 *
 * 1. booking_id ascending
 * 2. each booking receives min(remaining, outstanding)
 * 3. legacy/missing policy allows partial allocation
 * 4. allow_partial_payment=false requires that booking's
 *    complete outstanding amount if allocation reaches it
 *
 * Backend remains authoritative and transactionally atomic.
 */
export function getGroupPartialPaymentPolicyState(
  bookings,
  amount
) {

  const paymentAmount =
    Number(
      amount
    );


  if (
    !Number.isFinite(
      paymentAmount
    ) ||
    paymentAmount <= 0
  ) {

    return {
      valid:
        true,

      blockedBooking:
        null,

      nextBoundary:
        null,
    };
  }


  const orderedBookings =
    (
      Array.isArray(
        bookings
      )
        ? [...bookings]
        : []
    )
      .sort(
        (left, right) =>
          Number(
            left?.booking_id || 0
          ) -
          Number(
            right?.booking_id || 0
          )
      );


  let remaining =
    Number(
      paymentAmount.toFixed(2)
    );


  let allocatedBefore =
    0;


  for (
    const booking
    of orderedBookings
  ) {

    if (
      remaining <= 0.009
    ) {
      break;
    }


    const outstanding =
      Number(
        Math.max(
          0,
          Number(
            booking
              ?.outstanding_amount ||
            0
          )
        ).toFixed(2)
      );


    if (
      outstanding <= 0.009
    ) {
      continue;
    }


    const allocation =
      Number(
        Math.min(
          remaining,
          outstanding
        ).toFixed(2)
      );


    const allowPartial =
      booking
        ?.payment_policy
        ?.allow_partial_payment !==
      false;


    if (
      !allowPartial &&
      allocation +
        0.009 <
        outstanding
    ) {

      return {
        valid:
          false,

        blockedBooking:
          booking,

        nextBoundary:
          Number(
            (
              allocatedBefore +
              outstanding
            ).toFixed(2)
          ),
      };
    }


    remaining =
      Number(
        (
          remaining -
          allocation
        ).toFixed(2)
      );


    allocatedBefore =
      Number(
        (
          allocatedBefore +
          allocation
        ).toFixed(2)
      );
  }


  return {
    valid:
      true,

    blockedBooking:
      null,

    nextBoundary:
      null,
  };
}


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


/*
 * Checkout payment authority comes from the immutable
 * booking payment-policy snapshot.
 *
 * Missing / legacy payment policy preserves the historical
 * HMS rule: full payment is required before check-out.
 */
export function canContinueCheckoutAfterGroupPayment(
  bookings,
  result
) {

  if (
    !Array.isArray(
      bookings
    ) ||
    bookings.length === 0 ||
    !result
  ) {
    return false;
  }


  const allocationByBookingId =
    new Map(
      (
        Array.isArray(
          result.allocations
        )
          ? result.allocations
          : []
      ).map(
        (allocation) => [
          Number(
            allocation?.bookingId ||
            0
          ),

          Number(
            allocation?.outstandingAfter ??
            0
          ),
        ]
      )
    );


  return bookings.every(
    (booking) => {

      const mayCheckoutWithOutstanding =
        booking
          ?.payment_policy
          ?.full_payment_required_before_checkout ===
        false;


      if (
        mayCheckoutWithOutstanding
      ) {
        return true;
      }


      const bookingId =
        Number(
          booking?.booking_id ||
          0
        );


      const projectedOutstanding =
        allocationByBookingId.has(
          bookingId
        )
          ? Number(
              allocationByBookingId.get(
                bookingId
              ) ||
              0
            )
          : Number(
              booking
                ?.outstanding_amount ||
              0
            );


      return (
        projectedOutstanding <=
        0.009
      );
    }
  );
}


function GroupPaymentDialog({
  group,
  initialBookingIds = [],
  onClose,
  onChanged,
  onContinueToCheckout,
}) {
  const checkoutBookingIds =
    Array.isArray(
      initialBookingIds
    )
      ? initialBookingIds
          .map((value) =>
            Number(value)
          )
          .filter(
            (value) =>
              Number.isSafeInteger(
                value
              ) &&
              value > 0
          )
      : [];

  const checkoutFlow =
    checkoutBookingIds.length > 0;

  const checkoutOutstanding =
    Number(
      (
        Array.isArray(
          group?.bookings
        )
          ? group.bookings
          : []
      )
        .filter((booking) =>
          checkoutBookingIds.includes(
            Number(
              booking?.booking_id ||
                0
            )
          )
        )
        .reduce(
          (total, booking) =>
            total +
            Number(
              booking?.outstanding_amount ||
                0
            ),
          0
        )
        .toFixed(2)
    );

  const [mode, setMode] =
    useState(
      checkoutFlow
        ? "selected"
        : "all"
    );

  const [
    selectedIds,
    setSelectedIds,
  ] = useState(
    checkoutBookingIds
  );

  const [amount, setAmount] =
    useState(
      checkoutOutstanding > 0
        ? checkoutOutstanding.toFixed(2)
        : ""
    );
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
      !checkoutFlow &&
      hasFinancialReview &&
      mode === "all"
    ) {
      setMode("selected");
      setAmount("");
      setError("");
      setResult(null);
    }
  }, [
    checkoutFlow,
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


  const commonPaymentMethods =
    selectedBookings.length === 0
      ? PAYMENT_METHODS
      : PAYMENT_METHODS.filter(
          ([value]) =>
            selectedBookings.every(
              (booking) => {

                const policyMethods =
                  booking?.payment_policy
                    ?.allowed_methods;


                if (
                  !Array.isArray(
                    policyMethods
                  )
                ) {
                  return true;
                }


                return policyMethods.some(
                  (methodValue) =>
                    String(
                      methodValue || ""
                    )
                      .trim()
                      .toLowerCase() ===
                    value
                );
              }
            )
        );


  const commonPaymentMethodKey =
    commonPaymentMethods
      .map(
        ([value]) => value
      )
      .join("|");


  useEffect(() => {

    if (
      commonPaymentMethods.length ===
        0
    ) {

      if (method !== "") {
        setMethod("");
        setTransactionId("");
      }

      return;
    }


    const methodStillAllowed =
      commonPaymentMethods.some(
        ([value]) =>
          value === method
      );


    if (!methodStillAllowed) {
      setMethod(
        commonPaymentMethods[0][0]
      );

      setTransactionId("");
    }
  }, [
    commonPaymentMethodKey,
    method,
  ]);

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


  const enteredPaymentAmount =
    Number(
      amount
    );


  const groupPartialPolicy =
    getGroupPartialPaymentPolicyState(
      selectedBookings,
      enteredPaymentAmount
    );


  const partialPolicyMessage =
    !groupPartialPolicy.valid &&
    groupPartialPolicy.blockedBooking
      ? `${
          groupPartialPolicy
            .blockedBooking
            .booking_code ||
          "This booking"
        } does not allow partial payments. The payment must reach ${formatCurrency(
          groupPartialPolicy
            .nextBoundary
        )} to fully clear that room, or use a lower valid amount that ends before it.`
      : "";


  const canContinueToCheckout =
    Boolean(
      result
    ) &&
    typeof onContinueToCheckout ===
      "function" &&
    canContinueCheckoutAfterGroupPayment(
      selectedBookings,
      result
    );


  const checkoutOutstandingPermitted =
    canContinueToCheckout &&
    Number(
      result?.outstandingAfter ||
        0
    ) >
      0.009;

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


    const allocationPolicy =
      getGroupPartialPaymentPolicyState(
        selectedBookings,
        paymentAmount
      );


    if (
      !allocationPolicy.valid &&
      allocationPolicy.blockedBooking
    ) {

      return `${
        allocationPolicy
          .blockedBooking
          .booking_code ||
        "This booking"
      } does not allow partial payments. Enter ${formatCurrency(
        allocationPolicy
          .nextBoundary
      )} to fully clear that room, or use a lower valid amount that ends before it.`;
    }


    if (
      commonPaymentMethods.length ===
        0
    ) {
      return "Selected bookings do not share a common allowed payment method.";
    }

    if (
      !commonPaymentMethods.some(
        ([value]) => value === method
      )
    ) {
      return "Select a payment method allowed for every selected booking.";
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
      setError(getApiErrorMessage(requestError));
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


                {partialPolicyMessage && (
                  <div className="booking-special-request">
                    {partialPolicyMessage}
                  </div>
                )}
              </div>

              <div className="group-payment-field">
                <label htmlFor="group-payment-method">
                  Payment Method
                </label>

                <select
                  id="group-payment-method"
                  value={method}
                  disabled={
                    submitting ||
                    commonPaymentMethods.length === 0
                  }
                  onChange={(event) => {
                    const nextMethod =
                      event.target.value;

                    setMethod(nextMethod);

                    if (nextMethod === "cash") {
                      setTransactionId("");
                    }
                  }}
                >
                  {commonPaymentMethods.length === 0 && (
                    <option value="">
                      No common payment method
                    </option>
                  )}

                  {commonPaymentMethods.map(
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

              {method && method !== "cash" && (
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

              {checkoutOutstandingPermitted && (
                <div className="booking-special-request">
                  Check-out may continue with the remaining balance.
                  The outstanding amount will remain recorded as a
                  receivable under the booking payment policy.
                </div>
              )}


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
                selectedOutstanding <= 0 ||
                commonPaymentMethods.length === 0 ||
                (
                  Number.isFinite(
                    enteredPaymentAmount
                  ) &&
                  enteredPaymentAmount >
                    0 &&
                  !groupPartialPolicy.valid
                )
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

          {canContinueToCheckout && (
            <button
              type="button"
              className="booking-btn-primary"
              disabled={submitting}
              onClick={
                onContinueToCheckout
              }
            >
              Continue to Check-Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupPaymentDialog;