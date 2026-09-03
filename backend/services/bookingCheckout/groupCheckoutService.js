const {
  checkoutBooking:
    checkoutBookingLifecycle,
} = require("../bookingLifecycleService");


/* ============================================================
   ERROR
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
   IDS
============================================================ */

function positiveId(
  value,
  label
) {
  const id =
    Number(value);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throwHttp(
      400,
      `INVALID_${String(label)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")}`,
      `${label} is invalid.`
    );
  }

  return id;
}


function normalizeBookingIds(
  bookingIds
) {
  if (
    bookingIds === undefined ||
    bookingIds === null
  ) {
    return null;
  }


  if (
    !Array.isArray(bookingIds)
  ) {
    throwHttp(
      400,
      "INVALID_GROUP_CHECKOUT_BOOKING_IDS",
      "booking_ids must be an array."
    );
  }


  if (
    bookingIds.length === 0
  ) {
    return null;
  }


  const normalized =
    bookingIds.map(
      (value) => {
        const id =
          Number(value);

        if (
          !Number.isSafeInteger(id) ||
          id <= 0
        ) {
          throwHttp(
            400,
            "INVALID_GROUP_CHECKOUT_BOOKING_ID",
            "One or more selected booking IDs are invalid."
          );
        }

        return id;
      }
    );


  return [
    ...new Set(normalized),
  ].sort(
    (a, b) =>
      a - b
  );
}


/* ============================================================
   GROUP CHECKOUT

   Transaction is owned by controller.

   Modes:

   bookingIds omitted / []
     → checkout every currently checked-in room in the group

   bookingIds provided
     → checkout exactly those selected room bookings

   Rules:
   - Group row locks first.
   - All child booking rows lock in booking_id ASC order.
   - Explicit selection never silently ignores invalid/ineligible rows.
   - Whole-group mode ignores historical/non-active child bookings.
   - Every room checkout reuses the canonical checkoutBooking lifecycle.
   - One child failure rolls back the ENTIRE group checkout transaction.
============================================================ */

async function checkoutReservationGroup(
  connection,
  {
    hotelId,
    adminId,
    groupId,
    bookingIds = null,
  }
) {
  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );


  const aId =
    positiveId(
      adminId,
      "Admin ID"
    );


  const gId =
    positiveId(
      groupId,
      "Reservation Group ID"
    );


  const selectedBookingIds =
    normalizeBookingIds(
      bookingIds
    );


  /* ==========================================================
     LOCK RESERVATION GROUP
  ========================================================== */

  const [[group]] =
    await connection.query(
      `
        SELECT
          reservation_group_id,
          group_code,
          customer_id

        FROM reservation_groups

        WHERE hotel_id = ?
          AND reservation_group_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hId,
        gId,
      ]
    );


  if (!group) {
    throwHttp(
      404,
      "RESERVATION_GROUP_NOT_FOUND",
      "The reservation group was not found in your hotel."
    );
  }


  /* ==========================================================
     LOCK ALL CHILD BOOKINGS

     Deterministic ordering prevents concurrent group actions
     from locking children in different orders.
  ========================================================== */

  const [groupBookings] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          room_id,
          booking_status,
          actual_check_in,
          actual_check_out

        FROM bookings

        WHERE hotel_id = ?
          AND reservation_group_id = ?

        ORDER BY
          booking_id ASC

        FOR UPDATE
      `,
      [
        hId,
        gId,
      ]
    );


  if (
    groupBookings.length ===
    0
  ) {
    throwHttp(
      409,
      "RESERVATION_GROUP_EMPTY",
      "This reservation group does not contain any room bookings."
    );
  }


  const bookingsById =
    new Map(
      groupBookings.map(
        (booking) => [
          Number(
            booking.booking_id
          ),
          booking,
        ]
      )
    );


  /* ==========================================================
     EXPLICIT SELECTION VALIDATION
  ========================================================== */

  if (
    selectedBookingIds
  ) {
    const notInGroup =
      selectedBookingIds.find(
        (bookingId) =>
          !bookingsById.has(
            bookingId
          )
      );


    if (
      notInGroup
    ) {
      throwHttp(
        400,
        "GROUP_CHECKOUT_BOOKING_NOT_IN_GROUP",
        "One or more selected bookings do not belong to this reservation group."
      );
    }
  }


  const candidateBookings =
    selectedBookingIds
      ? selectedBookingIds.map(
          (bookingId) =>
            bookingsById.get(
              bookingId
            )
        )
      : groupBookings.filter(
          (booking) =>
            String(
              booking.booking_status ||
              ""
            )
              .trim()
              .toLowerCase() ===
            "checked_in"
        );


  /*
   * Explicit selection:
   * every selected booking must currently be an active stay.
   *
   * Whole-group:
   * confirmed / cancelled / checked_out / no_show etc.
   * are simply not part of the checkout operation.
   */
  if (
    selectedBookingIds
  ) {
    const invalidStatusBooking =
      candidateBookings.find(
        (booking) =>
          String(
            booking.booking_status ||
            ""
          )
            .trim()
            .toLowerCase() !==
          "checked_in"
      );


    if (
      invalidStatusBooking
    ) {
      throwHttp(
        409,
        "GROUP_CHECKOUT_BOOKING_NOT_CHECKED_IN",
        `${
          invalidStatusBooking.booking_code ||
          "A selected room booking"
        } is not currently checked in.`
      );
    }


    const invalidLifecycleBooking =
      candidateBookings.find(
        (booking) =>
          !booking.actual_check_in ||
          booking.actual_check_out
      );


    if (
      invalidLifecycleBooking
    ) {
      throwHttp(
        409,
        "GROUP_CHECKOUT_BOOKING_STATE_INVALID",
        `${
          invalidLifecycleBooking.booking_code ||
          "A selected room booking"
        } has an inconsistent check-in/check-out lifecycle state.`
      );
    }
  }


  if (
    candidateBookings.length ===
    0
  ) {
    throwHttp(
      409,
      "NO_CHECKED_IN_ROOMS",
      "There are no currently checked-in room bookings available for group checkout."
    );
  }


  /*
   * Explicit booking IDs are already sorted.
   * Whole-group rows came from ORDER BY booking_id ASC.
   */
  const orderedBookings =
    [...candidateBookings].sort(
      (a, b) =>
        Number(
          a.booking_id
        ) -
        Number(
          b.booking_id
        )
    );


  /* ==========================================================
     CANONICAL ROOM CHECKOUT

     Do NOT duplicate:
     - payment validation
     - guest closure
     - booking checkout timestamp
     - room → cleaning
     - room history completion

     checkoutBookingLifecycle remains the single source of truth.

     Controller transaction guarantees:
     if room 3 fails after rooms 1 and 2 were processed,
     all room 1/2 changes are rolled back too.
  ========================================================== */

  const results = [];


  for (
    const booking
    of orderedBookings
  ) {
    const result =
      await checkoutBookingLifecycle(
        connection,
        {
          hotelId:
            hId,

          adminId:
            aId,

          bookingId:
            Number(
              booking.booking_id
            ),
        }
      );


    results.push(
      result
    );
  }


  /* ==========================================================
     RESULT
  ========================================================== */

  return {
    reservationGroupId:
      Number(
        group
          .reservation_group_id
      ),

    groupCode:
      group.group_code,

    customerId:
      Number(
        group.customer_id
      ),

    scope:
      selectedBookingIds
        ? "selected"
        : "all_checked_in",

    requestedBookingIds:
      selectedBookingIds ||
      null,

    checkedOutBookingCount:
      results.length,

    bookings:
      results,
  };
}


module.exports = {
  checkoutReservationGroup,
};