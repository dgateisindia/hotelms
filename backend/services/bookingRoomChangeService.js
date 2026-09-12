const { ensureNoOverlap } = require("./bookingRoomService");
const { getLockedPaymentState } = require("./bookingPaymentService");
const { getBookingPolicySnapshotWithConnection } = require("./hotelSettingsService");
const { syncSourceRequestRoom } = require("./bookingSourceRequestService");

function throwHttp(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function round2(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function cleanText(value, maxLength = 500) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : "";
}

function dateParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function addDays(value, days) {
  const parts = dateParts(value);
  if (!parts) return null;

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + Number(days || 0)));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function diffDays(startValue, endValue) {
  const start = dateParts(startValue);
  const end = dateParts(endValue);

  if (!start || !end) return 0;

  const startTime = Date.UTC(start.year, start.month - 1, start.day);
  const endTime = Date.UTC(end.year, end.month - 1, end.day);

  return Math.max(0, Math.round((endTime - startTime) / 86400000));
}

function normalizeChangeSource(value) {
  const source = String(value || "").trim().toLowerCase();

  if (!["hotel_fault", "guest_request"].includes(source)) {
    throwHttp(
      400,
      "INVALID_ROOM_CHANGE_SOURCE",
      "change_source must be hotel_fault or guest_request."
    );
  }

  return source;
}

function resolveDirection(currentRoomRate, targetRoomRate) {
  const difference = Number(targetRoomRate) - Number(currentRoomRate);

  if (difference > 0.009) return "upgrade";
  if (difference < -0.009) return "downgrade";
  return "same_rate";
}

function resolvePolicyRule(roomChangePolicy, source, direction) {
  if (source === "guest_request") {
    if (direction === "upgrade") {
      return {
        key: "guest_request_upgrade_pricing",
        rule: roomChangePolicy.guest_request_upgrade_pricing,
      };
    }

    if (direction === "downgrade") {
      return {
        key: "guest_request_downgrade_pricing",
        rule: roomChangePolicy.guest_request_downgrade_pricing,
      };
    }

    return {
      key: "guest_request_same_rate",
      rule: {
        pricing_method: "original_rate",
        effective_from: "immediate",
      },
    };
  }

  if (direction === "upgrade") {
    return {
      key: "hotel_fault_upgrade_pricing",
      rule: roomChangePolicy.hotel_fault_upgrade_pricing,
    };
  }

  if (direction === "downgrade") {
    return {
      key: "hotel_fault_downgrade_pricing",
      rule: roomChangePolicy.hotel_fault_downgrade_pricing,
    };
  }

  return {
    key: "hotel_fault_same_rate_pricing",
    rule: roomChangePolicy.hotel_fault_same_rate_pricing,
  };
}

function resolveRate({
  rule,
  originalRate,
  currentRate,
  targetRate,
  customRate,
}) {
  const pricingMethod = String(rule?.pricing_method || "").trim().toLowerCase();

  if (pricingMethod === "original_rate") {
    return {
      pricingMethod,
      rate: round2(originalRate),
    };
  }

  if (pricingMethod === "new_room_rate") {
    return {
      pricingMethod,
      rate: round2(targetRate),
    };
  }

  if (pricingMethod === "manual") {
    const policyRate =
      rule?.custom_rate !== null &&
      rule?.custom_rate !== undefined &&
      rule?.custom_rate !== ""
        ? Number(rule.custom_rate)
        : null;

    const requestedRate =
      customRate !== null &&
      customRate !== undefined &&
      customRate !== ""
        ? Number(customRate)
        : null;

    const rate = policyRate !== null ? policyRate : requestedRate;

    if (rate === null || !Number.isFinite(rate) || rate < 0) {
      throwHttp(
        400,
        "ROOM_CHANGE_MANUAL_RATE_REQUIRED",
        "A valid custom_rate_per_night is required by the room-change policy."
      );
    }

    return {
      pricingMethod,
      rate: round2(rate),
    };
  }

  if (!pricingMethod && round2(currentRate) === round2(targetRate)) {
    return {
      pricingMethod: "original_rate",
      rate: round2(currentRate),
    };
  }

  throwHttp(
    409,
    "ROOM_CHANGE_PRICING_RULE_UNSUPPORTED",
    "The booking room-change pricing rule is not supported."
  );
}

function resolveHistoryReason(source, direction, reasonCategory) {
  if (source === "guest_request") {
    if (direction === "upgrade") return "guest_upgrade";
    if (direction === "downgrade") return "guest_downgrade";
    return "other";
  }

  const category = String(reasonCategory || "").trim().toLowerCase();

  if (category === "maintenance") return "maintenance";
  if (category === "other") return "other";

  return "hotel_operational";
}

