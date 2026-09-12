const {
  getLockedPaymentState,
} = require("../../bookingPaymentService");

const {
  getBookingPolicySnapshotWithConnection,
} = require("../../hotelSettingsService");

/* ============================================================
   HELPERS
============================================================ */

function throwHttp(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function round2(value) {
  return Number(
    Number(value || 0).toFixed(2)
  );
}

function cleanText(value, maxLength = 500) {
  const text = String(value || "").trim();

  return text
    ? text.slice(0, maxLength)
    : "";
}

function dateParts(value) {
  const match = String(value || "")
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function addDays(value, days) {
  const parts = dateParts(value);

  if (!parts) {
    return null;
  }

  const date = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day + Number(days || 0)
    )
  );

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function diffDays(startValue, endValue) {
  const start = dateParts(startValue);
  const end = dateParts(endValue);

  if (!start || !end) {
    return 0;
  }

  const startTime = Date.UTC(
    start.year,
    start.month - 1,
    start.day
  );

  const endTime = Date.UTC(
    end.year,
    end.month - 1,
    end.day
  );

  return Math.max(
    0,
    Math.round(
      (endTime - startTime) / 86400000
    )
  );
}

/* ============================================================
   PRICING

   IMPORTANT:
   Uses immutable booking-time policy snapshot only.
============================================================ */

function resolveRate({
  rule,
  originalRate,
  replacementRate,
  customRatePerNight,
}) {
  const method = String(
    rule?.pricing_method || ""
  )
    .trim()
    .toLowerCase();

  const original = round2(originalRate);
  const replacement = round2(replacementRate);

  if (method === "original_rate") {
    return {
      method,
      rate: original,
    };
  }

  if (method === "new_room_rate") {
    return {
      method,
      rate: replacement,
    };
  }

  if (method === "lower_of_both") {
    return {
      method,
      rate: round2(
        Math.min(original, replacement)
      ),
    };
  }

  if (method === "higher_of_both") {
    return {
      method,
      rate: round2(
        Math.max(original, replacement)
      ),
    };
  }

  if (method === "custom_rate") {
    const rate = Number(
      rule?.custom_rate
    );

    if (
      !Number.isFinite(rate) ||
      rate < 0
    ) {
      throwHttp(
        409,
        "STAY_REPLACEMENT_CUSTOM_RATE_INVALID",
        "The booking-time stay-replacement custom rate is invalid."
      );
    }

    return {
      method,
      rate: round2(rate),
    };
  }

  if (method === "manual") {
    const policyRate =
      rule?.custom_rate !== null &&
      rule?.custom_rate !== undefined &&
      rule?.custom_rate !== ""
        ? Number(rule.custom_rate)
        : null;

    const requestRate =
      customRatePerNight !== null &&
      customRatePerNight !== undefined &&
      customRatePerNight !== ""
        ? Number(customRatePerNight)
        : null;

    const rate =
      policyRate !== null
        ? policyRate
        : requestRate;

    if (
      rate === null ||
      !Number.isFinite(rate) ||
      rate < 0
    ) {
      throwHttp(
        400,
        "STAY_REPLACEMENT_MANUAL_RATE_REQUIRED",
        "A valid custom_rate_per_night is required by the booking-time stay-replacement policy."
      );
    }

    return {
      method,
      rate: round2(rate),
    };
  }

  throwHttp(
    409,
    "STAY_REPLACEMENT_PRICING_RULE_UNSUPPORTED",
    "The booking-time stay-replacement pricing rule is not supported."
  );
}

function resolvePricingWindow(
  rule,
  currentDate,
  checkOutDate
) {
  const effectiveFrom = String(
    rule?.effective_from || "immediately"
  )
    .trim()
    .toLowerCase();

  let pricingStartDate =
    currentDate;

  if (
    effectiveFrom === "next_billing_night" ||
    effectiveFrom === "next_day"
  ) {
    pricingStartDate =
      addDays(currentDate, 1);
  } else if (
    effectiveFrom === "custom"
  ) {
    const customDate = String(
      rule?.effective_date ||
      rule?.custom_effective_date ||
      ""
    ).trim();

    if (!dateParts(customDate)) {
      throwHttp(
        409,
        "STAY_REPLACEMENT_CUSTOM_EFFECTIVE_DATE_MISSING",
        "The booking-time stay-replacement policy does not contain a valid custom effective date."
      );
    }

    pricingStartDate =
      customDate;
  } else if (
    effectiveFrom !== "immediately" &&
    effectiveFrom !== "immediate"
  ) {
    throwHttp(
      409,
      "STAY_REPLACEMENT_EFFECTIVE_FROM_UNSUPPORTED",
      "The booking-time stay-replacement effective-from rule is not supported."
    );
  }

  if (!dateParts(pricingStartDate)) {
    throwHttp(
      409,
      "STAY_REPLACEMENT_PRICING_DATE_INVALID",
      "The stay-replacement pricing start date is invalid."
    );
  }

  if (pricingStartDate < currentDate) {
    pricingStartDate =
      currentDate;
  }

  return {
    effectiveFrom,
    pricingStartDate,
    affectedNights: diffDays(
      pricingStartDate,
      checkOutDate
    ),
  };
}

/* ============================================================
   STAY IN REPLACEMENT ROOM

   Resolves:
   temporary awaiting_decision
   → stayed_replacement

   Does NOT automatically create payment/refund entries.
============================================================ */

async function stayInReplacementRoom(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
    resolutionNotes = null,
    customRatePerNight = null,
  }
) {
  const hId = positiveId(hotelId);
  const aId = positiveId(adminId);
  const bId = positiveId(bookingId);

  if (!hId || !aId || !bId) {
    throwHttp(
      400,
      "INVALID_STAY_REPLACEMENT_CONTEXT",
      "A valid hotel, admin and booking are required."
    );
  }

  const notes =
    cleanText(resolutionNotes);

  /* ----------------------------------------------------------
     BOOKING LOCK
  ---------------------------------------------------------- */

  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          room_id,
          booking_status,
          total_amount,
          payment_status,
          DATE_FORMAT(check_out,'%Y-%m-%d')
            AS check_out_sql,
          DATE_FORMAT(CURDATE(),'%Y-%m-%d')
            AS current_date_sql

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1
        FOR UPDATE
      `,
      [hId, bId]
    );

  if (!booking) {
    throwHttp(
      404,
      "BOOKING_NOT_FOUND",
      "The booking could not be found."
    );
  }

  if (
    String(
      booking.booking_status || ""
    ).toLowerCase() !== "checked_in"
  ) {
    throwHttp(
      409,
      "STAY_REPLACEMENT_REQUIRES_CHECKED_IN_BOOKING",
      "Only a checked-in booking can stay in its temporary replacement room."
    );
  }

  if (
    !booking.current_date_sql ||
    !booking.check_out_sql ||
    booking.current_date_sql >=
      booking.check_out_sql
  ) {
    throwHttp(
      409,
      "STAY_REPLACEMENT_STAY_WINDOW_ENDED",
      "The expected checkout date has been reached. Extend the stay before resolving the room change."
    );
  }

  /* ----------------------------------------------------------
     TEMPORARY ADJUSTMENT LOCK
  ---------------------------------------------------------- */

  const [adjustments] =
    await connection.query(
      `
        SELECT
          adjustment_id,
          original_room_id,
          replacement_room_id

        FROM booking_adjustments

        WHERE hotel_id = ?
          AND booking_id = ?
          AND adjustment_type = 'room_change'
          AND room_change_mode = 'temporary'
          AND room_change_status = 'awaiting_decision'

        ORDER BY adjustment_id DESC

        LIMIT 1
        FOR UPDATE
      `,
      [hId, bId]
    );

  if (adjustments.length !== 1) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_CHANGE_NOT_AWAITING_DECISION",
      "No temporary room change is currently awaiting a stay-replacement decision."
    );
  }

  const adjustmentId =
    positiveId(
      adjustments[0].adjustment_id
    );

  const originalRoomId =
    positiveId(
      adjustments[0].original_room_id
    );

  const replacementRoomId =
    positiveId(
      adjustments[0].replacement_room_id
    );

  if (
    !adjustmentId ||
    !originalRoomId ||
    !replacementRoomId
  ) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_CHANGE_STATE_INVALID",
      "The temporary room-change state is incomplete."
    );
  }

  if (
    Number(booking.room_id) !==
    replacementRoomId
  ) {
    throwHttp(
      409,
      "TEMPORARY_REPLACEMENT_ROOM_MISMATCH",
      "The booking is no longer assigned to the expected replacement room."
    );
  }

  /* ----------------------------------------------------------
     BOOKING-TIME POLICY SNAPSHOT
  ---------------------------------------------------------- */

  const policySnapshot =
    await getBookingPolicySnapshotWithConnection(
      connection,
      {
        hotelId: hId,
        bookingId: bId,
      }
    );

  if (!policySnapshot) {
    throwHttp(
      409,
      "BOOKING_POLICY_SNAPSHOT_MISSING",
      "The booking policy snapshot could not be found."
    );
  }

  const roomChangePolicy =
    policySnapshot
      .policySnapshot
      ?.room_change;

  const pricingRule =
    roomChangePolicy
      ?.if_guest_stays_in_replacement_room;

  if (
    !roomChangePolicy ||
    roomChangePolicy.enabled !== true ||
    !pricingRule
  ) {
    throwHttp(
      409,
      "STAY_REPLACEMENT_POLICY_MISSING",
      "The booking-time stay-replacement pricing policy could not be found."
    );
  }

  /* ----------------------------------------------------------
     ROOMS LOCK
  ---------------------------------------------------------- */

  const [rooms] =
    await connection.query(
      `
        SELECT
          room_id,
          room_number,
          room_type,
          price_per_night,
          status

        FROM rooms

        WHERE hotel_id = ?
          AND room_id IN (?,?)

        ORDER BY room_id
        FOR UPDATE
      `,
      [
        hId,
        originalRoomId,
        replacementRoomId,
      ]
    );

  const originalRoom =
    rooms.find(
      (row) =>
        Number(row.room_id) ===
        originalRoomId
    );

  const replacementRoom =
    rooms.find(
      (row) =>
        Number(row.room_id) ===
        replacementRoomId
    );

  if (
    !originalRoom ||
    !replacementRoom
  ) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_REFERENCE_MISSING",
      "The original or replacement room could not be found."
    );
  }

  if (
    String(
      originalRoom.status || ""
    ).toLowerCase() !== "available"
  ) {
    throwHttp(
      409,
      "ORIGINAL_ROOM_NOT_READY",
      "The original room is not currently ready for this decision."
    );
  }

  if (
    String(
      replacementRoom.status || ""
    ).toLowerCase() !== "occupied"
  ) {
    throwHttp(
      409,
      "REPLACEMENT_ROOM_NOT_OCCUPIED",
      "The temporary replacement room is no longer occupied."
    );
  }

  /* ----------------------------------------------------------
     ROOM HISTORY LOCK
  ---------------------------------------------------------- */

  const [historyRows] =
    await connection.query(
      `
        SELECT
          room_history_id,
          room_id,
          assignment_status,
          rate_per_night,
          change_reason

        FROM booking_room_history

        WHERE hotel_id = ?
          AND booking_id = ?
          AND (
            (
              room_id = ?
              AND assignment_status = 'planned'
            )
            OR
            (
              room_id = ?
              AND assignment_status = 'active'
            )
          )

        FOR UPDATE
      `,
      [
        hId,
        bId,
        originalRoomId,
        replacementRoomId,
      ]
    );

  const plannedOriginal =
    historyRows.filter(
      (row) =>
        Number(row.room_id) ===
          originalRoomId &&
        row.assignment_status ===
          "planned"
    );

  const activeReplacement =
    historyRows.filter(
      (row) =>
        Number(row.room_id) ===
          replacementRoomId &&
        row.assignment_status ===
          "active"
    );

  if (
    plannedOriginal.length !== 1 ||
    activeReplacement.length !== 1
  ) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_HISTORY_INVALID",
      "The temporary room-change history is incomplete or inconsistent."
    );
  }

  /* ----------------------------------------------------------
     PRICING
  ---------------------------------------------------------- */

  const currentRate =
    round2(
      activeReplacement[0]
        .rate_per_night
    );

  const originalRate =
    round2(
      plannedOriginal[0]
        .rate_per_night
    );

  const replacementStandardRate =
    round2(
      replacementRoom
        .price_per_night
    );

  const rateResult =
    resolveRate({
      rule: pricingRule,
      originalRate,
      replacementRate:
        replacementStandardRate,
      customRatePerNight,
    });

  const pricingWindow =
    resolvePricingWindow(
      pricingRule,
      booking.current_date_sql,
      booking.check_out_sql
    );

  const previousTotal =
    round2(
      booking.total_amount
    );

  const differencePerNight =
    round2(
      rateResult.rate -
      currentRate
    );

  const differenceAmount =
    round2(
      differencePerNight *
      pricingWindow.affectedNights
    );

  const newTotal =
    Math.max(
      0,
      round2(
        previousTotal +
        differenceAmount
      )
    );

  /* ----------------------------------------------------------
     PAYMENT LEDGER STATE

     No payment/refund is created here.
  ---------------------------------------------------------- */

  const paymentState =
    await getLockedPaymentState(
      connection,
      hId,
      bId,
      newTotal
    );

  const netPaid =
    Math.max(
      0,
      round2(
        paymentState.netPaid
      )
    );

  const outstandingAmount =
    Math.max(
      0,
      round2(
        newTotal - netPaid
      )
    );

  const refundDueAmount =
    Math.max(
      0,
      round2(
        netPaid - newTotal
      )
    );

  const historyNote =
    cleanText(
      [
        `Temporary room-change adjustment #${adjustmentId} resolved:`,
        `guest stayed in replacement Room ${replacementRoom.room_number}.`,
        `Rate ${currentRate} -> ${rateResult.rate}.`,
        `Effective ${pricingWindow.pricingStartDate}.`,
        notes,
      ]
        .filter(Boolean)
        .join(" ")
    );

  /* ----------------------------------------------------------
     CANCEL ORIGINAL RETURN HOLD
  ---------------------------------------------------------- */

  const [holdResult] =
    await connection.query(
      `
        UPDATE booking_room_history

        SET
          assignment_status = 'cancelled',
          notes = LEFT(
            CONCAT_WS(
              ' | ',
              NULLIF(TRIM(notes), ''),
              ?
            ),
            500
          ),
          changed_by_admin_id = ?

        WHERE hotel_id = ?
          AND room_history_id = ?
          AND assignment_status = 'planned'
      `,
      [
        historyNote,
        aId,
        hId,
        plannedOriginal[0]
          .room_history_id,
      ]
    );

  if (
    Number(holdResult.affectedRows) !== 1
  ) {
    throwHttp(
      409,
      "STAY_REPLACEMENT_HOLD_CHANGED",
      "The original-room return hold changed before resolution."
    );
  }

    /* ----------------------------------------------------------
     CONVERT TEMPORARY REPLACEMENT SEGMENT
     INTO PERMANENT STAY SEGMENT

     Never overwrite the temporary history row.
  ---------------------------------------------------------- */

  const replacementHistoryReason =
    String(
      activeReplacement[0]
        .change_reason ||
      "other"
    )
      .trim()
      .toLowerCase() ||
    "other";

  const [historyCloseResult] =
    await connection.query(
      `
        UPDATE booking_room_history

        SET
          assignment_end = NOW(),
          assignment_status = 'completed',
          notes = LEFT(
            CONCAT_WS(
              ' | ',
              NULLIF(TRIM(notes), ''),
              ?
            ),
            500
          ),
          changed_by_admin_id = ?

        WHERE hotel_id = ?
          AND room_history_id = ?
          AND assignment_status = 'active'
      `,
      [
        historyNote,
        aId,
        hId,
        activeReplacement[0]
          .room_history_id,
      ]
    );

  if (
    Number(
      historyCloseResult.affectedRows
    ) !== 1
  ) {
    throwHttp(
      409,
      "STAY_REPLACEMENT_HISTORY_CHANGED",
      "The temporary replacement-room history changed before resolution."
    );
  }

  const [historyInsertResult] =
    await connection.query(
      `
        INSERT INTO booking_room_history (
          hotel_id,
          booking_id,
          room_id,
          assignment_start,
          assignment_end,
          assignment_status,
          rate_per_night,
          change_reason,
          notes,
          changed_by_admin_id
        )
        VALUES (
          ?, ?, ?,
          NOW(),
          ?,
          'active',
          ?,
          ?,
          ?,
          ?
        )
      `,
      [
        hId,
        bId,
        replacementRoomId,
        booking.check_out_sql,
        rateResult.rate,
        replacementHistoryReason,
        historyNote,
        aId,
      ]
    );

  if (
    !Number.isSafeInteger(
      Number(historyInsertResult.insertId)
    ) ||
    Number(historyInsertResult.insertId) <= 0
  ) {
    throwHttp(
      500,
      "STAY_REPLACEMENT_HISTORY_INSERT_FAILED",
      "The permanent replacement-room history could not be created."
    );
  }

  /* ----------------------------------------------------------
     BOOKING FINANCIAL STATE
  ---------------------------------------------------------- */

  const [bookingResult] =
    await connection.query(
      `
        UPDATE bookings

        SET
          total_amount = ?,
          payment_status = ?,
          updated_by_admin_id = ?

        WHERE hotel_id = ?
          AND booking_id = ?
          AND room_id = ?
          AND booking_status = 'checked_in'
      `,
      [
        newTotal,
        paymentState.paymentStatus,
        aId,
        hId,
        bId,
        replacementRoomId,
      ]
    );

  if (
    Number(bookingResult.affectedRows) !== 1
  ) {
    throwHttp(
      409,
      "STAY_REPLACEMENT_BOOKING_CHANGED",
      "The booking changed before stay-replacement resolution."
    );
  }

  /* ----------------------------------------------------------
     ORIGINAL ROOM BECOMES FREE
  ---------------------------------------------------------- */

  await connection.query(
    `
      UPDATE rooms

      SET status = 'available'

      WHERE hotel_id = ?
        AND room_id = ?
    `,
    [
      hId,
      originalRoomId,
    ]
  );

  /* ----------------------------------------------------------
     RESOLVE ADJUSTMENT
  ---------------------------------------------------------- */

  const [resolutionResult] =
    await connection.query(
      `
        UPDATE booking_adjustments

        SET
          room_change_status =
            'stayed_replacement',
          resolution_action =
            'stay_replacement',
          amount = ?,
          resolution_notes = ?,
          resolved_by_admin_id = ?,
          resolved_at = NOW()

        WHERE hotel_id = ?
          AND adjustment_id = ?
          AND room_change_status =
            'awaiting_decision'
      `,
      [
        differenceAmount,
        notes || null,
        aId,
        hId,
        adjustmentId,
      ]
    );

  if (
    Number(
      resolutionResult.affectedRows
    ) !== 1
  ) {
    throwHttp(
      409,
      "STAY_REPLACEMENT_STATE_CHANGED",
      "The temporary room-change state changed before it could be resolved."
    );
  }

  return {
    adjustmentId,

    bookingId: bId,

    bookingCode:
      booking.booking_code,

    roomChangeStatus:
      "stayed_replacement",

    resolutionAction:
      "stay_replacement",

    originalRoom: {
      roomId: originalRoomId,
      roomNumber:
        originalRoom.room_number,
      status: "available",
    },

    replacementRoom: {
      roomId: replacementRoomId,
      roomNumber:
        replacementRoom.room_number,
      roomType:
        replacementRoom.room_type,
      standardRate:
        replacementStandardRate,
      status: "occupied",
    },

    pricing: {
      policySnapshotId:
        policySnapshot.snapshotId,

      policyRule:
        "if_guest_stays_in_replacement_room",

      pricingMethod:
        rateResult.method,

      effectiveFrom:
        pricingWindow.effectiveFrom,

      pricingStartDate:
        pricingWindow.pricingStartDate,

      previousRatePerNight:
        currentRate,

      newRatePerNight:
        rateResult.rate,

      affectedNights:
        pricingWindow.affectedNights,

      differencePerNight,

      differenceAmount,

      previousTotalAmount:
        previousTotal,

      totalAmount:
        newTotal,
    },

    payment: {
      grossPaid:
        round2(
          paymentState.grossPaid
        ),

      refunded:
        round2(
          paymentState.refunded
        ),

      netPaid,

      paymentStatus:
        paymentState.paymentStatus,

      outstandingAmount,

      refundDueAmount,
    },
  };
}

module.exports = {
  stayInReplacementRoom,
};