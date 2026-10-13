// controllers/billingController.js

const db = require('../config/db').promisePool;

const {
  buildSettlementInvoiceItem,
  replaceInvoiceItems,
} = require(
  "../services/billing/finalizedSettlementInvoiceService"
);
// Maps the frontend's payment method labels to the DB's payment_method enum
const METHOD_MAP = {
  Cash: "cash",
  Card: "card",
  UPI: "upi",
  "Net Banking": "bank_transfer",
};

/* ===========================================================
   BILLING DASHBOARD
   Accepts optional ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD.
   Invoice-based figures (stats, revenue) filter on generated_at;
   payment-based figures (methods, recent payments) filter on payment_date.
=========================================================== */

function parseStoredBoolean(value) {
  if (value === true) {
    return true;
  }

  if (
    value === false ||
    value === null ||
    value === undefined
  ) {
    return false;
  }

  const normalized =
    String(value)
      .trim()
      .toLowerCase();

  return (
    normalized === "true" ||
    normalized === "1"
  );
}


function roundMoney(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return (
    Math.round(
      (
        number +
        Number.EPSILON
      ) *
      100
    ) /
    100
  );
}


async function getInvoiceTaxPolicy(
  executor,
  hotelId
) {

  const [rows] =
    await executor.query(
      `
        SELECT
          setting_key,
          setting_value

        FROM hotel_settings

        WHERE hotel_id = ?

          AND setting_section =
              'tax'

          AND setting_key IN (
            'gst_enabled',
            'gst_percent'
          )
      `,
      [
        hotelId,
      ]
    );


  const values = {};

  for (const row of rows) {
    values[row.setting_key] =
      row.setting_value;
  }


  const gstEnabled =
    parseStoredBoolean(
      values.gst_enabled
    );


  const rawPercent =
    Number(
      values.gst_percent ??
      0
    );


  const gstPercent =
    Number.isFinite(rawPercent)
      ? Math.min(
          100,
          Math.max(
            0,
            rawPercent
          )
        )
      : 0;


  return {
    gstEnabled,
    gstPercent:
      gstEnabled
        ? gstPercent
        : 0,
  };
}


function calculateInvoiceTax(
  subtotal,
  policy
) {

  if (
    !policy?.gstEnabled ||
    Number(
      policy.gstPercent ||
      0
    ) <= 0
  ) {
    return 0;
  }


  return roundMoney(
    Number(
      subtotal ||
      0
    ) *
    Number(
      policy.gstPercent
    ) /
    100
  );
}

function buildLegacyInvoiceItems({
  roomCharges,
  foodCharges,
  laundryCharges,
  extraServiceCharges,
}) {

  const definitions = [
    {
      itemCode:
        "room_charge",

      description:
        "Room Charges",

      amount:
        roomCharges,
    },

    {
      itemCode:
        "food_charge",

      description:
        "Food Charges",

      amount:
        foodCharges,
    },

    {
      itemCode:
        "laundry_charge",

      description:
        "Laundry Charges",

      amount:
        laundryCharges,
    },

    {
      itemCode:
        "extra_service_charge",

      description:
        "Extra Service Charges",

      amount:
        extraServiceCharges,
    },
  ];


  const items =
    definitions
      .map(
        (definition) => ({
          ...definition,

          amount:
            roundMoney(
              definition.amount
            ),
        })
      )
      .filter(
        (definition) =>
          definition.amount > 0
      )
      .map(
        (definition) => ({
          itemCode:
            definition.itemCode,

          description:
            definition.description,

          quantity:
            1,

          unitRate:
            definition.amount,

          lineAmount:
            definition.amount,

          sourceType:
            "legacy_header",

          sourceId:
            null,
        })
      );


  /*
   * Preserve a zero-value invoice snapshot too.
   * This prevents a generated invoice from existing
   * without a canonical line-item snapshot.
   */
  if (!items.length) {

    items.push({
      itemCode:
        "invoice_charge",

      description:
        "Invoice Charges",

      quantity:
        1,

      unitRate:
        0,

      lineAmount:
        0,

      sourceType:
        "legacy_header",

      sourceId:
        null,
    });
  }


  return items;
}


function invoiceItemCodeFromDescription(
  description
) {

  const normalized =
    String(
      description ||
      ""
    )
      .trim()
      .toLowerCase();


  if (normalized === "room charges") {
    return "room_charge";
  }


  if (normalized === "food charges") {
    return "food_charge";
  }


  if (normalized === "laundry charges") {
    return "laundry_charge";
  }


  if (
    normalized ===
    "extra service charges"
  ) {
    return "extra_service_charge";
  }


  return "manual_charge";
}


function normalizeInvoiceItemsPayload(
  rawItems
) {

  if (
    rawItems === undefined ||
    rawItems === null
  ) {
    return {
      provided:
        false,

      items:
        null,

      error:
        null,
    };
  }


  if (!Array.isArray(rawItems)) {

    return {
      provided:
        true,

      items:
        null,

      error:
        "Invoice items must be an array.",
    };
  }


  if (
    rawItems.length < 1 ||
    rawItems.length > 50
  ) {

    return {
      provided:
        true,

      items:
        null,

      error:
        "Invoice must contain between 1 and 50 line items.",
    };
  }


  const items = [];


  for (
    let index = 0;
    index < rawItems.length;
    index += 1
  ) {

    const raw =
      rawItems[index] ||
      {};


    const description =
      String(
        raw.description ??
        raw.desc ??
        ""
      )
        .trim();


    const quantity =
      Number(
        raw.quantity ??
        raw.qty
      );


    const unitRate =
      Number(
        raw.unit_rate ??
        raw.unitRate ??
        raw.rate
      );


    if (!description) {

      return {
        provided:
          true,

        items:
          null,

        error:
          `Invoice item ${index + 1} requires a description.`,
      };
    }


    if (
      description.length >
      255
    ) {

      return {
        provided:
          true,

        items:
          null,

        error:
          `Invoice item ${index + 1} description is too long.`,
      };
    }


    if (
      !Number.isFinite(
        quantity
      ) ||
      quantity <= 0
    ) {

      return {
        provided:
          true,

        items:
          null,

        error:
          `Invoice item ${index + 1} requires a quantity greater than zero.`,
      };
    }


    if (
      !Number.isFinite(
        unitRate
      ) ||
      unitRate < 0
    ) {

      return {
        provided:
          true,

        items:
          null,

        error:
          `Invoice item ${index + 1} requires a valid non-negative rate.`,
      };
    }


    const lineAmount =
      roundMoney(
        quantity *
        unitRate
      );


    items.push({
      itemCode:
        invoiceItemCodeFromDescription(
          description
        ),

      description,

      quantity,

      unitRate:
        roundMoney(
          unitRate
        ),

      lineAmount,

      sourceType:
        "manual",

      sourceId:
        null,
    });
  }


  return {
    provided:
      true,

    items,

    error:
      null,
  };
}


