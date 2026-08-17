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
    Number(
      totalAmount || 0
    );


  const paid =
    Math.max(
      0,
      Number(
        netPaid || 0
      )
    );


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


  const state =
    await getLockedPaymentState(
      connection,
      hotelId,
      bookingId,
      Number(
        booking.total_amount
      )
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


  return state;
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
   - payment amount cannot exceed outstanding balance
   - non-cash payment requires transaction ID
   - successful payment row is the financial source of truth
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
    ]);


  if (
    !allowedStatuses.has(
      booking.booking_status
    )
  ) {
    throwHttp(
      409,
      "PAYMENT_COLLECTION_NOT_ALLOWED",
      "Payment can be collected only for a confirmed reservation or an active checked-in stay."
    );
  }


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
      : "advance";


  const normalizedStage =
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


  if (
    normalizedMethod !==
      "cash" &&
    !normalizedTransactionId
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
    Number(
      booking.total_amount
    );


  if (
    !Number.isFinite(
      totalAmount
    ) ||
    totalAmount < 0
  ) {
    throwHttp(
      500,
      "INVALID_BOOKING_TOTAL",
      "The booking total is invalid."
    );
  }


  const currentState =
    await getLockedPaymentState(
      connection,
      hotelId,
      bookingId,
      totalAmount
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

        normalizedStage,

        paymentAmount,
        normalizedMethod,

        normalizedMethod ===
          "cash"
          ? null
          : normalizedTransactionId,

        adminId,

        normalizedNotes ||
          null,
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
      totalAmount
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
      normalizedMethod ===
        "cash"
        ? null
        : normalizedTransactionId,

    totalAmount,

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
   EXPORTS
============================================================ */

module.exports = {
  calculatePaymentStatus,
  getLockedPaymentState,
  syncBookingPaymentStatus,
  applyInitialPayment,
  collectBookingPayment,
};