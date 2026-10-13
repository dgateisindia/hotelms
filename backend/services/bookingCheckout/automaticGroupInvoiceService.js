const {
  checkoutBooking:
    checkoutBookingLifecycle,
} = require(
  "../bookingLifecycleService"
);


const {
  ensureReservationGroupInvoiceWithConnection,
} = require(
  "../billing/reservationGroupInvoiceService"
);


/* ============================================================
   G6 AUTOMATIC GROUP INVOICE ORCHESTRATOR
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

    const error =
      new Error(
        `${label} is invalid.`
      );


    error.status =
      400;

    error.code =
      `INVALID_${String(label)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")}`;


    throw error;
  }


  return id;
}


/* ============================================================
   GROUP-FIRST LOCK FOR INDIVIDUAL CHECKOUT

   reservation group
       -> booking
       -> canonical checkout
============================================================ */

async function lockReservationGroupForBookingWithConnection(
  connection,
  {
    hotelId,
    bookingId,
  }
) {

  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );


  const bId =
    positiveId(
      bookingId,
      "Booking ID"
    );


  /*
   * Discovery only.
   */
  const [[probe]] =
    await connection.query(
      `
        SELECT
          booking_id,
          reservation_group_id

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1
      `,
      [
        hId,
        bId,
      ]
    );


  /*
   * Canonical lifecycle owns BOOKING_NOT_FOUND.
   */
  if (!probe) {

    return {
      bookingFound:
        false,

      reservationGroupId:
        null,

      groupCode:
        null,

      groupLocked:
        false,
    };
  }


  const groupId =
    Number(
      probe.reservation_group_id ||
      0
    );


  /*
   * Ungrouped booking.
   */
  if (
    !Number.isSafeInteger(groupId) ||
    groupId <= 0
  ) {

    return {
      bookingFound:
        true,

      reservationGroupId:
        null,

      groupCode:
        null,

      groupLocked:
        false,
    };
  }


  /*
   * Group lock first.
   */
  const [[group]] =
    await connection.query(
      `
        SELECT
          reservation_group_id,
          group_code

        FROM reservation_groups

        WHERE hotel_id = ?
          AND reservation_group_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hId,
        groupId,
      ]
    );


  if (!group) {

    const error =
      new Error(
        "The booking reservation group could not be found."
      );


    error.status =
      409;

    error.code =
      "BOOKING_RESERVATION_GROUP_MISSING";


    throw error;
  }


  /*
   * Booking lock second.
   */
  const [[lockedBooking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          reservation_group_id

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hId,
        bId,
      ]
    );


  if (!lockedBooking) {

    const error =
      new Error(
        "The booking was not found in your hotel."
      );


    error.status =
      404;

    error.code =
      "BOOKING_NOT_FOUND";


    throw error;
  }


  if (
    Number(
      lockedBooking.reservation_group_id ||
      0
    ) !==
    groupId
  ) {

    const error =
      new Error(
        "The booking reservation group changed during checkout. Please retry."
      );


    error.status =
      409;

    error.code =
      "BOOKING_RESERVATION_GROUP_CHANGED";


    throw error;
  }


  return {
    bookingFound:
      true,

    reservationGroupId:
      groupId,

    groupCode:
      group.group_code ||
      null,

    groupLocked:
      true,
  };
}


/* ============================================================
   AUTOMATIC CONSOLIDATED INVOICE FINALIZER
============================================================ */

async function ensureAutomaticReservationGroupInvoiceWithConnection(
  connection,
  {
    hotelId,
    reservationGroupId,
  }
) {

  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );


  const gId =
    Number(
      reservationGroupId ||
      0
    );


  if (
    !Number.isSafeInteger(gId) ||
    gId <= 0
  ) {

    return {
      created:
        false,

      ready:
        false,

      reason:
        "booking_not_grouped",

      reservationGroupId:
        null,
    };
  }


  return ensureReservationGroupInvoiceWithConnection(
    connection,
    {
      hotelId:
        hId,

      reservationGroupId:
        gId,
    }
  );
}


/* ============================================================
   INDIVIDUAL CHECKOUT PRODUCTION ORCHESTRATOR
============================================================ */

async function checkoutBookingWithAutomaticGroupInvoice(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
  }
) {

  const groupContext =
    await lockReservationGroupForBookingWithConnection(
      connection,
      {
        hotelId,
        bookingId,
      }
    );


  const checkoutResult =
    await checkoutBookingLifecycle(
      connection,
      {
        hotelId,
        adminId,
        bookingId,
      }
    );


  const reservationGroupInvoice =
    await ensureAutomaticReservationGroupInvoiceWithConnection(
      connection,
      {
        hotelId,

        reservationGroupId:
          groupContext
            .reservationGroupId,
      }
    );


  return {
    ...checkoutResult,

    reservationGroupInvoice,
  };
}


module.exports = {
  lockReservationGroupForBookingWithConnection,
  ensureAutomaticReservationGroupInvoiceWithConnection,
  checkoutBookingWithAutomaticGroupInvoice,
};