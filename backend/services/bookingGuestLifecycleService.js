const {
  calculateNights,
} = require("./bookingValidation");

const {
  checkInBooking,
} = require("./bookingLifecycleService");

const {
  getLockedPaymentState,
} = require("./bookingPaymentService");

const {
  getBookingPolicySnapshotWithConnection,
} = require("./hotelSettingsService");

const {
  prepareSingleBookingGuest,
  calculateGuestCharges,
  loadPrimaryCustomerWithConnection,
  insertCheckedInGuestWithConnection,

  checkoutBookingGuestWithConnection,

  countGroupPrimaryGuestsWithConnection,
} = require("./bookingGuestService");


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


function optionalPositiveId(
  value
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const id =
    Number(value);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throwHttp(
      400,
      "INVALID_BOOKING_GUEST_ID",
      "The booking guest ID is invalid."
    );
  }

  return id;
}


function normalizeGuestRole(
  value
) {
  const role =
    String(
      value ||
      "accompanying"
    )
      .trim()
      .toLowerCase();

  if (
    ![
      "primary",
      "accompanying",
    ].includes(role)
  ) {
    throwHttp(
      400,
      "INVALID_GUEST_ROLE",
      "Guest role must be Primary or Accompanying."
    );
  }

  return role;
}


function money(
  value
) {
  const amount =
    Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throwHttp(
      500,
      "INVALID_GUEST_FINANCIAL_AMOUNT",
      "A guest financial amount is invalid."
    );
  }

  return Number(
    amount.toFixed(2)
  );
}


function validateRoomConfig(
  room
) {
  const capacity =
    Number(
      room?.capacity
    );

  const maxExtraBeds =
    Number(
      room?.max_extra_beds
    );

  if (
    !Number.isSafeInteger(
      capacity
    ) ||
    capacity < 1
  ) {
    throwHttp(
      500,
      "INVALID_ROOM_CAPACITY",
      `Room ${
        room?.room_number ||
        "—"
      } has an invalid guest capacity.`
    );
  }

  if (
    !Number.isSafeInteger(
      maxExtraBeds
    ) ||
    maxExtraBeds < 0 ||
    maxExtraBeds > capacity
  ) {
    throwHttp(
      500,
      "INVALID_ROOM_EXTRA_BED_LIMIT",
      `Room ${
        room?.room_number ||
        "—"
      } has an invalid extra-bed capacity configuration.`
    );
  }

  return {
    capacity,
    maxExtraBeds,
  };
}


async function loadBooking(
  connection,
  hotelId,
  bookingId
) {
  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          reservation_group_id,
          customer_id,
          room_id,
          stay_type,
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
          total_guests,
          booking_status,
          payment_status,
          total_amount,

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


  if (
    booking.booking_status ===
    "pending"
  ) {
    throwHttp(
      409,
      "BOOKING_NOT_CONFIRMED",
      "Confirm this reservation before checking in a guest."
    );
  }


  if (
    booking.booking_status ===
    "cancelled"
  ) {
    throwHttp(
      409,
      "CANCELLED_BOOKING_CANNOT_CHECK_IN",
      "A cancelled booking cannot accept guest check-in."
    );
  }


  if (
    booking.booking_status ===
      "checked_out" ||
    booking.actual_check_out
  ) {
    throwHttp(
      409,
      "BOOKING_ALREADY_CHECKED_OUT",
      "This booking has already been checked out."
    );
  }


  if (
    ![
      "confirmed",
      "checked_in",
    ].includes(
      booking.booking_status
    )
  ) {
    throwHttp(
      409,
      "GUEST_CHECK_IN_NOT_ALLOWED",
      "A guest cannot be checked in from the booking's current status."
    );
  }


  if (
    Number(
      booking.stay_window_closed
    ) === 1
  ) {
    throwHttp(
      409,
      "BOOKING_STAY_WINDOW_EXPIRED",
      "The expected checkout time has already passed. Extend or correct the stay before checking in another guest."
    );
  }


  if (
    booking.booking_status ===
      "checked_in" &&
    !booking.actual_check_in
  ) {
    throwHttp(
      409,
      "CHECK_IN_TIME_MISSING",
      "This booking is marked checked in but has no actual check-in time."
    );
  }


  return booking;
}

/* ============================================================
   LOAD BOOKING FOR INDIVIDUAL GUEST CHECKOUT

   Important:
   - Guest checkout is allowed only during an active room stay.
   - Expected checkout time may already have passed.
     Late checkout must NOT block an actual guest departure.
   - Room booking itself remains checked_in after one guest leaves.
============================================================ */