function summarizeInvoiceItemsForLegacyHeader(
  items
) {

  const summary = {
    roomCharges:
      0,

    foodCharges:
      0,

    laundryCharges:
      0,

    extraServiceCharges:
      0,
  };


  for (const item of items) {

    const amount =
      roundMoney(
        item.lineAmount
      );


    switch (item.itemCode) {

      case "room_charge":

        summary.roomCharges +=
          amount;

        break;


      case "food_charge":

        summary.foodCharges +=
          amount;

        break;


      case "laundry_charge":

        summary.laundryCharges +=
          amount;

        break;


      default:

        summary.extraServiceCharges +=
          amount;

        break;
    }
  }


  return {
    roomCharges:
      roundMoney(
        summary.roomCharges
      ),

    foodCharges:
      roundMoney(
        summary.foodCharges
      ),

    laundryCharges:
      roundMoney(
        summary.laundryCharges
      ),

    extraServiceCharges:
      roundMoney(
        summary.extraServiceCharges
      ),
  };
}

exports.getBillingDashboard = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const now = new Date();

    const defaultTo =
      [
        now.getFullYear(),
        String(
          now.getMonth() + 1
        ).padStart(2, "0"),
        String(
          now.getDate()
        ).padStart(2, "0"),
      ].join("-");

    const defaultFrom =
      [
        now.getFullYear(),
        String(
          now.getMonth() + 1
        ).padStart(2, "0"),
        "01",
      ].join("-");


    const dateFrom =
      req.query.dateFrom ||
      defaultFrom;

    const dateTo =
      req.query.dateTo ||
      defaultTo;


    const validDate =
      /^\d{4}-\d{2}-\d{2}$/;


    if (
      !validDate.test(dateFrom) ||
      !validDate.test(dateTo) ||
      dateFrom > dateTo
    ) {
      return res.status(400).json({
        message:
          "Invalid billing date range",
      });
    }


    const currentStart =
      new Date(
        `${dateFrom}T00:00:00Z`
      );

    const currentEnd =
      new Date(
        `${dateTo}T00:00:00Z`
      );


    const spanDays =
      Math.floor(
        (
          currentEnd -
          currentStart
        ) /
        86400000
      ) + 1;


    const previousEnd =
      new Date(
        currentStart.getTime() -
        86400000
      );

    const previousStart =
      new Date(
        currentStart.getTime() -
        spanDays *
        86400000
      );


    const prevFrom =
      previousStart
        .toISOString()
        .slice(0, 10);

    const prevTo =
      previousEnd
        .toISOString()
        .slice(0, 10);


    const invoiceSummaryQuery = `
      SELECT
        COUNT(*) AS totalBills,

        COALESCE(
          SUM(total_amount),
          0
        ) AS billedAmount

      FROM invoices

      WHERE hotel_id = ?

        AND customer_facing = 1


        AND DATE(generated_at)
            BETWEEN ? AND ?
    `;


    const collectionsQuery = `
      SELECT
        COALESCE(
          SUM(
            CASE

              WHEN
                transaction_type =
                'payment'

              THEN amount


              WHEN
                transaction_type =
                'refund'

              THEN -amount


              ELSE 0

            END
          ),

          0
        ) AS netCollections

      FROM payments

      WHERE hotel_id = ?

        AND payment_status =
            'success'

        AND DATE(payment_date)
            BETWEEN ? AND ?
    `;


    const outstandingQuery = `
      SELECT
        COALESCE(
          SUM(
            GREATEST(
              i.total_amount -

              LEAST(
                GREATEST(
                  COALESCE(
                    ledger.net_paid,
                    0
                  ),

                  0
                ),

                i.total_amount
              ),

              0
            )
          ),

          0
        ) AS outstanding

      FROM invoices i

      LEFT JOIN (
        SELECT
          hotel_id,
          booking_id,

          SUM(
            CASE

              WHEN
                transaction_type =
                'payment'

              THEN amount


              WHEN
                transaction_type =
                'refund'

              THEN -amount


              ELSE 0

            END
          ) AS net_paid

        FROM payments

        WHERE payment_status =
              'success'

        GROUP BY
          hotel_id,
          booking_id
      ) ledger

        ON ledger.hotel_id =
           i.hotel_id

       AND ledger.booking_id =
           i.booking_id

      WHERE i.hotel_id = ?

        AND i.customer_facing = 1


        AND DATE(i.generated_at)
            BETWEEN ? AND ?
    `;


    const [[currentInvoices]] =
      await db.query(
        invoiceSummaryQuery,
        [
          hotelId,
          dateFrom,
          dateTo,
        ]
      );


    const [[previousInvoices]] =
      await db.query(
        invoiceSummaryQuery,
        [
          hotelId,
          prevFrom,
          prevTo,
        ]
      );


    const [[currentCollections]] =
      await db.query(
        collectionsQuery,
        [
          hotelId,
          dateFrom,
          dateTo,
        ]
      );


    const [[previousCollections]] =
      await db.query(
        collectionsQuery,
        [
          hotelId,
          prevFrom,
          prevTo,
        ]
      );


    const [[currentOutstanding]] =
      await db.query(
        outstandingQuery,
        [
          hotelId,
          dateFrom,
          dateTo,
        ]
      );


    const [[previousOutstanding]] =
      await db.query(
        outstandingQuery,
        [
          hotelId,
          prevFrom,
          prevTo,
        ]
      );


    const pctChange = (
      current,
      previous
    ) => {

      const cur =
        Number(
          current ||
          0
        );

      const prev =
        Number(
          previous ||
          0
        );


      if (prev === 0) {

        return cur === 0
          ? 0
          : 100;
      }


      return Math.round(
        (
          (
            cur -
            prev
          ) /
          Math.abs(prev)
        ) *
        1000
      ) / 10;
    };


    const stats = {
      totalBills:
        Number(
          currentInvoices.totalBills ||
          0
        ),

      billedAmount:
        Number(
          currentInvoices.billedAmount ||
          0
        ),

      netCollections:
        Number(
          currentCollections.netCollections ||
          0
        ),

      outstanding:
        Number(
          currentOutstanding.outstanding ||
          0
        ),

      changes: {
        totalBills:
          pctChange(
            currentInvoices.totalBills,
            previousInvoices.totalBills
          ),

        billedAmount:
          pctChange(
            currentInvoices.billedAmount,
            previousInvoices.billedAmount
          ),

        netCollections:
          pctChange(
            currentCollections.netCollections,
            previousCollections.netCollections
          ),

        outstanding:
          pctChange(
            currentOutstanding.outstanding,
            previousOutstanding.outstanding
          ),
      },
    };


    return res.json({
      stats,
      range: {
        dateFrom,
        dateTo,
        previousFrom:
          prevFrom,
        previousTo:
          prevTo,
      },
    });

  } catch (err) {

    console.error(
      "getBillingDashboard error:",
      err
    );

    return res
      .status(500)
      .json({
        message:
          "Unable to load billing dashboard",
      });
  }
};

