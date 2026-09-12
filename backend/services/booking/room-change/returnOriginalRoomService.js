const {
  ensureNoOverlap,
} = require("../../bookingRoomService");

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
async function returnToOriginalRoom(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
    resolutionNotes = null,
  }
) {
  const hId = positiveId(hotelId);
  const aId = positiveId(adminId);
  const bId = positiveId(bookingId);

  if (!hId || !aId || !bId) {
    throwHttp(
      400,
      "INVALID_TEMPORARY_RETURN_CONTEXT",
      "A valid hotel, admin and booking are required."
    );
  }

  const normalizedResolutionNotes =
    cleanText(resolutionNotes);

  const [[booking]] = await connection.query(
    `
      SELECT
        booking_id,
        booking_code,
        source_request_id,
        room_id,
        booking_status,
        total_amount,
        payment_status,
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
      "TEMPORARY_RETURN_REQUIRES_CHECKED_IN_BOOKING",
      "Only a checked-in booking can return to its original room."
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
        AND room_change_status = 'awaiting_decision'
      ORDER BY adjustment_id DESC
      LIMIT 1
      FOR UPDATE
    `,
    [hId, bId]
  );

  if (!adjustments.length) {
    throwHttp(
      409,
      "TEMPORARY_ROOM_CHANGE_NOT_AWAITING_DECISION",
      "No temporary room change is currently awaiting a return decision."
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

  if (String(originalRoom.status || "").toLowerCase() !== "available") {
    throwHttp(
      409,
      "ORIGINAL_ROOM_NOT_READY",
      "The original room is not currently ready for the guest to return."
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
      SELECT
        room_history_id,
        room_id,
        assignment_status,
        rate_per_night
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

  if (
    !booking.current_date_sql ||
    !booking.check_out_sql ||
    booking.current_date_sql >= booking.check_out_sql
  ) {
    throwHttp(
      409,
      "TEMPORARY_RETURN_STAY_WINDOW_ENDED",
      "The expected checkout date has been reached."
    );
  }

  await ensureNoOverlap(
    connection,
    hId,
    [
      {
        roomId: originalRoomId,
        checkIn: booking.current_date_sql,
        checkOut: booking.check_out_sql,
      },
    ],
    bId
  );

  const resolutionHistoryNote = cleanText(
    `Temporary room-change adjustment #${adjustmentId} resolved: returned to original room. ${normalizedResolutionNotes}`
  );

  await connection.query(
    `
      UPDATE booking_room_history
      SET assignment_end = NOW(),
          assignment_status = 'completed',
          changed_by_admin_id = ?
      WHERE hotel_id = ?
        AND room_history_id = ?
        AND assignment_status = 'active'
    `,
    [aId, hId, activeReplacement[0].room_history_id]
  );

  await connection.query(
    `
      UPDATE booking_room_history
      SET assignment_start = NOW(),
          assignment_status = 'active',
          notes = ?,
          changed_by_admin_id = ?
      WHERE hotel_id = ?
        AND room_history_id = ?
        AND assignment_status = 'planned'
    `,
    [
      resolutionHistoryNote,
      aId,
      hId,
      plannedOriginal[0].room_history_id,
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
    [originalRoomId, aId, hId, bId]
  );

  await connection.query(
    `
      UPDATE rooms
      SET status = 'occupied'
      WHERE hotel_id = ?
        AND room_id = ?
    `,
    [hId, originalRoomId]
  );

  await connection.query(
    `
      UPDATE rooms
      SET status = 'cleaning'
      WHERE hotel_id = ?
        AND room_id = ?
    `,
    [hId, replacementRoomId]
  );

  const [resolutionResult] = await connection.query(
    `
      UPDATE booking_adjustments
      SET room_change_status = 'returned',
          resolution_action = 'return_original',
          resolution_notes = ?,
          resolved_by_admin_id = ?,
          resolved_at = NOW()
      WHERE hotel_id = ?
        AND adjustment_id = ?
        AND room_change_status = 'awaiting_decision'
    `,
    [
      normalizedResolutionNotes || null,
      aId,
      hId,
      adjustmentId,
    ]
  );

  if (Number(resolutionResult.affectedRows) !== 1) {
    throwHttp(
      409,
      "TEMPORARY_RETURN_STATE_CHANGED",
      "The temporary room-change state changed before it could be resolved."
    );
  }

  if (positiveId(booking.source_request_id)) {
    await syncSourceRequestRoom(connection, {
      hotelId: hId,
      sourceRequestId: Number(booking.source_request_id),
      roomId: originalRoomId,
      adminId: aId,
    });
  }

  return {
    adjustmentId,
    bookingId: bId,
    bookingCode: booking.booking_code,
    roomChangeStatus: "returned",
    resolutionAction: "return_original",
    originalRoom: {
      roomId: originalRoomId,
      roomNumber: originalRoom.room_number,
      status: "occupied",
    },
    replacementRoom: {
      roomId: replacementRoomId,
      roomNumber: replacementRoom.room_number,
      status: "cleaning",
    },
    booking: {
      roomId: originalRoomId,
      totalAmount: round2(booking.total_amount),
      paymentStatus: booking.payment_status,
    },
  };
}
module.exports = {
  returnToOriginalRoom,
};