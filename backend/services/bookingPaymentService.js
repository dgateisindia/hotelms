/* ============================================================
   BOOKING PAYMENT SERVICE

   Purpose:
   - Calculate booking payment status
   - Calculate paid / refunded / outstanding amounts
   - Synchronize booking payment status
   - Apply initial booking payment

   Important:
   Database operations use the active transaction connection.
============================================================ */


/* ============================================================
   SERVICE ERROR
============================================================ */

function throwHttp(
  status,
  code,
  message
) {
  const error =
    new Error(message);

  error.status =
    status;

  error.code =
    code;

  throw error;
}


/* ============================================================
   PAYMENT STATUS
============================================================ */

function calculatePaymentStatus(
  totalAmount,
  netPaid
) {
  const total =
    Math.max(
      0,
      Number(
        totalAmount || 0
      )
    );


  const paid =
    Math.max(
      0,
      Number(
        netPaid || 0
      )
    );


  /*
   * Zero-payable bookings are financially settled even when
   * no money was collected.
   */
  if (
    total <= 0.009
  ) {
    return "paid";
  }


  if (
    paid <= 0
  ) {
    return "unpaid";
  }


  if (
    paid + 0.009 <
    total
  ) {
    return "partial";
  }


  return "paid";
}


/* ============================================================
   LOCKED PAYMENT STATE
============================================================ */

async function getLockedPaymentState(
  connection,
  hotelId,
  bookingId,
  totalAmount
) {
  const [payments] =
    await connection.query(
      `
        SELECT
          amount,
          transaction_type,
          payment_status

        FROM payments

        WHERE hotel_id = ?
          AND booking_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  let grossPaid = 0;
  let refunded = 0;


  for (
    const payment of payments
  ) {
    if (
      payment.payment_status !==
      "success"
    ) {
      continue;
    }


    const amount =
      Number(
        payment.amount || 0
      );


    if (
      payment.transaction_type ===
      "refund"
    ) {
      refunded += amount;
    } else {
      grossPaid += amount;
    }
  }


  const netPaid =
    Number(
      (
        grossPaid -
        refunded
      ).toFixed(2)
    );


  const paymentStatus =
    calculatePaymentStatus(
      totalAmount,
      netPaid
    );


  return {
    grossPaid,
    refunded,
    netPaid,
    paymentStatus,

    outstandingAmount:
      Math.max(
        0,
        Number(totalAmount) -
          Math.max(
            0,
            netPaid
          )
      ),
  };
}

async function resolveLockedPaymentTarget(
  connection,
  {
    hotelId,
    booking,
  }
) {
  const originalTotalAmount =
    Number(
      booking?.total_amount
    );


  if (
    !Number.isFinite(
      originalTotalAmount
    ) ||
    originalTotalAmount < 0
  ) {
    throwHttp(
      500,
      "INVALID_BOOKING_TOTAL",
      "The booking total is invalid."
    );
  }


  /*
   * Lifecycle settlements that replace the normal contractual
   * payable target.
   *
   * Normal active reservations continue using total_amount.
   */
  const settlementConfig = {
    no_show: {
      type:
        "no_show",

      label:
        "No Show",

      codePrefix:
        "NO_SHOW",
    },

    cancelled: {
      type:
        "cancellation",

      label:
        "Cancellation",

      codePrefix:
        "CANCELLATION",
    },
  };


  const config =
    settlementConfig[
      booking.booking_status
    ];


  if (!config) {
    return {
      originalTotalAmount,

      payableAmount:
        originalTotalAmount,

      settlementId:
        null,

      settlementType:
        null,
    };
  }


  /*
   * Booking row must already be locked.
   *
   * Lock order:
   * booking
   *   ->
   * financial settlement
   */
  const [[settlement]] =
    await connection.query(
      `
        SELECT
          settlement_id,
          settlement_status,
          final_payable_amount

        FROM booking_financial_settlements

        WHERE hotel_id = ?
          AND booking_id = ?
          AND settlement_type = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotelId,
        booking.booking_id,
        config.type,
      ]
    );


  if (!settlement) {
    throwHttp(
      409,
      `${config.codePrefix}_SETTLEMENT_MISSING`,
      `The ${config.label} financial settlement is not available yet.`
    );
  }


  if (
    settlement.settlement_status !==
      "finalized" ||
    settlement.final_payable_amount ===
      null ||
    settlement.final_payable_amount ===
      undefined
  ) {
    throwHttp(
      409,
      `${config.codePrefix}_FINANCIAL_REVIEW_REQUIRED`,
      `This ${config.label} requires financial review before payment can be collected.`
    );
  }


  const payableAmount =
    Number(
      settlement
        .final_payable_amount
    );


  if (
    !Number.isFinite(
      payableAmount
    ) ||
    payableAmount < 0 ||
    payableAmount >
      originalTotalAmount +
        0.009
  ) {
    throwHttp(
      500,
      `INVALID_${config.codePrefix}_PAYABLE`,
      `The ${config.label} final payable amount is invalid.`
    );
  }


  return {
    originalTotalAmount,

    payableAmount:
      Number(
        payableAmount
          .toFixed(2)
      ),

    settlementId:
      Number(
        settlement
          .settlement_id
      ),

    settlementType:
      config.type,
  };
}


