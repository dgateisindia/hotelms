const db =
  require("../../config/db").promisePool;

const {
  RESERVATION_EDIT_STATUSES,
  parsePositiveInteger,
  normalizeBookingSource,
  validateCustomer,
  validateBookingItems,
  validateInitialPayment,
} = require(
  "../../services/bookingValidation"
);

const {
  priceBookingItemsWithConnection,
} = require(
  "../../services/bookingPricingService"
);

const {
  saveBookingPolicySnapshotWithConnection,
} = require(
  "../../services/hotelSettingsService"
);

const {
  lockRooms,
  ensureNoOverlap,
  createInitialRoomHistory,
} = require(
  "../../services/bookingRoomService"
);

const {
  applyInitialPayment,
} = require(
  "../../services/bookingPaymentService"
);

const {
  findOrCreateCustomer,
} = require(
  "../../services/bookingCustomerService"
);

const {
  loadPrimaryCustomerWithConnection,
  insertBookingGuestsWithConnection,
  countGroupPrimaryGuestsWithConnection,
} = require(
  "../../services/bookingGuestService"
);

const {
  lockSourceRequest,
  approveSourceRequest,
} = require(
  "../../services/bookingSourceRequestService"
);

const {
  reconcileOverdueBookingsWithConnection,
} = require(
  "../../services/bookingStatusService"
);
function sendError(
  res,
  status,
  code,
  message
) {
  return res
    .status(status)
    .json({
      success: false,
      code,
      message,
    });
}


function logBookingError(
  operation,
  error
) {
  console.error(
    `[BOOKING:${operation}] ${
      error?.code ||
      "UNKNOWN_ERROR"
    }: ${
      error?.message ||
      "Unknown booking error"
    }`
  );
}


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

function usesDetailedGuestRoster(
  items
) {
  return (
    Array.isArray(items) &&
    items.some(
      (item) =>
        item
          ?.guestRosterProvided ===
        true
    )
  );
}

function getAdminContext(req) {
  const hotelId =
    Number(
      req.dbUser?.hotelId
    );

  const adminId =
    Number(
      req.dbUser?.adminId
    );


  if (
    !Number.isSafeInteger(
      hotelId
    ) ||
    hotelId <= 0 ||
    !Number.isSafeInteger(
      adminId
    ) ||
    adminId <= 0
  ) {
    return null;
  }


  return {
    hotelId,
    adminId,
  };
}

/* ============================================================
   PAYMENT HELPERS
============================================================ */

/* ============================================================
   CREATE RESERVATION GROUP

   Internal system relationship.

   Rules:
   - Every new reservation transaction gets one group.
   - One-room reservation still gets one group.
   - All rooms created in the same transaction share the group.
   - Admin never manually selects or creates the group.
============================================================ */

async function createReservationGroup(
  connection,
  {
    hotelId,
    customerId,
    adminId,
  }
) {
  const temporaryCode =
    (
      `TMP-RG-${hotelId}-${adminId}-` +
      `${Date.now()}-` +
      `${Math.random()
        .toString(36)
        .slice(2, 8)}`
    ).slice(
      0,
      60
    );


  const [result] =
    await connection.query(
      `
        INSERT INTO reservation_groups (
          hotel_id,
          customer_id,
          group_code,
          created_by_admin_id
        )

        VALUES (
          ?, ?, ?, ?
        )
      `,
      [
        hotelId,
        customerId,
        temporaryCode,
        adminId,
      ]
    );


  const reservationGroupId =
    Number(
      result.insertId
    );


  if (
    !Number.isSafeInteger(
      reservationGroupId
    ) ||
    reservationGroupId <= 0
  ) {
    throwHttp(
      500,
      "RESERVATION_GROUP_CREATE_FAILED",
      "The reservation group could not be created."
    );
  }


  const groupCode =
    `RG-${
      1000 +
      reservationGroupId
    }`;


  await connection.query(
    `
      UPDATE reservation_groups

      SET group_code = ?

      WHERE hotel_id = ?
        AND reservation_group_id = ?
    `,
    [
      groupCode,
      hotelId,
      reservationGroupId,
    ]
  );


  return {
    reservationGroupId,
    groupCode,
  };
}

