/* ============================================================
   BOOKING SOURCE REQUEST SERVICE

   Purpose:
   - Lock QR/customer source request
   - Prevent duplicate request-to-booking conversion
   - Approve request after successful booking
   - Keep assigned room synchronized before check-in

   Important:
   All database operations use the active transaction connection.
============================================================ */


/* ============================================================
   SERVICE ERROR
============================================================ */

function throwHttp(
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

  throw error;
}


/* ============================================================
   LOCK SOURCE REQUEST

   One customer request can create only one booking.
============================================================ */

async function lockSourceRequest(
  connection,
  hotelId,
  sourceRequestId
) {
  if (!sourceRequestId) {
    return null;
  }


  const [[request]] =
    await connection.query(
      `
        SELECT
          request_id,
          status,
          assigned_room_id

        FROM customer_requests

        WHERE hotel_id = ?
          AND request_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        sourceRequestId,
      ]
    );


  if (!request) {
    throwHttp(
      404,
      "CUSTOMER_REQUEST_NOT_FOUND",
      "The customer request was not found in this hotel."
    );
  }


  if (
    request.status ===
    "declined"
  ) {
    throwHttp(
      409,
      "CUSTOMER_REQUEST_DECLINED",
      "A declined customer request cannot be converted into a booking."
    );
  }


  const [[existingBooking]] =
    await connection.query(
      `
        SELECT
          booking_id

        FROM bookings

        WHERE hotel_id = ?
          AND source_request_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotelId,
        sourceRequestId,
      ]
    );


  if (existingBooking) {
    throwHttp(
      409,
      "CUSTOMER_REQUEST_ALREADY_BOOKED",
      "This customer request has already been converted into a booking."
    );
  }


  return request;
}


/* ============================================================
   APPROVE SOURCE REQUEST

   Called only after booking creation succeeds inside the same
   database transaction.
============================================================ */

async function approveSourceRequest(
  connection,
  {
    hotelId,
    sourceRequestId,
    roomId,
    adminId,
  }
) {
  if (!sourceRequestId) {
    return;
  }


  await connection.query(
    `
      UPDATE customer_requests

      SET
        status = 'approved',
        assigned_room_id = ?,
        handled_by_admin_id = ?,
        updated_by_admin_id = ?,
        handled_at = NOW(),
        seen = 1

      WHERE hotel_id = ?
        AND request_id = ?
    `,
    [
      roomId,
      adminId,
      adminId,
      hotelId,
      sourceRequestId,
    ]
  );
}


/* ============================================================
   SYNC ASSIGNED ROOM

   Used only while the reservation is still editable
   before operational check-in lifecycle begins.
============================================================ */

async function syncSourceRequestRoom(
  connection,
  {
    hotelId,
    sourceRequestId,
    roomId,
    adminId,
  }
) {
  if (!sourceRequestId) {
    return;
  }


  await connection.query(
    `
      UPDATE customer_requests

      SET
        assigned_room_id = ?,
        updated_by_admin_id = ?

      WHERE hotel_id = ?
        AND request_id = ?
    `,
    [
      roomId,
      adminId,
      hotelId,
      sourceRequestId,
    ]
  );
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  lockSourceRequest,
  approveSourceRequest,
  syncSourceRequestRoom,
};