/* ============================================================
   SYNC BOOKING PAYMENT STATUS
============================================================ */

async function syncBookingPaymentStatus(
  connection,
  hotelId,
  bookingId
) {
  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_status,
          total_amount

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  if (!booking) {
    throwHttp(
      404,
      "BOOKING_NOT_FOUND",
      "Booking was not found."
    );
  }


  const paymentTarget =
    await resolveLockedPaymentTarget(
      connection,
      {
        hotelId,
        booking,
      }
    );


  const state =
    await getLockedPaymentState(
      connection,
      hotelId,
      bookingId,
      paymentTarget
        .payableAmount
    );


  await connection.query(
    `
      UPDATE bookings

      SET payment_status = ?

      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [
      state.paymentStatus,
      hotelId,
      bookingId,
    ]
  );


  return {
    ...state,

    originalTotalAmount:
      paymentTarget
        .originalTotalAmount,

    payableAmount:
      paymentTarget
        .payableAmount,
  };
}


/* ============================================================
   APPLY INITIAL PAYMENT

   Multi-room bookings currently create separate booking rows.

   Initial payment is distributed across those rows.

   External transaction ID is stored only once.
============================================================ */

async function applyInitialPayment(
  connection,
  {
    hotelId,
    adminId,
    bookings,
    payment,
  }
) {
  const grandTotal =
    Number(
      bookings
        .reduce(
          (
            total,
            booking
          ) =>
            total +
            Number(
              booking.totalAmount ||
              0
            ),
          0
        )
        .toFixed(2)
    );


  if (!payment) {
    return {
      amountReceived: 0,
      grandTotal,
      balanceDue:
        grandTotal,
    };
  }


  const amountReceived =
    payment.mode === "full"
      ? grandTotal
      : Number(
          payment.amount
        );


  if (
    amountReceived >
    grandTotal + 0.009
  ) {
    throwHttp(
      400,
      "PAYMENT_EXCEEDS_BOOKING_TOTAL",
      "Initial payment cannot be greater than the booking total."
    );
  }


  let remaining =
    amountReceived;


  for (
    let index = 0;
    index <
    bookings.length;
    index += 1
  ) {
    const booking =
      bookings[index];


    const allocation =
      Number(
        Math.min(
          remaining,
          booking.totalAmount
        ).toFixed(2)
      );


    if (
      allocation <= 0
    ) {
      booking.paymentStatus =
        "unpaid";

      continue;
    }


    const allocationNote =
      [
        payment.notes,

        bookings.length > 1
          ? `Multi-room booking payment allocation ${index + 1}/${bookings.length}.`
          : null,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(
          0,
          500
        );


    await connection.query(
      `
        INSERT INTO payments (
          hotel_id,
          booking_id,
          transaction_type,
          payment_stage,
          amount,
          payment_method,
          transaction_id,
          created_by_admin_id,
          notes,
          payment_status
        )

        VALUES (
          ?, ?,
          'payment',
          ?,
          ?, ?, ?, ?, ?,
          'success'
        )
      `,
      [
        hotelId,
        booking.bookingId,
        payment.stage,
        allocation,
        payment.method,

        index === 0
          ? payment.transactionId
          : null,

        adminId,

        allocationNote ||
          null,
      ]
    );


    remaining =
      Number(
        (
          remaining -
          allocation
        ).toFixed(2)
      );


    booking.paymentStatus =
      calculatePaymentStatus(
        booking.totalAmount,
        allocation
      );


    await connection.query(
      `
        UPDATE bookings

        SET payment_status = ?

        WHERE hotel_id = ?
          AND booking_id = ?
      `,
      [
        booking.paymentStatus,
        hotelId,
        booking.bookingId,
      ]
    );
  }


  return {
    amountReceived,
    grandTotal,

    balanceDue:
      Number(
        Math.max(
          0,
          grandTotal -
            amountReceived
        ).toFixed(2)
      ),
  };
}

/* ============================================================
   COLLECT BOOKING PAYMENT

   Used for additional payments after booking creation.

   Typical flow:
   confirmed  -> advance payment
   checked_in -> during-stay / checkout payment

   Important:
    * - payment amount cannot exceed outstanding balance
    * - normal non-cash payment requires transaction ID
    * - group-payment child allocations use group_payment_id
    *   and keep the external transaction ID on the group receipt
    * - successful payment rows remain the booking-level ledger
============================================================ */

async function collectBookingPayment(
  connection,
  {
    hotelId,
    adminId,
    bookingId,

    amount,
    method,

    stage,
    transactionId,
    notes,

    groupPaymentId = null,
  }
) {
  /* ==========================================================
     LOCK BOOKING
  ========================================================== */

  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          booking_status,
          total_amount,
          payment_status

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  if (!booking) {
    throwHttp(
      404,
      "BOOKING_NOT_FOUND",
      "The booking was not found in your hotel."
    );
  }


  /* ==========================================================
     BOOKING STATE
  ========================================================== */

  const allowedStatuses =
    new Set([
      "confirmed",
      "checked_in",
      "no_show",
      "cancelled",
    ]);


  if (
    !allowedStatuses.has(
      booking.booking_status
    )
  ) {
    throwHttp(
      409,
      "PAYMENT_COLLECTION_NOT_ALLOWED",
      "Payment can be collected only for a confirmed reservation, an active checked-in stay, or a finalized lifecycle settlement."
    );
  }

  const paymentTarget =
    await resolveLockedPaymentTarget(
      connection,
      {
        hotelId,
        booking,
      }
    );

  /* ==========================================================
     AMOUNT
  ========================================================== */

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
    throwHttp(
      400,
      "INVALID_PAYMENT_AMOUNT",
      "Enter a valid payment amount greater than zero."
    );
  }


  if (
    paymentAmount >
    9999999999.99
  ) {
    throwHttp(
      400,
      "PAYMENT_AMOUNT_TOO_LARGE",
      "The payment amount is too large."
    );
  }

  const normalizedGroupPaymentId =
    groupPaymentId === null ||
    groupPaymentId === undefined ||
    groupPaymentId === ""
      ? null
      : Number(
          groupPaymentId
        );


  if (
    normalizedGroupPaymentId !== null &&
    (
      !Number.isSafeInteger(
        normalizedGroupPaymentId
      ) ||
      normalizedGroupPaymentId <= 0
    )
  ) {
    throwHttp(
      500,
      "INVALID_GROUP_PAYMENT_REFERENCE",
      "The group payment reference is invalid."
    );
  }


  /* ==========================================================
     PAYMENT METHOD
  ========================================================== */

  const normalizedMethod =
    String(
      method || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_"
      );


  const paymentMethods =
    new Set([
      "cash",
      "card",
      "upi",
      "bank_transfer",
    ]);


  if (
    !paymentMethods.has(
      normalizedMethod
    )
  ) {
    throwHttp(
      400,
      "INVALID_PAYMENT_METHOD",
      "Select a valid payment method."
    );
  }


  /* ==========================================================
     PAYMENT STAGE
  ========================================================== */

  const defaultStage =
    booking.booking_status ===
      "checked_in"
      ? "during_stay"
      : [
          "no_show",
          "cancelled",
        ].includes(
          booking.booking_status
        )
        ? "other"
        : "advance";


  const requestedStage =
    String(
      stage ||
      defaultStage
    )
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_"
      );


  const normalizedStage =
    [
      "no_show",
      "cancelled",
    ].includes(
      booking.booking_status
    )
      ? "other"
      : requestedStage;


  const paymentStages =
    new Set([
      "advance",
      "during_stay",
      "checkout",
      "other",
    ]);


  if (
    !paymentStages.has(
      normalizedStage
    )
  ) {
    throwHttp(
      400,
      "INVALID_PAYMENT_STAGE",
      "The payment stage is invalid."
    );
  }


  /* ==========================================================
     TRANSACTION REFERENCE

     Cash does not require external transaction ID.

     Card / UPI / Bank Transfer require one.
  ========================================================== */

  const normalizedTransactionId =
    String(
      transactionId || ""
    ).trim();

  const ledgerTransactionId =
    normalizedGroupPaymentId !== null
      ? null
      : normalizedMethod === "cash"
        ? null
        : normalizedTransactionId;


  if (
    normalizedMethod !==
      "cash" &&
    !normalizedTransactionId &&
    normalizedGroupPaymentId ===
      null
  ) {
    throwHttp(
      400,
      "TRANSACTION_ID_REQUIRED",
      "Transaction ID is required for non-cash payments."
    );
  }


  if (
    normalizedTransactionId.length >
    255
  ) {
    throwHttp(
      400,
      "TRANSACTION_ID_TOO_LONG",
      "Transaction ID is too long."
    );
  }


  const normalizedNotes =
    String(
      notes || ""
    ).trim();


  if (
    normalizedNotes.length >
    500
  ) {
    throwHttp(
      400,
      "PAYMENT_NOTES_TOO_LONG",
      "Payment notes cannot exceed 500 characters."
    );
  }
  


  /* ==========================================================
     CURRENT PAYMENT STATE
  ========================================================== */

  const totalAmount =
    paymentTarget
      .originalTotalAmount;


  const payableAmount =
    paymentTarget
      .payableAmount;

  const settlementLabel =
    booking.booking_status ===
      "no_show"
      ? "No Show"
      : booking.booking_status ===
          "cancelled"
        ? "Cancellation"
        : null;


  const paymentAuditNote =
    settlementLabel
      ? [
          `${settlementLabel} financial settlement payment.`,

          `Final payable: ₹${payableAmount.toFixed(
            2
          )}.`,

          normalizedNotes ||
            null,
        ]
          .filter(Boolean)
          .join(" ")
          .slice(
            0,
            500
          )
      : normalizedNotes ||
        null;


  const currentState =
    await getLockedPaymentState(
      connection,
      hotelId,
      bookingId,
      payableAmount
    );


  const outstandingAmount =
    Number(
      Math.max(
        0,
        currentState
          .outstandingAmount
      ).toFixed(2)
    );


  if (
    outstandingAmount <=
    0.009
  ) {
    throwHttp(
      409,
      "BOOKING_ALREADY_PAID",
      "This booking has no outstanding payment."
    );
  }


  if (
    paymentAmount >
    outstandingAmount +
      0.009
  ) {
    throwHttp(
      409,
      "PAYMENT_EXCEEDS_OUTSTANDING",
      `Only ₹${outstandingAmount.toFixed(2)} is outstanding on this booking.`
    );
  }


  /* ==========================================================
     RECORD SUCCESSFUL PAYMENT
  ========================================================== */

  const [result] =
    await connection.query(
      `
        INSERT INTO payments (
          hotel_id,
          booking_id,
          group_payment_id,

          transaction_type,
          payment_stage,

          amount,
          payment_method,
          transaction_id,

          created_by_admin_id,
          notes,

          payment_status
        )

        VALUES (
          ?,
          ?,
          ?,

          'payment',
          ?,

          ?,
          ?,
          ?,

          ?,
          ?,

          'success'
        )
      `,
      [
        hotelId,
        bookingId,
        normalizedGroupPaymentId,

        normalizedStage,

        paymentAmount,
        normalizedMethod,

        ledgerTransactionId,

        adminId,

        paymentAuditNote,
      ]
    );


  /* ==========================================================
     RECALCULATE AFTER INSERT
  ========================================================== */

  const finalState =
    await getLockedPaymentState(
      connection,
      hotelId,
      bookingId,
      payableAmount
    );


  await connection.query(
    `
      UPDATE bookings

      SET
        payment_status = ?,
        updated_by_admin_id = ?

      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [
      finalState
        .paymentStatus,

      adminId,
      hotelId,
      bookingId,
    ]
  );


  /* ==========================================================
     RESULT
  ========================================================== */

  return {
    paymentId:
      Number(
        result.insertId
      ),

    groupPaymentId:
      normalizedGroupPaymentId,

    bookingId:
      booking.booking_id,

    bookingCode:
      booking.booking_code,

    amountReceived:
      paymentAmount,

    paymentMethod:
      normalizedMethod,

    paymentStage:
      normalizedStage,

    transactionId:
      ledgerTransactionId,

    totalAmount,

    payableAmount,

    settlementType:
      paymentTarget
        .settlementType,

    settlementId:
      paymentTarget
        .settlementId,

    amountPaid:
      Math.max(
        0,
        finalState.netPaid
      ),

    outstandingAmount:
      Number(
        Math.max(
          0,
          finalState
            .outstandingAmount
        ).toFixed(2)
      ),

    paymentStatus:
      finalState
        .paymentStatus,
  };
}