async function loadBookingForGuestCheckout(
  connection,
  hotelId,
  bookingId
) {
  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          reservation_group_id,
          customer_id,
          room_id,

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


  if (
    booking.booking_status ===
      "checked_out" ||
    booking.actual_check_out
  ) {
    throwHttp(
      409,
      "BOOKING_ALREADY_CHECKED_OUT",
      "This room stay has already been checked out."
    );
  }


  if (
    booking.booking_status ===
    "cancelled"
  ) {
    throwHttp(
      409,
      "CANCELLED_BOOKING_CANNOT_CHECK_OUT_GUEST",
      "A cancelled booking cannot process guest checkout."
    );
  }


  if (
    booking.booking_status !==
    "checked_in"
  ) {
    throwHttp(
      409,
      "GUEST_CHECKOUT_NOT_ALLOWED",
      "Individual guest checkout is available only for an active checked-in stay."
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


  return booking;
}

async function loadRoom(
  connection,
  hotelId,
  roomId
) {
  const [[room]] =
    await connection.query(
      `
        SELECT
          room_id,
          room_number,
          room_type,
          capacity,
          max_extra_beds,
          status

        FROM rooms

        WHERE hotel_id = ?
          AND room_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        roomId,
      ]
    );


  if (!room) {
    throwHttp(
      409,
      "BOOKING_ROOM_NOT_FOUND",
      "The room assigned to this stay no longer exists."
    );
  }


  return room;
}


async function loadGuestRows(
  connection,
  hotelId,
  bookingId
) {
  const [rows] =
    await connection.query(
      `
        SELECT
          booking_guest_id,
          customer_id,
          guest_role,
          guest_type,
          full_name,
          age,
          id_proof_type,
          id_proof_number,
          extra_bed_used,
          child_charge_amount,
          extra_bed_charge_amount,
          guest_status,
          actual_check_in,
          actual_check_out

        FROM booking_guests

        WHERE hotel_id = ?
          AND booking_id = ?

        ORDER BY
          booking_guest_id ASC

        FOR UPDATE
      `,
      [
        hotelId,
        bookingId,
      ]
    );


  return rows;
}


async function ensureActiveRoomState(
  connection,
  hotelId,
  bookingId,
  room
) {
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


  const [activeRows] =
    await connection.query(
      `
        SELECT
          room_history_id

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
        room.room_id,
      ]
    );


  if (
    activeRows.length !== 1
  ) {
    throwHttp(
      409,
      "ACTIVE_ROOM_ASSIGNMENT_INVALID",
      "The active room assignment for this checked-in stay is invalid."
    );
  }
}


async function checkInBookingGuest(
  connection,
  {
    hotelId,
    adminId,
    bookingId,

    bookingGuestId = null,

    guestRole =
      "accompanying",

    guest = null,
  }
) {
  const requestedGuestId =
    optionalPositiveId(
      bookingGuestId
    );


  const role =
    requestedGuestId === null
      ? normalizeGuestRole(
          guestRole
        )
      : null;


  const booking =
    await loadBooking(
      connection,
      hotelId,
      bookingId
    );


  const room =
    await loadRoom(
      connection,
      hotelId,
      booking.room_id
    );


  const {
    capacity,
    maxExtraBeds,
  } =
    validateRoomConfig(
      room
    );


  const guestRows =
    await loadGuestRows(
      connection,
      hotelId,
      bookingId
    );


  const activeGuestRows =
    guestRows.filter(
      (row) =>
        [
          "expected",
          "checked_in",
        ].includes(
          row.guest_status
        )
    );


  const activeExtraBeds =
    activeGuestRows.reduce(
      (
        total,
        row
      ) =>
        total +
        (
          Number(
            row.extra_bed_used
          ) === 1
            ? 1
            : 0
        ),
      0
    );


  if (
    activeGuestRows.length >
    capacity
  ) {
    throwHttp(
      409,
      "ROOM_GUEST_CAPACITY_ALREADY_EXCEEDED",
      `Room ${room.room_number} already exceeds its current guest capacity.`
    );
  }


  if (
    activeExtraBeds >
    maxExtraBeds
  ) {
    throwHttp(
      409,
      "ROOM_EXTRA_BED_LIMIT_ALREADY_EXCEEDED",
      `Room ${room.room_number} already exceeds its current extra-bed limit.`
    );
  }


  let selectedExistingGuest =
    null;

  let preparedNewGuest =
    null;


  /* ==========================================================
     EXISTING EXPECTED GUEST
  ========================================================== */

  if (
    requestedGuestId !== null
  ) {
    selectedExistingGuest =
      guestRows.find(
        (row) =>
          Number(
            row.booking_guest_id
          ) ===
          requestedGuestId
      );


    if (!selectedExistingGuest) {
      throwHttp(
        404,
        "BOOKING_GUEST_NOT_FOUND",
        "The selected guest was not found in this room reservation."
      );
    }


    if (
      selectedExistingGuest
        .guest_status ===
      "checked_in"
    ) {
      throwHttp(
        409,
        "GUEST_ALREADY_CHECKED_IN",
        "This guest is already checked in."
      );
    }


    if (
      selectedExistingGuest
        .guest_status ===
      "checked_out"
    ) {
      throwHttp(
        409,
        "GUEST_ALREADY_CHECKED_OUT",
        "This guest has already been checked out."
      );
    }


    if (
      selectedExistingGuest
        .guest_status ===
      "cancelled"
    ) {
      throwHttp(
        409,
        "CANCELLED_GUEST_CANNOT_CHECK_IN",
        "A cancelled guest allocation cannot be checked in."
      );
    }


    if (
      selectedExistingGuest
        .guest_status !==
      "expected"
    ) {
      throwHttp(
        409,
        "GUEST_CHECK_IN_NOT_ALLOWED",
        "This guest cannot be checked in from the current status."
      );
    }
  }


  /* ==========================================================
     NEW ARRIVING GUEST
  ========================================================== */

  else {
    if (
      activeGuestRows.length >=
      capacity
    ) {
      throwHttp(
        409,
        "ROOM_GUEST_CAPACITY_REACHED",
        `Room ${room.room_number} already has its maximum of ${capacity} active/expected guest(s).`
      );
    }


    const snapshot =
      await getBookingPolicySnapshotWithConnection(
        connection,
        {
          hotelId,
          bookingId,
        }
      );


    if (!snapshot) {
      throwHttp(
        409,
        "BOOKING_POLICY_SNAPSHOT_MISSING",
        "This legacy booking has no original hotel-policy snapshot, so automatic guest-policy validation and pricing are unavailable."
      );
    }


    const guestPolicy =
      snapshot
        ?.policySnapshot
        ?.guest_requirements;


    if (
      !guestPolicy ||
      typeof guestPolicy !==
      "object"
    ) {
      throwHttp(
        500,
        "GUEST_POLICY_MISSING",
        "The booking's Guest & Occupancy policy snapshot could not be resolved."
      );
    }


    let primaryCustomer =
      null;


    /* ========================================================
       PRIMARY GUEST
    ======================================================== */

    if (
      role ===
      "primary"
    ) {
      /*
       * Lock reservation group first.
       *
       * Two admins checking the same reservation group's
       * primary customer into different rooms at the same
       * time must not create two primary allocations.
       */
      const [[group]] =
        await connection.query(
          `
            SELECT
              reservation_group_id

            FROM reservation_groups

            WHERE hotel_id = ?
              AND reservation_group_id = ?

            FOR UPDATE
          `,
          [
            hotelId,
            booking
              .reservation_group_id,
          ]
        );


      if (!group) {
        throwHttp(
          409,
          "RESERVATION_GROUP_NOT_FOUND",
          "The reservation group could not be found for primary guest allocation."
        );
      }


      const primaryCount =
        await countGroupPrimaryGuestsWithConnection(
          connection,
          {
            hotelId,

            reservationGroupId:
              booking
                .reservation_group_id,
          }
        );


      if (
        primaryCount > 0
      ) {
        throwHttp(
          409,
          "PRIMARY_GUEST_ALREADY_ALLOCATED",
          "The reservation group's primary guest is already allocated to a room."
        );
      }


      const storedCustomer =
        await loadPrimaryCustomerWithConnection(
          connection,
          {
            hotelId,

            customerId:
              booking.customer_id,

            forUpdate:
              true,
          }
        );


      const source =
        guest &&
        typeof guest ===
          "object" &&
        !Array.isArray(
          guest
        )
          ? guest
          : {};


      /*
      * Name and phone come from the Reservation Contact.
      * ID may be captured at arrival if it was not available
      * when the room was originally reserved.
      */
      primaryCustomer = {
        fullName:
          storedCustomer.fullName,

        phone:
          storedCustomer.phone,

        idProofType:
          source.id_proof_type ??
          source.idProofType ??
          storedCustomer.idProofType,

        idProofNumber:
          source.id_proof_number ??
          source.idProofNumber ??
          storedCustomer.idProofNumber,
      };
    }


    const prepared =
      prepareSingleBookingGuest({
        guestRole:
          role,

        guest,

        primaryCustomer,

        guestPolicy,
      });


    const requestedExtraBeds =
      prepared.guest
        .extraBedUsed
        ? 1
        : 0;


    if (
      activeExtraBeds +
        requestedExtraBeds >
      maxExtraBeds
    ) {
      throwHttp(
        409,
        "ROOM_EXTRA_BED_LIMIT_EXCEEDED",
        `Room ${room.room_number} allows a maximum of ${maxExtraBeds} extra bed${maxExtraBeds === 1 ? "" : "s"}.`
      );
    }


    const stayType =
      String(
        booking.stay_type ||
        ""
      ).trim();


    const nights =
      stayType ===
        "overnight"
        ? calculateNights(
            booking.check_in_sql,
            booking.check_out_sql
          )
        : 0;


    if (
      stayType ===
        "overnight" &&
      nights < 1
    ) {
      throwHttp(
        500,
        "INVALID_BOOKING_STAY_DURATION",
        "The booking has an invalid overnight stay duration."
      );
    }


    const ratePerNight =
      Number(
        booking
          .booked_rate_per_night
      );


    if (
      stayType ===
        "overnight" &&
      (
        !Number.isFinite(
          ratePerNight
        ) ||
        ratePerNight < 0
      )
    ) {
      throwHttp(
        500,
        "INVALID_BOOKED_ROOM_RATE",
        "The booking has an invalid room rate."
      );
    }


    /*
     * Current Guest & Occupancy phase uses booked stay duration.
     *
     * Guest-specific partial-stay timing/proration belongs to
     * the later Different Room Timings flow.
     */
    const charges =
      calculateGuestCharges({
        roster: {
          guests: [
            prepared.guest,
          ],
        },

        stayType,

        nights,

        ratePerNight:
          Number.isFinite(
            ratePerNight
          )
            ? ratePerNight
            : 0,

        guestPolicy:
          prepared.policy,
      });


    if (
      !charges.guests?.[0]
    ) {
      throwHttp(
        500,
        "GUEST_CHARGE_CALCULATION_FAILED",
        "The arriving guest charge could not be calculated."
      );
    }


    preparedNewGuest = {
      snapshotId:
        snapshot.snapshotId,

      guest:
        charges.guests[0],

      addedGuestCharge:
        money(
          charges
            .totalGuestCharges ||
          0
        ),
    };
  }


  /* ==========================================================
     ROOM ACTIVATION

     First arriving guest:
       confirmed → checked_in

     Later arriving guest:
       booking already checked_in
  ========================================================== */

  const roomActivated =
    booking.booking_status ===
    "confirmed";


  if (roomActivated) {
    await checkInBooking(
      connection,
      {
        hotelId,
        adminId,
        bookingId,
      }
    );
  } else {
    await ensureActiveRoomState(
      connection,
      hotelId,
      bookingId,
      room
    );
  }


  /* ==========================================================
     CHECK IN EXISTING EXPECTED GUEST

     Already priced previously:
     no duplicate financial charge.
  ========================================================== */

  if (
    selectedExistingGuest
  ) {
    await connection.query(
      `
        UPDATE booking_guests

        SET
          guest_status =
            'checked_in',

          actual_check_in =
            NOW(),

          actual_check_out =
            NULL,

          checked_in_by_admin_id = ?,
          checked_out_by_admin_id = NULL,
          updated_by_admin_id = ?

        WHERE hotel_id = ?
          AND booking_id = ?
          AND booking_guest_id = ?
      `,
      [
        adminId,
        adminId,
        hotelId,
        bookingId,
        requestedGuestId,
      ]
    );


    const totalAmount =
      money(
        booking.total_amount
      );


    const paymentState =
      await getLockedPaymentState(
        connection,
        hotelId,
        bookingId,
        totalAmount
      );


    await connection.query(
      `
        UPDATE bookings

        SET
          total_guests = ?,
          payment_status = ?,
          updated_by_admin_id = ?

        WHERE hotel_id = ?
          AND booking_id = ?
      `,
      [
        activeGuestRows.length,

        paymentState
          .paymentStatus,

        adminId,
        hotelId,
        bookingId,
      ]
    );


    const [[updatedGuest]] =
      await connection.query(
        `
          SELECT
            booking_guest_id,
            guest_role,
            guest_type,
            full_name,
            child_charge_amount,
            extra_bed_charge_amount,
            guest_status,
            actual_check_in

          FROM booking_guests

          WHERE hotel_id = ?
            AND booking_id = ?
            AND booking_guest_id = ?

          LIMIT 1
        `,
        [
          hotelId,
          bookingId,
          requestedGuestId,
        ]
      );


    return {
      bookingId:
        Number(
          booking.booking_id
        ),

      bookingCode:
        booking.booking_code,

      roomId:
        Number(
          booking.room_id
        ),

      roomNumber:
        room.room_number,

      roomType:
        room.room_type,

      roomActivated,

      existingGuest:
        true,

      bookingGuestId:
        Number(
          updatedGuest
            .booking_guest_id
        ),

      guestRole:
        updatedGuest
          .guest_role,

      guestType:
        updatedGuest
          .guest_type,

      fullName:
        updatedGuest
          .full_name,

      guestStatus:
        updatedGuest
          .guest_status,

      actualGuestCheckIn:
        updatedGuest
          .actual_check_in,

      totalGuests:
        activeGuestRows.length,

      childChargeAmount:
        Number(
          updatedGuest
            .child_charge_amount ||
          0
        ),

      extraBedChargeAmount:
        Number(
          updatedGuest
            .extra_bed_charge_amount ||
          0
        ),

      addedGuestCharge:
        0,

      totalAmount,

      amountPaid:
        Math.max(
          0,
          paymentState.netPaid
        ),

      outstandingAmount:
        money(
          Math.max(
            0,
            paymentState
              .outstandingAmount
          )
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


  /* ==========================================================
     INSERT NEW ARRIVING GUEST
  ========================================================== */

  const previousTotalAmount =
    money(
      booking.total_amount
    );


  const newTotalAmount =
    money(
      previousTotalAmount +
      preparedNewGuest
        .addedGuestCharge
    );


  if (
    newTotalAmount >
    9999999999.99
  ) {
    throwHttp(
      400,
      "BOOKING_TOTAL_TOO_LARGE",
      "The booking total is too large after adding this guest."
    );
  }


  const paymentState =
    await getLockedPaymentState(
      connection,
      hotelId,
      bookingId,
      newTotalAmount
    );


  const inserted =
    await insertCheckedInGuestWithConnection(
      connection,
      {
        hotelId,
        bookingId,

        customerId:
          role ===
            "primary"
            ? booking
                .customer_id
            : null,

        adminId,

        guest:
          preparedNewGuest.guest,
      }
    );


  const totalGuests =
    activeGuestRows.length +
    1;


  await connection.query(
    `
      UPDATE bookings

      SET
        total_guests = ?,
        total_amount = ?,
        payment_status = ?,
        updated_by_admin_id = ?

      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [
      totalGuests,
      newTotalAmount,

      paymentState
        .paymentStatus,

      adminId,
      hotelId,
      bookingId,
    ]
  );


  const [[updatedGuest]] =
    await connection.query(
      `
        SELECT
          booking_guest_id,
          guest_role,
          guest_type,
          full_name,
          child_charge_amount,
          extra_bed_charge_amount,
          guest_status,
          actual_check_in

        FROM booking_guests

        WHERE hotel_id = ?
          AND booking_id = ?
          AND booking_guest_id = ?

        LIMIT 1
      `,
      [
        hotelId,
        bookingId,

        inserted
          .bookingGuestId,
      ]
    );


  return {
    bookingId:
      Number(
        booking.booking_id
      ),

    bookingCode:
      booking.booking_code,

    roomId:
      Number(
        booking.room_id
      ),

    roomNumber:
      room.room_number,

    roomType:
      room.room_type,

    roomActivated,

    existingGuest:
      false,

    bookingGuestId:
      Number(
        updatedGuest
          .booking_guest_id
      ),

    guestRole:
      updatedGuest
        .guest_role,

    guestType:
      updatedGuest
        .guest_type,

    fullName:
      updatedGuest
        .full_name,

    guestStatus:
      updatedGuest
        .guest_status,

    actualGuestCheckIn:
      updatedGuest
        .actual_check_in,

    totalGuests,

    childChargeAmount:
      Number(
        updatedGuest
          .child_charge_amount ||
        0
      ),

    extraBedChargeAmount:
      Number(
        updatedGuest
          .extra_bed_charge_amount ||
        0
      ),

    addedGuestCharge:
      preparedNewGuest
        .addedGuestCharge,

    previousTotalAmount,

    totalAmount:
      newTotalAmount,

    amountPaid:
      Math.max(
        0,
        paymentState.netPaid
      ),

    outstandingAmount:
      money(
        Math.max(
          0,
          paymentState
            .outstandingAmount
        )
      ),

    paymentStatus:
      paymentState
        .paymentStatus,

    bookingStatus:
      "checked_in",

    roomStatus:
      "occupied",

    policySnapshotId:
      preparedNewGuest
        .snapshotId,
  };
}

/* ============================================================
   CHECK OUT INDIVIDUAL BOOKING GUEST

   Transaction is owned by controller.

   Guest lifecycle:
   checked_in
      ↓
   checked_out

   Important:
   - Only selected guest is checked out.
   - Booking remains checked_in.
   - Room remains occupied.
   - Room history remains active.
   - Payment ledger is untouched.
   - Remaining guests may continue staying.

   Formal room checkout is a separate lifecycle operation.
============================================================ */

async function checkoutBookingGuest(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
    bookingGuestId,
  }
) {
  /* ==========================================================
     LOCK / VALIDATE ACTIVE BOOKING
  ========================================================== */

  const booking =
    await loadBookingForGuestCheckout(
      connection,
      hotelId,
      bookingId
    );


  /* ==========================================================
     LOCK / VALIDATE ROOM

     Individual guest departure must not accidentally operate
     against a room whose physical lifecycle has already drifted
     away from the active stay.
  ========================================================== */

  const room =
    await loadRoom(
      connection,
      hotelId,
      booking.room_id
    );


  await ensureActiveRoomState(
    connection,
    hotelId,
    bookingId,
    room
  );


  /* ==========================================================
     CHECK OUT SELECTED GUEST

     Persistence helper:
     - verifies guest belongs to this booking
     - requires guest_status = checked_in
     - records DB checkout timestamp
     - records admin attribution
     - does NOT close room stay
  ========================================================== */

  const guestResult =
    await checkoutBookingGuestWithConnection(
      connection,
      {
        hotelId,
        bookingId,
        bookingGuestId,
        adminId,
      }
    );


  /* ==========================================================
    SYNC ACTIVE GUEST COUNT

    total_guests represents currently active/expected occupancy.

    Individual guest checkout removes one checked-in guest from
    active occupancy while preserving any expected or still
    checked-in guests.
  ========================================================== */

  const activeGuestsRemaining =
    Number(
      guestResult
        .checkedInGuestsRemaining ||
      0
    ) +
    Number(
      guestResult
        .expectedGuestsRemaining ||
      0
    );


  await connection.query(
    `
      UPDATE bookings

      SET
        total_guests = ?,
        updated_by_admin_id = ?

      WHERE hotel_id = ?
        AND booking_id = ?
        AND booking_status =
          'checked_in'
    `,
    [
      activeGuestsRemaining,
      adminId,
      hotelId,
      bookingId,
    ]
  );


  /* ==========================================================
     RESULT

     Even when checkedInGuestsRemaining becomes 0, room booking
     is intentionally NOT auto-checked-out.

     Formal Room Checkout must still:
     - verify financial settlement
     - close remaining expected guest allocations
     - complete room history
     - move room to cleaning
  ========================================================== */

  return {
    bookingId:
      Number(
        booking.booking_id
      ),

    bookingCode:
      booking.booking_code,

    roomId:
      Number(
        booking.room_id
      ),

    roomNumber:
      room.room_number,

    roomType:
      room.room_type,

    bookingGuestId:
      guestResult
        .bookingGuestId,

    guestRole:
      guestResult
        .guestRole,

    guestType:
      guestResult
        .guestType,

    fullName:
      guestResult
        .fullName,

    guestStatus:
      guestResult
        .guestStatus,

    actualGuestCheckOut:
      guestResult
        .actualCheckOut,

    checkedInGuestsRemaining:
      guestResult
        .checkedInGuestsRemaining,

    expectedGuestsRemaining:
      guestResult
        .expectedGuestsRemaining,

    totalGuests:
      activeGuestsRemaining,

    bookingStatus:
      "checked_in",

    roomStatus:
      "occupied",
  };
}

module.exports = {
  checkInBookingGuest,
  checkoutBookingGuest,
};