import apiClient from "../../../shared/api/apiClient";

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function resolvePaymentStage(
  booking,
  amount
) {
  const status =
    normalizeStatus(
      booking?.booking_status
    );

  if (
    status === "cancelled" ||
    status === "no_show"
  ) {
    return "other";
  }

  if (
    status === "confirmed"
  ) {
    return "advance";
  }

  const outstanding =
    Number(
      booking?.outstanding_amount ||
      0
    );

  return amount + 0.009 >=
    outstanding
      ? "checkout"
      : "during_stay";
}

export function getFinancialSettlementReview(
  bookingId
) {
  return apiClient.get(
    `/bookings/${bookingId}/financial-settlement-review`
  );
}

export function finalizeFinancialSettlementReview(
  bookingId,
  {
    finalPayableAmount,
    reviewNotes,
  }
) {
  return apiClient.post(
    `/bookings/${bookingId}/financial-settlement-review/finalize`,
    {
      final_payable_amount:
        finalPayableAmount,

      review_notes:
        reviewNotes,
    }
  );
}

export function collectBookingPayment(
  booking,
  {
    amount,
    method,
    transactionId,
    notes,
  }
) {
  return apiClient.post(
    `/bookings/${booking.booking_id}/payments`,
    {
      amount,

      payment_method:
        method,

      payment_stage:
        resolvePaymentStage(
          booking,
          amount
        ),

      transaction_id:
        method === "cash"
          ? null
          : String(
              transactionId || ""
            ).trim(),

      notes:
        String(
          notes || ""
        ).trim() ||
        null,
    }
  );
}

export function processLifecycleRefund(
  booking,
  {
    method,
    transactionId,
    notes,
  }
) {
  const status =
    normalizeStatus(
      booking?.booking_status
    );

  const refundPath =
    status === "cancelled"
      ? "cancellation-refund"
      : status === "no_show"
        ? "no-show-refund"
        : null;

  if (!refundPath) {
    throw new Error(
      "This booking is not eligible for a lifecycle settlement refund."
    );
  }

  return apiClient.post(
    `/bookings/${booking.booking_id}/${refundPath}`,
    {
      refund_method:
        method,

      transaction_id:
        method === "cash"
          ? null
          : String(
              transactionId || ""
            ).trim(),

      notes:
        String(
          notes || ""
        ).trim() ||
        null,
    }
  );
}