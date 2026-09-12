const {
  ensureNoOverlap,
} = require("../../bookingRoomService");

const {
  getBookingPolicySnapshotWithConnection,
} = require("../../hotelSettingsService");

const {
  syncSourceRequestRoom,
} = require("../../bookingSourceRequestService");
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
  return Number(Number(value || 0).toFixed(2));
}

function cleanText(value, maxLength = 500) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : "";
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

function resolveDirection(currentRate, replacementRate) {
  const difference = Number(replacementRate) - Number(currentRate);

  if (difference > 0.009) return "upgrade";
  if (difference < -0.009) return "downgrade";
  return "same_rate";
}

function resolveAdjustmentReason(source, reasonCategory) {
  if (source === "guest_request") return "guest_request";

  const category = String(reasonCategory || "")
    .trim()
    .toLowerCase();

  if (
    [
      "maintenance",
      "hotel_operational",
      "hotel_policy",
      "other",
    ].includes(category)
  ) {
    return category;
  }

  return "hotel_operational";
}

function resolveHistoryReason(source, direction, reasonCategory) {
  if (source === "guest_request") {
    if (direction === "upgrade") return "guest_upgrade";
    if (direction === "downgrade") return "guest_downgrade";
    return "other";
  }

  const category = String(reasonCategory || "")
    .trim()
    .toLowerCase();

  if (category === "maintenance") return "maintenance";
  if (category === "other") return "other";

  return "hotel_operational";
}

