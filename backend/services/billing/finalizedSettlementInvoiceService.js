/* ============================================================
   FINALIZED SETTLEMENT INVOICE SERVICE

   Purpose:
   Keep invoice truth synchronized with the authoritative
   finalized booking financial settlement.

   Important:
   - Caller owns the transaction.
   - This service NEVER begins, commits or rolls back.
   - Finalized settlement amount is invoice total authority.
   - Payment ledger is never modified here.
   - Refund due remains ledger truth, not extra invoice value.
   - One invoice per hotel + booking is preserved.
   - Canonical invoice_items preserve settlement identity.
============================================================ */


/* ============================================================
   HELPERS
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


function positiveId(
  value,
  label
) {
  const number =
    Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number <= 0
  ) {
    throw serviceError(
      400,
      "INVALID_INVOICE_REFERENCE",
      `${label} must be a valid positive integer.`
    );
  }

  return number;
}


function roundMoney(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return (
    Math.round(
      (number + Number.EPSILON) *
      100
    ) /
    100
  );
}


/* ============================================================
   SETTLEMENT ITEM META

   Canonical invoice descriptions for lifecycle settlements.
============================================================ */

function settlementInvoiceItemMeta(
  settlementType
) {
  const type =
    String(
      settlementType ||
      ""
    )
      .trim()
      .toLowerCase();


  const map = {

    no_show: {
      itemCode:
        "no_show_charge",

      description:
        "No-show Charge",
    },


    cancellation: {
      itemCode:
        "cancellation_charge",

      description:
        "Cancellation Charge",
    },


    early_checkout: {
      itemCode:
        "early_checkout_charge",

      description:
        "Early Checkout Charge",
    },


    manual_adjustment: {
      itemCode:
        "manual_adjustment",

      description:
        "Manual Adjustment",
    },
  };


  return (
    map[type] || {
      itemCode:
        "financial_settlement",

      description:
        "Financial Settlement",
    }
  );
}


/* ============================================================
   BUILD CANONICAL SETTLEMENT ITEM
============================================================ */

function buildSettlementInvoiceItem(
  settlement
) {
  const amount =
    roundMoney(
      settlement
        ?.final_payable_amount ||
      0
    );


  const meta =
    settlementInvoiceItemMeta(
      settlement
        ?.settlement_type
    );


  return {
    itemCode:
      meta.itemCode,

    description:
      meta.description,

    quantity:
      1,

    unitRate:
      amount,

    lineAmount:
      amount,

    sourceType:
      "settlement",

    sourceId:
      Number(
        settlement
          ?.settlement_id ||
        0
      ) || null,
  };
}


/* ============================================================
   REPLACE CANONICAL INVOICE ITEMS

   Caller transaction is reused.
============================================================ */

async function replaceInvoiceItems(
  executor,
  {
    hotelId,
    invoiceId,
    items,
  }
) {
  await executor.query(
    `
      DELETE FROM invoice_items

      WHERE hotel_id = ?
        AND invoice_id = ?
    `,
    [
      hotelId,
      invoiceId,
    ]
  );


  let lineNo = 1;


  for (const item of items) {

    await executor.query(
      `
        INSERT INTO invoice_items (
          hotel_id,
          invoice_id,
          line_no,
          item_code,
          description,
          quantity,
          unit_rate,
          line_amount,
          source_type,
          source_id
        )

        VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `,
      [
        hotelId,
        invoiceId,
        lineNo,

        item.itemCode,
        item.description,

        Number(
          item.quantity ||
          1
        ),

        roundMoney(
          item.unitRate
        ),

        roundMoney(
          item.lineAmount
        ),

        item.sourceType ||
          "manual",

        item.sourceId ??
          null,
      ]
    );


    lineNo += 1;
  }
}


/* ============================================================
   LOAD FINALIZED SETTLEMENT

   Locks the authoritative settlement row in the caller's
   transaction.
============================================================ */