exports.getRevenueChart = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const now = new Date();

    const defaultTo =
      [
        now.getFullYear(),
        String(
          now.getMonth() + 1
        ).padStart(2, "0"),
        String(
          now.getDate()
        ).padStart(2, "0"),
      ].join("-");

    const defaultFrom =
      [
        now.getFullYear(),
        String(
          now.getMonth() + 1
        ).padStart(2, "0"),
        "01",
      ].join("-");


    const dateFrom =
      req.query.dateFrom ||
      defaultFrom;

    const dateTo =
      req.query.dateTo ||
      defaultTo;


    const start =
      new Date(
        `${dateFrom}T00:00:00Z`
      );

    const end =
      new Date(
        `${dateTo}T00:00:00Z`
      );


    const days =
      Math.floor(
        (
          end -
          start
        ) /
        86400000
      ) + 1;


    const useDaily =
      days <= 62;


    const groupExpr =
      useDaily
        ? "DATE(payment_date)"
        : "DATE_FORMAT(payment_date,'%Y-%m')";


    const labelExpr =
      useDaily
        ? "DATE_FORMAT(payment_date,'%d %b')"
        : "DATE_FORMAT(payment_date,'%b %Y')";


    const [rows] =
      await db.query(
        `
          SELECT
            ${groupExpr} AS sort_key,

            ${labelExpr} AS month,

            COALESCE(
              SUM(
                CASE

                  WHEN
                    transaction_type =
                    'payment'

                  THEN amount


                  WHEN
                    transaction_type =
                    'refund'

                  THEN -amount


                  ELSE 0

                END
              ),

              0
            ) AS val

          FROM payments

          WHERE hotel_id = ?

            AND payment_status =
                'success'

            AND DATE(payment_date)
                BETWEEN ? AND ?

          GROUP BY
            sort_key,
            month

          ORDER BY
            sort_key
        `,
        [
          hotelId,
          dateFrom,
          dateTo,
        ]
      );


    return res.json(
      rows.map(
        (row) => ({
          month:
            row.month,

          val:
            Number(
              row.val ||
              0
            ),
        })
      )
    );

  } catch (err) {

    console.error(
      "getRevenueChart error:",
      err
    );

    return res
      .status(500)
      .json({
        message:
          "Unable to load net collections chart",
      });
  }
};

exports.getPaymentMethods = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const now = new Date();

    const defaultTo =
      [
        now.getFullYear(),
        String(
          now.getMonth() + 1
        ).padStart(2, "0"),
        String(
          now.getDate()
        ).padStart(2, "0"),
      ].join("-");

    const defaultFrom =
      [
        now.getFullYear(),
        String(
          now.getMonth() + 1
        ).padStart(2, "0"),
        "01",
      ].join("-");


    const dateFrom =
      req.query.dateFrom ||
      defaultFrom;

    const dateTo =
      req.query.dateTo ||
      defaultTo;


    const [rows] =
      await db.query(
        `
          SELECT
            COALESCE(
              payment_method,
              'Unknown'
            ) AS label,

            COALESCE(
              SUM(amount),
              0
            ) AS amount

          FROM payments

          WHERE hotel_id = ?

            AND payment_status =
                'success'

            AND transaction_type =
                'payment'

            AND DATE(payment_date)
                BETWEEN ? AND ?

          GROUP BY
            COALESCE(
              payment_method,
              'Unknown'
            )

          ORDER BY
            amount DESC
        `,
        [
          hotelId,
          dateFrom,
          dateTo,
        ]
      );


    const total =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          Number(
            row.amount ||
            0
          ),

        0
      );


    const colors = [
      "#2563eb",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#06b6d4",
      "#f97316",
      "#ef4444",
      "#6366f1",
    ];


    return res.json(
      rows.map(
        (
          row,
          index
        ) => ({

          label:
            row.label,

          amount:
            Number(
              row.amount ||
              0
            ),

          pct:
            total > 0

              ? Math.round(
                  (
                    Number(
                      row.amount ||
                      0
                    ) /
                    total
                  ) *
                  1000
                ) / 10

              : 0,

          color:
            colors[
              index %
              colors.length
            ],
        })
      )
    );

  } catch (err) {

    console.error(
      "getPaymentMethods error:",
      err
    );

    return res
      .status(500)
      .json({
        message:
          "Unable to load payment methods",
      });
  }
};

exports.getRecentPayments = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const {
      dateFrom,
      dateTo,
      limit = 5,
    } = req.query;

    const hasRange =
      Boolean(
        dateFrom &&
        dateTo
      );

    const dateRange =
      hasRange
        ? " AND DATE(p.payment_date) BETWEEN ? AND ?"
        : "";

    const params =
      hasRange
        ? [
            hotelId,
            dateFrom,
            dateTo,
          ]
        : [
            hotelId,
          ];

    const safeLimit =
      Math.min(
        50,
        Math.max(
          1,
          Number(limit) ||
          5
        )
      );


    const [rows] =
      await db.query(
        `
          SELECT
            c.full_name AS guest,

            b.booking_id,

            i.invoice_number,

            p.amount,

            p.transaction_type,

            p.payment_method,

            p.payment_status,

            DATE_FORMAT(
              p.payment_date,
              '%d %b %Y'
            ) AS payment_date_label

          FROM payments p

          INNER JOIN bookings b
            ON b.booking_id =
               p.booking_id

           AND b.hotel_id =
               p.hotel_id

          INNER JOIN customers c
            ON c.customer_id =
               b.customer_id

          LEFT JOIN invoices i
            ON i.booking_id =
               b.booking_id

           AND i.hotel_id =
               b.hotel_id

          WHERE p.hotel_id = ?

            AND p.payment_status =
                'success'

            ${dateRange}

          ORDER BY
            p.payment_date DESC,
            p.payment_id DESC

          LIMIT ?
        `,
        [
          ...params,
          safeLimit,
        ]
      );


    return res.json(
      rows.map(
        (row) => {

          const transactionType =
            row.transaction_type ===
            "refund"
              ? "refund"
              : "payment";


          const sign =
            transactionType ===
            "refund"
              ? "-"
              : "";


          return {
            guest:
              row.guest,

            inv:
              row.invoice_number ||
              `BK-${row.booking_id}`,

            bookingId:
              row.booking_id,

            amount:
              `${sign}\u20B9 ${Number(
                row.amount ||
                0
              ).toLocaleString(
                "en-IN"
              )}`,

            rawAmount:
              Number(
                row.amount ||
                0
              ),

            transactionType,

            paymentMethod:
              row.payment_method ||
              "-",

            status:
              row.payment_status,

            date:
              row.payment_date_label,
          };
        }
      )
    );

  } catch (err) {

    console.error(
      "getRecentPayments error:",
      err
    );

    return res
      .status(500)
      .json({
        message:
          "Unable to fetch recent transactions",
      });
  }
};