async function startTemporaryRoomChange(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
    replacementRoomId,
    changeSource,
    reason,
    reasonCategory = null,
  }
) {
  const hId = positiveId(hotelId);
  const aId = positiveId(adminId);
  const bId = positiveId(bookingId);
  const targetRoomId = positiveId(replacementRoomId);

  if (!hId || !aId || !bId || !targetRoomId) {
    throwHttp(
      400,
      "INVALID_TEMPORARY_ROOM_CHANGE_CONTEXT",
      "A valid hotel, admin, booking and replacement room are required."
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
        payment_status,
        booking_status,
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

  if (String(booking.booking_status || "").toLowerCase() !== "checked_in") {
    throwHttp(
      409,
      "TEMPORARY_ROOM_CHANGE_REQUIRES_CHECKED_IN_BOOKING",
      "Only a checked-in booking can use the temporary room-change workflow."
    );
  }

  if (String(booking.stay_type || "").toLowerCase() !== "overnight") {
    throwHttp(
      409,
      "TEMPORARY_ROOM_CHANGE_STAY_TYPE_NOT_SUPPORTED",
      "Temporary room change currently supports overnight stays only."
    );
  }

  if (
    !booking.current_date_sql ||
    !booking.check_out_sql ||
    booking.current_date_sql >= booking.check_out_sql
  ) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_CHANGE_STAY_WINDOW_ENDED",
      "The expected checkout date has been reached. Extend the stay before changing rooms."
    );
  }

  const originalRoomId = positiveId(booking.room_id);

  if (!originalRoomId) {
    throwHttp(
      409,
      "BOOKING_ROOM_NOT_FOUND",
      "The booking does not have a valid current room."
    );
  }

  if (originalRoomId === targetRoomId) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_CHANGE_SAME_ROOM",
      "Select a different replacement room."
    );
  }

  const [existingTemporaryChanges] = await connection.query(
    `
      SELECT
        adjustment_id,
        original_room_id,
        replacement_room_id,
        room_change_status
      FROM booking_adjustments
      WHERE hotel_id = ?
        AND booking_id = ?
        AND adjustment_type = 'room_change'
        AND room_change_mode = 'temporary'
        AND room_change_status IN ('active','awaiting_decision')
      ORDER BY adjustment_id DESC
      LIMIT 1
      FOR UPDATE
    `,
    [hId, bId]
  );

  if (existingTemporaryChanges.length) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_CHANGE_ALREADY_ACTIVE",
      "This booking already has an unresolved temporary room change."
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
      "The booking policy snapshot required for the temporary room change could not be found."
    );
  }

  const roomChangePolicy =
    policySnapshot.policySnapshot?.room_change;

  if (!roomChangePolicy || roomChangePolicy.enabled !== true) {
    throwHttp(
      409,
      "ROOM_CHANGE_DISABLED",
      "Room changes are disabled by this booking's policy."
    );
  }

  if (roomChangePolicy.allow_temporary_change !== true) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_CHANGE_DISABLED",
      "Temporary room changes are disabled by this booking's policy."
    );
  }

  if (roomChangePolicy.require_reason === true && !normalizedReason) {
    throwHttp(
      400,
      "ROOM_CHANGE_REASON_REQUIRED",
      "A reason is required for this temporary room change."
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
        AND room_id IN (?,?)
      ORDER BY room_id
      FOR UPDATE
    `,
    [hId, originalRoomId, targetRoomId]
  );

  const originalRoom = roomRows.find(
    (row) => Number(row.room_id) === originalRoomId
  );

  const replacementRoom = roomRows.find(
    (row) => Number(row.room_id) === targetRoomId
  );

  if (!originalRoom) {
    throwHttp(
      409,
      "ORIGINAL_ROOM_NOT_FOUND",
      "The booking's current room could not be found."
    );
  }

  if (!replacementRoom) {
    throwHttp(
      404,
      "REPLACEMENT_ROOM_NOT_FOUND",
      "The selected replacement room could not be found."
    );
  }

  if (String(replacementRoom.status || "").toLowerCase() !== "available") {
    throwHttp(
      409,
      "REPLACEMENT_ROOM_NOT_AVAILABLE",
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
    [hId, bId, originalRoomId]
  );

  if (activeHistories.length !== 1) {
    throwHttp(
      409,
      "ACTIVE_ROOM_HISTORY_INVALID",
      "Exactly one active room assignment is required before a temporary room change."
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

  const originalStandardRate = round2(
    originalRoom.price_per_night
  );

  const replacementStandardRate = round2(
    replacementRoom.price_per_night
  );

  const currentRate = round2(
    activeHistory.rate_per_night ??
      booking.booked_rate_per_night ??
      originalStandardRate
  );

  const direction = resolveDirection(
    originalStandardRate,
    replacementStandardRate
  );

  const adjustmentReason = resolveAdjustmentReason(
    source,
    reasonCategory
  );

  const historyReason = resolveHistoryReason(
    source,
    direction,
    reasonCategory
  );

  const originalRoomNextStatus =
    adjustmentReason === "maintenance"
      ? "maintenance"
      : "cleaning";

  const description = cleanText(
    `Temporary room change from Room ${originalRoom.room_number} to Room ${replacementRoom.room_number}. ${normalizedReason}`
  );

  const [adjustmentResult] = await connection.query(
    `
      INSERT INTO booking_adjustments (
        hotel_id,
        booking_id,
        adjustment_type,
        room_change_mode,
        original_room_id,
        replacement_room_id,
        room_change_status,
        reason,
        amount,
        description,
        created_by_admin_id
      )
      VALUES (
        ?,?,
        'room_change',
        'temporary',
        ?,?,
        'active',
        ?,
        0,
        ?,
        ?
      )
    `,
    [
      hId,
      bId,
      originalRoomId,
      targetRoomId,
      adjustmentReason,
      description,
      aId,
    ]
  );

  const returnHoldNote = cleanText(
    `Temporary return hold for room-change adjustment #${adjustmentResult.insertId}.`
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
        ?,?,?,
        NOW(),
        ?,
        'planned',
        ?,
        ?,
        ?,
        ?
      )
    `,
    [
      hId,
      bId,
      originalRoomId,
      booking.check_out_sql,
      currentRate,
      historyReason,
      returnHoldNote,
      aId,
    ]
  );

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
        ?,?,?,
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
      currentRate,
      historyReason,
      description,
      aId,
    ]
  );

  await connection.query(
    `
      UPDATE bookings
      SET room_id = ?,
          updated_by_admin_id = ?
      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [targetRoomId, aId, hId, bId]
  );

  await connection.query(
    `
      UPDATE rooms
      SET status = ?
      WHERE hotel_id = ?
        AND room_id = ?
    `,
    [originalRoomNextStatus, hId, originalRoomId]
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

  return {
    adjustmentId: Number(adjustmentResult.insertId),
    bookingId: bId,
    bookingCode: booking.booking_code,
    changeType: "temporary",
    changeSource: source,
    direction,
    historyReason,
    roomChangeStatus: "active",
    originalRoomReadyAction:
      roomChangePolicy.when_original_room_ready || "ask_guest",
    originalRoom: {
      roomId: originalRoomId,
      roomNumber: originalRoom.room_number,
      roomType: originalRoom.room_type,
      standardRate: originalStandardRate,
      status: originalRoomNextStatus,
    },
    replacementRoom: {
      roomId: targetRoomId,
      roomNumber: replacementRoom.room_number,
      roomType: replacementRoom.room_type,
      standardRate: replacementStandardRate,
      status: "occupied",
    },
    pricing: {
      policySnapshotId: policySnapshot.snapshotId,
      pricingMode: "preserve_current_rate_until_resolution",
      ratePerNight: currentRate,
      totalAmount: round2(booking.total_amount),
      paymentStatus: booking.payment_status,
      amountDifference: 0,
    },
  };
}
module.exports = {
  startTemporaryRoomChange,
};