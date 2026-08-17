/* ============================================================
   HTTP ERROR HELPER
============================================================ */

const {
  calculateNights,
} = require("./bookingValidation");

const {
  ensureNoOverlap,
} = require("./bookingRoomService");

const {
  getLockedPaymentState,
} = require("./bookingPaymentService");

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
   EXTEND STAY HELPERS
============================================================ */

const EXTENSION_REASONS =
  new Set([
    "guest_request",
    "maintenance",
    "hotel_operational",
    "hotel_policy",
    "other",
  ]);


function normalizeDateOnly(
  value
) {
  const input =
    String(
      value || ""
    ).trim();


  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      input
    );


  if (!match) {
    return null;
  }


  const year =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  const day =
    Number(
      match[3]
    );


  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );


  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return null;
  }


  return (
    `${match[1]}-${match[2]}-${match[3]} ` +
    "00:00:00"
  );
}


function normalizeExtensionReason(
  value
) {
  const reason =
    String(
      value ||
      "guest_request"
    )
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_"
      );


  return EXTENSION_REASONS.has(
    reason
  )
    ? reason
    : null;
}

/* ============================================================
   CHECK IN BOOKING

   Transaction is owned by controller.

   Lifecycle:
   confirmed
      ↓
   checked_in

   Effects:
   - actual_check_in = database NOW()
   - booking status = checked_in
   - room status = occupied
   - planned room history = active

   Important:
   - pending booking cannot check in
   - future booking cannot check in early
   - expired stay window cannot check in
   - maintenance / cleaning / occupied room is blocked
   - another active room assignment is blocked
============================================================ */

