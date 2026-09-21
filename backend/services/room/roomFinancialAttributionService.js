const db =
  require("../../config/db").promisePool;

/* ============================================================
   MONEY HELPERS
============================================================ */

function money(value) {
  return Number(
    Number(value || 0).toFixed(2)
  );
}

function toCents(value) {
  return Math.round(
    Number(value || 0) * 100
  );
}

function fromCents(value) {
  return Number(
    (value / 100).toFixed(2)
  );
}

/* ============================================================
   VALIDATION
============================================================ */

function isPositiveInteger(value) {
  return (
    Number.isSafeInteger(
      Number(value)
    ) &&
    Number(value) > 0
  );
}

/* ============================================================
   EXACT CENT ALLOCATION

   Important:
   - Allocation always preserves the original monetary total.
   - Supports both positive and negative amounts.
   - Largest-remainder distribution removes rounding drift.
============================================================ */

function allocateCents(
  amount,
  shares
) {
  const totalCents =
    toCents(amount);

  if (
    totalCents === 0 ||
    !Array.isArray(shares) ||
    shares.length === 0
  ) {
    return (
      Array.isArray(shares)
        ? shares
        : []
    ).map(
      (share) => ({
        roomId:
          Number(
            share.roomId
          ),

        roomNumber:
          share.roomNumber,

        amount: 0,
      })
    );
  }

  const validShares =
    shares.filter(
      (share) =>
        Number(
          share.weight
        ) > 0
    );

  if (
    validShares.length === 0
  ) {
    return [];
  }

  const totalWeight =
    validShares.reduce(
      (sum, share) =>
        sum +
        Number(
          share.weight
        ),
      0
    );

  if (
    totalWeight <= 0
  ) {
    return [];
  }

  const sign =
    totalCents < 0
      ? -1
      : 1;

  const absoluteCents =
    Math.abs(
      totalCents
    );

  const calculated =
    validShares.map(
      (share) => {
        const exact =
          absoluteCents *
          (
            Number(
              share.weight
            ) /
            totalWeight
          );

        const floor =
          Math.floor(exact);

        return {
          roomId:
            Number(
              share.roomId
            ),

          roomNumber:
            share.roomNumber,

          floor,

          fraction:
            exact - floor,
        };
      }
    );

  let remainder =
    absoluteCents -
    calculated.reduce(
      (sum, item) =>
        sum +
        item.floor,
      0
    );

  calculated.sort(
    (a, b) =>
      b.fraction -
        a.fraction ||
      a.roomId -
        b.roomId
  );

  for (
    let index = 0;
    remainder > 0;
    index += 1
  ) {
    calculated[
      index %
      calculated.length
    ].floor += 1;

    remainder -= 1;
  }

  return calculated
    .sort(
      (a, b) =>
        a.roomId -
        b.roomId
    )
    .map(
      (item) => ({
        roomId:
          item.roomId,

        roomNumber:
          item.roomNumber,

        amount:
          fromCents(
            item.floor *
            sign
          ),
      })
    );
}

/* ============================================================
   EMPTY RESPONSE
============================================================ */

function createEmptyFinancials() {
  return {
    finalized: {
      stayRevenue: 0,
      reservationFees: 0,
      revenue: 0,
      appliedPaid: 0,
      outstanding: 0,
      refundDue: 0,
    },

    provisional: {
      currentStayValue: 0,
      appliedPaid: 0,
      outstanding: 0,
    },

    deferred: {
      historicalValue: 0,
      netPaid: 0,
    },

    allocation: {
      exactAllocations: 0,
      estimatedAllocations: 0,
      unresolvedAllocations: 0,
      quality: "none",
    },

    warnings: [],
  };
}

/* ============================================================
   GROUP HELPERS
============================================================ */