/* ============================================================
   INSERT BOOKING

   Room price is authoritative.

   Client total_amount is ignored.
============================================================ */

async function insertBooking(
  connection,
  values
) {
  const {
    hotelId,
    adminId,
    customerId,
    sourceRequestId,
    reservationGroupId,
    bookingSource,
    item,
    room,
    pricing,
  } = values;

  if (
    !Number.isSafeInteger(
      Number(
        reservationGroupId
      )
    ) ||
    Number(
      reservationGroupId
    ) <= 0
  ) {
    throwHttp(
      500,
      "RESERVATION_GROUP_MISSING",
      "A valid reservation group is required before creating the booking."
    );
  }

  if (
    !pricing ||
    Number(
      pricing.roomId
    ) !==
      Number(
        item.roomId
      )
  ) {
    throwHttp(
      500,
      "BOOKING_PRICING_MISSING",
      "The booking price could not be resolved."
    );
  }

  const stayType =
    pricing.stayType;

  const nights =
    Number(
      pricing.nights ||
      0
    );

  const ratePerNight =
    Number(
      pricing.ratePerNight
    );

  const totalAmount =
    Number(
      pricing.totalAmount
    );

  const authoritativeTotalGuests =
    Number(
      pricing.totalGuests ??
      item.totalGuests
    );

  if (
    ![
      "overnight",
      "day_use",
    ].includes(
      stayType
    ) ||
    !Number.isFinite(
      ratePerNight
    ) ||
    ratePerNight < 0 ||
    !Number.isFinite(
      totalAmount
    ) ||
    totalAmount < 0
  ) {
    throwHttp(
      500,
      "INVALID_BOOKING_PRICE",
      "The calculated booking price is invalid."
    );
  }


  const temporaryCode =
    (
      `TMP-${hotelId}-${adminId}-` +
      `${Date.now()}-` +
      `${Math.random()
        .toString(36)
        .slice(2, 8)}`
    ).slice(
      0,
      60
    );


  const [result] =
    await connection.query(
      `
        INSERT INTO bookings (
          reservation_group_id,
          source_request_id,
          booking_source,
          stay_type,
          hotel_id,
          customer_id,
          room_id,
          booked_rate_per_night,
          created_by_admin_id,
          updated_by_admin_id,
          booking_code,
          check_in,
          check_out,
          actual_check_in,
          actual_check_out,
          total_guests,
          guest_roster_captured,
          booking_status,
          payment_status,
          total_amount,
          special_request
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, NULL, ?, ?, ?,
          NULL, NULL,
          ?, ?, ?,
          'unpaid',
          ?,
          ?
        )
      `,
      [
        reservationGroupId,
        sourceRequestId,
        bookingSource,
        stayType,
        hotelId,
        customerId,
        item.roomId,
        ratePerNight,
        adminId,
        temporaryCode,
        item.checkIn,
        item.checkOut,
        authoritativeTotalGuests,

        pricing
          .guestRosterProvided ===
        true
          ? 1
          : 0,

        item.bookingStatus,
        totalAmount,
        item.specialRequest,
      ]
    );


  const bookingId =
    Number(
      result.insertId
    );


  const bookingCode =
    `BK-${
      1000 +
      bookingId
    }`;


  await connection.query(
    `
      UPDATE bookings

      SET booking_code = ?

      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [
      bookingCode,
      hotelId,
      bookingId,
    ]
  );


  await createInitialRoomHistory(
    connection,
    {
      hotelId,
      bookingId,

      roomId:
        item.roomId,

      checkIn:
        item.checkIn,

      checkOut:
        item.checkOut,

      ratePerNight,
      adminId,
    }
  );


  return {
    bookingId,
    bookingCode,

    roomId:
      item.roomId,

    roomNumber:
      room.room_number,

    roomType:
      room.room_type,

    stayType,

    pricingMode:
      pricing.pricingMode,

    nights,

    durationMinutes:
      pricing.durationMinutes,

    ratePerNight,

    roomCharge:
      pricing.roomCharge,

    childChargeAmount:
      Number(
        pricing
          .childChargeAmount ||
        0
      ),

    extraBedChargeAmount:
      Number(
        pricing
          .extraBedChargeAmount ||
        0
      ),

    guestChargeAmount:
      Number(
        pricing
          .guestChargeAmount ||
        0
      ),

    totalGuests:
      authoritativeTotalGuests,

    maxExtraBeds:
      Number(
        pricing.maxExtraBeds ??
        room?.max_extra_beds ??
        0
      ),

    extraBedsUsed:
      pricing.extraBedsUsed ??
      null,

    guestRosterProvided:
      pricing
        .guestRosterProvided ===
      true,

    totalAmount,

    paymentStatus:
      "unpaid",
      
  };
}

/* ============================================================
   SHARED CREATE BOOKING ENGINE
============================================================ */

async function createBookingForHotel({
  connection,
  hotelId,
  adminId,
  payload,
}) {
  const customerValidation =
    validateCustomer(
      payload
    );


  if (
    customerValidation.error
  ) {
    throwHttp(
      400,
      "INVALID_CUSTOMER_DETAILS",
      customerValidation.error
    );
  }


  const bookingValidation =
    validateBookingItems(
      payload,
      {
        allowedStatuses:
          RESERVATION_EDIT_STATUSES,
      }
    );


  if (
    bookingValidation.error
  ) {
    throwHttp(
      400,
      "INVALID_BOOKING_DETAILS",
      bookingValidation.error
    );
  }


  const paymentValidation =
    validateInitialPayment(
      payload
    );


  if (
    paymentValidation.error
  ) {
    throwHttp(
      400,
      "INVALID_INITIAL_PAYMENT",
      paymentValidation.error
    );
  }


  const items =
    bookingValidation.value;


  let sourceRequestId =
    null;


  if (
    payload
      ?.source_request_id !==
      undefined &&
    payload
      ?.source_request_id !==
      null &&
    String(
      payload
        .source_request_id
    ).trim() !==
      ""
  ) {
    sourceRequestId =
      parsePositiveInteger(
        payload
          .source_request_id
      );


    if (
      !sourceRequestId
    ) {
      throwHttp(
        400,
        "INVALID_SOURCE_REQUEST_ID",
        "source_request_id must be a valid positive integer."
      );
    }
  }


  if (
    sourceRequestId &&
    items.length !== 1
  ) {
    throwHttp(
      400,
      "SOURCE_REQUEST_SINGLE_BOOKING_REQUIRED",
      "A QR customer request can create only one booking."
    );
  }


  const bookingSource =
    normalizeBookingSource(
      payload
        ?.booking_source,
      sourceRequestId
    );


  if (
    !bookingSource
  ) {
    throwHttp(
      400,
      "INVALID_BOOKING_SOURCE",
      "Booking source is invalid."
    );
  }


  const sourceRequest =
    await lockSourceRequest(
      connection,
      hotelId,
      sourceRequestId
    );


  const roomMap =
    await lockRooms(
      connection,
      hotelId,
      items
    );


  if (
    sourceRequest
      ?.assigned_room_id &&
    Number(
      sourceRequest
        .assigned_room_id
    ) !==
      items[0].roomId
  ) {
    throwHttp(
      409,
      "SOURCE_REQUEST_ROOM_MISMATCH",
      "The selected room does not match the room already assigned to this request."
    );
  }


  /*
   * Room rows are locked before conflict check.
   */
  await ensureNoOverlap(
    connection,
    hotelId,
    items
  );

  /*
  * Customer is resolved inside the same booking transaction.
  *
  * When detailed occupancy is supplied, Guest & Occupancy
  * pricing uses the authoritative customer record for the
  * Primary Guest.
  */
  const customerResult =
    await findOrCreateCustomer(
      connection,
      hotelId,
      customerValidation.value
    );


  let guestContext =
    null;


  if (
    usesDetailedGuestRoster(
      items
    )
  ) {
    const primaryCustomer =
      await loadPrimaryCustomerWithConnection(
        connection,
        {
          hotelId,

          customerId:
            customerResult
              .customerId,

          forUpdate:
            true,
        }
      );


    /*
    * Reservation Contact does not have to stay in the hotel.
    *
    * A new reservation may allocate the contact as a staying
    * Primary Guest to zero or one selected room.
    */
    guestContext = {
      primaryMode:
        "zero_or_one",

      primaryCustomer,
    };
  }


  const pricingResult =
    await priceBookingItemsWithConnection(
      connection,
      {
        hotelId,
        items,
        roomMap,
        guestContext,
      }
    );


  const reservationGroup =
    await createReservationGroup(
      connection,
      {
        hotelId,

        customerId:
          customerResult
            .customerId,

        adminId,
      }
    );


  const bookings = [];


  for (
    let index = 0;
    index <
    items.length;
    index += 1
  ) {
    const item =
      items[index];


    const room =
      roomMap.get(
        item.roomId
      );

    const pricing =
      pricingResult
        .prices[index];

    if (!pricing) {
      throwHttp(
        500,
        "BOOKING_PRICING_MISSING",
        "The calculated booking price is missing."
      );
    }

    const created =
      await insertBooking(
        connection,
        {
          hotelId,
          adminId,

          customerId:
            customerResult
              .customerId,

          reservationGroupId:
            reservationGroup
              .reservationGroupId,

          sourceRequestId:
            index === 0
              ? sourceRequestId
              : null,

          bookingSource,
          item,
          room,
          pricing,
        }
      );

    let guestSaveResult =
      null;


    if (
      pricing
        .guestRosterProvided ===
        true
    ) {
      const rosterGuests =
        pricing
          ?.guestRoster
          ?.guests;


      if (
        !Array.isArray(
          rosterGuests
        )
      ) {
        throwHttp(
          500,
          "BOOKING_GUEST_ROSTER_MISSING",
          "The validated guest roster is invalid."
        );
      }


      guestSaveResult =
        await insertBookingGuestsWithConnection(
          connection,
          {
            hotelId,

            bookingId:
              created.bookingId,

            customerId:
              customerResult
                .customerId,

            adminId,

            guests:
              rosterGuests,
          }
        );
    }

    const policySnapshot =
      await saveBookingPolicySnapshotWithConnection(
        connection,
        {
          hotelId,

          bookingId:
            created.bookingId,
        }
      );

    bookings.push({
      ...created,

      policySnapshotId:
        policySnapshot
          .snapshotId,

      guestRosterSaved:
        Number(
          guestSaveResult
            ?.guestCount ||
          0
        ) > 0,

      bookingGuestIds:
        guestSaveResult
          ?.bookingGuestIds ||
        [],

      checkIn:
        item.checkIn,

      checkOut:
        item.checkOut,

      bookingStatus:
        item.bookingStatus,
    });
  }


  const paymentSummary =
    await applyInitialPayment(
      connection,
      {
        hotelId,
        adminId,
        bookings,

        payment:
          paymentValidation
            .value,
      }
    );


  /*
   * QR approval remains inside same transaction.
   */
  await approveSourceRequest(
    connection,
    {
      hotelId,
      sourceRequestId,

      roomId:
        items[0].roomId,

      adminId,
    }
  );


  return {
    reservationGroupId:
      reservationGroup
        .reservationGroupId,

    reservationGroupCode:
      reservationGroup
        .groupCode,
        
    customerId:
      customerResult
        .customerId,

    existingCustomer:
      customerResult
        .existing,

    bookingSource,
    bookings,
    paymentSummary,
  };
}


/* ============================================================
   ADD BOOKINGS TO EXISTING RESERVATION GROUP

   Used by:
   Add Another Room

   Rules:
   - Existing hotel-scoped reservation group is reused.
   - Existing customer is reused.
   - No new reservation group is created.
   - New room(s) use current room rate + current hotel policy.
   - Every new child booking gets its own policy snapshot.
   - Existing payments are never changed.
   - Optional payment applies only to newly-added room(s).
============================================================ */

async function createBookingsInExistingReservationGroup({
  connection,
  hotelId,
  adminId,
  reservationGroupId,
  payload,
}) {
  /* ==========================================================
     VALIDATE NEW ROOM BOOKINGS
  ========================================================== */

  const bookingValidation =
    validateBookingItems(
      payload,
      {
        allowedStatuses:
          RESERVATION_EDIT_STATUSES,
      }
    );


  if (
    bookingValidation.error
  ) {
    throwHttp(
      400,
      "INVALID_BOOKING_DETAILS",
      bookingValidation.error
    );
  }


  const paymentValidation =
    validateInitialPayment(
      payload
    );


  if (
    paymentValidation.error
  ) {
    throwHttp(
      400,
      "INVALID_INITIAL_PAYMENT",
      paymentValidation.error
    );
  }


  const items =
    bookingValidation.value;


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
        hotelId,
        reservationGroupId,
      ]
    );


  if (!group) {
    throwHttp(
      404,
      "RESERVATION_GROUP_NOT_FOUND",
      "The reservation group was not found in your hotel."
    );
  }

  /*
  * Reservation group row is already locked.
  *
  * Reconcile only this group's overdue child bookings before
  * deciding whether the group is still operationally open.
  *
  * Lock order remains:
  * reservation_group -> booking rows
  */
  await reconcileOverdueBookingsWithConnection(
    connection,
    {
      hotelId,
      reservationGroupId,
    }
  );


  /* ==========================================================
     LOCK EXISTING CHILD BOOKINGS
  ========================================================== */

  const [existingBookings] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_source,
          stay_type,
          booking_status

        FROM bookings

        WHERE hotel_id = ?
          AND reservation_group_id = ?

        ORDER BY
          booking_id ASC

        FOR UPDATE
      `,
      [
        hotelId,
        reservationGroupId,
      ]
    );


  if (
    existingBookings.length ===
    0
  ) {
    throwHttp(
      409,
      "RESERVATION_GROUP_EMPTY",
      "This reservation group does not contain any booking records."
    );
  }


  /* ==========================================================
     GROUP MUST STILL BE OPEN

     Add Room is allowed while at least one child is:
     pending / confirmed / checked_in.

     Fully checked-out / cancelled groups are historical.
  ========================================================== */

  const groupIsOpen =
    existingBookings.some(
      (booking) =>
        [
          "pending",
          "confirmed",
          "checked_in",
        ].includes(
          booking.booking_status
        )
    );


  if (!groupIsOpen) {
    throwHttp(
      409,
      "RESERVATION_GROUP_CLOSED",
      "This reservation group is closed and no longer accepts new room bookings."
    );
  }


  /* ==========================================================
     PRESERVE GROUP STAY PRODUCT

     Different room dates/times are allowed.

     But:
     Overnight group → Overnight additions
     Day Use group   → Day Use additions
  ========================================================== */

  const groupStayTypes =
    new Set(
      existingBookings
        .filter(
          (booking) =>
            booking.booking_status !==
            "cancelled"
        )
        .map(
          (booking) =>
            booking.stay_type
        )
    );


  if (
    groupStayTypes.size !==
    1
  ) {
    throwHttp(
      409,
      "RESERVATION_GROUP_STAY_TYPE_INCONSISTENT",
      "This reservation group contains inconsistent stay types and requires review before another room can be added."
    );
  }


  const groupStayType =
    [
      ...groupStayTypes,
    ][0];


  if (
    items.some(
      (item) =>
        item.stayType !==
        groupStayType
    )
  ) {
    throwHttp(
      409,
      "RESERVATION_GROUP_STAY_TYPE_MISMATCH",
      groupStayType ===
        "day_use"
        ? "Only Day Use / Short Stay rooms can be added to this reservation group."
        : "Only Overnight Stay rooms can be added to this reservation group."
    );
  }


  /* ==========================================================
     BOOKING SOURCE

     Add Room is an Admin/front-desk action.
  ========================================================== */

  const bookingSource =
    normalizeBookingSource(
      payload?.booking_source,
      null
    );


  if (!bookingSource) {
    throwHttp(
      400,
      "INVALID_BOOKING_SOURCE",
      "Booking source is invalid."
    );
  }


  /* ==========================================================
     LOCK ROOMS + AVAILABILITY
  ========================================================== */

  const roomMap =
    await lockRooms(
      connection,
      hotelId,
      items
    );


  await ensureNoOverlap(
    connection,
    hotelId,
    items
  );

  let guestContext =
    null;


  if (
    usesDetailedGuestRoster(
      items
    )
  ) {
    /*
    * reservation_groups row is already FOR UPDATE above,
    * therefore concurrent Add Room requests for the same
    * group are serialized before Primary Guest allocation.
    */
    const primaryGuestCount =
      await countGroupPrimaryGuestsWithConnection(
        connection,
        {
          hotelId,
          reservationGroupId,
        }
      );


    if (
      primaryGuestCount > 1
    ) {
      throwHttp(
        409,
        "RESERVATION_GROUP_PRIMARY_GUEST_INVALID",
        "This reservation group contains multiple Primary Guest allocations and requires review."
      );
    }


    const primaryCustomer =
      await loadPrimaryCustomerWithConnection(
        connection,
        {
          hotelId,

          customerId:
            Number(
              group.customer_id
            ),

          forUpdate:
            true,
        }
      );


    guestContext = {
      /*
      * Existing modern group:
      * Primary already belongs to another room → none.
      *
      * Legacy group:
      * No historical occupant records exist → zero_or_one,
      * because we must not invent where the Primary Guest
      * historically stayed.
      */
      primaryMode:
        primaryGuestCount === 1
          ? "none"
          : "zero_or_one",

      primaryCustomer,
    };
  }

  /* ==========================================================
     CURRENT AUTHORITATIVE PRICING

     A newly-added room is booked NOW, therefore it uses the
     hotel's current policy and current room rate.
  ========================================================== */

  const pricingResult =
    await priceBookingItemsWithConnection(
      connection,
      {
        hotelId,
        items,
        roomMap,
        guestContext,
      }
    );


  const bookings = [];


  /* ==========================================================
     CREATE CHILD BOOKING(S)
  ========================================================== */

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const item =
      items[index];


    const room =
      roomMap.get(
        item.roomId
      );


    const pricing =
      pricingResult
        .prices[index];


    if (!pricing) {
      throwHttp(
        500,
        "BOOKING_PRICING_MISSING",
        "The calculated booking price is missing."
      );
    }


    const created =
      await insertBooking(
        connection,
        {
          hotelId,
          adminId,

          customerId:
            Number(
              group.customer_id
            ),

          reservationGroupId,

          sourceRequestId:
            null,

          bookingSource,
          item,
          room,
          pricing,
        }
      );

    let guestSaveResult =
      null;


    if (
      pricing
        .guestRosterProvided ===
        true
    ) {
      const rosterGuests =
        pricing
          ?.guestRoster
          ?.guests;


      if (
        !Array.isArray(
          rosterGuests
        )
      ) {
        throwHttp(
          500,
          "BOOKING_GUEST_ROSTER_MISSING",
          "The validated guest roster is invalid."
        );
      }


      guestSaveResult =
        await insertBookingGuestsWithConnection(
          connection,
          {
            hotelId,

            bookingId:
              created.bookingId,

            customerId:
              Number(
                group.customer_id
              ),

            adminId,

            guests:
              rosterGuests,
          }
        );
    }

    const policySnapshot =
      await saveBookingPolicySnapshotWithConnection(
        connection,
        {
          hotelId,

          bookingId:
            created.bookingId,
        }
      );


    bookings.push({
      ...created,

      policySnapshotId:
        policySnapshot
          .snapshotId,

      guestRosterSaved:
        Number(
          guestSaveResult
            ?.guestCount ||
          0
        ) > 0,

      bookingGuestIds:
        guestSaveResult
          ?.bookingGuestIds ||
        [],

      checkIn:
        item.checkIn,

      checkOut:
        item.checkOut,

      bookingStatus:
        item.bookingStatus,
    });
  }


  /* ==========================================================
     OPTIONAL PAYMENT

     Payment allocation applies ONLY to newly-created rooms.
     Existing group payment ledger is untouched.
  ========================================================== */

  const paymentSummary =
    await applyInitialPayment(
      connection,
      {
        hotelId,
        adminId,
        bookings,

        payment:
          paymentValidation
            .value,
      }
    );


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

    bookings,

    paymentSummary,
  };
}