async function checkInBooking(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
  }
) {
  /* ==========================================================
     LOCK BOOKING
  ========================================================== */

  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          customer_id,
          room_id,

          check_in,
          check_out,

          actual_check_in,
          actual_check_out,

          booking_status,

          CASE
            WHEN check_in > NOW()
              THEN 1
            ELSE 0
          END AS check_in_not_started,

          CASE
            WHEN check_out <= NOW()
              THEN 1
            ELSE 0
          END AS stay_window_closed

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  if (!booking) {
    throwHttp(
      404,
      "BOOKING_NOT_FOUND",
      "The booking was not found in your hotel."
    );
  }


  /* ==========================================================
     BOOKING LIFECYCLE VALIDATION
  ========================================================== */

  if (
    booking.booking_status ===
    "checked_in"
  ) {
    throwHttp(
      409,
      "BOOKING_ALREADY_CHECKED_IN",
      "This guest is already checked in."
    );
  }


  if (
    booking.booking_status ===
    "checked_out"
  ) {
    throwHttp(
      409,
      "BOOKING_ALREADY_CHECKED_OUT",
      "This booking has already been checked out."
    );
  }


  if (
    booking.booking_status ===
    "cancelled"
  ) {
    throwHttp(
      409,
      "CANCELLED_BOOKING_CANNOT_CHECK_IN",
      "A cancelled booking cannot be checked in."
    );
  }


  if (
    booking.booking_status ===
    "pending"
  ) {
    throwHttp(
      409,
      "BOOKING_NOT_CONFIRMED",
      "Confirm this reservation before checking in the guest."
    );
  }


  if (
    booking.booking_status !==
    "confirmed"
  ) {
    throwHttp(
      409,
      "BOOKING_CHECK_IN_NOT_ALLOWED",
      "This booking cannot be checked in from its current status."
    );
  }


  if (
    booking.actual_check_in
  ) {
    throwHttp(
      409,
      "ACTUAL_CHECK_IN_ALREADY_RECORDED",
      "An actual check-in time is already recorded for this booking."
    );
  }


  /*
   * Prevent accidentally checking in a reservation
   * before its planned arrival window begins.
   *
   * The database clock is used so lifecycle timestamps
   * remain consistent with actual_check_in.
   */
  if (
    Number(
      booking.check_in_not_started
    ) === 1
  ) {
    throwHttp(
      409,
      "CHECK_IN_TOO_EARLY",
      "The scheduled check-in time has not started yet."
    );
  }


  /*
   * Example:
   *
   * Expected checkout was yesterday.
   *
   * Do not start an already-expired stay.
   * Reservation dates must be corrected first.
   */
  if (
    Number(
      booking.stay_window_closed
    ) === 1
  ) {
    throwHttp(
      409,
      "BOOKING_STAY_WINDOW_EXPIRED",
      "The expected checkout time has already passed. Update the reservation dates before checking in."
    );
  }


  /* ==========================================================
     LOCK CURRENT ROOM
  ========================================================== */

  const [[room]] =
    await connection.query(
      `
        SELECT
          room_id,
          room_number,
          room_type,
          status

        FROM rooms

        WHERE hotel_id = ?
          AND room_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        booking.room_id,
      ]
    );


  if (!room) {
    throwHttp(
      409,
      "BOOKING_ROOM_NOT_FOUND",
      "The room assigned to this booking no longer exists."
    );
  }


  if (
    room.status ===
    "maintenance"
  ) {
    throwHttp(
      409,
      "ROOM_UNDER_MAINTENANCE",
      "This room is under maintenance and cannot be checked in."
    );
  }


  if (
    room.status ===
    "cleaning"
  ) {
    throwHttp(
      409,
      "ROOM_NOT_READY",
      "This room is currently being cleaned and is not ready for check-in."
    );
  }


  if (
    room.status ===
    "occupied"
  ) {
    throwHttp(
      409,
      "ROOM_ALREADY_OCCUPIED",
      "This room is currently occupied and cannot be checked in."
    );
  }


  if (
    room.status !==
    "available"
  ) {
    throwHttp(
      409,
      "ROOM_NOT_AVAILABLE_FOR_CHECK_IN",
      "The assigned room is not available for check-in."
    );
  }


  /* ==========================================================
     LOCK CURRENT ROOM ASSIGNMENT
  ========================================================== */

  const [[roomHistory]] =
    await connection.query(
      `
        SELECT
          room_history_id,
          room_id,
          assignment_status,
          assignment_start,
          assignment_end

        FROM booking_room_history

        WHERE hotel_id = ?
          AND booking_id = ?
          AND room_id = ?
          AND assignment_status IN (
            'planned',
            'active'
          )

        ORDER BY
          room_history_id DESC

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
        booking.room_id,
      ]
    );


  if (!roomHistory) {
    throwHttp(
      409,
      "BOOKING_ROOM_HISTORY_MISSING",
      "The active room assignment for this booking could not be found."
    );
  }


  if (
    roomHistory.assignment_status ===
    "active"
  ) {
    throwHttp(
      409,
      "ROOM_ASSIGNMENT_ALREADY_ACTIVE",
      "The room assignment is already marked as active."
    );
  }


  /* ==========================================================
     DEFENSIVE ACTIVE-STAY CHECK

     Room status should already prevent this, but room history
     is checked as an additional integrity guard.
  ========================================================== */

  const [[otherActiveAssignment]] =
    await connection.query(
      `
        SELECT
          room_history_id,
          booking_id

        FROM booking_room_history

        WHERE hotel_id = ?
          AND room_id = ?
          AND booking_id <> ?
          AND assignment_status =
            'active'

        ORDER BY
          room_history_id ASC

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotelId,
        booking.room_id,
        bookingId,
      ]
    );


  if (
    otherActiveAssignment
  ) {
    throwHttp(
      409,
      "ROOM_HAS_ACTIVE_STAY",
      "Another active stay is already assigned to this room."
    );
  }


  /* ==========================================================
     UPDATE BOOKING
  ========================================================== */

  await connection.query(
    `
      UPDATE bookings

      SET
        booking_status =
          'checked_in',

        actual_check_in =
          NOW(),

        actual_check_out =
          NULL,

        updated_by_admin_id = ?

      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [
      adminId,
      hotelId,
      bookingId,
    ]
  );


  /* ==========================================================
     UPDATE ROOM
  ========================================================== */

  await connection.query(
    `
      UPDATE rooms

      SET
        status =
          'occupied'

      WHERE hotel_id = ?
        AND room_id = ?
    `,
    [
      hotelId,
      booking.room_id,
    ]
  );


  /* ==========================================================
     ACTIVATE ROOM HISTORY

     assignment_start / assignment_end are intentionally
     preserved here.

     They represent the reservation assignment window.
     actual_check_in is stored separately in bookings.
  ========================================================== */

  await connection.query(
    `
      UPDATE booking_room_history

      SET
        assignment_status =
          'active',

        changed_by_admin_id = ?

      WHERE hotel_id = ?
        AND room_history_id = ?
    `,
    [
      adminId,
      hotelId,
      roomHistory.room_history_id,
    ]
  );


  /* ==========================================================
     RETURN FINAL DATABASE STATE
  ========================================================== */

  const [[updated]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          customer_id,
          room_id,
          check_in,
          check_out,
          actual_check_in,
          booking_status

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  return {
    bookingId:
      updated.booking_id,

    bookingCode:
      updated.booking_code,

    customerId:
      updated.customer_id,

    roomId:
      updated.room_id,

    roomNumber:
      room.room_number,

    roomType:
      room.room_type,

    checkIn:
      updated.check_in,

    expectedCheckOut:
      updated.check_out,

    actualCheckIn:
      updated.actual_check_in,

    bookingStatus:
      updated.booking_status,

    roomStatus:
      "occupied",
  };
}