function groupRowsByBooking(
  rows
) {
  const grouped =
    new Map();

  for (const row of rows) {
    const bookingId =
      Number(
        row.booking_id
      );

    if (
      !grouped.has(
        bookingId
      )
    ) {
      grouped.set(
        bookingId,
        []
      );
    }

    grouped
      .get(bookingId)
      .push(row);
  }

  return grouped;
}

/* ============================================================
   ROOM WEIGHT BUILDERS

   Stay weight:
   - active / completed physical assignments only.

   Reservation fallback weight:
   - used only when a multi-room cancelled/no-show booking
     has no actual active/completed stay weight.
   - scheduled assignment duration x room rate is used.
============================================================ */

function buildStayWeights(
  historyRows
) {
  const weights =
    new Map();

  const now =
    Date.now();

  for (
    const row of historyRows
  ) {
    if (
      row.assignment_status !==
        "active" &&
      row.assignment_status !==
        "completed"
    ) {
      continue;
    }

    const start =
      new Date(
        row.assignment_start
      ).getTime();

    let end =
      new Date(
        row.assignment_end
      ).getTime();

    if (
      row.assignment_status ===
      "active"
    ) {
      end =
        Math.min(
          end,
          now
        );
    }

    const seconds =
      Math.max(
        0,
        (
          end -
          start
        ) /
          1000
      );

    const weight =
      (
        seconds /
        86400
      ) *
      Number(
        row.rate_per_night ||
          0
      );

    if (
      weight <= 0
    ) {
      continue;
    }

    const roomId =
      Number(
        row.room_id
      );

    const current =
      weights.get(
        roomId
      ) || {
        roomId,

        roomNumber:
          row.room_number,

        weight: 0,
      };

    current.weight +=
      weight;

    weights.set(
      roomId,
      current
    );
  }

  return [
    ...weights.values(),
  ];
}

function buildReservationWeights(
  historyRows
) {
  const weights =
    new Map();

  for (
    const row of historyRows
  ) {
    const start =
      new Date(
        row.assignment_start
      ).getTime();

    const end =
      new Date(
        row.assignment_end
      ).getTime();

    const seconds =
      Math.max(
        0,
        (
          end -
          start
        ) /
          1000
      );

    const weight =
      (
        seconds /
        86400
      ) *
      Number(
        row.rate_per_night ||
          0
      );

    if (
      weight <= 0
    ) {
      continue;
    }

    const roomId =
      Number(
        row.room_id
      );

    const current =
      weights.get(
        roomId
      ) || {
        roomId,

        roomNumber:
          row.room_number,

        weight: 0,
      };

    current.weight +=
      weight;

    weights.set(
      roomId,
      current
    );
  }

  return [
    ...weights.values(),
  ];
}

/* ============================================================
   TARGET ROOM AMOUNT
============================================================ */

function targetAmount(
  allocations,
  roomId
) {
  const row =
    allocations.find(
      (item) =>
        Number(
          item.roomId
        ) ===
        Number(roomId)
    );

  return row
    ? money(
        row.amount
      )
    : 0;
}

/* ============================================================
   ADD MONEY SAFELY
============================================================ */

function addMoney(
  target,
  key,
  amount
) {
  target[key] =
    money(
      Number(
        target[key] ||
          0
      ) +
      Number(
        amount ||
          0
      )
    );
}

/* ============================================================
   MAIN SERVICE

   Returns financial attribution for ONE physical room.

   Canonical precedence:
   1. Invoice total
   2. One finalized settlement when invoice is absent
   3. Checked-in booking total = provisional
   4. Checked-out booking total without invoice/settlement =
      deferred historical only

   Never converts deferred historical bookings into finalized
   revenue.

   Multi-room monetary allocation:
   - physical room-history duration x rate is only an allocation
     ratio, never the financial source amount.
============================================================ */