/* ============================================================
   GET ALL BOOKINGS
============================================================ */

/* ============================================================
   RESOLVE EXISTING RESERVATION EDIT PRICE
   Recovered shared helper for Quote Edit + Update Booking.
============================================================ */

exports.addBooking = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const result =
      await createBookingForHotel({
        connection,

        hotelId:
          context.hotelId,

        adminId:
          context.adminId,

        payload:
          req.body,
      });


    await connection.commit();


    const first =
      result.bookings[0];


    return res
      .status(201)
      .json({
        success: true,

        message:
          result.bookings.length ===
          1
            ? "Booking created successfully."
            : `${result.bookings.length} bookings created successfully.`,

        reservation_group_id:
          result.reservationGroupId,

        reservation_group_code:
          result.reservationGroupCode,
          
        customer_id:
          result.customerId,

        existing_customer:
          result.existingCustomer,

        booking_source:
          result.bookingSource,

        booking_id:
          first.bookingId,

        booking_code:
          first.bookingCode,

        bookings:
          result.bookings,

        payment:
          result.paymentSummary,
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "CREATE_BOOKING",
      error
    );


    if (
      error?.status &&
      error?.code
    ) {
      return sendError(
        res,
        error.status,
        error.code,
        error.message
      );
    }


    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "BOOKING_DUPLICATE",
        "A duplicate booking, customer identity, or transaction reference already exists."
      );
    }


    return sendError(
      res,
      500,
      "BOOKING_CREATE_FAILED",
      "The booking could not be created. Please try again."
    );
  } finally {
    connection.release();
  }
};


