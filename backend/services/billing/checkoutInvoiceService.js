const {
  getLockedPaymentState,
} = require("../bookingPaymentService");

const {
  replaceInvoiceItems,
} = require("./finalizedSettlementInvoiceService");

const {
  resolveBookingPaymentPolicyWithConnection,
} = require("../bookingPayments/paymentPolicyService");


/* ============================================================
   ERROR
============================================================ */

function serviceError(
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

  return error;
}


/* ============================================================
   HELPERS
============================================================ */

function positiveId(
  value,
  label
) {
  const id =
    Number(value);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw serviceError(
      400,
      "INVALID_ID",
      `${label} is invalid.`
    );
  }

  return id;
}


function roundMoney(
  value
) {
  const amount =
    Number(value);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Number(
    amount.toFixed(2)
  );
}


/* ============================================================
   ENSURE NORMAL CHECKOUT INVOICE

   Purpose:
   - normal completed stay only
   - no financial-settlement row required
   - idempotent by (hotel_id, booking_id)
   - existing invoice is preserved
   - caller owns transaction
   - no commit / rollback here
============================================================ */

async function ensureCheckoutInvoiceWithConnection(
  connection,
  {
    hotelId,
    bookingId,
  }
) {
  if (
    !connection ||
    typeof connection.query !==
      "function"
  ) {
    throw serviceError(
      500,
      "INVALID_DB_CONNECTION",
      "A valid database transaction connection is required."
    );
  }


  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );

  const bId =
    positiveId(
      bookingId,
      "Booking ID"
    );


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
          total_amount

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hId,
        bId,
      ]
    );


  if (!booking) {
    throw serviceError(
      404,
      "BOOKING_NOT_FOUND",
      "The booking was not found."
    );
  }


  if (
    booking.booking_status !==
    "checked_out"
  ) {
    throw serviceError(
      409,
      "CHECKOUT_INVOICE_NOT_ALLOWED",
      "A checkout invoice can only be created for a checked-out booking."
    );
  }


  const totalAmount =
    roundMoney(
      booking.total_amount
    );


  if (
    totalAmount < 0
  ) {
    throw serviceError(
      500,
      "INVALID_BOOKING_TOTAL",
      "The booking total is invalid."
    );
  }


  /* ==========================================================
     PAYMENT TRUTH

     Do not independently recalculate payment state.
     Reuse canonical booking payment service.
  ========================================================== */

  const paymentState =
    await getLockedPaymentState(
      connection,
      hId,
      bId,
      totalAmount
    );


  const netPaid =
    roundMoney(
      Math.max(
        0,
        Number(
          paymentState?.netPaid ||
          0
        )
      )
    );


  const outstandingAmount =
    roundMoney(
      Math.max(
        0,
        totalAmount -
        netPaid
      )
    );


  /* ==========================================================
     IMMUTABLE BOOKING PAYMENT POLICY

     Payment authority for an existing booking comes from its
     immutable booking policy snapshot.

     Only an explicit false permits checkout invoice creation
     while an outstanding receivable remains.
  ========================================================== */

  const paymentPolicy =
    await resolveBookingPaymentPolicyWithConnection(
      connection,
      {
        hotelId:
          hId,

        bookingId:
          bId,
      }
    );


  const fullPaymentRequiredBeforeCheckout =
    paymentPolicy
      ?.fullPaymentRequiredBeforeCheckout !==
    false;


  if (
    fullPaymentRequiredBeforeCheckout &&
    outstandingAmount >
      0.009
  ) {
    throw serviceError(
      409,
      "CHECKOUT_INVOICE_PAYMENT_DUE",
      `₹${outstandingAmount.toFixed(2)} is still due.`
    );
  }


  /* ==========================================================
     EXISTING CANONICAL INVOICE

     Never create a second invoice for one booking.
     Existing invoice is preserved.
  ========================================================== */

  const [[existingInvoice]] =
    await connection.query(
      `
        SELECT
          invoice_id,
          invoice_number,
          total_amount,
          paid_amount,
          pending_amount,
          invoice_status

        FROM invoices

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hId,
        bId,
      ]
    );


  if (existingInvoice) {
    return {
      created:
        false,

      invoiceId:
        Number(
          existingInvoice.invoice_id
        ),

      invoiceNumber:
        existingInvoice.invoice_number,

      totalAmount:
        roundMoney(
          existingInvoice.total_amount
        ),

      paidAmount:
        roundMoney(
          existingInvoice.paid_amount
        ),

      pendingAmount:
        roundMoney(
          existingInvoice.pending_amount
        ),

      invoiceStatus:
        existingInvoice.invoice_status,
    };
  }


  /* ==========================================================
     CANONICAL NORMAL-STAY INVOICE

     Booking total is already the financial obligation used by
     booking/payment/checkout.

     Do NOT add a second tax calculation here.
  ========================================================== */

  const paidAmount =
    roundMoney(
      Math.min(
        netPaid,
        totalAmount
      )
    );


  const pendingAmount =
    roundMoney(
      Math.max(
        0,
        totalAmount -
        paidAmount
      )
    );


  let invoiceStatus =
    "unpaid";

  if (
    totalAmount <= 0 ||
    pendingAmount <= 0.009
  ) {
    invoiceStatus =
      "paid";
  }
  else if (
    paidAmount > 0
  ) {
    invoiceStatus =
      "partial";
  }


  const invoiceNumber =
    [
      "INV",
      Date.now(),
      bId,
      "CO",
    ].join("-");


  const [insertResult] =
    await connection.query(
      `
        INSERT INTO invoices (
          hotel_id,
          booking_id,
          invoice_number,

          room_charges,
          food_charges,
          laundry_charges,
          extra_service_charges,

          tax_amount,

          total_amount,
          paid_amount,
          pending_amount,
          invoice_status
        )

        VALUES (
          ?, ?, ?,
          ?, ?, ?, ?,
          ?,
          ?, ?, ?, ?
        )
      `,
      [
        hId,
        bId,
        invoiceNumber,

        totalAmount,
        0,
        0,
        0,

        0,

        totalAmount,
        paidAmount,
        pendingAmount,
        invoiceStatus,
      ]
    );


  const invoiceId =
    Number(
      insertResult.insertId
    );


  /* ==========================================================
     CANONICAL LINE ITEM

     Reuse the existing shared invoice-item writer.
  ========================================================== */

  await replaceInvoiceItems(
    connection,
    {
      hotelId:
        hId,

      invoiceId,

      items: [
        {
          itemCode:
            "room_charge",

          description:
            "Room Charges",

          quantity:
            1,

          unitRate:
            totalAmount,

          lineAmount:
            totalAmount,

          sourceType:
            "booking",

          sourceId:
            bId,
        },
      ],
    }
  );


  return {
    created:
      true,

    invoiceId,

    invoiceNumber,

    totalAmount,

    paidAmount,

    pendingAmount,

    invoiceStatus,
  };
}


module.exports = {
  ensureCheckoutInvoiceWithConnection,
};