exports.getAllInvoices = async (req, res) => {
  const hotelId =
    req.dbUser.hotelId;

  try {
    const {
      search = "",
      status,
      page = 1,
      limit = 8,
      dateFrom,
      dateTo,
    } = req.query;


    const safePage =
      Math.max(
        1,
        Number(page) ||
        1
      );


    const safeLimit =
      Math.min(
        100,
        Math.max(
          1,
          Number(limit) ||
          8
        )
      );


    const offset =
      (
        safePage -
        1
      ) *
      safeLimit;


    /*
     * Customer-facing Billing read model.
     *
     * Booking invoice:
     *   invoices.booking_id
     *
     * Consolidated reservation invoice:
     *   invoices.reservation_group_id
     *
     * Both scopes intentionally share one response shape so
     * the existing Billing frontend does not need a parallel
     * invoice-list implementation.
     */
    const conditions = [
      "i.hotel_id = ?",
      "i.customer_facing = 1",
    ];


    const params = [
      hotelId,
    ];


    if (
      search &&
      search.trim()
    ) {
      const like =
        `%${search.trim()}%`;

      conditions.push(
        `(
          i.invoice_number LIKE ?

          OR c.full_name LIKE ?

          OR CAST(
               b.booking_id
               AS CHAR
             ) LIKE ?

          OR rg.group_code LIKE ?
        )`
      );

      params.push(
        like,
        like,
        like,
        like
      );
    }


    /*
     * Net paid is always derived from the real payment ledger.
     *
     * Booking invoice:
     *   only that booking's successful transactions.
     *
     * Group invoice:
     *   successful transactions across every booking belonging
     *   to the reservation group.
     *
     * No payment is duplicated or recreated for the group invoice.
     */
    const netPaidSql = `
      COALESCE(
        (
          SELECT
            SUM(
              CASE

                WHEN
                  scope_payment.transaction_type =
                  'payment'

                THEN
                  scope_payment.amount


                WHEN
                  scope_payment.transaction_type =
                  'refund'

                THEN
                  -scope_payment.amount


                ELSE 0
              END
            )

          FROM payments scope_payment

          INNER JOIN bookings scope_booking
            ON scope_booking.booking_id =
               scope_payment.booking_id

           AND scope_booking.hotel_id =
               scope_payment.hotel_id

          WHERE scope_payment.hotel_id =
                i.hotel_id

            AND scope_payment.payment_status =
                'success'

            AND (
              (
                i.invoice_scope =
                'booking'

                AND scope_booking.booking_id =
                    i.booking_id
              )

              OR

              (
                i.invoice_scope =
                'reservation_group'

                AND scope_booking.reservation_group_id =
                    i.reservation_group_id
              )
            )
        ),

        0
      )
    `;


    /*
     * invoice_status is a stored snapshot.
     *
     * Billing filtering must continue using live ledger truth,
     * now for both invoice scopes.
     */
    const liveStatusSql = `
      CASE

        WHEN
          GREATEST(
            0,
            COALESCE(
              i.total_amount,
              0
            )
          ) <= 0

        THEN 'paid'


        WHEN
          (${netPaidSql}) >=
          GREATEST(
            0,
            COALESCE(
              i.total_amount,
              0
            )
          )

        THEN 'paid'


        WHEN
          (${netPaidSql}) > 0

        THEN 'partial'


        ELSE 'unpaid'
      END
    `;


    if (
      status &&
      status !==
      "All Bills"
    ) {
      conditions.push(
        `(${liveStatusSql}) = ?`
      );

      params.push(
        status.toLowerCase()
      );
    }


    if (
      dateFrom &&
      dateTo
    ) {
      conditions.push(
        "DATE(i.generated_at) BETWEEN ? AND ?"
      );

      params.push(
        dateFrom,
        dateTo
      );
    }


    const whereClause =
      `WHERE ${
        conditions.join(
          " AND "
        )
      }`;


    /*
     * Reservation-group stay projection.
     *
     * This is display metadata only.
     * Financial truth remains in invoices + payments.
     */
    const groupStayJoin = `
      LEFT JOIN (
        SELECT
          gb.hotel_id,
          gb.reservation_group_id,

          MIN(
            gb.check_in
          ) AS check_in,

          MAX(
            gb.check_out
          ) AS check_out,

          COUNT(*) AS room_count

        FROM bookings gb

        WHERE gb.reservation_group_id
              IS NOT NULL

        GROUP BY
          gb.hotel_id,
          gb.reservation_group_id
      ) group_stay

        ON group_stay.hotel_id =
           i.hotel_id

       AND group_stay.reservation_group_id =
           i.reservation_group_id
    `;


    const baseJoins = `
      LEFT JOIN bookings b
        ON b.booking_id =
           i.booking_id

       AND b.hotel_id =
           i.hotel_id


      LEFT JOIN reservation_groups rg
        ON rg.reservation_group_id =
           i.reservation_group_id

       AND rg.hotel_id =
           i.hotel_id


      INNER JOIN customers c
        ON c.customer_id =
           COALESCE(
             b.customer_id,
             rg.customer_id
           )

       AND c.hotel_id =
           i.hotel_id


      LEFT JOIN rooms r
        ON r.room_id =
           b.room_id

       AND r.hotel_id =
           i.hotel_id


      ${groupStayJoin}
    `;


    const [[{ total }]] =
      await db.query(
        `
          SELECT
            COUNT(*) AS total

          FROM invoices i

          ${baseJoins}

          ${whereClause}
        `,
        params
      );


    const [rows] =
      await db.query(
        `
          SELECT
            i.invoice_id,
            i.invoice_number,
            i.invoice_scope,
            i.booking_id,
            i.reservation_group_id,

            rg.group_code,

            CASE
              WHEN
                i.invoice_scope =
                'reservation_group'

              THEN
                DATE_FORMAT(
                  group_stay.check_in,
                  '%Y-%m-%d'
                )

              ELSE
                DATE_FORMAT(
                  b.check_in,
                  '%Y-%m-%d'
                )
            END AS check_in,


            CASE
              WHEN
                i.invoice_scope =
                'reservation_group'

              THEN
                DATE_FORMAT(
                  group_stay.check_out,
                  '%Y-%m-%d'
                )

              ELSE
                DATE_FORMAT(
                  b.check_out,
                  '%Y-%m-%d'
                )
            END AS check_out,


            c.full_name,


            CASE
              WHEN
                i.invoice_scope =
                'reservation_group'

              THEN
                CONCAT(
                  COALESCE(
                    group_stay.room_count,
                    0
                  ),
                  ' rooms'
                )

              ELSE
                r.room_number
            END AS room_number,


            i.total_amount,

            (${netPaidSql}) AS net_paid,


            (
              SELECT
                scope_payment_method.payment_method

              FROM payments scope_payment_method

              INNER JOIN bookings method_booking
                ON method_booking.booking_id =
                   scope_payment_method.booking_id

               AND method_booking.hotel_id =
                   scope_payment_method.hotel_id

              WHERE scope_payment_method.hotel_id =
                    i.hotel_id

                AND scope_payment_method.payment_status =
                    'success'

                AND scope_payment_method.transaction_type =
                    'payment'

                AND (
                  (
                    i.invoice_scope =
                    'booking'

                    AND method_booking.booking_id =
                        i.booking_id
                  )

                  OR

                  (
                    i.invoice_scope =
                    'reservation_group'

                    AND method_booking.reservation_group_id =
                        i.reservation_group_id
                  )
                )

              ORDER BY
                scope_payment_method.payment_date DESC,
                scope_payment_method.payment_id DESC

              LIMIT 1
            ) AS payment_method


          FROM invoices i

          ${baseJoins}

          ${whereClause}

          ORDER BY
            i.generated_at DESC,
            i.invoice_id DESC

          LIMIT ? OFFSET ?
        `,
        [
          ...params,
          safeLimit,
          offset,
        ]
      );


    const invoices =
      rows.map(
        (row) => {

          const amount =
            Math.max(
              0,
              Number(
                row.total_amount ||
                0
              )
            );


          const netPaid =
            Number(
              row.net_paid ||
              0
            );


          const paid =
            Math.min(
              Math.max(
                0,
                netPaid
              ),
              amount
            );


          const due =
            Math.max(
              0,
              amount -
              paid
            );


          const refundDue =
            Math.max(
              0,
              netPaid -
              amount
            );


          const liveStatus =
            amount <= 0 ||
            netPaid >= amount
              ? "Paid"
              : netPaid > 0
                ? "Partial"
                : "Unpaid";


          return {
            invoice_id:
              row.invoice_id,

            id:
              row.invoice_number,

            invoiceScope:
              row.invoice_scope,

            bookingId:
              row.booking_id
                ? Number(
                    row.booking_id
                  )
                : null,

            reservationGroupId:
              row.reservation_group_id
                ? Number(
                    row.reservation_group_id
                  )
                : null,

            groupCode:
              row.group_code ||
              null,

            guest:
              row.full_name,

            room:
              row.room_number,

            checkIn:
              row.check_in,

            checkOut:
              row.check_out,

            amount,

            paid,

            due,

            netPaid,

            refundDue,

            status:
              liveStatus,

            method:
              row.payment_method ||
              "-",
          };
        }
      );


    return res.json({
      invoices,
      total:
        Number(
          total ||
          0
        ),

      totalPages:
        Math.max(
          1,
          Math.ceil(
            Number(
              total ||
              0
            ) /
            safeLimit
          )
        ),
    });

  } catch (err) {
    console.error(
      "getAllInvoices error:",
      err
    );

    return res
      .status(500)
      .json({
        message:
          "Unable to fetch invoices",
      });
  }
};
exports.getInvoiceById = async (req, res) => {
  const hotelId =
    req.dbUser.hotelId;

  try {
    const {
      id,
    } = req.params;


    /*
     * One canonical invoice-detail reader for both:
     *
     * 1. booking invoices
     * 2. consolidated reservation-group invoices
     *
     * Payment truth remains in the existing booking payment
     * ledger. A group invoice never creates a second payment.
     */
    const [[invoice]] =
      await db.query(
        `
          SELECT
            i.invoice_id,
            i.invoice_number,
            i.invoice_scope,
            i.customer_facing,

            i.booking_id,
            i.reservation_group_id,

            rg.group_code,

            c.full_name,
            c.phone,
            c.email,


            CASE
              WHEN
                i.invoice_scope =
                'reservation_group'

              THEN
                DATE_FORMAT(
                  group_stay.check_in,
                  '%Y-%m-%d'
                )

              ELSE
                DATE_FORMAT(
                  b.check_in,
                  '%Y-%m-%d'
                )
            END AS check_in,


            CASE
              WHEN
                i.invoice_scope =
                'reservation_group'

              THEN
                DATE_FORMAT(
                  group_stay.check_out,
                  '%Y-%m-%d'
                )

              ELSE
                DATE_FORMAT(
                  b.check_out,
                  '%Y-%m-%d'
                )
            END AS check_out,


            CASE
              WHEN
                i.invoice_scope =
                'reservation_group'

              THEN
                CONCAT(
                  COALESCE(
                    group_stay.room_count,
                    0
                  ),
                  ' rooms'
                )

              ELSE
                r.room_number
            END AS room_number,


            COALESCE(
              group_stay.room_count,
              CASE
                WHEN b.booking_id IS NULL
                THEN 0
                ELSE 1
              END
            ) AS room_count,


            i.room_charges,
            i.food_charges,
            i.laundry_charges,
            i.extra_service_charges,
            i.tax_amount,
            i.total_amount,
            i.invoice_status,


            COALESCE(
              (
                SELECT
                  SUM(
                    CASE

                      WHEN
                        scope_payment.transaction_type =
                        'payment'

                      THEN
                        scope_payment.amount


                      WHEN
                        scope_payment.transaction_type =
                        'refund'

                      THEN
                        -scope_payment.amount


                      ELSE 0
                    END
                  )

                FROM payments scope_payment

                INNER JOIN bookings scope_booking
                  ON scope_booking.booking_id =
                     scope_payment.booking_id

                 AND scope_booking.hotel_id =
                     scope_payment.hotel_id

                WHERE scope_payment.hotel_id =
                      i.hotel_id

                  AND scope_payment.payment_status =
                      'success'

                  AND (
                    (
                      i.invoice_scope =
                      'booking'

                      AND scope_booking.booking_id =
                          i.booking_id
                    )

                    OR

                    (
                      i.invoice_scope =
                      'reservation_group'

                      AND scope_booking.reservation_group_id =
                          i.reservation_group_id
                    )
                  )
              ),

              0
            ) AS net_paid


          FROM invoices i


          LEFT JOIN bookings b
            ON b.booking_id =
               i.booking_id

           AND b.hotel_id =
               i.hotel_id


          LEFT JOIN reservation_groups rg
            ON rg.reservation_group_id =
               i.reservation_group_id

           AND rg.hotel_id =
               i.hotel_id


          INNER JOIN customers c
            ON c.customer_id =
               COALESCE(
                 b.customer_id,
                 rg.customer_id
               )

           AND c.hotel_id =
               i.hotel_id


          LEFT JOIN rooms r
            ON r.room_id =
               b.room_id

           AND r.hotel_id =
               i.hotel_id


          LEFT JOIN (
            SELECT
              gb.hotel_id,
              gb.reservation_group_id,

              MIN(
                gb.check_in
              ) AS check_in,

              MAX(
                gb.check_out
              ) AS check_out,

              COUNT(*) AS room_count

            FROM bookings gb

            WHERE gb.reservation_group_id
                  IS NOT NULL

            GROUP BY
              gb.hotel_id,
              gb.reservation_group_id
          ) group_stay

            ON group_stay.hotel_id =
               i.hotel_id

           AND group_stay.reservation_group_id =
               i.reservation_group_id


          WHERE i.invoice_id = ?
            AND i.hotel_id = ?
        `,
        [
          id,
          hotelId,
        ]
      );


    if (!invoice) {
      return res
        .status(404)
        .json({
          message:
            "Invoice not found",
        });
    }


    const invoiceScope =
      invoice.invoice_scope ===
      "reservation_group"
        ? "reservation_group"
        : "booking";


    /*
     * Immutability must follow the invoice scope.
     *
     * Booking invoice:
     *   one booking
     *
     * Group invoice:
     *   every booking belonging to that reservation group
     */
    const [[immutability]] =
      await db.query(
        `
          SELECT

            (
              SELECT
                COUNT(*)

              FROM payments p

              INNER JOIN bookings pb
                ON pb.booking_id =
                   p.booking_id

               AND pb.hotel_id =
                   p.hotel_id

              WHERE p.hotel_id = ?

                AND p.payment_status =
                    'success'

                AND (
                  (
                    ? =
                    'booking'

                    AND pb.booking_id = ?
                  )

                  OR

                  (
                    ? =
                    'reservation_group'

                    AND pb.reservation_group_id = ?
                  )
                )
            ) AS successful_transactions,


            (
              SELECT
                COUNT(*)

              FROM booking_financial_settlements bfs

              INNER JOIN bookings sb
                ON sb.booking_id =
                   bfs.booking_id

               AND sb.hotel_id =
                   bfs.hotel_id

              WHERE bfs.hotel_id = ?

                AND bfs.settlement_status =
                    'finalized'

                AND (
                  (
                    ? =
                    'booking'

                    AND sb.booking_id = ?
                  )

                  OR

                  (
                    ? =
                    'reservation_group'

                    AND sb.reservation_group_id = ?
                  )
                )
            ) AS finalized_settlements
        `,
        [
          hotelId,

          invoiceScope,
          invoice.booking_id,

          invoiceScope,
          invoice.reservation_group_id,


          hotelId,

          invoiceScope,
          invoice.booking_id,

          invoiceScope,
          invoice.reservation_group_id,
        ]
      );


    const successfulTransactions =
      Number(
        immutability
          ?.successful_transactions ||
        0
      );


    const finalizedSettlements =
      Number(
        immutability
          ?.finalized_settlements ||
        0
      );


    const isLocked =
      invoiceScope ===
        "reservation_group" ||
      successfulTransactions > 0 ||
      finalizedSettlements > 0;


    const lockReason =
      invoiceScope ===
        "reservation_group"
        ? "reservation_group_invoice"
        : finalizedSettlements > 0
          ? "finalized_settlement"
          : successfulTransactions > 0
            ? "financial_activity"
            : null;


    /*
     * Latest successful payment method for display.
     *
     * Group scope searches the child booking allocations.
     */
    const [[payment]] =
      await db.query(
        `
          SELECT
            p.payment_method,
            p.payment_status,
            p.payment_date,
            p.transaction_id

          FROM payments p

          INNER JOIN bookings pb
            ON pb.booking_id =
               p.booking_id

           AND pb.hotel_id =
               p.hotel_id

          WHERE p.hotel_id = ?

            AND p.payment_status =
                'success'

            AND p.transaction_type =
                'payment'

            AND (
              (
                ? =
                'booking'

                AND pb.booking_id = ?
              )

              OR

              (
                ? =
                'reservation_group'

                AND pb.reservation_group_id = ?
              )
            )

          ORDER BY
            p.payment_date DESC,
            p.payment_id DESC

          LIMIT 1
        `,
        [
          hotelId,

          invoiceScope,
          invoice.booking_id,

          invoiceScope,
          invoice.reservation_group_id,
        ]
      );


    const total =
      Math.max(
        0,
        Number(
          invoice.total_amount ||
          0
        )
      );


    const netPaid =
      Number(
        invoice.net_paid ||
        0
      );


    const applied =
      Math.min(
        Math.max(
          0,
          netPaid
        ),
        total
      );


    const due =
      Math.max(
        0,
        total -
        applied
      );


    const refundDue =
      Math.max(
        0,
        netPaid -
        total
      );


    const liveStatus =
      total <= 0 ||
      netPaid >= total
        ? "paid"
        : netPaid > 0
          ? "partial"
          : "unpaid";


    /*
     * invoice_items is already the canonical line-item model
     * for both invoice scopes.
     */
    const [itemRows] =
      await db.query(
        `
          SELECT
            invoice_item_id,
            line_no,
            item_code,
            description,
            quantity,
            unit_rate,
            line_amount,
            source_type,
            source_id

          FROM invoice_items

          WHERE hotel_id = ?
            AND invoice_id = ?

          ORDER BY
            line_no ASC,
            invoice_item_id ASC
        `,
        [
          hotelId,
          invoice.invoice_id,
        ]
      );


    const items =
      itemRows.map(
        (row) => ({
          invoiceItemId:
            Number(
              row.invoice_item_id
            ),

          lineNo:
            Number(
              row.line_no
            ),

          itemCode:
            row.item_code,

          desc:
            row.description,

          description:
            row.description,

          qty:
            Number(
              row.quantity
            ),

          quantity:
            Number(
              row.quantity
            ),

          rate:
            Number(
              row.unit_rate
            ),

          unitRate:
            Number(
              row.unit_rate
            ),

          amount:
            Number(
              row.line_amount
            ),

          lineAmount:
            Number(
              row.line_amount
            ),

          sourceType:
            row.source_type,

          sourceId:
            row.source_id,
        })
      );


    return res.json({
      items,

      invoice_id:
        invoice.invoice_id,

      id:
        invoice.invoice_number,

      invoiceScope,

      customerFacing:
        Boolean(
          invoice.customer_facing
        ),

      bookingId:
        invoice.booking_id
          ? Number(
              invoice.booking_id
            )
          : null,

      reservationGroupId:
        invoice.reservation_group_id
          ? Number(
              invoice.reservation_group_id
            )
          : null,

      groupCode:
        invoice.group_code ||
        null,

      guest:
        invoice.full_name,

      phone:
        invoice.phone,

      email:
        invoice.email,

      room:
        invoice.room_number,

      roomCount:
        Number(
          invoice.room_count ||
          0
        ),

      checkIn:
        invoice.check_in,

      checkOut:
        invoice.check_out,

      roomCharges:
        Number(
          invoice.room_charges ||
          0
        ),

      foodCharges:
        Number(
          invoice.food_charges ||
          0
        ),

      laundryCharges:
        Number(
          invoice.laundry_charges ||
          0
        ),

      serviceCharges:
        Number(
          invoice.extra_service_charges ||
          0
        ),

      tax:
        Number(
          invoice.tax_amount ||
          0
        ),

      total,

      paid:
        applied,

      due,

      netPaid,

      refundDue,

      status:
        liveStatus,

      storedStatus:
        invoice.invoice_status,

      successfulTransactions,

      finalizedSettlements,

      isLocked,

      lockReason,

      paymentMethod:
        payment?.payment_method ||
        "-",

      paymentStatus:
        payment?.payment_status ||
        "-",

      transactionId:
        payment?.transaction_id ||
        null,

      paymentDate:
        payment?.payment_date ||
        null,
    });

  } catch (err) {
    console.error(
      "getInvoiceById error:",
      err
    );

    return res
      .status(500)
      .json({
        message:
          "Unable to fetch invoice",
      });
  }
};
exports.createInvoice = async (req, res) => {
  const hotelId = req.dbUser.hotelId;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      booking_id,
      room_charges = 0,
      food_charges = 0,
      laundry_charges = 0,
      extra_service_charges = 0,
      tax_amount = 0,
      items,
    } = req.body;

    const [[booking]] = await connection.query(
      `SELECT b.booking_id,b.booking_status,
              (SELECT bfs.final_payable_amount
               FROM booking_financial_settlements bfs
               WHERE bfs.hotel_id=b.hotel_id AND bfs.booking_id=b.booking_id
                 AND bfs.settlement_status='finalized'
               ORDER BY bfs.settlement_id DESC LIMIT 1) AS final_payable_amount
       FROM bookings b
       WHERE b.booking_id=? AND b.hotel_id=?
       FOR UPDATE`,
      [booking_id, hotelId]
    );

    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: "Booking not found" });
    }

    const [[duplicate]] = await connection.query(
      "SELECT invoice_id FROM invoices WHERE booking_id=? AND hotel_id=? LIMIT 1",
      [booking_id, hotelId]
    );

    if (duplicate) {
      await connection.rollback();
      return res.status(409).json({ message: "Invoice already exists for this booking" });
    }

    const manualItemPayload =
      normalizeInvoiceItemsPayload(
        items
      );


    if (manualItemPayload.error) {

      await connection.rollback();

      return res
        .status(400)
        .json({
          code:
            "INVALID_INVOICE_ITEMS",

          message:
            manualItemPayload.error,
        });
    }


    const manualItems =
      manualItemPayload.items;


    const manualHeader =
      manualItems
        ? summarizeInvoiceItemsForLegacyHeader(
            manualItems
          )
        : {
            roomCharges:
              Number(
                room_charges
              ),

            foodCharges:
              Number(
                food_charges
              ),

            laundryCharges:
              Number(
                laundry_charges
              ),

            extraServiceCharges:
              Number(
                extra_service_charges
              ),
          };


    const subtotal =
      roundMoney(
        Number(
          manualHeader.roomCharges
        ) +

        Number(
          manualHeader.foodCharges
        ) +

        Number(
          manualHeader.laundryCharges
        ) +

        Number(
          manualHeader
            .extraServiceCharges
        )
      );

    const taxPolicy =
      await getInvoiceTaxPolicy(
        connection,
        hotelId
      );


    const policyTaxAmount =
      calculateInvoiceTax(
        subtotal,
        taxPolicy
      );


    const manualTotal =
      roundMoney(
        subtotal +
        policyTaxAmount
      );

    const hasFinalizedSettlement = booking.final_payable_amount !== null;


    let finalizedSettlement =
      null;


    if (hasFinalizedSettlement) {

      const [[settlementRow]] =
        await connection.query(
          `
            SELECT
              settlement_id,
              settlement_type,
              final_payable_amount

            FROM
              booking_financial_settlements

            WHERE hotel_id = ?
              AND booking_id = ?
              AND settlement_status =
                  'finalized'

            ORDER BY
              settlement_id DESC

            LIMIT 1
          `,
          [
            hotelId,
            booking_id,
          ]
        );


      if (!settlementRow) {
        throw new Error(
          "Finalized settlement snapshot is missing."
        );
      }


      finalizedSettlement =
        settlementRow;
    }

    const total_amount = hasFinalizedSettlement
      ? Math.max(0, Number(booking.final_payable_amount))
      : manualTotal;

    const invoiceRoomCharges = hasFinalizedSettlement ? 0 : Number(manualHeader.roomCharges);
    const invoiceFoodCharges = hasFinalizedSettlement ? 0 : Number(manualHeader.foodCharges);
    const invoiceLaundryCharges = hasFinalizedSettlement ? 0 : Number(manualHeader.laundryCharges);
    const invoiceExtraCharges = hasFinalizedSettlement ? total_amount : Number(manualHeader.extraServiceCharges);
    const invoiceTaxAmount = hasFinalizedSettlement ? 0 : policyTaxAmount;

    const [[ledger]] = await connection.query(
      `SELECT COALESCE(SUM(CASE
         WHEN transaction_type='payment' THEN amount
         WHEN transaction_type='refund' THEN -amount
         ELSE 0 END),0) AS net_paid
       FROM payments
       WHERE booking_id=? AND hotel_id=? AND payment_status='success'`,
      [booking_id, hotelId]
    );

    const netPaid = Math.max(0, Number(ledger.net_paid) || 0);
    const paid_amount = Math.min(netPaid, total_amount);
    const pending_amount = Math.max(0, total_amount - paid_amount);

    let invoice_status = "unpaid";
    if (total_amount <= 0 || paid_amount >= total_amount) invoice_status = "paid";
    else if (paid_amount > 0) invoice_status = "partial";

    const invoice_number = "INV-" + Date.now();

    const [result] = await connection.query(
      `INSERT INTO invoices
       (hotel_id, booking_id, invoice_number, room_charges, food_charges, laundry_charges,
        extra_service_charges, tax_amount, total_amount, paid_amount, pending_amount, invoice_status)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        hotelId, booking_id, invoice_number, invoiceRoomCharges, invoiceFoodCharges,
        invoiceLaundryCharges, invoiceExtraCharges, invoiceTaxAmount, total_amount,
        paid_amount, pending_amount, invoice_status,
      ]
    );

    const canonicalItems =
      hasFinalizedSettlement
        ? [
            buildSettlementInvoiceItem(
              finalizedSettlement
            ),
          ]
        : (
            manualItems ||
            buildLegacyInvoiceItems({
              roomCharges:
                invoiceRoomCharges,

              foodCharges:
                invoiceFoodCharges,

              laundryCharges:
                invoiceLaundryCharges,

              extraServiceCharges:
                invoiceExtraCharges,
            })
          );

    const canonicalSubtotal =
      roundMoney(
        canonicalItems.reduce(
          (
            sum,
            item
          ) =>
            sum +
            Number(
              item.lineAmount ||
              0
            ),

          0
        )
      );


    const canonicalTotal =
      roundMoney(
        canonicalSubtotal +
        Number(
          invoiceTaxAmount ||
          0
        )
      );


    if (
      Math.abs(
        canonicalTotal -
        roundMoney(
          total_amount
        )
      ) > 0.01
    ) {
      throw new Error(
        "Canonical invoice-item total does not match invoice total."
      );
    }


    await replaceInvoiceItems(
      connection,
      {
        hotelId,

        invoiceId:
          result.insertId,

        items:
          canonicalItems,
      }
    );


    await connection.commit();

    return res.status(201).json({
      message: "Invoice generated successfully",
      invoice_id: result.insertId,
      paid_amount,
      pending_amount,
      invoice_status,
      settlement_applied: hasFinalizedSettlement,
    });
  } catch (err) {
    await connection.rollback();
    console.error("createInvoice error:", err);
    return res.status(500).json({ message: "Unable to generate invoice" });
  } finally {
    connection.release();
  }
};

/* ===========================================================
   UPDATE INVOICE
=========================================================== */
exports.updateInvoice = async (req, res) => {
  const hotelId = req.dbUser.hotelId;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      room_charges,
      food_charges,
      laundry_charges,
      extra_service_charges,
      tax_amount,
      items,
    } = req.body;

    const [[existing]] = await connection.query(
      `SELECT
              i.booking_id,
              i.reservation_group_id,
              i.invoice_scope,
              i.customer_facing,
              b.booking_status,
              (SELECT bfs.final_payable_amount
               FROM booking_financial_settlements bfs
               WHERE bfs.hotel_id=b.hotel_id AND bfs.booking_id=b.booking_id
                 AND bfs.settlement_status='finalized'
               ORDER BY bfs.settlement_id DESC LIMIT 1) AS final_payable_amount
       FROM invoices i
       LEFT JOIN bookings b
         ON b.booking_id=i.booking_id
        AND b.hotel_id=i.hotel_id
       WHERE i.invoice_id=? AND i.hotel_id=?
       FOR UPDATE`,
      [id, hotelId]
    );

    if (!existing) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found" });
    }

    /*
     * Consolidated reservation-group invoices are generated
     * from canonical child booking invoices and payment ledgers.
     *
     * They are customer-facing immutable financial documents.
     * Any correction must happen through the underlying booking
     * settlement/payment workflow, never by manually rewriting
     * the consolidated invoice.
     */
    if (
      existing.invoice_scope ===
      "reservation_group"
    ) {
      await connection.rollback();

      return res
        .status(409)
        .json({
          code:
            "GROUP_INVOICE_IMMUTABLE",

          message:
            "Consolidated reservation-group invoices cannot be edited manually.",
        });
    }
    /*
     * Invoice immutability:
     *
     * Once money has moved successfully, or a final
     * financial settlement exists, the invoice becomes
     * an immutable financial record.
     */
    const [[immutability]] =
      await connection.query(
        `
          SELECT

            (
              SELECT
                COUNT(*)

              FROM payments p

              WHERE p.hotel_id = ?
                AND p.booking_id = ?
                AND p.payment_status =
                    'success'
            ) AS successful_transactions,

            (
              SELECT
                COUNT(*)

              FROM
                booking_financial_settlements
                bfs

              WHERE bfs.hotel_id = ?
                AND bfs.booking_id = ?
                AND bfs.settlement_status =
                    'finalized'
            ) AS finalized_settlements
        `,
        [
          hotelId,
          existing.booking_id,

          hotelId,
          existing.booking_id,
        ]
      );


    const successfulTransactions =
      Number(
        immutability
          .successful_transactions ||
        0
      );


    const finalizedSettlements =
      Number(
        immutability
          .finalized_settlements ||
        0
      );


    if (
      successfulTransactions > 0 ||
      finalizedSettlements > 0
    ) {

      await connection.rollback();

      return res
        .status(409)
        .json({
          code:
            "INVOICE_IMMUTABLE",

          message:
            "This invoice is locked because it already has a successful financial transaction or finalized settlement.",
        });
    }


    const manualItemPayload =
      normalizeInvoiceItemsPayload(
        items
      );


    if (manualItemPayload.error) {

      await connection.rollback();

      return res
        .status(400)
        .json({
          code:
            "INVALID_INVOICE_ITEMS",

          message:
            manualItemPayload.error,
        });
    }


    const manualItems =
      manualItemPayload.items;


    const manualHeader =
      manualItems
        ? summarizeInvoiceItemsForLegacyHeader(
            manualItems
          )
        : {
            roomCharges:
              Number(
                room_charges
              ),

            foodCharges:
              Number(
                food_charges
              ),

            laundryCharges:
              Number(
                laundry_charges
              ),

            extraServiceCharges:
              Number(
                extra_service_charges
              ),
          };


    const subtotal =
      roundMoney(
        Number(
          manualHeader.roomCharges
        ) +

        Number(
          manualHeader.foodCharges
        ) +

        Number(
          manualHeader.laundryCharges
        ) +

        Number(
          manualHeader
            .extraServiceCharges
        )
      );

    const taxPolicy =
      await getInvoiceTaxPolicy(
        connection,
        hotelId
      );


    const policyTaxAmount =
      calculateInvoiceTax(
        subtotal,
        taxPolicy
      );


    const manualTotal =
      roundMoney(
        subtotal +
        policyTaxAmount
      );

    const hasFinalizedSettlement = existing.final_payable_amount !== null;

    const total_amount = hasFinalizedSettlement
      ? Math.max(0, Number(existing.final_payable_amount))
      : manualTotal;

    const invoiceRoomCharges = hasFinalizedSettlement ? total_amount : Number(manualHeader.roomCharges);
    const invoiceFoodCharges = hasFinalizedSettlement ? 0 : Number(manualHeader.foodCharges);
    const invoiceLaundryCharges = hasFinalizedSettlement ? 0 : Number(manualHeader.laundryCharges);
    const invoiceExtraCharges = hasFinalizedSettlement ? 0 : Number(manualHeader.extraServiceCharges);
    const invoiceTaxAmount = hasFinalizedSettlement ? 0 : policyTaxAmount;

    const [[ledger]] = await connection.query(
      `SELECT COALESCE(SUM(CASE
         WHEN transaction_type='payment' THEN amount
         WHEN transaction_type='refund' THEN -amount
         ELSE 0 END),0) AS net_paid
       FROM payments
       WHERE booking_id=? AND hotel_id=? AND payment_status='success'`,
      [existing.booking_id, hotelId]
    );

    const netPaid = Math.max(0, Number(ledger.net_paid) || 0);
    const paid_amount = Math.min(netPaid, total_amount);
    const pending_amount = Math.max(0, total_amount - paid_amount);

    let invoice_status = "unpaid";
    if (total_amount <= 0 || paid_amount >= total_amount) invoice_status = "paid";
    else if (paid_amount > 0) invoice_status = "partial";

    await connection.query(
      `UPDATE invoices
       SET room_charges=?, food_charges=?, laundry_charges=?, extra_service_charges=?,
           tax_amount=?, total_amount=?, paid_amount=?, pending_amount=?, invoice_status=?
       WHERE invoice_id=? AND hotel_id=?`,
      [
        invoiceRoomCharges, invoiceFoodCharges, invoiceLaundryCharges, invoiceExtraCharges,
        invoiceTaxAmount, total_amount, paid_amount, pending_amount,
        invoice_status, id, hotelId,
      ]
    );

    const canonicalItems =
      manualItems ||
      buildLegacyInvoiceItems({
        roomCharges:
          invoiceRoomCharges,

        foodCharges:
          invoiceFoodCharges,

        laundryCharges:
          invoiceLaundryCharges,

        extraServiceCharges:
          invoiceExtraCharges,
      });

    const canonicalSubtotal =
      roundMoney(
        canonicalItems.reduce(
          (
            sum,
            item
          ) =>
            sum +
            Number(
              item.lineAmount ||
              0
            ),

          0
        )
      );


    const canonicalTotal =
      roundMoney(
        canonicalSubtotal +
        Number(
          invoiceTaxAmount ||
          0
        )
      );


    if (
      Math.abs(
        canonicalTotal -
        roundMoney(
          total_amount
        )
      ) > 0.01
    ) {
      throw new Error(
        "Canonical invoice-item total does not match invoice total."
      );
    }


    await replaceInvoiceItems(
      connection,
      {
        hotelId,

        invoiceId:
          Number(id),

        items:
          canonicalItems,
      }
    );


    await connection.commit();

    return res.json({
      message: "Invoice updated successfully",
      paid_amount,
      pending_amount,
      invoice_status,
      settlement_applied: hasFinalizedSettlement,
    });
  } catch (err) {
    await connection.rollback();
    console.error("updateInvoice error:", err);
    return res.status(500).json({ message: "Unable to update invoice" });
  } finally {
    connection.release();
  }
};

/* ===========================================================
   DELETE INVOICE
=========================================================== */
exports.deleteInvoice = async (req, res) => {
  return res
    .status(405)
    .json({
      code:
        "INVOICE_DELETE_DISABLED",

      message:
        "Invoices are immutable financial records and cannot be deleted.",
    });
};