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
  const hotelId = req.dbUser.hotelId;

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


    const conditions = [
      "i.hotel_id = ?",
    ];

    const params = [
      hotelId,
    ];


    if (search) {

      const like =
        `%${search}%`;

      conditions.push(
        "(i.invoice_number LIKE ? OR c.full_name LIKE ? OR b.booking_id LIKE ?)"
      );

      params.push(
        like,
        like,
        like
      );
    }


    /*
     * invoice_status is a stored snapshot only.
     * Status filtering, total count, pagination, and returned
     * rows must use the same successful payment/refund truth.
     */
    if (
      status &&
      status !== "All Bills"
    ) {

      const statusNetPaidSql = `
        COALESCE(
          (
            SELECT
              SUM(
                CASE
                  WHEN
                    status_payment.transaction_type =
                    'payment'

                  THEN
                    status_payment.amount


                  WHEN
                    status_payment.transaction_type =
                    'refund'

                  THEN
                    -status_payment.amount


                  ELSE 0
                END
              )

            FROM payments status_payment

            WHERE status_payment.booking_id =
                  b.booking_id

              AND status_payment.hotel_id =
                  i.hotel_id

              AND status_payment.payment_status =
                  'success'
          ),

          0
        )
      `;


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
            (${statusNetPaidSql}) >=
            GREATEST(
              0,
              COALESCE(
                i.total_amount,
                0
              )
            )

          THEN 'paid'


          WHEN
            (${statusNetPaidSql}) > 0

          THEN 'partial'


          ELSE 'unpaid'
        END
      `;


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
      `WHERE ${conditions.join(
        " AND "
      )}`;


    const [[{ total }]] =
      await db.query(
        `
          SELECT
            COUNT(*) AS total

          FROM invoices i

          INNER JOIN bookings b
            ON i.booking_id =
               b.booking_id

           AND b.hotel_id =
               i.hotel_id

          INNER JOIN customers c
            ON b.customer_id =
               c.customer_id

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

            b.booking_id,

            DATE_FORMAT(
              b.check_in,
              '%Y-%m-%d'
            ) AS check_in,

            DATE_FORMAT(
              b.check_out,
              '%Y-%m-%d'
            ) AS check_out,

            c.full_name,

            r.room_number,

            i.total_amount,

            COALESCE(
              (
                SELECT
                  SUM(
                    CASE

                      WHEN
                        p.transaction_type =
                        'payment'

                      THEN p.amount


                      WHEN
                        p.transaction_type =
                        'refund'

                      THEN -p.amount


                      ELSE 0

                    END
                  )

                FROM payments p

                WHERE p.booking_id =
                      b.booking_id

                  AND p.hotel_id =
                      i.hotel_id

                  AND p.payment_status =
                      'success'
              ),

              0
            ) AS net_paid,

            (
              SELECT
                p2.payment_method

              FROM payments p2

              WHERE p2.booking_id =
                    b.booking_id

                AND p2.hotel_id =
                    i.hotel_id

                AND p2.payment_status =
                    'success'

                AND p2.transaction_type =
                    'payment'

              ORDER BY
                p2.payment_date DESC,
                p2.payment_id DESC

              LIMIT 1
            ) AS payment_method

          FROM invoices i

          INNER JOIN bookings b
            ON i.booking_id =
               b.booking_id

           AND b.hotel_id =
               i.hotel_id

          INNER JOIN customers c
            ON b.customer_id =
               c.customer_id

          INNER JOIN rooms r
            ON b.room_id =
               r.room_id

           AND r.hotel_id =
               b.hotel_id

          ${whereClause}

          ORDER BY
            i.generated_at DESC

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


          const applied =
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
              applied
            );


          const refundDue =
            Math.max(
              0,
              netPaid -
              amount
            );


          const liveStatus =
            amount <= 0 ||
            applied >= amount
              ? "paid"
              : applied > 0
                ? "partial"
                : "unpaid";


          return {
            invoice_id:
              row.invoice_id,

            id:
              row.invoice_number,

            bookingId:
              row.booking_id,

            guest:
              row.full_name,

            room:
              row.room_number,

            checkIn:
              row.check_in,

            checkOut:
              row.check_out,

            amount,

            paid:
              applied,

            due,

            netPaid,

            refundDue,

            status:
              liveStatus ===
              "paid"
                ? "Paid"
                : liveStatus ===
                  "partial"
                  ? "Partial"
                  : "Unpaid",

            method:
              row.payment_method ||
              "-",
          };
        }
      );


    return res.json({
      invoices,
      total,

      totalPages:
        Math.max(
          1,
          Math.ceil(
            total /
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
  const hotelId = req.dbUser.hotelId;

  try {
    const {
      id,
    } = req.params;


    const [[invoice]] =
      await db.query(
        `
          SELECT
            i.invoice_id,
            i.invoice_number,

            b.booking_id,

            DATE_FORMAT(
              b.check_in,
              '%Y-%m-%d'
            ) AS check_in,

            DATE_FORMAT(
              b.check_out,
              '%Y-%m-%d'
            ) AS check_out,

            c.full_name,
            c.phone,
            c.email,

            r.room_number,

            i.room_charges,
            i.food_charges,
            i.laundry_charges,
            i.extra_service_charges,
            i.tax_amount,
            i.total_amount,

            COALESCE(
              (
                SELECT
                  SUM(
                    CASE

                      WHEN
                        p.transaction_type =
                        'payment'

                      THEN p.amount


                      WHEN
                        p.transaction_type =
                        'refund'

                      THEN -p.amount


                      ELSE 0

                    END
                  )

                FROM payments p

                WHERE p.booking_id =
                      b.booking_id

                  AND p.hotel_id =
                      i.hotel_id

                  AND p.payment_status =
                      'success'
              ),

              0
            ) AS net_paid

          FROM invoices i

          INNER JOIN bookings b
            ON i.booking_id =
               b.booking_id

           AND b.hotel_id =
               i.hotel_id

          INNER JOIN customers c
            ON b.customer_id =
               c.customer_id

          INNER JOIN rooms r
            ON b.room_id =
               r.room_id

           AND r.hotel_id =
               b.hotel_id

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


    const [[immutability]] =
      await db.query(
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
          invoice.booking_id,

          hotelId,
          invoice.booking_id,
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


    const isLocked =
      successfulTransactions > 0 ||
      finalizedSettlements > 0;


    const lockReason =
      finalizedSettlements > 0
        ? "finalized_settlement"
        : successfulTransactions > 0
          ? "financial_activity"
          : null;

    const [[payment]] =
      await db.query(
        `
          SELECT
            payment_method,
            payment_status,
            payment_date,
            transaction_id

          FROM payments

          WHERE booking_id = ?
            AND hotel_id = ?

            AND payment_status =
                'success'

            AND transaction_type =
                'payment'

          ORDER BY
            payment_date DESC,
            payment_id DESC

          LIMIT 1
        `,
        [
          invoice.booking_id,
          hotelId,
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
      applied >= total
        ? "paid"
        : applied > 0
          ? "partial"
          : "unpaid";


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

          rate:
            Number(
              row.unit_rate
            ),

          amount:
            Number(
              row.line_amount
            ),

          sourceType:
            row.source_type,

          sourceId:
            row.source_id === null
              ? null
              : Number(
                  row.source_id
                ),
        })
      );


    return res.json({
      items,
      invoice_id:
        invoice.invoice_id,

      id:
        invoice.invoice_number,

      bookingId:
        invoice.booking_id,

      guest:
        invoice.full_name,

      phone:
        invoice.phone,

      email:
        invoice.email,

      room:
        invoice.room_number,

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

      isLocked,

      lockReason,

      successfulTransactions,

      finalizedSettlements,

      status:
        liveStatus,

      paymentMethod:
        payment?.payment_method ||
        "-",

      paymentStatus:
        payment?.payment_status ||
        "-",

      transactionId:
        payment?.transaction_id ||
        "-",

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
      `SELECT i.booking_id,b.booking_status,
              (SELECT bfs.final_payable_amount
               FROM booking_financial_settlements bfs
               WHERE bfs.hotel_id=b.hotel_id AND bfs.booking_id=b.booking_id
                 AND bfs.settlement_status='finalized'
               ORDER BY bfs.settlement_id DESC LIMIT 1) AS final_payable_amount
       FROM invoices i
       JOIN bookings b ON b.booking_id=i.booking_id AND b.hotel_id=i.hotel_id
       WHERE i.invoice_id=? AND i.hotel_id=?
       FOR UPDATE`,
      [id, hotelId]
    );

    if (!existing) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found" });
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