/* ============================================================
   REFUND BOOKING OVERPAYMENT

   Used when an existing reservation is edited to a lower total.

   Example:
   current net paid = ₹600
   new booking total = ₹400

   required refund = ₹200

   Important:
   - Client NEVER decides refund amount.
   - Backend calculates exact required refund.
   - Must run inside the SAME transaction as booking update.
   - Cash does not require transaction reference.
   - Card / UPI / Bank Transfer require transaction reference.
============================================================ */

async function refundBookingOverpayment(
  connection,
  {
    hotelId,
    adminId,
    bookingId,

    newTotalAmount,

    method,
    transactionId,
    notes,
  }
) {
  /* ==========================================================
     TARGET TOTAL
  ========================================================== */

  const targetTotal =
    Number(
      newTotalAmount
    );


  if (
    !Number.isFinite(
      targetTotal
    ) ||
    targetTotal < 0
  ) {
    throwHttp(
      500,
      "INVALID_UPDATED_BOOKING_TOTAL",
      "The updated booking total is invalid."
    );
  }


  /* ==========================================================
     PAYMENT METHOD
  ========================================================== */

  const normalizedMethod =
    String(
      method || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_"
      );


  const allowedMethods =
    new Set([
      "cash",
      "card",
      "upi",
      "bank_transfer",
    ]);


  if (
    !allowedMethods.has(
      normalizedMethod
    )
  ) {
    throwHttp(
      400,
      "INVALID_REFUND_METHOD",
      "Select a valid refund method."
    );
  }


  /* ==========================================================
     TRANSACTION REFERENCE
  ========================================================== */

  const normalizedTransactionId =
    String(
      transactionId || ""
    ).trim();


  if (
    normalizedMethod !==
      "cash" &&
    !normalizedTransactionId
  ) {
    throwHttp(
      400,
      "REFUND_TRANSACTION_ID_REQUIRED",
      "Transaction ID is required for non-cash refunds."
    );
  }


  if (
    normalizedTransactionId.length >
    255
  ) {
    throwHttp(
      400,
      "REFUND_TRANSACTION_ID_TOO_LONG",
      "Refund transaction ID is too long."
    );
  }


  /* ==========================================================
     NOTES
  ========================================================== */

  const normalizedNotes =
    String(
      notes || ""
    ).trim();


  if (
    normalizedNotes.length >
    500
  ) {
    throwHttp(
      400,
      "REFUND_NOTES_TOO_LONG",
      "Refund notes cannot exceed 500 characters."
    );
  }


  /* ==========================================================
     LOCK CURRENT PAYMENT LEDGER

     getLockedPaymentState() uses FOR UPDATE.
  ========================================================== */

  const currentState =
    await getLockedPaymentState(
      connection,
      hotelId,
      bookingId,
      targetTotal
    );


  const currentNetPaid =
    Math.max(
      0,
      Number(
        currentState.netPaid ||
        0
      )
    );


  const requiredRefund =
    Number(
      Math.max(
        0,
        currentNetPaid -
          targetTotal
      ).toFixed(2)
    );


  if (
    requiredRefund <=
    0.009
  ) {
    throwHttp(
      409,
      "BOOKING_REFUND_NOT_REQUIRED",
      "No refund is required for the updated reservation total."
    );
  }


  /*
   * Defensive check:
   * Never refund more than the remaining successful
   * net amount received for this booking.
   */
  if (
    requiredRefund >
    currentNetPaid +
      0.009
  ) {
    throwHttp(
      409,
      "REFUND_EXCEEDS_NET_PAYMENT",
      "The refund amount exceeds the net amount paid on this booking."
    );
  }


  /* ==========================================================
     RECORD REFUND

     payment_stage = other because this refund is caused by
     a pre-stay reservation edit, not normal payment collection.
  ========================================================== */

  const auditNote =
    [
      "Automatic refund required by reservation price reduction.",

      `Updated booking total: ₹${targetTotal.toFixed(
        2
      )}.`,

      normalizedNotes ||
        null,
    ]
      .filter(
        Boolean
      )
      .join(" ")
      .slice(
        0,
        500
      );


  const [result] =
    await connection.query(
      `
        INSERT INTO payments (
          hotel_id,
          booking_id,

          transaction_type,
          payment_stage,

          amount,
          payment_method,
          transaction_id,

          created_by_admin_id,
          notes,

          payment_status
        )

        VALUES (
          ?,
          ?,

          'refund',
          'other',

          ?,
          ?,
          ?,

          ?,
          ?,

          'success'
        )
      `,
      [
        hotelId,
        bookingId,

        requiredRefund,
        normalizedMethod,

        normalizedMethod ===
          "cash"
          ? null
          : normalizedTransactionId,

        adminId,
        auditNote,
      ]
    );


  /* ==========================================================
     VERIFY FINAL LEDGER STATE AGAINST UPDATED TOTAL
  ========================================================== */

  const finalState =
    await getLockedPaymentState(
      connection,
      hotelId,
      bookingId,
      targetTotal
    );


  if (
    finalState.netPaid >
    targetTotal + 0.009
  ) {
    throwHttp(
      500,
      "REFUND_RECONCILIATION_FAILED",
      "The payment ledger could not be reconciled with the updated reservation total."
    );
  }


  return {
    refundPaymentId:
      Number(
        result.insertId
      ),

    bookingId,

    refundAmount:
      requiredRefund,

    refundMethod:
      normalizedMethod,

    transactionId:
      normalizedMethod ===
        "cash"
        ? null
        : normalizedTransactionId,

    previousNetPaid:
      currentNetPaid,

    updatedNetPaid:
      Math.max(
        0,
        Number(
          finalState.netPaid ||
          0
        )
      ),

    updatedBookingTotal:
      targetTotal,

    outstandingAmount:
      Number(
        Math.max(
          0,
          finalState
            .outstandingAmount
        ).toFixed(2)
      ),

    paymentStatus:
      finalState
        .paymentStatus,
  };
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  calculatePaymentStatus,
  getLockedPaymentState,
  syncBookingPaymentStatus,
  applyInitialPayment,
  collectBookingPayment,
  refundBookingOverpayment,
};