async function loadFinalizedSettlementWithConnection(
  connection,
  {
    hotelId,
    bookingId,
    settlementId = null,
  }
) {
  if (settlementId) {

    const [[settlement]] =
      await connection.query(
        `
          SELECT
            settlement_id,
            hotel_id,
            booking_id,

            settlement_type,
            settlement_status,

            original_total_amount,
            final_payable_amount

          FROM booking_financial_settlements

          WHERE hotel_id = ?
            AND booking_id = ?
            AND settlement_id = ?
            AND settlement_status =
                'finalized'

          LIMIT 1

          FOR UPDATE
        `,
        [
          hotelId,
          bookingId,
          settlementId,
        ]
      );


    return settlement ||
      null;
  }


  const [[settlement]] =
    await connection.query(
      `
        SELECT
          settlement_id,
          hotel_id,
          booking_id,

          settlement_type,
          settlement_status,

          original_total_amount,
          final_payable_amount

        FROM booking_financial_settlements

        WHERE hotel_id = ?
          AND booking_id = ?
          AND settlement_status =
              'finalized'

        ORDER BY
          settlement_id DESC

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  return settlement ||
    null;
}


/* ============================================================
   LOAD LIVE NET PAID

   successful payment
   minus
   successful refund
============================================================ */

async function getNetPaidWithConnection(
  connection,
  {
    hotelId,
    bookingId,
  }
) {
  const [[ledger]] =
    await connection.query(
      `
        SELECT
          COALESCE(
            SUM(
              CASE

                WHEN transaction_type =
                     'payment'
                  THEN amount

                WHEN transaction_type =
                     'refund'
                  THEN -amount

                ELSE 0
              END
            ),
            0
          ) AS net_paid

        FROM payments

        WHERE hotel_id = ?
          AND booking_id = ?
          AND payment_status =
              'success'
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  return roundMoney(
    ledger
      ?.net_paid ||
    0
  );
}


/* ============================================================
   ENSURE FINALIZED SETTLEMENT INVOICE

   Behavior:
   - If invoice does not exist:
       create it.
   - If invoice already exists:
       reconcile it to finalized settlement authority.
   - Canonical invoice item is always settlement-sourced.
   - Successful payments/refunds are never modified.
   - Overpayment remains refund_due.
   - No commit/rollback here.
============================================================ */

async function ensureFinalizedSettlementInvoiceWithConnection(
  connection,
  {
    hotelId,
    bookingId,
    settlementId = null,
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


  const sId =
    settlementId === null ||
    settlementId === undefined
      ? null
      : positiveId(
          settlementId,
          "Settlement ID"
        );


  const settlement =
    await loadFinalizedSettlementWithConnection(
      connection,
      {
        hotelId:
          hId,

        bookingId:
          bId,

        settlementId:
          sId,
      }
    );


  if (!settlement) {

    throw serviceError(
      409,
      "FINALIZED_SETTLEMENT_NOT_FOUND",
      "A finalized financial settlement is required before the invoice can be generated."
    );
  }


  const totalAmount =
    roundMoney(
      settlement
        .final_payable_amount
    );


  if (
    !Number.isFinite(
      Number(
        settlement
          .final_payable_amount
      )
    ) ||
    totalAmount < 0
  ) {

    throw serviceError(
      409,
      "INVALID_FINALIZED_SETTLEMENT_AMOUNT",
      "The finalized financial settlement does not contain a valid final payable amount."
    );
  }


  const netPaid =
    await getNetPaidWithConnection(
      connection,
      {
        hotelId:
          hId,

        bookingId:
          bId,
      }
    );


  const applicablePaid =
    Math.max(
      0,
      netPaid
    );


  const paidAmount =
    roundMoney(
      Math.min(
        applicablePaid,
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


  const refundDue =
    roundMoney(
      Math.max(
        0,
        netPaid -
        totalAmount
      )
    );


  let invoiceStatus =
    "unpaid";


  if (
    totalAmount <= 0 ||
    paidAmount >= totalAmount
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


  /*
   * Compatibility header:
   *
   * A finalized settlement is a final financial obligation,
   * not physical room-history revenue.
   *
   * Canonical meaning lives in invoice_items.
   */
  const roomCharges =
    0;

  const foodCharges =
    0;

  const laundryCharges =
    0;

  const extraServiceCharges =
    totalAmount;

  const taxAmount =
    0;


  const [[existingInvoice]] =
    await connection.query(
      `
        SELECT
          invoice_id,
          invoice_number

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


  let invoiceId;
  let invoiceNumber;
  let created = false;


  if (existingInvoice) {

    invoiceId =
      Number(
        existingInvoice
          .invoice_id
      );

    invoiceNumber =
      existingInvoice
        .invoice_number;


    await connection.query(
      `
        UPDATE invoices

        SET
          room_charges = ?,
          food_charges = ?,
          laundry_charges = ?,
          extra_service_charges = ?,

          tax_amount = ?,

          total_amount = ?,
          paid_amount = ?,
          pending_amount = ?,
          invoice_status = ?

        WHERE hotel_id = ?
          AND invoice_id = ?
          AND booking_id = ?
      `,
      [
        roomCharges,
        foodCharges,
        laundryCharges,
        extraServiceCharges,

        taxAmount,

        totalAmount,
        paidAmount,
        pendingAmount,
        invoiceStatus,

        hId,
        invoiceId,
        bId,
      ]
    );
  }
  else {

    invoiceNumber =
      [
        "INV",
        Date.now(),
        bId,
        Number(
          settlement
            .settlement_id
        ),
      ].join("-");


    const [result] =
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

          roomCharges,
          foodCharges,
          laundryCharges,
          extraServiceCharges,

          taxAmount,

          totalAmount,
          paidAmount,
          pendingAmount,
          invoiceStatus,
        ]
      );


    invoiceId =
      Number(
        result.insertId
      );

    created =
      true;
  }


  if (
    !Number.isSafeInteger(invoiceId) ||
    invoiceId <= 0
  ) {

    throw serviceError(
      500,
      "INVOICE_ENSURE_FAILED",
      "The finalized settlement invoice could not be created or loaded."
    );
  }


  const canonicalItem =
    buildSettlementInvoiceItem(
      settlement
    );


  await replaceInvoiceItems(
    connection,
    {
      hotelId:
        hId,

      invoiceId,

      items: [
        canonicalItem,
      ],
    }
  );


  return {
    created,

    reconciled:
      !created,

    invoiceId,

    invoiceNumber,

    hotelId:
      hId,

    bookingId:
      bId,

    settlementId:
      Number(
        settlement
          .settlement_id
      ),

    settlementType:
      settlement
        .settlement_type,

    totalAmount,

    netPaid,

    paidAmount,

    pendingAmount,

    refundDue,

    invoiceStatus,

    canonicalItem,
  };
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  settlementInvoiceItemMeta,
  buildSettlementInvoiceItem,
  replaceInvoiceItems,
  ensureFinalizedSettlementInvoiceWithConnection,
};