async function changeCheckedInRoom(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
    newRoomId,
    changeSource,
    reason,
    reasonCategory = null,
    customRatePerNight = null,
  }
) {
  const hId = positiveId(hotelId);
  const aId = positiveId(adminId);
  const bId = positiveId(bookingId);
  const targetRoomId = positiveId(newRoomId);

  if (!hId || !aId || !bId || !targetRoomId) {
    throwHttp(
      400,
      "INVALID_ROOM_CHANGE_CONTEXT",
      "A valid hotel, admin, booking and target room are required."
    );
  }

  const source = normalizeChangeSource(changeSource);
  const normalizedReason = cleanText(reason);

  const [[booking]] = await connection.query(
    `
      SELECT
        booking_id,
        booking_code,
        source_request_id,
        stay_type,
        room_id,
        booked_rate_per_night,
        total_amount,
        booking_status,
        DATE_FORMAT(check_in,'%Y-%m-%d') AS check_in_sql,
        DATE_FORMAT(check_out,'%Y-%m-%d') AS check_out_sql,
        DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS current_date_sql
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

  if (String(booking.booking_status).toLowerCase() !== "checked_in") {
    throwHttp(
      409,
      "ROOM_CHANGE_REQUIRES_CHECKED_IN_BOOKING",
      "Only a checked-in booking can use the in-stay room-change workflow."
    );
  }

  if (String(booking.stay_type || "").toLowerCase() !== "overnight") {
    throwHttp(
      409,
      "ROOM_CHANGE_STAY_TYPE_NOT_SUPPORTED",
      "This room-change workflow currently supports overnight stays only."
    );
  }

  const currentRoomId = positiveId(booking.room_id);

  if (!currentRoomId) {
    throwHttp(
      409,
      "BOOKING_ROOM_NOT_FOUND",
      "The booking does not have a valid current room."
    );
  }

  if (currentRoomId === targetRoomId) {
    throwHttp(
      409,
      "ROOM_CHANGE_SAME_ROOM",
      "Select a different room for the room change."
    );
  }

  if (
    !booking.current_date_sql ||
    !booking.check_out_sql ||
    booking.current_date_sql >= booking.check_out_sql
  ) {
    throwHttp(
      409,
      "ROOM_CHANGE_STAY_WINDOW_ENDED",
      "The expected checkout date has been reached. Extend the stay before changing rooms."
    );
  }

  const policySnapshot =
    await getBookingPolicySnapshotWithConnection(connection, {
      hotelId: hId,
      bookingId: bId,
    });

  if (!policySnapshot) {
    throwHttp(
      409,
      "BOOKING_POLICY_SNAPSHOT_MISSING",
      "The booking policy snapshot required for the room change could not be found."
    );
  }

  const roomChangePolicy = policySnapshot.policySnapshot?.room_change;

  if (!roomChangePolicy || roomChangePolicy.enabled !== true) {
    throwHttp(
      409,
      "ROOM_CHANGE_DISABLED",
      "Room changes are disabled by this booking's policy."
    );
  }

  if (roomChangePolicy.allow_permanent_change !== true) {
    throwHttp(
      409,
      "PERMANENT_ROOM_CHANGE_DISABLED",
      "Permanent room changes are disabled by this booking's policy."
    );
  }

  if (roomChangePolicy.require_reason === true && !normalizedReason) {
    throwHttp(
      400,
      "ROOM_CHANGE_REASON_REQUIRED",
      "A reason is required for this room change."
    );
  }

  const [roomRows] = await connection.query(
    `
      SELECT
        room_id,
        room_number,
        room_type,
        price_per_night,
        status
      FROM rooms
      WHERE hotel_id = ?
        AND room_id IN (?, ?)
      ORDER BY room_id
      FOR UPDATE
    `,
    [hId, currentRoomId, targetRoomId]
  );

  const currentRoom = roomRows.find(
    (row) => Number(row.room_id) === currentRoomId
  );

  const targetRoom = roomRows.find(
    (row) => Number(row.room_id) === targetRoomId
  );

  if (!currentRoom) {
    throwHttp(
      409,
      "CURRENT_ROOM_NOT_FOUND",
      "The booking's current room could not be found."
    );
  }

  if (!targetRoom) {
    throwHttp(
      404,
      "TARGET_ROOM_NOT_FOUND",
      "The selected replacement room could not be found."
    );
  }

  if (String(targetRoom.status || "").toLowerCase() !== "available") {
    throwHttp(
      409,
      "TARGET_ROOM_NOT_AVAILABLE",
      "The selected replacement room is not currently available."
    );
  }

  const [activeHistories] = await connection.query(
    `
      SELECT
        room_history_id,
        room_id,
        assignment_start,
        assignment_end,
        rate_per_night
      FROM booking_room_history
      WHERE hotel_id = ?
        AND booking_id = ?
        AND room_id = ?
        AND assignment_status = 'active'
      ORDER BY room_history_id
      FOR UPDATE
    `,
    [hId, bId, currentRoomId]
  );

  if (activeHistories.length !== 1) {
    throwHttp(
      409,
      "ACTIVE_ROOM_HISTORY_INVALID",
      "Exactly one active room assignment is required before changing rooms."
    );
  }

  const activeHistory = activeHistories[0];

  await ensureNoOverlap(
    connection,
    hId,
    [
      {
        roomId: targetRoomId,
        checkIn: booking.current_date_sql,
        checkOut: booking.check_out_sql,
      },
    ],
    bId
  );

  const currentStandardRate = round2(currentRoom.price_per_night);
  const targetStandardRate = round2(targetRoom.price_per_night);
  const originalRate = round2(
    booking.booked_rate_per_night ?? activeHistory.rate_per_night ?? currentStandardRate
  );
  const currentRate = round2(
    activeHistory.rate_per_night ?? booking.booked_rate_per_night ?? currentStandardRate
  );

  const direction = resolveDirection(
    currentStandardRate,
    targetStandardRate
  );

  const policyResult = resolvePolicyRule(
    roomChangePolicy,
    source,
    direction
  );

  const rateResult = resolveRate({
    rule: policyResult.rule,
    originalRate,
    currentRate,
    targetRate: targetStandardRate,
    customRate: customRatePerNight,
  });

  const effectiveFrom =
    String(policyResult.rule?.effective_from || "immediate")
      .trim()
      .toLowerCase();

  const pricingStartDate =
    effectiveFrom === "next_billing_night"
      ? addDays(booking.current_date_sql, 1)
      : booking.current_date_sql;

  const affectedNights = diffDays(
    pricingStartDate,
    booking.check_out_sql
  );

  const previousTotal = round2(booking.total_amount);
  const priceDifferencePerNight = round2(
    rateResult.rate - currentRate
  );
  const totalDifference = round2(
    priceDifferencePerNight * affectedNights
  );
  const newTotal = Math.max(
    0,
    round2(previousTotal + totalDifference)
  );

  const paymentState = await getLockedPaymentState(
    connection,
    hId,
    bId,
    newTotal
  );

  const netPaid = Math.max(
    0,
    round2(paymentState.netPaid)
  );

  const historyReason = resolveHistoryReason(
    source,
    direction,
    reasonCategory
  );
  const oldRoomNextStatus =
    historyReason === "maintenance"
      ? "maintenance"
      : "cleaning";

  const historyNote =
    normalizedReason ||
    `Permanent room change from Room ${currentRoom.room_number} to Room ${targetRoom.room_number}`;

  await connection.query(
    `
      UPDATE booking_room_history
      SET assignment_end = NOW(),
          assignment_status = 'completed',
          changed_by_admin_id = ?
      WHERE hotel_id = ?
        AND room_history_id = ?
    `,
    [aId, hId, activeHistory.room_history_id]
  );

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
      targetRoomId,
      booking.check_out_sql,
      rateResult.rate,
      historyReason,
      historyNote,
      aId,
    ]
  );

  await connection.query(
    `
      UPDATE bookings
      SET room_id = ?,
          total_amount = ?,
          payment_status = ?,
          updated_by_admin_id = ?
      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [
      targetRoomId,
      newTotal,
      paymentState.paymentStatus,
      aId,
      hId,
      bId,
    ]
  );

  await connection.query(
    `
      UPDATE rooms
      SET status = ?
      WHERE hotel_id = ?
        AND room_id = ?
    `,
    [oldRoomNextStatus, hId, currentRoomId]
  );

  await connection.query(
    `
      UPDATE rooms
      SET status = 'occupied'
      WHERE hotel_id = ?
        AND room_id = ?
    `,
    [hId, targetRoomId]
  );

  if (positiveId(booking.source_request_id)) {
    await syncSourceRequestRoom(connection, {
      hotelId: hId,
      sourceRequestId: Number(booking.source_request_id),
      roomId: targetRoomId,
      adminId: aId,
    });
  }

  const outstandingAmount = Math.max(
    0,
    round2(newTotal - netPaid)
  );

  const refundRequiredAmount = Math.max(
    0,
    round2(netPaid - newTotal)
  );

  return {
    bookingId: bId,
    bookingCode: booking.booking_code,
    changeType: "permanent",
    changeSource: source,
    direction,
    historyReason,
    oldRoom: {
      roomId: currentRoomId,
      roomNumber: currentRoom.room_number,
      roomType: currentRoom.room_type,
      standardRate: currentStandardRate,
      status: oldRoomNextStatus,
    },
    newRoom: {
      roomId: targetRoomId,
      roomNumber: targetRoom.room_number,
      roomType: targetRoom.room_type,
      standardRate: targetStandardRate,
      status: "occupied",
    },
    pricing: {
      policySnapshotId: policySnapshot.snapshotId,
      policyRule: policyResult.key,
      pricingMethod: rateResult.pricingMethod,
      effectiveFrom,
      pricingStartDate,
      previousRatePerNight: currentRate,
      newRatePerNight: rateResult.rate,
      affectedNights,
      differencePerNight: priceDifferencePerNight,
      differenceAmount: totalDifference,
      previousTotalAmount: previousTotal,
      totalAmount: newTotal,
    },
    payment: {
      netPaid,
      paymentStatus: paymentState.paymentStatus,
      outstandingAmount,
      refundRequired: refundRequiredAmount > 0,
      refundRequiredAmount,
    },
  };
}

module.exports = {
  changeCheckedInRoom,
};