/* ============================================================
   EXTEND STAY

   checked_in
      ↓
   checked_in with later expected checkout

   Effects:
   - booking check_out extended
   - active room assignment extended
   - room conflict checked before extension
   - stay_extension adjustment recorded
   - booking total increased
   - payment status recalculated

   No payment transaction is created automatically.
============================================================ */

async function extendStayBooking(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
    newCheckOut,
    reason =
      "guest_request",
  }
) {
  /* ==========================================================
     INPUT VALIDATION
  ========================================================== */

  const normalizedNewCheckOut =
    normalizeDateOnly(
      newCheckOut
    );


  if (
    !normalizedNewCheckOut
  ) {
    throwHttp(
      400,
      "INVALID_EXTENSION_CHECKOUT",
      "Enter a valid new expected checkout date."
    );
  }


  const normalizedReason =
    normalizeExtensionReason(
      reason
    );


  if (
    !normalizedReason
  ) {
    throwHttp(
      400,
      "INVALID_EXTENSION_REASON",
      "The stay extension reason is invalid."
    );
  }


  /* ==========================================================
     LOCK BOOKING
  ========================================================== */

  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          customer_id,
          room_id,

          booked_rate_per_night,

          DATE_FORMAT(
            check_in,
            '%Y-%m-%d %H:%i:%s'
          ) AS check_in_sql,

          DATE_FORMAT(
            check_out,
            '%Y-%m-%d %H:%i:%s'
          ) AS check_out_sql,

          actual_check_in,
          actual_check_out,

          booking_status,
          payment_status,
          total_amount

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  if (!booking) {
    throwHttp(
      404,
      "BOOKING_NOT_FOUND",
      "The booking was not found in your hotel."
    );
  }


  /* ==========================================================
     LIFECYCLE VALIDATION
  ========================================================== */

  if (
    booking.booking_status !==
    "checked_in"
  ) {
    throwHttp(
      409,
      "STAY_EXTENSION_NOT_ALLOWED",
      "Only a checked-in stay can be extended."
    );
  }


  if (
    !booking.actual_check_in
  ) {
    throwHttp(
      409,
      "CHECK_IN_TIME_MISSING",
      "This booking is marked checked in but has no actual check-in time."
    );
  }


  if (
    booking.actual_check_out
  ) {
    throwHttp(
      409,
      "BOOKING_ALREADY_CHECKED_OUT",
      "A checked-out stay cannot be extended."
    );
  }


  /* ==========================================================
     CALCULATE EXTENSION
  ========================================================== */

  const extensionNights =
    calculateNights(
      booking.check_out_sql,
      normalizedNewCheckOut
    );


  if (
    extensionNights <= 0
  ) {
    throwHttp(
      400,
      "NEW_CHECKOUT_MUST_BE_LATER",
      "The new expected checkout must be later than the current expected checkout."
    );
  }


  /* ==========================================================
     LOCK ROOM

     An active checked-in stay must own an occupied room.
  ========================================================== */

  const [[room]] =
    await connection.query(
      `
        SELECT
          room_id,
          room_number,
          room_type,
          status

        FROM rooms

        WHERE hotel_id = ?
          AND room_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        booking.room_id,
      ]
    );


  if (!room) {
    throwHttp(
      409,
      "BOOKING_ROOM_NOT_FOUND",
      "The room assigned to this stay no longer exists."
    );
  }


  if (
    room.status !==
    "occupied"
  ) {
    throwHttp(
      409,
      "ACTIVE_STAY_ROOM_STATE_INVALID",
      "The room assigned to this checked-in stay is not marked occupied."
    );
  }


  /* ==========================================================
     LOCK ACTIVE ROOM HISTORY
  ========================================================== */

  const [activeHistories] =
    await connection.query(
      `
        SELECT
          room_history_id,
          room_id,
          assignment_status,
          rate_per_night,

          DATE_FORMAT(
            assignment_start,
            '%Y-%m-%d %H:%i:%s'
          ) AS assignment_start_sql,

          DATE_FORMAT(
            assignment_end,
            '%Y-%m-%d %H:%i:%s'
          ) AS assignment_end_sql

        FROM booking_room_history

        WHERE hotel_id = ?
          AND booking_id = ?
          AND room_id = ?
          AND assignment_status =
            'active'

        ORDER BY
          room_history_id ASC

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
        booking.room_id,
      ]
    );


  if (
    activeHistories.length ===
    0
  ) {
    throwHttp(
      409,
      "ACTIVE_ROOM_ASSIGNMENT_MISSING",
      "The active room assignment for this stay could not be found."
    );
  }


  if (
    activeHistories.length >
    1
  ) {
    throwHttp(
      409,
      "MULTIPLE_ACTIVE_ROOM_ASSIGNMENTS",
      "Multiple active room assignments were found for this stay."
    );
  }


  const activeHistory =
    activeHistories[0];


  if (
    activeHistory
      .assignment_end_sql !==
    booking.check_out_sql
  ) {
    throwHttp(
      409,
      "ROOM_HISTORY_CHECKOUT_MISMATCH",
      "The booking checkout date and active room assignment are not synchronized."
    );
  }


  /* ==========================================================
     FUTURE ROOM CONFLICT CHECK

     Only the newly requested extension window needs checking.

     Current booking is excluded.
  ========================================================== */

  await ensureNoOverlap(
    connection,
    hotelId,
    [
      {
        roomId:
          Number(
            booking.room_id
          ),

        checkIn:
          booking.check_out_sql,

        checkOut:
          normalizedNewCheckOut,
      },
    ],
    bookingId
  );


  /* ==========================================================
     RATE / AMOUNT
  ========================================================== */

  const ratePerNight =
    Number(
      activeHistory
        .rate_per_night ??
      booking
        .booked_rate_per_night
    );


  if (
    !Number.isFinite(
      ratePerNight
    ) ||
    ratePerNight < 0
  ) {
    throwHttp(
      500,
      "INVALID_ACTIVE_ROOM_RATE",
      "The active room assignment has an invalid nightly rate."
    );
  }


  const previousTotalAmount =
    Number(
      booking.total_amount
    );


  if (
    !Number.isFinite(
      previousTotalAmount
    ) ||
    previousTotalAmount < 0
  ) {
    throwHttp(
      500,
      "INVALID_BOOKING_TOTAL",
      "The current booking total is invalid."
    );
  }


  const extensionAmount =
    Number(
      (
        ratePerNight *
        extensionNights
      ).toFixed(2)
    );


  const newTotalAmount =
    Number(
      (
        previousTotalAmount +
        extensionAmount
      ).toFixed(2)
    );


  if (
    !Number.isFinite(
      newTotalAmount
    ) ||
    newTotalAmount >
      9999999999.99
  ) {
    throwHttp(
      400,
      "EXTENSION_TOTAL_TOO_LARGE",
      "The extended booking total is too large."
    );
  }


  /* ==========================================================
     PAYMENT STATE

     Example:
     Old total = ₹5,000
     Paid      = ₹5,000

     Extend one night at ₹2,500

     New total = ₹7,500
     Paid      = ₹5,000
     Status    = partial
  ========================================================== */

  const paymentState =
    await getLockedPaymentState(
      connection,
      hotelId,
      bookingId,
      newTotalAmount
    );


  /* ==========================================================
     UPDATE BOOKING
  ========================================================== */

  await connection.query(
    `
      UPDATE bookings

      SET
        check_out = ?,
        total_amount = ?,
        payment_status = ?,
        updated_by_admin_id = ?

      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [
      normalizedNewCheckOut,
      newTotalAmount,
      paymentState
        .paymentStatus,
      adminId,
      hotelId,
      bookingId,
    ]
  );


  /* ==========================================================
     EXTEND ACTIVE ROOM ASSIGNMENT
  ========================================================== */

  await connection.query(
    `
      UPDATE booking_room_history

      SET
        assignment_end = ?,
        changed_by_admin_id = ?

      WHERE hotel_id = ?
        AND room_history_id = ?
    `,
    [
      normalizedNewCheckOut,
      adminId,
      hotelId,
      activeHistory
        .room_history_id,
    ]
  );


  /* ==========================================================
     FINANCIAL ADJUSTMENT

     Adjustment = additional obligation.

     This is NOT a payment transaction.
  ========================================================== */

  const oldCheckoutDate =
    booking
      .check_out_sql
      .slice(
        0,
        10
      );


  const newCheckoutDate =
    normalizedNewCheckOut
      .slice(
        0,
        10
      );


  const description =
    (
      `Stay extended from ${oldCheckoutDate} ` +
      `to ${newCheckoutDate} ` +
      `(${extensionNights} additional ` +
      `night${extensionNights === 1 ? "" : "s"}).`
    ).slice(
      0,
      500
    );


  await connection.query(
    `
      INSERT INTO booking_adjustments (
        hotel_id,
        booking_id,
        adjustment_type,
        reason,
        amount,
        description,
        created_by_admin_id
      )

      VALUES (
        ?,
        ?,
        'stay_extension',
        ?,
        ?,
        ?,
        ?
      )
    `,
    [
      hotelId,
      bookingId,
      normalizedReason,
      extensionAmount,
      description,
      adminId,
    ]
  );


  /* ==========================================================
     RESULT
  ========================================================== */

  return {
    bookingId:
      booking.booking_id,

    bookingCode:
      booking.booking_code,

    customerId:
      booking.customer_id,

    roomId:
      booking.room_id,

    roomNumber:
      room.room_number,

    roomType:
      room.room_type,

    previousExpectedCheckOut:
      booking.check_out_sql,

    newExpectedCheckOut:
      normalizedNewCheckOut,

    extensionNights,

    ratePerNight,

    extensionAmount,

    previousTotalAmount,

    totalAmount:
      newTotalAmount,

    amountPaid:
      Math.max(
        0,
        paymentState.netPaid
      ),

    outstandingAmount:
      Number(
        Math.max(
          0,
          paymentState
            .outstandingAmount
        ).toFixed(2)
      ),

    paymentStatus:
      paymentState
        .paymentStatus,

    bookingStatus:
      "checked_in",

    roomStatus:
      "occupied",
  };
}


/* ============================================================
   CHECKOUT BOOKING

   checked_in
      ↓
   checked_out

   Effects:
   - actual_check_out = database NOW()
   - booking status = checked_out
   - room status = cleaning
   - active room history = completed

   MVP financial rule:
   - outstanding payment must be cleared before checkout
   - booking total is NOT recalculated during checkout
   - early-checkout pricing/refunds are handled separately later
============================================================ */

async function checkoutBooking(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
  }
) {
  /* ==========================================================
     LOCK BOOKING
  ========================================================== */

  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          customer_id,
          room_id,

          check_in,
          check_out,

          actual_check_in,
          actual_check_out,

          booking_status,
          payment_status,
          total_amount

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  if (!booking) {
    throwHttp(
      404,
      "BOOKING_NOT_FOUND",
      "The booking was not found in your hotel."
    );
  }


  /* ==========================================================
     LIFECYCLE VALIDATION
  ========================================================== */

  if (
    booking.booking_status ===
    "checked_out"
  ) {
    throwHttp(
      409,
      "BOOKING_ALREADY_CHECKED_OUT",
      "This guest has already been checked out."
    );
  }


  if (
    booking.booking_status !==
    "checked_in"
  ) {
    throwHttp(
      409,
      "CHECKOUT_NOT_ALLOWED",
      "Only a checked-in stay can be checked out."
    );
  }


  if (
    !booking.actual_check_in
  ) {
    throwHttp(
      409,
      "CHECK_IN_TIME_MISSING",
      "This booking is marked checked in but has no actual check-in time."
    );
  }


  if (
    booking.actual_check_out
  ) {
    throwHttp(
      409,
      "ACTUAL_CHECKOUT_ALREADY_RECORDED",
      "An actual checkout time is already recorded for this booking."
    );
  }


  /* ==========================================================
     LOCK ROOM
  ========================================================== */

  const [[room]] =
    await connection.query(
      `
        SELECT
          room_id,
          room_number,
          room_type,
          status

        FROM rooms

        WHERE hotel_id = ?
          AND room_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        booking.room_id,
      ]
    );


  if (!room) {
    throwHttp(
      409,
      "BOOKING_ROOM_NOT_FOUND",
      "The room assigned to this stay no longer exists."
    );
  }


  if (
    room.status !==
    "occupied"
  ) {
    throwHttp(
      409,
      "CHECKOUT_ROOM_STATE_INVALID",
      "The room assigned to this checked-in stay is not marked occupied."
    );
  }


  /* ==========================================================
     LOCK ACTIVE ROOM HISTORY
  ========================================================== */

  const [activeHistories] =
    await connection.query(
      `
        SELECT
          room_history_id,
          room_id,
          assignment_status,
          assignment_start,
          assignment_end,
          rate_per_night

        FROM booking_room_history

        WHERE hotel_id = ?
          AND booking_id = ?
          AND room_id = ?
          AND assignment_status =
            'active'

        ORDER BY
          room_history_id ASC

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
        booking.room_id,
      ]
    );


  if (
    activeHistories.length ===
    0
  ) {
    throwHttp(
      409,
      "ACTIVE_ROOM_ASSIGNMENT_MISSING",
      "The active room assignment for this stay could not be found."
    );
  }


  if (
    activeHistories.length >
    1
  ) {
    throwHttp(
      409,
      "MULTIPLE_ACTIVE_ROOM_ASSIGNMENTS",
      "Multiple active room assignments were found for this stay."
    );
  }


  const activeHistory =
    activeHistories[0];


  /* ==========================================================
     PAYMENT CHECK

     Checkout requires balance = 0.

     Example:
     Total = ₹10,000
     Paid  = ₹3,600
     Due   = ₹6,400

     Checkout is blocked until the remaining payment
     is recorded through Collect Payment.
  ========================================================== */

  const totalAmount =
    Number(
      booking.total_amount
    );


  if (
    !Number.isFinite(
      totalAmount
    ) ||
    totalAmount < 0
  ) {
    throwHttp(
      500,
      "INVALID_BOOKING_TOTAL",
      "The booking total is invalid."
    );
  }


  const paymentState =
    await getLockedPaymentState(
      connection,
      hotelId,
      bookingId,
      totalAmount
    );


  const outstandingAmount =
    Number(
      Math.max(
        0,
        paymentState
          .outstandingAmount
      ).toFixed(2)
    );


  if (
    outstandingAmount >
    0.009
  ) {
    throwHttp(
      409,
      "OUTSTANDING_PAYMENT_DUE",
      `₹${outstandingAmount.toFixed(2)} is still due. Collect the remaining payment before checkout.`
    );
  }


  /* ==========================================================
     UPDATE BOOKING
  ========================================================== */

  await connection.query(
    `
      UPDATE bookings

      SET
        booking_status =
          'checked_out',

        actual_check_out =
          NOW(),

        payment_status = ?,

        updated_by_admin_id = ?

      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [
      paymentState
        .paymentStatus,

      adminId,
      hotelId,
      bookingId,
    ]
  );


  /* ==========================================================
     ROOM → CLEANING

     Room must not become directly available after checkout.
     Housekeeping must complete cleaning first.
  ========================================================== */

  await connection.query(
    `
      UPDATE rooms

      SET
        status =
          'cleaning'

      WHERE hotel_id = ?
        AND room_id = ?
    `,
    [
      hotelId,
      booking.room_id,
    ]
  );


  /* ==========================================================
     COMPLETE ROOM HISTORY

     assignment_end remains the reservation's expected end.

     actual_check_out is stored separately in bookings.
  ========================================================== */

  await connection.query(
    `
      UPDATE booking_room_history

      SET
        assignment_status =
          'completed',

        changed_by_admin_id = ?

      WHERE hotel_id = ?
        AND room_history_id = ?
    `,
    [
      adminId,
      hotelId,
      activeHistory
        .room_history_id,
    ]
  );


  /* ==========================================================
     FINAL DATABASE STATE
  ========================================================== */

  const [[updated]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          customer_id,
          room_id,

          check_in,
          check_out,

          actual_check_in,
          actual_check_out,

          booking_status,
          payment_status,
          total_amount

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  return {
    bookingId:
      updated.booking_id,

    bookingCode:
      updated.booking_code,

    customerId:
      updated.customer_id,

    roomId:
      updated.room_id,

    roomNumber:
      room.room_number,

    roomType:
      room.room_type,

    expectedCheckOut:
      updated.check_out,

    actualCheckOut:
      updated.actual_check_out,

    totalAmount:
      Number(
        updated.total_amount
      ),

    amountPaid:
      Math.max(
        0,
        paymentState.netPaid
      ),

    outstandingAmount:
      0,

    paymentStatus:
      updated.payment_status,

    bookingStatus:
      updated.booking_status,

    roomStatus:
      "cleaning",
  };
}

module.exports = {
  checkInBooking,
  extendStayBooking,
  checkoutBooking,
};