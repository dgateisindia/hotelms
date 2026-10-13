import { useState } from "react";

import {
  getApiErrorMessage,
} from "../../../shared/api/apiClient";

import {
  collectBookingPayment,
  finalizeFinancialSettlementReview,
  getFinancialSettlementReview,
  processLifecycleRefund,
} from "../api/reservationFinancialApi";

function useReservationFinancialActions({
  group,
  refreshGroup,
}) {
  const [
    operationSuccess,
    setOperationSuccess,
  ] = useState("");

  /* =========================================================
     FINANCIAL REVIEW
  ========================================================= */

  const [
    financialReviewBooking,
    setFinancialReviewBooking,
  ] = useState(null);

  const [
    financialReviewData,
    setFinancialReviewData,
  ] = useState(null);

  const [
    financialReviewFinalPayable,
    setFinancialReviewFinalPayable,
  ] = useState("");

  const [
    financialReviewNotes,
    setFinancialReviewNotes,
  ] = useState("");

  const [
    financialReviewLoading,
    setFinancialReviewLoading,
  ] = useState(false);

  const [
    financialReviewProcessing,
    setFinancialReviewProcessing,
  ] = useState(false);

  const [
    financialReviewError,
    setFinancialReviewError,
  ] = useState("");

  /* =========================================================
     PAYMENT
  ========================================================= */

  const [
    paymentBooking,
    setPaymentBooking,
  ] = useState(null);

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("cash");

  const [
    paymentTransactionId,
    setPaymentTransactionId,
  ] = useState("");

  const [
    paymentNotes,
    setPaymentNotes,
  ] = useState("");

  const [
    paymentProcessing,
    setPaymentProcessing,
  ] = useState(false);

  const [
    paymentError,
    setPaymentError,
  ] = useState("");

  /* =========================================================
     REFUND
  ========================================================= */

  const [
    refundBooking,
    setRefundBooking,
  ] = useState(null);

  const [
    refundMethod,
    setRefundMethod,
  ] = useState("cash");

  const [
    refundTransactionId,
    setRefundTransactionId,
  ] = useState("");

  const [
    refundNotes,
    setRefundNotes,
  ] = useState("");

  const [
    refundProcessing,
    setRefundProcessing,
  ] = useState(false);

  const [
    refundError,
    setRefundError,
  ] = useState("");

  /* =========================================================
     REVIEW
  ========================================================= */

  async function openFinancialSettlementReview(
    booking
  ) {
    setFinancialReviewBooking(
      booking
    );

    setFinancialReviewData(
      null
    );

    setFinancialReviewFinalPayable(
      ""
    );

    setFinancialReviewNotes(
      ""
    );

    setFinancialReviewError(
      ""
    );

    setFinancialReviewLoading(
      true
    );

    try {
      const response =
        await getFinancialSettlementReview(
          booking.booking_id
        );

      const review =
        response.data?.data ||
        null;

      setFinancialReviewData(
        review
      );

      setFinancialReviewFinalPayable(
        review?.final_payable_amount ===
          null ||
        review?.final_payable_amount ===
          undefined
          ? ""
          : String(
              review.final_payable_amount
            )
      );
    } catch (
      error
    ) {
      setFinancialReviewError(
        getApiErrorMessage(
          error
        )
      );
    } finally {
      setFinancialReviewLoading(
        false
      );
    }
  }

  function closeFinancialSettlementReview() {
    if (
      financialReviewProcessing
    ) {
      return;
    }

    setFinancialReviewBooking(
      null
    );

    setFinancialReviewData(
      null
    );

    setFinancialReviewFinalPayable(
      ""
    );

    setFinancialReviewNotes(
      ""
    );

    setFinancialReviewError(
      ""
    );
  }

  async function confirmFinancialSettlementReview() {
    if (
      !financialReviewBooking ||
      !financialReviewData
    ) {
      return;
    }

    const finalPayable =
      Number(
        financialReviewFinalPayable
      );

    const originalTotal =
      Number(
        financialReviewData
          .original_total_amount ||
        0
      );

    const reviewNotes =
      financialReviewNotes
        .trim();

    if (
      !Number.isFinite(
        finalPayable
      ) ||
      finalPayable < 0 ||
      finalPayable >
        originalTotal + 0.009
    ) {
      setFinancialReviewError(
        "Enter a valid final payable amount within the original booking amount."
      );

      return;
    }

    if (!reviewNotes) {
      setFinancialReviewError(
        "Enter review notes explaining the final settlement amount."
      );

      return;
    }

    if (
      reviewNotes.length >
      500
    ) {
      setFinancialReviewError(
        "Financial review notes cannot exceed 500 characters."
      );

      return;
    }

    setFinancialReviewProcessing(
      true
    );

    setFinancialReviewError(
      ""
    );

    setOperationSuccess(
      ""
    );

    try {
      const response =
        await finalizeFinancialSettlementReview(
          financialReviewBooking
            .booking_id,
          {
            finalPayableAmount:
              finalPayable,

            reviewNotes,
          }
        );

      setFinancialReviewBooking(
        null
      );

      setFinancialReviewData(
        null
      );

      setFinancialReviewFinalPayable(
        ""
      );

      setFinancialReviewNotes(
        ""
      );

      setFinancialReviewError(
        ""
      );

      setOperationSuccess(
        response.data?.message ||
        "Financial settlement review finalized successfully."
      );

      await refreshGroup();
    } catch (
      error
    ) {
      setFinancialReviewError(
        getApiErrorMessage(
          error
        )
      );
    } finally {
      setFinancialReviewProcessing(
        false
      );
    }
  }

  /* =========================================================
     PAYMENT
  ========================================================= */

  function openCollectPayment(
    booking
  ) {
    const outstanding =
      Number(
        booking?.outstanding_amount ||
        0
      );

    setPaymentBooking({
      ...booking,

      full_name:
        booking?.full_name ||
        group?.customer
          ?.full_name ||
        "Guest",
    });

    setPaymentAmount(
      outstanding > 0
        ? outstanding.toFixed(2)
        : ""
    );

    setPaymentMethod(
      "cash"
    );

    setPaymentTransactionId(
      ""
    );

    setPaymentNotes(
      ""
    );

    setPaymentError(
      ""
    );
  }

  function closeCollectPayment() {
    if (
      paymentProcessing
    ) {
      return;
    }

    setPaymentBooking(
      null
    );

    setPaymentAmount(
      ""
    );

    setPaymentMethod(
      "cash"
    );

    setPaymentTransactionId(
      ""
    );

    setPaymentNotes(
      ""
    );

    setPaymentError(
      ""
    );
  }

  async function confirmCollectPayment() {
    if (
      !paymentBooking
    ) {
      return;
    }

    const amount =
      Number(
        paymentAmount
      );

    const outstanding =
      Number(
        paymentBooking
          .outstanding_amount ||
        0
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0 ||
      amount >
        outstanding + 0.009
    ) {
      setPaymentError(
        "Enter a valid payment amount within the outstanding balance."
      );

      return;
    }

    if (
      paymentMethod !==
        "cash" &&
      !paymentTransactionId
        .trim()
    ) {
      setPaymentError(
        "Transaction ID is required for non-cash payments."
      );

      return;
    }

    setPaymentProcessing(
      true
    );

    setPaymentError(
      ""
    );

    setOperationSuccess(
      ""
    );

    try {
      const response =
        await collectBookingPayment(
          paymentBooking,
          {
            amount,

            method:
              paymentMethod,

            transactionId:
              paymentTransactionId,

            notes:
              paymentNotes,
          }
        );

      setPaymentBooking(
        null
      );

      setPaymentAmount(
        ""
      );

      setPaymentMethod(
        "cash"
      );

      setPaymentTransactionId(
        ""
      );

      setPaymentNotes(
        ""
      );

      setPaymentError(
        ""
      );

      setOperationSuccess(
        response.data?.message ||
        "Payment collected successfully."
      );

      await refreshGroup();
    } catch (
      error
    ) {
      setPaymentError(
        getApiErrorMessage(
          error
        )
      );
    } finally {
      setPaymentProcessing(
        false
      );
    }
  }

  /* =========================================================
     REFUND
  ========================================================= */

  function openLifecycleRefund(
    booking
  ) {
    setRefundBooking({
      ...booking,

      full_name:
        booking?.full_name ||
        group?.customer
          ?.full_name ||
        "Guest",
    });

    setRefundMethod(
      "cash"
    );

    setRefundTransactionId(
      ""
    );

    setRefundNotes(
      ""
    );

    setRefundError(
      ""
    );
  }

  function closeLifecycleRefund() {
    if (
      refundProcessing
    ) {
      return;
    }

    setRefundBooking(
      null
    );

    setRefundMethod(
      "cash"
    );

    setRefundTransactionId(
      ""
    );

    setRefundNotes(
      ""
    );

    setRefundError(
      ""
    );
  }

  async function confirmLifecycleRefund() {
    if (
      !refundBooking
    ) {
      return;
    }

    if (
      refundMethod !==
        "cash" &&
      !refundTransactionId
        .trim()
    ) {
      setRefundError(
        "Transaction ID is required for non-cash refunds."
      );

      return;
    }

    setRefundProcessing(
      true
    );

    setRefundError(
      ""
    );

    setOperationSuccess(
      ""
    );

    try {
      const response =
        await processLifecycleRefund(
          refundBooking,
          {
            method:
              refundMethod,

            transactionId:
              refundTransactionId,

            notes:
              refundNotes,
          }
        );

      setRefundBooking(
        null
      );

      setRefundMethod(
        "cash"
      );

      setRefundTransactionId(
        ""
      );

      setRefundNotes(
        ""
      );

      setRefundError(
        ""
      );

      setOperationSuccess(
        response.data?.message ||
        "Refund processed successfully."
      );

      await refreshGroup();
    } catch (
      error
    ) {
      setRefundError(
        getApiErrorMessage(
          error
        )
      );
    } finally {
      setRefundProcessing(
        false
      );
    }
  }

  return {
    operationSuccess,

    clearOperationSuccess: () =>
      setOperationSuccess(
        ""
      ),

    financialReviewBooking,
    financialReviewData,
    financialReviewFinalPayable,
    financialReviewNotes,
    financialReviewLoading,
    financialReviewProcessing,
    financialReviewError,

    setFinancialReviewFinalPayable,
    setFinancialReviewNotes,

    openFinancialSettlementReview,
    closeFinancialSettlementReview,
    confirmFinancialSettlementReview,

    paymentBooking,
    paymentAmount,
    paymentMethod,
    paymentTransactionId,
    paymentNotes,
    paymentProcessing,
    paymentError,

    setPaymentAmount,
    setPaymentMethod,
    setPaymentTransactionId,
    setPaymentNotes,

    openCollectPayment,
    closeCollectPayment,
    confirmCollectPayment,

    refundBooking,
    refundMethod,
    refundTransactionId,
    refundNotes,
    refundProcessing,
    refundError,

    setRefundMethod,
    setRefundTransactionId,
    setRefundNotes,

    openLifecycleRefund,
    closeLifecycleRefund,
    confirmLifecycleRefund,
  };
}

export default useReservationFinancialActions;