async function getRoomFinancialAttribution(
  hotelId,
  roomId
) {
  if (
    !isPositiveInteger(
      hotelId
    )
  ) {
    const error =
      new Error(
        "A valid hotel ID is required."
      );

    error.code =
      "INVALID_HOTEL_ID";

    throw error;
  }

  if (
    !isPositiveInteger(
      roomId
    )
  ) {
    const error =
      new Error(
        "A valid room ID is required."
      );

    error.code =
      "INVALID_ROOM_ID";

    throw error;
  }

  const safeHotelId =
    Number(hotelId);

  const safeRoomId =
    Number(roomId);

  const result =
    createEmptyFinancials();

  /* ========================================================
     CANONICAL BOOKINGS THAT TOUCHED THIS ROOM
  ======================================================== */

  const [bookingIdRows] =
    await db.query(
      `
        SELECT DISTINCT
          booking_id

        FROM booking_room_history

        WHERE hotel_id = ?
          AND room_id = ?

        ORDER BY booking_id
      `,
      [
        safeHotelId,
        safeRoomId,
      ]
    );

  /* ========================================================
     LEGACY / INTEGRITY CHECK

     Canonical HMS requires booking_room_history. We do not
     fabricate attribution from bookings.room_id when history
     is missing.
  ======================================================== */

  const [legacyRows] =
    await db.query(
      `
        SELECT
          b.booking_id,
          b.booking_code

        FROM bookings b

        WHERE b.hotel_id = ?
          AND b.room_id = ?

          AND NOT EXISTS (
            SELECT 1

            FROM booking_room_history h

            WHERE h.hotel_id =
                  b.hotel_id

              AND h.booking_id =
                  b.booking_id
          )

        ORDER BY b.booking_id
      `,
      [
        safeHotelId,
        safeRoomId,
      ]
    );

  if (
    legacyRows.length > 0
  ) {
    result.warnings.push({
      code:
        "BOOKING_WITHOUT_ROOM_HISTORY",

      severity:
        "warning",

      message:
        "One or more bookings reference this room without canonical room-history records. Their financial values were not attributed.",

      bookings:
        legacyRows.map(
          (row) => ({
            bookingId:
              Number(
                row.booking_id
              ),

            bookingCode:
              row.booking_code,
          })
        ),
    });

    result.allocation
      .unresolvedAllocations +=
      legacyRows.length;
  }

  if (
    bookingIdRows.length === 0
  ) {
    if (
      result.allocation
        .unresolvedAllocations >
      0
    ) {
      result.allocation.quality =
        "unresolved";
    }

    return result;
  }

  const bookingIds =
    bookingIdRows.map(
      (row) =>
        Number(
          row.booking_id
        )
    );

  const placeholders =
    bookingIds
      .map(() => "?")
      .join(",");

  /* ========================================================
     FINANCIAL SOURCES
  ======================================================== */

  const [
    [bookings],
    [settlements],
    [payments],
    [history],
  ] =
    await Promise.all([
      db.query(
        `
          SELECT
            b.booking_id,
            b.booking_code,
            b.booking_status,
            b.total_amount,

            i.invoice_id,
            i.total_amount
              AS invoice_total

          FROM bookings b

          LEFT JOIN invoices i
            ON i.hotel_id =
                 b.hotel_id

           AND i.booking_id =
                 b.booking_id

          WHERE b.hotel_id = ?

            AND b.booking_id
                IN (${placeholders})

          ORDER BY b.booking_id
        `,
        [
          safeHotelId,
          ...bookingIds,
        ]
      ),

      db.query(
        `
          SELECT
            settlement_id,
            booking_id,
            settlement_type,
            settlement_status,
            final_payable_amount

          FROM booking_financial_settlements

          WHERE hotel_id = ?

            AND booking_id
                IN (${placeholders})

            AND settlement_status =
                'finalized'

          ORDER BY
            booking_id,
            settlement_id
        `,
        [
          safeHotelId,
          ...bookingIds,
        ]
      ),

      db.query(
        `
          SELECT
            booking_id,

            SUM(
              CASE
                WHEN payment_status =
                     'success'
                 AND transaction_type =
                     'payment'
                THEN amount

                WHEN payment_status =
                     'success'
                 AND transaction_type =
                     'refund'
                THEN -amount

                ELSE 0
              END
            ) AS net_paid

          FROM payments

          WHERE hotel_id = ?

            AND booking_id
                IN (${placeholders})

          GROUP BY booking_id
        `,
        [
          safeHotelId,
          ...bookingIds,
        ]
      ),

      db.query(
        `
          SELECT
            h.room_history_id,
            h.booking_id,
            h.room_id,
            r.room_number,
            h.assignment_status,
            h.assignment_start,
            h.assignment_end,
            h.rate_per_night

          FROM booking_room_history h

          INNER JOIN rooms r
            ON r.hotel_id =
                 h.hotel_id

           AND r.room_id =
                 h.room_id

          WHERE h.hotel_id = ?

            AND h.booking_id
                IN (${placeholders})

          ORDER BY
            h.booking_id,
            h.assignment_start,
            h.room_history_id
        `,
        [
          safeHotelId,
          ...bookingIds,
        ]
      ),
    ]);

  const settlementsByBooking =
    groupRowsByBooking(
      settlements
    );

  const historyByBooking =
    groupRowsByBooking(
      history
    );

  const paymentsByBooking =
    new Map(
      payments.map(
        (row) => [
          Number(
            row.booking_id
          ),

          money(
            row.net_paid
          ),
        ]
      )
    );

  /* ========================================================
     CLASSIFY + ATTRIBUTE EACH BOOKING
  ======================================================== */

  for (
    const booking
    of bookings
  ) {
    const bookingId =
      Number(
        booking.booking_id
      );

    const bookingCode =
      booking.booking_code;

    const historyRows =
      historyByBooking.get(
        bookingId
      ) || [];

    const settlementRows =
      settlementsByBooking.get(
        bookingId
      ) || [];

    const netPaid =
      money(
        paymentsByBooking.get(
          bookingId
        ) || 0
      );

    const distinctRooms =
      new Map();

    for (
      const row
      of historyRows
    ) {
      const id =
        Number(
          row.room_id
        );

      if (
        !distinctRooms.has(id)
      ) {
        distinctRooms.set(
          id,
          {
            roomId: id,

            roomNumber:
              row.room_number,
          }
        );
      }
    }

    let state = null;
    let revenueType = null;
    let payable = 0;
    let source = null;

    /* --------------------------------------------------------
       CANONICAL FINALIZED SOURCE
    -------------------------------------------------------- */

    if (
      booking.invoice_id !==
      null
    ) {
      state =
        "finalized";

      source =
        "invoice";

      payable =
        money(
          booking.invoice_total
        );

      revenueType =
        booking.booking_status ===
          "cancelled" ||
        booking.booking_status ===
          "no_show"
          ? "reservation_fee"
          : "stay";
    } else if (
      settlementRows.length ===
      1
    ) {
      const settlement =
        settlementRows[0];

      if (
        settlement
          .final_payable_amount ===
        null
      ) {
        result.warnings.push({
          code:
            "FINALIZED_SETTLEMENT_MISSING_PAYABLE",

          severity:
            "warning",

          bookingId,

          bookingCode,

          message:
            "A finalized settlement has no final payable amount, so it was not attributed.",
        });

        result.allocation
          .unresolvedAllocations +=
          1;

        continue;
      }

      state =
        "finalized";

      source =
        "finalized_settlement";

      payable =
        money(
          settlement
            .final_payable_amount
        );

      revenueType =
        settlement
          .settlement_type ===
            "cancellation" ||
        settlement
          .settlement_type ===
            "no_show"
          ? "reservation_fee"
          : "stay";
    } else if (
      settlementRows.length >
      1
    ) {
      result.warnings.push({
        code:
          "MULTIPLE_FINALIZED_SETTLEMENTS_WITHOUT_INVOICE",

        severity:
          "warning",

        bookingId,

        bookingCode,

        message:
          "Multiple finalized settlements exist without one canonical invoice. Financial attribution was skipped.",
      });

      result.allocation
        .unresolvedAllocations +=
        1;

      continue;
    } else if (
      booking.booking_status ===
      "checked_in"
    ) {
      state =
        "provisional";

      source =
        "booking_total";

      payable =
        money(
          booking.total_amount
        );

      revenueType =
        "current_stay";
    } else if (
      booking.booking_status ===
      "checked_out"
    ) {
      state =
        "deferred";

      source =
        "booking_total_deferred";

      payable =
        money(
          booking.total_amount
        );

      revenueType =
        "historical_deferred";
    } else if (
      booking.booking_status ===
        "cancelled" ||
      booking.booking_status ===
        "no_show"
    ) {
      result.warnings.push({
        code:
          "TERMINAL_BOOKING_WITHOUT_FINAL_FINANCIALS",

        severity:
          "warning",

        bookingId,

        bookingCode,

        message:
          "A cancelled or no-show booking has no canonical invoice or finalized settlement, so no finalized revenue was attributed.",
      });

      result.allocation
        .unresolvedAllocations +=
        1;

      continue;
    } else {
      continue;
    }

    /* --------------------------------------------------------
       PAID / REFUND TRUTH
    -------------------------------------------------------- */

    let appliedPaid = 0;
    let refundDue = 0;

    if (
      state ===
        "finalized" ||
      state ===
        "provisional"
    ) {
      appliedPaid =
        money(
          Math.min(
            Math.max(
              netPaid,
              0
            ),
            payable
          )
        );

      refundDue =
        money(
          Math.max(
            netPaid -
            payable,
            0
          )
        );
    }

    /* --------------------------------------------------------
       ROOM SHARES
    -------------------------------------------------------- */

    let shares = [];
    let allocationQuality =
      null;

    if (
      distinctRooms.size ===
      1
    ) {
      const onlyRoom =
        [
          ...distinctRooms
            .values(),
        ][0];

      shares = [{
        roomId:
          onlyRoom.roomId,

        roomNumber:
          onlyRoom.roomNumber,

        weight: 1,
      }];

      allocationQuality =
        "exact";
    } else {
      shares =
        buildStayWeights(
          historyRows
        );

      if (
        shares.length === 0 &&
        revenueType ===
          "reservation_fee"
      ) {
        shares =
          buildReservationWeights(
            historyRows
          );
      }

      if (
        shares.length > 0
      ) {
        allocationQuality =
          "estimated";
      }
    }

    if (
      shares.length === 0
    ) {
      result.warnings.push({
        code:
          "FINANCIAL_ALLOCATION_WEIGHT_MISSING",

        severity:
          "warning",

        bookingId,

        bookingCode,

        source,

        state,

        message:
          "A multi-room booking has no usable canonical allocation weight. Its monetary values were not attributed.",
      });

      result.allocation
        .unresolvedAllocations +=
        1;

      continue;
    }

    /* --------------------------------------------------------
       EXACT CENT SPLITS
    -------------------------------------------------------- */

    const payableSplit =
      allocateCents(
        payable,
        shares
      );

    const paidSplit =
      state ===
        "deferred"
        ? allocateCents(
            netPaid,
            shares
          )
        : allocateCents(
            appliedPaid,
            shares
          );

    const refundSplit =
      allocateCents(
        refundDue,
        shares
      );

    const roomPayable =
      targetAmount(
        payableSplit,
        safeRoomId
      );

    const roomPaid =
      targetAmount(
        paidSplit,
        safeRoomId
      );

    const roomRefundDue =
      targetAmount(
        refundSplit,
        safeRoomId
      );

    const targetIncluded =
      shares.some(
        (share) =>
          Number(
            share.roomId
          ) ===
          safeRoomId
      );

    if (
      !targetIncluded
    ) {
      continue;
    }

    if (
      allocationQuality ===
      "exact"
    ) {
      result.allocation
        .exactAllocations +=
        1;
    } else {
      result.allocation
        .estimatedAllocations +=
        1;
    }

    /* --------------------------------------------------------
       FINALIZED
    -------------------------------------------------------- */

    if (
      state ===
      "finalized"
    ) {
      if (
        revenueType ===
        "reservation_fee"
      ) {
        addMoney(
          result.finalized,
          "reservationFees",
          roomPayable
        );
      } else {
        addMoney(
          result.finalized,
          "stayRevenue",
          roomPayable
        );
      }

      addMoney(
        result.finalized,
        "appliedPaid",
        roomPaid
      );

      addMoney(
        result.finalized,
        "refundDue",
        roomRefundDue
      );

      continue;
    }

    /* --------------------------------------------------------
       PROVISIONAL CURRENT STAY
    -------------------------------------------------------- */

    if (
      state ===
      "provisional"
    ) {
      addMoney(
        result.provisional,
        "currentStayValue",
        roomPayable
      );

      addMoney(
        result.provisional,
        "appliedPaid",
        roomPaid
      );

      continue;
    }

    /* --------------------------------------------------------
       DEFERRED HISTORICAL
    -------------------------------------------------------- */

    if (
      state ===
      "deferred"
    ) {
      addMoney(
        result.deferred,
        "historicalValue",
        roomPayable
      );

      addMoney(
        result.deferred,
        "netPaid",
        roomPaid
      );
    }
  }

  /* ========================================================
     DERIVED TOTALS
  ======================================================== */

  result.finalized.revenue =
    money(
      result.finalized
        .stayRevenue +
      result.finalized
        .reservationFees
    );

  result.finalized.outstanding =
    money(
      Math.max(
        result.finalized
          .revenue -
        result.finalized
          .appliedPaid,
        0
      )
    );

  result.provisional.outstanding =
    money(
      Math.max(
        result.provisional
          .currentStayValue -
        result.provisional
          .appliedPaid,
        0
      )
    );

  /* ========================================================
     QUALITY / USER-FACING WARNINGS
  ======================================================== */

  if (
    result.allocation
      .unresolvedAllocations >
    0
  ) {
    result.allocation.quality =
      "unresolved";
  } else if (
    result.allocation
      .estimatedAllocations >
    0
  ) {
    result.allocation.quality =
      "estimated";
  } else if (
    result.allocation
      .exactAllocations >
    0
  ) {
    result.allocation.quality =
      "exact";
  }

  if (
    result.allocation
      .estimatedAllocations >
    0
  ) {
    result.warnings.push({
      code:
        "ESTIMATED_MULTI_ROOM_ALLOCATION",

      severity:
        "info",

      message:
        "Some financial values were proportionally attributed across room-change segments using canonical room duration and rate.",
    });
  }

  if (
    result.provisional
      .currentStayValue !==
      0 ||
    result.provisional
      .appliedPaid !==
      0
  ) {
    result.warnings.push({
      code:
        "PROVISIONAL_CURRENT_STAY_FINANCIALS",

      severity:
        "info",

      message:
        "Current checked-in stay values are provisional until final checkout settlement and invoice generation.",
    });
  }

  if (
    result.deferred
      .historicalValue !==
      0 ||
    result.deferred
      .netPaid !==
      0
  ) {
    result.warnings.push({
      code:
        "DEFERRED_HISTORICAL_FINANCIALS",

      severity:
        "info",

      message:
        "Some historical checked-out bookings are intentionally deferred because they do not yet have canonical finalized settlement or invoice records.",
    });
  }

  return result;
}

module.exports = {
  getRoomFinancialAttribution,
};