/* ============================================================
   ADD ROOM(S) TO EXISTING RESERVATION GROUP
============================================================ */

exports.addReservationGroupRooms = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const reservationGroupId =
    parsePositiveInteger(
      req.params.groupId
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!reservationGroupId) {
    return sendError(
      res,
      400,
      "INVALID_RESERVATION_GROUP_ID",
      "The reservation group ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const result =
      await createBookingsInExistingReservationGroup({
        connection,

        hotelId:
          context.hotelId,

        adminId:
          context.adminId,

        reservationGroupId,

        payload:
          req.body,
      });


    await connection
      .commit();


    return res
      .status(201)
      .json({
        success: true,

        message:
          result.bookings.length ===
          1
            ? "Room added to reservation successfully."
            : `${result.bookings.length} rooms added to reservation successfully.`,

        data: {
          reservation_group_id:
            result
              .reservationGroupId,

          group_code:
            result.groupCode,

          customer_id:
            result.customerId,

          bookings:
            result.bookings,

          payment:
            result.paymentSummary,
        },
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "ADD_RESERVATION_GROUP_ROOMS",
      error
    );


    if (
      error?.status &&
      error?.code
    ) {
      return sendError(
        res,
        error.status,
        error.code,
        error.message
      );
    }


    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "DUPLICATE_TRANSACTION_REFERENCE",
        "This payment transaction reference has already been used."
      );
    }


    return sendError(
      res,
      500,
      "RESERVATION_GROUP_ROOM_ADD_FAILED",
      "The room could not be added to this reservation. Please try again."
    );
  } finally {
    connection.release();
  }
};


/* ============================================================
   UPDATE RESERVATION

   Important lifecycle rule:

   Normal Edit is ONLY for:
   pending / confirmed booking.

   checked_in:
   use Change Room / Extend Stay / Checkout.

   checked_out:
   read-only.

   cancelled:
   read-only.
============================================================ */
