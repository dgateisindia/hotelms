const {
  getBookingPolicySnapshotWithConnection,
} = require("../../hotelSettingsService");

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
async function markOriginalRoomReady(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
  }
) {
  const hId = positiveId(hotelId);
  const aId = positiveId(adminId);
  const bId = positiveId(bookingId);

  if (!hId || !aId || !bId) {
    throwHttp(
      400,
      "INVALID_ORIGINAL_ROOM_READY_CONTEXT",
      "A valid hotel, admin and booking are required."
    );
  }

  const [[booking]] = await connection.query(
    `
      SELECT
        booking_id,
        booking_code,
        room_id,
        booking_status,
        total_amount,
        payment_status
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
      "ORIGINAL_ROOM_READY_REQUIRES_CHECKED_IN_BOOKING",
      "Only a checked-in booking can resolve a temporary room change."
    );
  }

  const [adjustments] = await connection.query(
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
        AND room_change_status = 'active'
      ORDER BY adjustment_id DESC
      LIMIT 1
      FOR UPDATE
    `,
    [hId, bId]
  );

  if (!adjustments.length) {
    throwHttp(
      409,
      "ACTIVE_TEMPORARY_ROOM_CHANGE_NOT_FOUND",
      "No active temporary room change was found for this booking."
    );
  }

  const adjustment = adjustments[0];
  const adjustmentId = positiveId(adjustment.adjustment_id);
  const originalRoomId = positiveId(adjustment.original_room_id);
  const replacementRoomId = positiveId(adjustment.replacement_room_id);

  if (!adjustmentId || !originalRoomId || !replacementRoomId) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_CHANGE_STATE_INVALID",
      "The temporary room-change state is incomplete."
    );
  }

  if (Number(booking.room_id) !== replacementRoomId) {
    throwHttp(
      409,
      "TEMPORARY_REPLACEMENT_ROOM_MISMATCH",
      "The booking is no longer assigned to the expected replacement room."
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
      "The booking policy snapshot could not be found."
    );
  }

  const roomChangePolicy =
    policySnapshot.policySnapshot?.room_change || {};

  const originalRoomReadyAction =
    String(
      roomChangePolicy.when_original_room_ready ||
      "ask_guest"
    ).trim().toLowerCase();

  const allowedActions = new Set([
    "ask_guest",
    "return_original",
    "stay_replacement",
    "admin_decides",
  ]);

  if (!allowedActions.has(originalRoomReadyAction)) {
    throwHttp(
      409,
      "INVALID_ORIGINAL_ROOM_READY_ACTION",
      "The booking's original-room-ready policy is invalid."
    );
  }

  const [rooms] = await connection.query(
    `
      SELECT room_id,room_number,room_type,price_per_night,status
      FROM rooms
      WHERE hotel_id = ?
        AND room_id IN (?,?)
      ORDER BY room_id
      FOR UPDATE
    `,
    [hId, originalRoomId, replacementRoomId]
  );

  const originalRoom = rooms.find(
    (row) => Number(row.room_id) === originalRoomId
  );

  const replacementRoom = rooms.find(
    (row) => Number(row.room_id) === replacementRoomId
  );

  if (!originalRoom || !replacementRoom) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_REFERENCE_MISSING",
      "The original or replacement room could not be found."
    );
  }

  if (String(originalRoom.status || "").toLowerCase() === "occupied") {
    throwHttp(
      409,
      "ORIGINAL_ROOM_CURRENTLY_OCCUPIED",
      "The original room is currently occupied and cannot be marked ready."
    );
  }

  if (String(replacementRoom.status || "").toLowerCase() !== "occupied") {
    throwHttp(
      409,
      "REPLACEMENT_ROOM_NOT_OCCUPIED",
      "The temporary replacement room is no longer occupied."
    );
  }

  const [historyRows] = await connection.query(
    `
      SELECT room_history_id,room_id,assignment_status
      FROM booking_room_history
      WHERE hotel_id = ?
        AND booking_id = ?
        AND (
          (room_id = ? AND assignment_status = 'planned')
          OR
          (room_id = ? AND assignment_status = 'active')
        )
      FOR UPDATE
    `,
    [hId, bId, originalRoomId, replacementRoomId]
  );

  const plannedOriginal = historyRows.filter(
    (row) =>
      Number(row.room_id) === originalRoomId &&
      row.assignment_status === "planned"
  );

  const activeReplacement = historyRows.filter(
    (row) =>
      Number(row.room_id) === replacementRoomId &&
      row.assignment_status === "active"
  );

  if (plannedOriginal.length !== 1 || activeReplacement.length !== 1) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_HISTORY_INVALID",
      "The temporary room-change history is incomplete or inconsistent."
    );
  }

  await connection.query(
    `
      UPDATE rooms
      SET status = 'available'
      WHERE hotel_id = ?
        AND room_id = ?
    `,
    [hId, originalRoomId]
  );

  await connection.query(
    `
      UPDATE booking_adjustments
      SET room_change_status = 'awaiting_decision'
      WHERE hotel_id = ?
        AND adjustment_id = ?
        AND room_change_status = 'active'
    `,
    [hId, adjustmentId]
  );

  return {
    adjustmentId,
    bookingId: bId,
    bookingCode: booking.booking_code,
    roomChangeStatus: "awaiting_decision",
    originalRoomReadyAction,
    originalRoom: {
      roomId: originalRoomId,
      roomNumber: originalRoom.room_number,
      status: "available",
    },
    replacementRoom: {
      roomId: replacementRoomId,
      roomNumber: replacementRoom.room_number,
      status: "occupied",
    },
    booking: {
      roomId: replacementRoomId,
      totalAmount: round2(booking.total_amount),
      paymentStatus: booking.payment_status,
    },
    requiresDecision:
      originalRoomReadyAction === "ask_guest" ||
      originalRoomReadyAction === "admin_decides",
  };
}
module.exports = {
  markOriginalRoomReady,
};