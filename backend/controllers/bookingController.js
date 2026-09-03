const db = require("../config/db").promisePool;

const {
  RESERVATION_EDIT_STATUSES,
  parsePositiveInteger,
  normalizeBookingSource,
  validateCustomer,
  validateBookingItems,
  validateInitialPayment,
} = require("../services/bookingValidation");

const {
  calculateOvernightPrice,

  priceBookingItemsWithConnection,

  priceBookingItemsFromSnapshotWithConnection,
} = require(
  "../services/bookingPricingService"
);

const {
  saveBookingPolicySnapshotWithConnection,

  getBookingPolicySnapshotWithConnection,
} = require(
  "../services/hotelSettingsService"
);

const {
  lockRooms,
  getRoomsForPricing,

  ensureNoOverlap,
  createInitialRoomHistory,
} = require("../services/bookingRoomService");


const {
  getLockedPaymentState,
  syncBookingPaymentStatus,
  applyInitialPayment,

  collectBookingPayment:
    collectBookingPaymentService,

  refundBookingOverpayment:
    refundBookingOverpaymentService,
} = require("../services/bookingPaymentService");

const {
  refundNoShowOverpayment:
    refundNoShowOverpaymentService,
} = require(
  "../services/bookingPayments/noShowRefundService"
);

const {
  collectReservationGroupPayment:
    collectReservationGroupPaymentService,
} = require(
  "../services/bookingPayments/groupPaymentService"
);

const {
  checkoutReservationGroup:
    checkoutReservationGroupService,
} = require(
  "../services/bookingCheckout/groupCheckoutService"
);

const {
  cancelBooking:
    cancelBookingService,
} = require(
  "../services/bookingCancellationService"
);

const {
  findOrCreateCustomer,
} = require("../services/bookingCustomerService");

const {
  loadPrimaryCustomerWithConnection,

  insertBookingGuestsWithConnection,

  replaceBookingGuestsWithConnection,

  getBookingGuestsWithConnection,

  getReservationGroupGuestsWithConnection,

  countGroupPrimaryGuestsWithConnection,
} = require(
  "../services/bookingGuestService"
);

const {
  lockSourceRequest,
  approveSourceRequest,
  syncSourceRequestRoom,
} = require("../services/bookingSourceRequestService");

const {
  checkInBooking:
    checkInBookingLifecycle,

  extendStayBooking:
    extendStayBookingLifecycle,

  checkoutBooking:
    checkoutBookingLifecycle,
} = require("../services/bookingLifecycleService");

const {
  checkInBookingGuest:
    checkInBookingGuestLifecycle,

  checkoutBookingGuest:
    checkoutBookingGuestLifecycle,
} = require(
  "../services/bookingGuestLifecycleService"
);

const {
  reconcileOverdueBookingsWithConnection,
  reconcileOverdueBookingsForHotel,
  reconcileOverdueBookingForHotel,
  reconcileOverdueReservationGroupForHotel,
} = require(
  "../services/bookingStatusService"
);

/* ============================================================
   RESPONSE / LOG HELPERS
============================================================ */

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

async function reconcileBookingBeforeAction(
  connection,
  {
    hotelId,
    bookingId,
  }
) {
  const result =
    await reconcileOverdueBookingsWithConnection(
      connection,
      {
        hotelId,
        bookingId,
      }
    );


  if (!result?.changed) {
    return null;
  }


  if (
    Number(
      result.noShowCount || 0
    ) > 0
  ) {
    return {
      code:
        "BOOKING_BECAME_NO_SHOW",

      message:
        "This reservation is now marked No Show because its configured no-show time passed without any check-in.",
    };
  }


  if (
    Number(
      result.expiredCount || 0
    ) > 0
  ) {
    return {
      code:
        "BOOKING_EXPIRED",

      message:
        "This pending reservation has expired because its stay window passed without becoming an active stay.",
    };
  }


  return {
    code:
      "BOOKING_LIFECYCLE_CLOSED",

    message:
      "This reservation is no longer open for this action.",
  };
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

function serializeBookingGuest(
  guest
) {
  return {
    booking_guest_id:
      guest.bookingGuestId,

    customer_id:
      guest.customerId,

    guest_role:
      guest.guestRole,

    guest_type:
      guest.guestType,

    full_name:
      guest.fullName,

    phone:
      guest.phone || null,

    age:
      guest.age,

    id_proof_type:
      guest.idProofType,

    id_proof_number:
      guest.idProofNumber,

    extra_bed_used:
      guest.extraBedUsed,

    child_charge_amount:
      Number(
        guest.childChargeAmount ||
        0
      ),

    extra_bed_charge_amount:
      Number(
        guest.extraBedChargeAmount ||
        0
      ),

    /* ========================================================
       INDIVIDUAL GUEST LIFECYCLE
    ======================================================== */

    guest_status:
      guest.guestStatus ||
      "expected",

    actual_check_in:
      guest.actualCheckIn ||
      null,

    actual_check_out:
      guest.actualCheckOut ||
      null,

    checked_in_by_admin_id:
      guest.checkedInByAdminId ??
      null,

    checked_out_by_admin_id:
      guest.checkedOutByAdminId ??
      null,

    created_by_admin_id:
      guest.createdByAdminId ??
      null,

    updated_by_admin_id:
      guest.updatedByAdminId ??
      null,

    created_at:
      guest.createdAt ||
      null,

    updated_at:
      guest.updatedAt ||
      null,
  };
}


function buildBookingOccupancy(
  booking,
  guests
) {
  const records =
    Array.isArray(
      guests
    )
      ? guests.map(
          serializeBookingGuest
        )
      : [];

  const rosterCaptured =
    Number(
      booking
        ?.guest_roster_captured ||
      0
    ) === 1 ||
    records.length > 0;


  const primaryGuest =
    records.find(
      (guest) =>
        guest.guest_role ===
        "primary"
    ) ||
    null;


  const accompanyingGuests =
    records.filter(
      (guest) =>
        guest.guest_role ===
        "accompanying"
    );


  const childChargeAmount =
    records.reduce(
      (
        total,
        guest
      ) =>
        total +
        Number(
          guest.child_charge_amount ||
          0
        ),
      0
    );


  const extraBedChargeAmount =
    records.reduce(
      (
        total,
        guest
      ) =>
        total +
        Number(
          guest.extra_bed_charge_amount ||
          0
        ),
      0
    );


  return {
    roster_captured:
      rosterCaptured,

    roster_status:
      rosterCaptured
        ? "captured"
        : "legacy_not_captured",

    total_guests:
      Number(
        booking?.total_guests ||
        0
      ),

    saved_guest_rows:
      records.length,

    primary_guest_staying:
      Boolean(
        primaryGuest
      ),

    primary_guest:
      primaryGuest,

    accompanying_guests:
      accompanyingGuests,

    guests:
      records,

    child_charge_amount:
      Number(
        childChargeAmount
          .toFixed(2)
      ),

    extra_bed_charge_amount:
      Number(
        extraBedChargeAmount
          .toFixed(2)
      ),

    guest_charge_amount:
      Number(
        (
          childChargeAmount +
          extraBedChargeAmount
        ).toFixed(2)
      ),
  };
}

async function resolveReservationEditGuestContext(
  connection,
  {
    hotelId,
    bookingId,
    existing,
    item,
  }
) {
  if (
    item?.guestRosterProvided !==
    true
  ) {
    return null;
  }


  const reservationGroupId =
    Number(
      existing
        ?.reservation_group_id
    );


  if (
    !Number.isSafeInteger(
      reservationGroupId
    ) ||
    reservationGroupId <= 0
  ) {
    throwHttp(
      500,
      "RESERVATION_GROUP_MISSING",
      "The reservation group could not be resolved for guest allocation."
    );
  }


  const currentGuests =
    await getBookingGuestsWithConnection(
      connection,
      {
        hotelId,
        bookingId,
      }
    );


  const currentHasPrimary =
    currentGuests.some(
      (guest) =>
        guest.guestRole ===
        "primary"
    );


  const otherPrimaryCount =
    await countGroupPrimaryGuestsWithConnection(
      connection,
      {
        hotelId,

        reservationGroupId,

        excludeBookingId:
          bookingId,
      }
    );


  if (
    otherPrimaryCount > 1 ||
    (
      currentHasPrimary &&
      otherPrimaryCount > 0
    )
  ) {
    throwHttp(
      409,
      "RESERVATION_GROUP_PRIMARY_GUEST_INVALID",
      "This reservation group contains an invalid Primary Guest allocation and requires review."
    );
  }


  const primaryMode =
    otherPrimaryCount > 0
      ? "none"
      : "zero_or_one";


  const primaryCustomer =
    await loadPrimaryCustomerWithConnection(
      connection,
      {
        hotelId,

        customerId:
          Number(
            existing.customer_id
          ),

        forUpdate:
          false,
      }
    );


  return {
    primaryMode,
    primaryCustomer,
  };
}

/* ============================================================
   TRUSTED ADMIN / HOTEL CONTEXT
============================================================ */

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

exports.syncBookingPaymentStatus =
  syncBookingPaymentStatus;


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


exports.createBookingForHotel =
  createBookingForHotel;


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

exports.getBookings = async (
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


  try {
    await reconcileOverdueBookingsForHotel(
      context.hotelId
    );
    const [rows] =
      await db.query(
        `
          SELECT
            b.booking_id,
            b.booking_code,

            b.reservation_group_id,
            rg.group_code,

            COALESCE(
              gc.group_booking_count,
              1
            ) AS group_booking_count,

            b.source_request_id,
            b.booking_source,
            b.stay_type,

            b.customer_id,
            b.room_id,

            b.booked_rate_per_night,

            b.created_by_admin_id,
            b.updated_by_admin_id,

            b.check_in,
            b.check_out,
            b.actual_check_in,
            b.actual_check_out,

            b.cancellation_source,
            b.cancellation_reason,
            b.cancelled_at,
            b.cancelled_by_admin_id,

            b.total_guests,
            b.booking_status,
            b.total_amount,

            bfs.settlement_id
              AS financial_settlement_id,

            bfs.settlement_type
              AS financial_settlement_type,

            bfs.settlement_status
              AS financial_settlement_status,

            bfs.calculation_mode
              AS financial_calculation_mode,

            bfs.charge_method
              AS financial_charge_method,

            bfs.charge_value
              AS financial_charge_value,

            bfs.final_payable_amount
              AS final_payable_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.settlement_status =
                'finalized'
              AND bfs.final_payable_amount
                IS NOT NULL
                THEN bfs.final_payable_amount

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
                THEN NULL

              ELSE b.total_amount
            END AS effective_payable_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND (
                COALESCE(
                  bfs.settlement_status,
                  'missing'
                ) <> 'finalized'

                OR bfs.final_payable_amount
                  IS NULL
              )
                THEN 1

              ELSE 0
            END AS financial_review_required,

            b.special_request,
            b.created_at,
            b.updated_at,

            c.full_name,
            c.phone,
            c.email,
            c.nationality,

            r.room_number,
            r.room_type,
            r.floor_number,
            r.capacity,
            r.max_extra_beds,

            COALESCE(
              guest_count.expected_guest_count,
              0
            ) AS expected_guest_count,

            COALESCE(
              guest_count.checked_in_guest_count,
              0
            ) AS checked_in_guest_count,

            COALESCE(
              guest_count.active_guest_count,
              0
            ) AS active_guest_count,

            COALESCE(
              pay.gross_paid,
              0
            ) AS gross_paid,

            COALESCE(
              pay.refunded_amount,
              0
            ) AS refunded_amount,

            COALESCE(
              pay.net_paid,
              0
            ) AS net_paid,

            GREATEST(
              COALESCE(
                pay.net_paid,
                0
              ),
              0
            ) AS amount_paid,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.settlement_status =
                'finalized'
              AND bfs.final_payable_amount
                IS NOT NULL
                THEN GREATEST(
                  bfs.final_payable_amount -
                  COALESCE(
                    pay.net_paid,
                    0
                  ),
                  0
                )

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
                THEN NULL

              ELSE GREATEST(
                b.total_amount -
                COALESCE(
                  pay.net_paid,
                  0
                ),
                0
              )
            END AS outstanding_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.settlement_status =
                'finalized'
              AND bfs.final_payable_amount
                IS NOT NULL
                THEN GREATEST(
                  COALESCE(
                    pay.net_paid,
                    0
                  ) -
                  bfs.final_payable_amount,
                  0
                )

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
                THEN NULL

              ELSE GREATEST(
                COALESCE(
                  pay.net_paid,
                  0
                ) -
                b.total_amount,
                0
              )
            END AS overpaid_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND (
                COALESCE(
                  bfs.settlement_status,
                  'missing'
                ) <> 'finalized'

                OR bfs.final_payable_amount
                  IS NULL
              )
                THEN 'review_required'

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.final_payable_amount <= 0
                THEN 'paid'

              WHEN COALESCE(
                pay.net_paid,
                0
              ) <= 0
                THEN 'unpaid'

              WHEN COALESCE(
                pay.net_paid,
                0
              ) <
                CASE
                  WHEN b.booking_status IN (
                    'no_show',
                    'cancelled'
                  )
                    THEN bfs.final_payable_amount

                  ELSE b.total_amount
                END
                THEN 'partial'

              ELSE 'paid'
            END AS payment_status

          FROM bookings b

          INNER JOIN reservation_groups rg
            ON rg.hotel_id =
              b.hotel_id
          AND rg.reservation_group_id =
              b.reservation_group_id

          LEFT JOIN (
            SELECT
              hotel_id,
              reservation_group_id,
              COUNT(*) AS group_booking_count

            FROM bookings

            GROUP BY
              hotel_id,
              reservation_group_id
          ) gc
            ON gc.hotel_id =
              b.hotel_id
          AND gc.reservation_group_id =
              b.reservation_group_id

          INNER JOIN customers c
            ON c.hotel_id =
              b.hotel_id
           AND c.customer_id =
              b.customer_id

          INNER JOIN rooms r
            ON r.hotel_id =
              b.hotel_id
           AND r.room_id =
              b.room_id

          LEFT JOIN (
            SELECT
              hotel_id,
              booking_id,

              SUM(
                CASE
                  WHEN guest_status = 'expected'
                  THEN 1
                  ELSE 0
                END
              ) AS expected_guest_count,

              SUM(
                CASE
                  WHEN guest_status = 'checked_in'
                  THEN 1
                  ELSE 0
                END
              ) AS checked_in_guest_count,

              SUM(
                CASE
                  WHEN guest_status IN (
                    'expected',
                    'checked_in'
                  )
                  THEN 1
                  ELSE 0
                END
              ) AS active_guest_count

            FROM booking_guests

            GROUP BY
              hotel_id,
              booking_id
          ) guest_count
            ON guest_count.hotel_id =
              b.hotel_id
          AND guest_count.booking_id =
              b.booking_id

          LEFT JOIN (
            SELECT
              hotel_id,
              booking_id,

              SUM(
                CASE
                  WHEN payment_status =
                    'success'
                   AND transaction_type =
                    'payment'
                  THEN amount
                  ELSE 0
                END
              ) AS gross_paid,

              SUM(
                CASE
                  WHEN payment_status =
                    'success'
                   AND transaction_type =
                    'refund'
                  THEN amount
                  ELSE 0
                END
              ) AS refunded_amount,

              SUM(
                CASE

                  WHEN payment_status <>
                    'success'
                    THEN 0

                  WHEN transaction_type =
                    'refund'
                    THEN -amount

                  ELSE amount

                END
              ) AS net_paid

            FROM payments

            GROUP BY
              hotel_id,
              booking_id
          ) pay
            ON pay.hotel_id =
              b.hotel_id
           AND pay.booking_id =
              b.booking_id

          LEFT JOIN booking_financial_settlements bfs
            ON bfs.hotel_id =
              b.hotel_id

          AND bfs.booking_id =
              b.booking_id

          AND (
                (
                  b.booking_status =
                    'no_show'

                  AND bfs.settlement_type =
                    'no_show'
                )

                OR

                (
                  b.booking_status =
                    'cancelled'

                  AND bfs.settlement_type =
                    'cancellation'
                )
          )

          WHERE b.hotel_id = ?

          ORDER BY
            b.booking_id DESC
        `,
        [
          context.hotelId,
        ]
      );


    return res
      .status(200)
      .json(rows);
  } catch (error) {
    logBookingError(
      "GET_BOOKINGS",
      error
    );


    return sendError(
      res,
      500,
      "BOOKING_LIST_FETCH_FAILED",
      "Bookings could not be loaded. Please try again."
    );
  }
};


/* ============================================================
   GET SINGLE BOOKING
============================================================ */

exports.getBooking = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  try {
    await reconcileOverdueBookingForHotel(
      context.hotelId,
      bookingId
    );
    const [[booking]] =
      await db.query(
        `
          SELECT
            b.booking_id,
            b.booking_code,

            b.reservation_group_id,
            rg.group_code,

            COALESCE(
              gc.group_booking_count,
              1
            ) AS group_booking_count,

            b.source_request_id,
            b.booking_source,
            b.stay_type,

            b.customer_id,
            b.room_id,
            b.booked_rate_per_night,

            b.created_by_admin_id,
            b.updated_by_admin_id,

            b.check_in,
            b.check_out,
            b.actual_check_in,
            b.actual_check_out,

            b.cancellation_source,
            b.cancellation_reason,
            b.cancelled_at,
            b.cancelled_by_admin_id,

            b.total_guests,
            b.guest_roster_captured,
            b.booking_status,
            b.total_amount,

            bfs.settlement_id
              AS financial_settlement_id,

            bfs.settlement_type
              AS financial_settlement_type,

            bfs.settlement_status
              AS financial_settlement_status,

            bfs.calculation_mode
              AS financial_calculation_mode,

            bfs.charge_method
              AS financial_charge_method,

            bfs.charge_value
              AS financial_charge_value,

            bfs.final_payable_amount
              AS final_payable_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.settlement_status =
                'finalized'
              AND bfs.final_payable_amount
                IS NOT NULL
                THEN bfs.final_payable_amount

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
                THEN NULL

              ELSE b.total_amount
            END AS effective_payable_amount, 

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND (
                COALESCE(
                  bfs.settlement_status,
                  'missing'
                ) <> 'finalized'

                OR bfs.final_payable_amount
                  IS NULL
              )
                THEN 1

              ELSE 0
            END AS financial_review_required,

            b.special_request,
            b.created_at,
            b.updated_at,

            c.full_name,
            c.phone,
            c.email,
            c.gender,
            c.nationality,
            c.address,
            c.id_proof_type,
            c.id_proof_number,

            r.room_number,
            r.room_type,
            r.floor_number,
            r.capacity,
            r.max_extra_beds,
            r.status AS room_status,

            COALESCE(
              pay.gross_paid,
              0
            ) AS gross_paid,

            COALESCE(
              pay.refunded_amount,
              0
            ) AS refunded_amount,

            COALESCE(
              pay.net_paid,
              0
            ) AS net_paid,

            GREATEST(
              COALESCE(
                pay.net_paid,
                0
              ),
              0
            ) AS amount_paid,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.settlement_status =
                'finalized'
              AND bfs.final_payable_amount
                IS NOT NULL
                THEN GREATEST(
                  bfs.final_payable_amount -
                  COALESCE(
                    pay.net_paid,
                    0
                  ),
                  0
                )

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
                THEN NULL

              ELSE GREATEST(
                b.total_amount -
                COALESCE(
                  pay.net_paid,
                  0
                ),
                0
              )
            END AS outstanding_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.settlement_status =
                'finalized'
              AND bfs.final_payable_amount
                IS NOT NULL
                THEN GREATEST(
                  COALESCE(
                    pay.net_paid,
                    0
                  ) -
                  bfs.final_payable_amount,
                  0
                )

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
                THEN NULL

              ELSE GREATEST(
                COALESCE(
                  pay.net_paid,
                  0
                ) -
                b.total_amount,
                0
              )
            END AS overpaid_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND (
                COALESCE(
                  bfs.settlement_status,
                  'missing'
                ) <> 'finalized'

                OR bfs.final_payable_amount
                  IS NULL
              )
                THEN 'review_required'

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.final_payable_amount <= 0
                THEN 'paid'

              WHEN COALESCE(
                pay.net_paid,
                0
              ) <= 0
                THEN 'unpaid'

              WHEN COALESCE(
                pay.net_paid,
                0
              ) <
                CASE
                  WHEN b.booking_status IN (
                    'no_show',
                    'cancelled'
                  )
                    THEN bfs.final_payable_amount

                  ELSE b.total_amount
                END
                THEN 'partial'

              ELSE 'paid'
            END AS payment_status

          FROM bookings b

          INNER JOIN reservation_groups rg
            ON rg.hotel_id =
              b.hotel_id
          AND rg.reservation_group_id =
              b.reservation_group_id

          LEFT JOIN (
            SELECT
              hotel_id,
              reservation_group_id,
              COUNT(*) AS group_booking_count

            FROM bookings

            GROUP BY
              hotel_id,
              reservation_group_id
          ) gc
            ON gc.hotel_id =
              b.hotel_id
          AND gc.reservation_group_id =
              b.reservation_group_id

          INNER JOIN customers c
            ON c.hotel_id =
              b.hotel_id
           AND c.customer_id =
              b.customer_id

          INNER JOIN rooms r
            ON r.hotel_id =
              b.hotel_id
           AND r.room_id =
              b.room_id

          LEFT JOIN (
            SELECT
              hotel_id,
              booking_id,

              SUM(
                CASE
                  WHEN payment_status =
                    'success'
                   AND transaction_type =
                    'payment'
                  THEN amount
                  ELSE 0
                END
              ) AS gross_paid,

              SUM(
                CASE
                  WHEN payment_status =
                    'success'
                   AND transaction_type =
                    'refund'
                  THEN amount
                  ELSE 0
                END
              ) AS refunded_amount,

              SUM(
                CASE

                  WHEN payment_status <>
                    'success'
                    THEN 0

                  WHEN transaction_type =
                    'refund'
                    THEN -amount

                  ELSE amount

                END
              ) AS net_paid

            FROM payments

            GROUP BY
              hotel_id,
              booking_id
          ) pay
            ON pay.hotel_id =
              b.hotel_id
          AND pay.booking_id =
              b.booking_id

          LEFT JOIN booking_financial_settlements bfs
            ON bfs.hotel_id =
              b.hotel_id

          AND bfs.booking_id =
              b.booking_id

          AND (
                (
                  b.booking_status =
                    'no_show'

                  AND bfs.settlement_type =
                    'no_show'
                )

                OR

                (
                  b.booking_status =
                    'cancelled'

                  AND bfs.settlement_type =
                    'cancellation'
                )
          )

          WHERE b.hotel_id = ?
            AND b.booking_id = ?

          LIMIT 1
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    if (!booking) {
      return sendError(
        res,
        404,
        "BOOKING_NOT_FOUND",
        "The booking was not found in your hotel."
      );
    }


    const [payments] =
      await db.query(
        `
          SELECT
            payment_id,
            transaction_type,
            payment_stage,
            amount,
            payment_method,
            transaction_id,
            created_by_admin_id,
            notes,
            payment_status,
            payment_date

          FROM payments

          WHERE hotel_id = ?
            AND booking_id = ?

          ORDER BY
            payment_date DESC,
            payment_id DESC
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    const [roomHistory] =
      await db.query(
        `
          SELECT
            h.room_history_id,
            h.room_id,
            h.assignment_start,
            h.assignment_end,
            h.assignment_status,
            h.rate_per_night,
            h.change_reason,
            h.notes,
            h.changed_by_admin_id,
            h.created_at,

            r.room_number,
            r.room_type,
            r.floor_number

          FROM booking_room_history h

          INNER JOIN rooms r
            ON r.hotel_id =
              h.hotel_id
           AND r.room_id =
              h.room_id

          WHERE h.hotel_id = ?
            AND h.booking_id = ?

          ORDER BY
            h.assignment_start ASC,
            h.room_history_id ASC
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    const [adjustments] =
      await db.query(
        `
          SELECT
            adjustment_id,
            adjustment_type,
            reason,
            amount,
            description,
            created_by_admin_id,
            created_at

          FROM booking_adjustments

          WHERE hotel_id = ?
            AND booking_id = ?

          ORDER BY
            created_at ASC,
            adjustment_id ASC
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    const [customerDocuments] =
      await db.query(
        `
          SELECT
            document_id,
            document_type,
            document_number,
            original_file_name,
            mime_type,
            file_size_bytes,
            is_verified,
            uploaded_by_admin_id,
            created_at

          FROM customer_documents

          WHERE hotel_id = ?
            AND customer_id = ?

          ORDER BY
            document_id DESC
        `,
        [
          context.hotelId,
          booking.customer_id,
        ]
      );
    
    const bookingGuests =
      await getBookingGuestsWithConnection(
        db,
        {
          hotelId:
            context.hotelId,

          bookingId,
        }
      );


    const occupancy =
      buildBookingOccupancy(
        booking,
        bookingGuests
      );


    /*
    * Edit Booking Desk must use the same immutable
    * booking-time Guest & Occupancy policy that backend
    * repricing uses.
    *
    * Do not substitute today's hotel settings.
    */
    const bookingPolicySnapshot =
      await getBookingPolicySnapshotWithConnection(
        db,
        {
          hotelId:
            context.hotelId,

          bookingId,
        }
      );

    return res
      .status(200)
      .json({
        ...booking,

        occupancy,

        booking_policy_snapshot:
          bookingPolicySnapshot
            ? {
                snapshot_id:
                  bookingPolicySnapshot
                    .snapshotId,

                created_at:
                  bookingPolicySnapshot
                    .createdAt,

                guest_requirements:
                  bookingPolicySnapshot
                    .policySnapshot
                    ?.guest_requirements ||
                  null,

                day_use:
                  bookingPolicySnapshot
                    .policySnapshot
                    ?.day_use ||
                  null,
              }
            : null,

        payments,

        room_history:
          roomHistory,

        adjustments,

        customer_documents:
          customerDocuments,
      });
  } catch (error) {
    logBookingError(
      "GET_BOOKING",
      error
    );


    return sendError(
      res,
      500,
      "BOOKING_FETCH_FAILED",
      "The booking could not be loaded. Please try again."
    );
  }
};


exports.getBookingDetails =
  exports.getBooking;

/* ============================================================
   GET RESERVATION GROUP DETAILS

   One reservation group may contain one or many room bookings.

   Important:
   - Strictly hotel scoped.
   - Customer comes from reservation_groups.
   - Every room booking keeps its own lifecycle/payment state.
   - Cancelled bookings do not create outstanding balance.
   - Existing successful payments/refunds remain visible.
============================================================ */

exports.getReservationGroupDetails = async (
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


  try {
    await reconcileOverdueReservationGroupForHotel(
      context.hotelId,
      reservationGroupId
    );
    /* ========================================================
       GROUP + CUSTOMER
    ======================================================== */

    const [[group]] =
      await db.query(
        `
          SELECT
            rg.reservation_group_id,
            rg.group_code,
            rg.customer_id,
            rg.created_by_admin_id,
            rg.created_at,
            rg.updated_at,

            c.full_name,
            c.phone,
            c.email,
            c.gender,
            c.nationality,
            c.address,
            c.id_proof_type,
            c.id_proof_number

          FROM reservation_groups rg

          INNER JOIN customers c
            ON c.hotel_id =
              rg.hotel_id
           AND c.customer_id =
              rg.customer_id

          WHERE rg.hotel_id = ?
            AND rg.reservation_group_id = ?

          LIMIT 1
        `,
        [
          context.hotelId,
          reservationGroupId,
        ]
      );


    if (!group) {
      return sendError(
        res,
        404,
        "RESERVATION_GROUP_NOT_FOUND",
        "The reservation group was not found in your hotel."
      );
    }


    /* ========================================================
       CHILD BOOKINGS

       Financial state is derived from successful ledger rows.
    ======================================================== */

    const [bookings] =
      await db.query(
        `
          SELECT
            b.booking_id,
            b.booking_code,
            b.booking_source,
            b.source_request_id,
            b.stay_type,

            b.room_id,

            r.room_number,
            r.room_type,
            r.floor_number,
            r.capacity,
            r.max_extra_beds,
            r.status AS room_status,

            b.booked_rate_per_night,

            b.check_in,
            b.check_out,
            b.actual_check_in,
            b.actual_check_out,

            b.cancellation_source,
            b.cancellation_reason,
            b.cancelled_at,
            b.cancelled_by_admin_id,

            b.total_guests,
            b.guest_roster_captured,
            b.booking_status,
            b.total_amount,

            bfs.settlement_id
              AS financial_settlement_id,

            bfs.settlement_status
              AS financial_settlement_status,

            bfs.calculation_mode
              AS financial_calculation_mode,

            bfs.charge_method
              AS financial_charge_method,

            bfs.charge_value
              AS financial_charge_value,

            bfs.final_payable_amount
              AS final_payable_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.settlement_status =
                'finalized'
              AND bfs.final_payable_amount
                IS NOT NULL
                THEN bfs.final_payable_amount

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
                THEN NULL

              ELSE b.total_amount
            END AS effective_payable_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND (
                COALESCE(
                  bfs.settlement_status,
                  'missing'
                ) <> 'finalized'

                OR bfs.final_payable_amount
                  IS NULL
              )
                THEN 1

              ELSE 0
            END AS financial_review_required,

            b.special_request,

            b.created_by_admin_id,
            b.updated_by_admin_id,
            b.created_at,
            b.updated_at,

            COALESCE(
              pay.gross_paid,
              0
            ) AS gross_paid,

            COALESCE(
              pay.refunded_amount,
              0
            ) AS refunded_amount,

            COALESCE(
              pay.net_paid,
              0
            ) AS net_paid,

            GREATEST(
              COALESCE(
                pay.net_paid,
                0
              ),
              0
            ) AS amount_paid,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.settlement_status =
                'finalized'
              AND bfs.final_payable_amount
                IS NOT NULL
                THEN GREATEST(
                  bfs.final_payable_amount -
                  COALESCE(
                    pay.net_paid,
                    0
                  ),
                  0
                )

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
                THEN NULL

              ELSE GREATEST(
                b.total_amount -
                COALESCE(
                  pay.net_paid,
                  0
                ),
                0
              )
            END AS outstanding_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.settlement_status =
                'finalized'
              AND bfs.final_payable_amount
                IS NOT NULL
                THEN GREATEST(
                  COALESCE(
                    pay.net_paid,
                    0
                  ) -
                  bfs.final_payable_amount,
                  0
                )

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
                THEN NULL

              ELSE GREATEST(
                COALESCE(
                  pay.net_paid,
                  0
                ) -
                b.total_amount,
                0
              )
            END AS overpaid_amount,

            CASE
              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND (
                COALESCE(
                  bfs.settlement_status,
                  'missing'
                ) <> 'finalized'

                OR bfs.final_payable_amount
                  IS NULL
              )
                THEN 'review_required'

              WHEN b.booking_status IN (
                'no_show',
                'cancelled'
              )
              AND bfs.final_payable_amount <= 0
                THEN 'paid'

              WHEN COALESCE(
                pay.net_paid,
                0
              ) <= 0
                THEN 'unpaid'

              WHEN COALESCE(
                pay.net_paid,
                0
              ) <
                CASE
                  WHEN b.booking_status IN (
                    'no_show',
                    'cancelled'
                  )
                    THEN bfs.final_payable_amount

                  ELSE b.total_amount
                END
                THEN 'partial'

              ELSE 'paid'
            END AS payment_status

          FROM bookings b

          INNER JOIN rooms r
            ON r.hotel_id =
              b.hotel_id
           AND r.room_id =
              b.room_id

          LEFT JOIN (
            SELECT
              hotel_id,
              booking_id,

              SUM(
                CASE
                  WHEN payment_status =
                    'success'
                   AND transaction_type =
                    'payment'
                  THEN amount
                  ELSE 0
                END
              ) AS gross_paid,

              SUM(
                CASE
                  WHEN payment_status =
                    'success'
                   AND transaction_type =
                    'refund'
                  THEN amount
                  ELSE 0
                END
              ) AS refunded_amount,

              SUM(
                CASE

                  WHEN payment_status <>
                    'success'
                    THEN 0

                  WHEN transaction_type =
                    'refund'
                    THEN -amount

                  ELSE amount

                END
              ) AS net_paid

            FROM payments

            GROUP BY
              hotel_id,
              booking_id
          ) pay
            ON pay.hotel_id =
              b.hotel_id
           AND pay.booking_id =
              b.booking_id
          
          LEFT JOIN booking_financial_settlements bfs
            ON bfs.hotel_id =
              b.hotel_id

          AND bfs.booking_id =
              b.booking_id

          AND (
                (
                  b.booking_status =
                    'no_show'

                  AND bfs.settlement_type =
                    'no_show'
                )

                OR

                (
                  b.booking_status =
                    'cancelled'

                  AND bfs.settlement_type =
                    'cancellation'
                )
          )

          WHERE b.hotel_id = ?
            AND b.reservation_group_id = ?

          ORDER BY
            b.booking_id ASC
        `,
        [
          context.hotelId,
          reservationGroupId,
        ]
      );


    const groupGuests =
      await getReservationGroupGuestsWithConnection(
        db,
        {
          hotelId:
            context.hotelId,

          reservationGroupId,
        }
      );


    const guestsByBookingId =
      new Map();


    for (
      const guest of
      groupGuests
    ) {
      const bookingId =
        Number(
          guest.bookingId
        );


      if (
        !guestsByBookingId.has(
          bookingId
        )
      ) {
        guestsByBookingId.set(
          bookingId,
          []
        );
      }


      guestsByBookingId
        .get(
          bookingId
        )
        .push(
          guest
        );
    }


    const bookingsWithOccupancy =
      bookings.map(
        (booking) => ({
          ...booking,

          occupancy:
            buildBookingOccupancy(
              booking,

              guestsByBookingId.get(
                Number(
                  booking.booking_id
                )
              ) ||
              []
            ),
        })
      );

    /* ========================================================
       GROUP SUMMARY

       Active booking total excludes cancelled child bookings.

       Payment history is never discarded:
       cancelled paid bookings may therefore produce an
       overpaid/refund-review amount.
    ======================================================== */

    const summary =
      bookings.reduce(
        (
          result,
          booking
        ) => {
          const status =
            booking.booking_status;


          const cancelled =
            status ===
            "cancelled";

          const noShow =
            status ===
            "no_show";

          const expired =
            status ===
            "expired";

          const closedWithoutStay =
            cancelled ||
            noShow ||
            expired;


          const bookingTotal =
            Number(
              booking.total_amount ||
              0
            );

          const effectivePayable =
            booking
              .effective_payable_amount ===
                null ||
            booking
              .effective_payable_amount ===
                undefined
              ? null
              : Number(
                  booking
                    .effective_payable_amount
                );


          const financialReviewRequired =
            Number(
              booking
                .financial_review_required ||
              0
            ) === 1;


          const grossPaid =
            Number(
              booking.gross_paid ||
              0
            );


          const refunded =
            Number(
              booking.refunded_amount ||
              0
            );


          const netPaid =
            Number(
              booking.amount_paid ||
              0
            );


          result.totalBookings +=
            1;


          if (!closedWithoutStay) {
            result.activeBookings +=
              1;

            result.totalGuests +=
              Number(
                booking.total_guests ||
                0
              );

            result.bookingTotal +=
              bookingTotal;
          }

          if (cancelled) {
            result.cancelledBookings +=
              1;
          }

          if (noShow) {
            result.noShowBookings +=
              1;
          }

          if (expired) {
            result.expiredBookings +=
              1;
          }

          if (
            status ===
            "pending"
          ) {
            result.pendingBookings +=
              1;
          }

          if (
            status ===
            "confirmed"
          ) {
            result.confirmedBookings +=
              1;
          }

          if (
            status ===
            "checked_in"
          ) {
            result.checkedInBookings +=
              1;
          }

          if (
            status ===
            "checked_out"
          ) {
            result.checkedOutBookings +=
              1;
          }


          result.grossPaid +=
            grossPaid;

          result.refundedAmount +=
            refunded;

          result.netPaid +=
            netPaid;

          if (
            financialReviewRequired
          ) {
            result.financialReviewRequired =
              true;
          } else if (
            Number.isFinite(
              effectivePayable
            )
          ) {
            result.financialPayableTotal +=
              effectivePayable;
          }


          result.outstandingAmount +=
            Number(
              booking
                .outstanding_amount ||
              0
            );


          result.overpaidAmount +=
            Number(
              booking
                .overpaid_amount ||
              0
            );


          return result;
        },
        {
          totalBookings: 0,
          activeBookings: 0,
          cancelledBookings: 0,
          noShowBookings: 0,
          expiredBookings: 0,
          financialPayableTotal: 0,
          financialReviewRequired: false,

          pendingBookings: 0,
          confirmedBookings: 0,
          checkedInBookings: 0,
          checkedOutBookings: 0,

          totalGuests: 0,

          bookingTotal: 0,
          grossPaid: 0,
          refundedAmount: 0,
          netPaid: 0,
          outstandingAmount: 0,
          overpaidAmount: 0,
        }
      );


    const normalizedSummary = {
      total_bookings:
        summary.totalBookings,

      active_bookings:
        summary.activeBookings,

      cancelled_bookings:
        summary.cancelledBookings,

      no_show_bookings:
        summary.noShowBookings,

      financial_payable_total:
        Number(
          summary
            .financialPayableTotal
            .toFixed(2)
        ),

      financial_review_required:
        summary
          .financialReviewRequired,

      expired_bookings:
        summary.expiredBookings,

      pending_bookings:
        summary.pendingBookings,

      confirmed_bookings:
        summary.confirmedBookings,

      checked_in_bookings:
        summary.checkedInBookings,

      checked_out_bookings:
        summary.checkedOutBookings,

      total_rooms:
        summary.totalBookings,

      total_guests:
        summary.totalGuests,

      booking_total:
        Number(
          summary.bookingTotal
            .toFixed(2)
        ),

      gross_paid:
        Number(
          summary.grossPaid
            .toFixed(2)
        ),

      refunded_amount:
        Number(
          summary.refundedAmount
            .toFixed(2)
        ),

      net_paid:
        Number(
          summary.netPaid
            .toFixed(2)
        ),

      outstanding_amount:
        Number(
          summary.outstandingAmount
            .toFixed(2)
        ),

      overpaid_amount:
        Number(
          summary.overpaidAmount
            .toFixed(2)
        ),

      refund_review_required:
        summary.overpaidAmount >
        0.009,
    };


    return res
      .status(200)
      .json({
        success: true,

        data: {
          reservation_group_id:
            Number(
              group
                .reservation_group_id
            ),

          group_code:
            group.group_code,

          customer: {
            customer_id:
              Number(
                group.customer_id
              ),

            full_name:
              group.full_name,

            phone:
              group.phone,

            email:
              group.email,

            gender:
              group.gender,

            nationality:
              group.nationality,

            address:
              group.address,

            id_proof_type:
              group.id_proof_type,

            id_proof_number:
              group.id_proof_number,
          },

          summary:
            normalizedSummary,

          bookings:
            bookingsWithOccupancy,

          created_by_admin_id:
            group.created_by_admin_id,

          created_at:
            group.created_at,

          updated_at:
            group.updated_at,
        },
      });
  } catch (error) {
    logBookingError(
      "GET_RESERVATION_GROUP",
      error
    );


    return sendError(
      res,
      500,
      "RESERVATION_GROUP_FETCH_FAILED",
      "The reservation group could not be loaded. Please try again."
    );
  }
};

/* ============================================================
   BOOKING STATS
============================================================ */

exports.getBookingStats = async (
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


  try {
    await reconcileOverdueBookingsForHotel(
      context.hotelId
    );
    const [[bookingStats]] =
      await db.query(
        `
          SELECT
            COUNT(*) AS totalBookings,

            COALESCE(
              SUM(
                booking_status =
                  'confirmed'
              ),
              0
            ) AS confirmedBookings,

            COALESCE(
              SUM(
                booking_status =
                  'pending'
              ),
              0
            ) AS pendingBookings,

            COALESCE(
              SUM(
                booking_status =
                  'checked_in'
              ),
              0
            ) AS checkedInBookings,

            COALESCE(
              SUM(
                booking_status =
                  'checked_out'
              ),
              0
            ) AS checkedOutBookings,

            COALESCE(
              SUM(
                booking_status =
                  'cancelled'
              ),
              0
            ) AS cancelledBookings,

            COALESCE(
              SUM(
                booking_status =
                  'no_show'
              ),
              0
            ) AS noShowBookings,

            COALESCE(
              SUM(
                booking_status =
                  'expired'
              ),
              0
            ) AS expiredBookings,

            COALESCE(
              SUM(
                CASE
                  WHEN b.booking_status =
                    'no_show'

                  AND bfs.settlement_status =
                    'finalized'

                  AND bfs.final_payable_amount
                    IS NOT NULL

                    THEN bfs.final_payable_amount

                  ELSE 0
                END
              ),
              0
            ) AS noShowPayableValue,

            COALESCE(
              SUM(
                CASE
                  WHEN b.booking_status =
                    'no_show'

                  AND (
                    COALESCE(
                      bfs.settlement_status,
                      'missing'
                    ) <> 'finalized'

                    OR bfs.final_payable_amount
                        IS NULL
                  )

                    THEN 1

                  ELSE 0
                END
              ),
              0
            ) AS noShowFinancialReviewBookings,

            COALESCE(
              SUM(
                CASE
                  WHEN booking_status <>
                    'cancelled'
                  THEN total_amount
                  ELSE 0
                END
              ),
              0
            ) AS totalBookedValue

          FROM bookings b

          LEFT JOIN booking_financial_settlements bfs
            ON bfs.hotel_id =
              b.hotel_id

          AND bfs.booking_id =
              b.booking_id

          AND bfs.settlement_type =
              'no_show'

          WHERE b.hotel_id = ?
        `,
        [
          context.hotelId,
        ]
      );


    const [[paymentStats]] =
      await db.query(
        `
          SELECT
            COALESCE(
              SUM(
                CASE

                  WHEN payment_status <>
                    'success'
                    THEN 0

                  WHEN transaction_type =
                    'refund'
                    THEN -amount

                  ELSE amount

                END
              ),
              0
            ) AS totalRevenue

          FROM payments

          WHERE hotel_id = ?
        `,
        [
          context.hotelId,
        ]
      );


    return res
      .status(200)
      .json({
        success: true,

        data: {
          totalBookings:
            Number(
              bookingStats
                .totalBookings ||
              0
            ),

          confirmedBookings:
            Number(
              bookingStats
                .confirmedBookings ||
              0
            ),

          pendingBookings:
            Number(
              bookingStats
                .pendingBookings ||
              0
            ),

          checkedInBookings:
            Number(
              bookingStats
                .checkedInBookings ||
              0
            ),

          checkedOutBookings:
            Number(
              bookingStats
                .checkedOutBookings ||
              0
            ),

          cancelledBookings:
            Number(
              bookingStats
                .cancelledBookings ||
              0
            ),

          noShowBookings:
            Number(
              bookingStats
                .noShowBookings ||
              0
            ),

          noShowPayableValue:
            Number(
              bookingStats
                .noShowPayableValue ||
              0
            ),

          noShowFinancialReviewBookings:
            Number(
              bookingStats
                .noShowFinancialReviewBookings ||
              0
            ),

          expiredBookings:
            Number(
              bookingStats
                .expiredBookings ||
              0
            ),

          totalBookedValue:
            Number(
              bookingStats
                .totalBookedValue ||
              0
            ),

          totalRevenue:
            Number(
              paymentStats
                .totalRevenue ||
              0
            ),
        },
      });
  } catch (error) {
    logBookingError(
      "GET_BOOKING_STATS",
      error
    );


    return sendError(
      res,
      500,
      "BOOKING_STATS_FETCH_FAILED",
      "Booking statistics could not be loaded. Please try again."
    );
  }
};


/* ============================================================
   RESOLVE EXISTING RESERVATION EDIT PRICE

   Shared by:
   - Edit price quote
   - Final reservation update

   Rules:
   - Same room keeps original booked room rate.
   - Pre-stay room change uses the new room's current rate.
   - Day Use keeps the immutable booking-time policy snapshot.
   - Overnight uses the same central overnight pricing formula.
============================================================ */

async function resolveReservationEditPricing(
  connection,
  {
    hotelId,
    bookingId,
    existing,
    item,
    room,
    guestContext = null,
  }
) {
  const roomChanged =
    Number(
      existing.room_id
    ) !==
    Number(
      item.roomId
    );


  const rateSource =
    roomChanged
      ? "current_room_rate"
      : "booked_room_rate";


  const pricingRoom = {
    ...room,

    price_per_night:
      roomChanged
        ? Number(
            room.price_per_night
          )
        : Number(
            existing
              .booked_rate_per_night ??
            room.price_per_night
          ),
  };


  let pricing;
  let policySource;
  let policySnapshotId =
    null;


  if (
    existing.stay_type ===
      "day_use" ||
    item.guestRosterProvided ===
      true
  ) {
    const pricingResult =
      await priceBookingItemsFromSnapshotWithConnection(
        connection,
        {
          hotelId,
          bookingId,

          items: [
            item,
          ],

          roomMap:
            new Map([
              [
                item.roomId,
                pricingRoom,
              ],
            ]),
          
          guestContext,
        }
      );


    pricing =
      pricingResult
        .prices[0];

    policySource =
      pricingResult
        .policySource;

    policySnapshotId =
      pricingResult
        .snapshotId;
  } else {
    pricing =
      calculateOvernightPrice({
        item,
        room:
          pricingRoom,
      });

    policySource =
      "nightly_rate";
  }


  if (!pricing) {
    throwHttp(
      500,
      "BOOKING_PRICING_MISSING",
      "The reservation price could not be calculated."
    );
  }


  return {
    roomChanged,
    rateSource,
    policySource,
    policySnapshotId,
    pricing,
  };
}

/* ============================================================
   QUOTE BOOKING PRICE

   Read-only pricing preview for Booking Desk.

   Important:
   - Does NOT create customer
   - Does NOT create booking
   - Does NOT create payment
   - Does NOT save policy snapshot
   - Does NOT trust client total_amount
   - Does NOT lock room rows
   - Final booking still performs authoritative availability
     and pricing checks inside its transaction
============================================================ */

exports.quoteBookingPrice = async (
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


  const validation =
    validateBookingItems(
      req.body,
      {
        allowedStatuses:
          RESERVATION_EDIT_STATUSES,
      }
    );


  if (
    validation.error
  ) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_DETAILS",
      validation.error
    );
  }


  const items =
    validation.value;

  let guestContext =
    null;


  if (
    usesDetailedGuestRoster(
      items
    )
  ) {
    /*
    * An empty room roster is valid.
    *
    * Reservation Contact details are needed for guest pricing
    * only when the contact is actually marked as staying.
    */
    const primaryGuestRequested =
      items.some(
        (item) =>
          item
            ?.guestRosterProvided ===
            true &&
          item
            ?.primaryGuestStaying ===
            true
      );


    let primaryCustomer =
      null;


    if (
      primaryGuestRequested
    ) {
      const customerValidation =
        validateCustomer(
          req.body
        );


      if (
        customerValidation.error
      ) {
        return sendError(
          res,
          400,
          "INVALID_CUSTOMER_DETAILS",
          customerValidation.error
        );
      }


      primaryCustomer =
        customerValidation.value;
    }


    guestContext = {
      primaryMode:
        "zero_or_one",

      primaryCustomer,
    };
  }

  const connection =
    await db.getConnection();


  try {
    /*
     * Short read transaction keeps room-rate and hotel-policy
     * reads consistent without using FOR UPDATE.
     */
    await connection
      .beginTransaction();


    const roomMap =
      await getRoomsForPricing(
        connection,
        context.hotelId,
        items
      );


    const pricingResult =
      await priceBookingItemsWithConnection(
        connection,
        {
          hotelId:
            context.hotelId,

          items,
          roomMap,
          guestContext,
        }
      );


    const quotes =
      pricingResult
        .prices
        .map(
          (
            pricing,
            index
          ) => {
            const item =
              items[index];


            const room =
              roomMap.get(
                item.roomId
              );


            return {
              room_id:
                item.roomId,

              room_number:
                room
                  ?.room_number,

              room_type:
                room
                  ?.room_type,

              stay_type:
                pricing
                  .stayType,

              pricing_mode:
                pricing
                  .pricingMode,

              check_in:
                item.checkIn,

              check_out:
                item.checkOut,

              nights:
                pricing
                  .nights,

              duration_minutes:
                pricing
                  .durationMinutes,

              rate_per_night:
                pricing
                  .ratePerNight,

              room_charge:
                pricing.roomCharge,

              total_guests:
                pricing.totalGuests ??
                item.totalGuests,

              max_extra_beds:
                Number(
                  pricing.maxExtraBeds ??
                  room?.max_extra_beds ??
                  0
                ),

              extra_beds_used:
                pricing.extraBedsUsed ??
                null,

              child_charge_amount:
                Number(
                  pricing
                    .childChargeAmount ||
                  0
                ),

              extra_bed_charge_amount:
                Number(
                  pricing
                    .extraBedChargeAmount ||
                  0
                ),

              guest_charge_amount:
                Number(
                  pricing
                    .guestChargeAmount ||
                  0
                ),

              total_amount:
                pricing.totalAmount,

              /*
               * Present only for slab-based Day Use pricing.
               */
              matched_up_to_hours:
                pricing
                  .matchedUpToHours ??
                null,

              applied_value:
                pricing
                  .appliedValue ??
                null,

              /*
               * Present only for hourly Day Use pricing.
               */
              exact_hours:
                pricing
                  .exactHours ??
                null,

              hourly_rate_type:
                pricing
                  .hourlyRateType ??
                null,

              hourly_rate_value:
                pricing
                  .hourlyRateValue ??
                null,

              maximum_charge_percent:
                pricing
                  .maximumChargePercent ??
                null,
            };
          }
        );


    const grandTotal =
      Number(
        quotes
          .reduce(
            (
              total,
              quote
            ) =>
              total +
              Number(
                quote
                  .total_amount ||
                0
              ),
            0
          )
          .toFixed(2)
      );


    await connection
      .commit();


    return res
      .status(200)
      .json({
        success: true,

        data: {
          stay_type:
            items[0]
              ?.stayType,

          room_count:
            quotes.length,

          total_amount:
            grandTotal,

          day_use_enabled:
            pricingResult
              .policySnapshot
              ?.day_use
              ?.enabled ===
            true,

          pricing_source:
            "current_hotel_policy",

          rooms:
            quotes,
        },
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "QUOTE_BOOKING_PRICE",
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


    return sendError(
      res,
      500,
      "BOOKING_PRICE_QUOTE_FAILED",
      "The booking price could not be calculated. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   QUOTE ROOM(S) FOR EXISTING RESERVATION GROUP

   Read-only preview for Add Room.

   Important:
   - Existing reservation group/customer is reused.
   - Uses CURRENT hotel policy because the new room is booked now.
   - Existing Primary Guest allocation is respected.
   - Does NOT create booking / payment / guest / snapshot.
   - Does NOT lock room rows.
============================================================ */

exports.quoteReservationGroupRooms = async (
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


  const validation =
    validateBookingItems(
      req.body,
      {
        allowedStatuses:
          RESERVATION_EDIT_STATUSES,
      }
    );


  if (
    validation.error
  ) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_DETAILS",
      validation.error
    );
  }


  const items =
    validation.value;

  try {
    await reconcileOverdueReservationGroupForHotel(
      context.hotelId,
      reservationGroupId
    );
  } catch (error) {
    logBookingError(
      "RECONCILE_RESERVATION_GROUP_QUOTE",
      error
    );

    return sendError(
      res,
      500,
      "RESERVATION_GROUP_RECONCILE_FAILED",
      "The reservation lifecycle could not be refreshed before adding another room."
    );
  }

  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    /* ========================================================
       RESERVATION GROUP
    ======================================================== */

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
        `,
        [
          context.hotelId,
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


    /* ========================================================
       EXISTING GROUP BOOKINGS
    ======================================================== */

    const [existingBookings] =
      await connection.query(
        `
          SELECT
            booking_id,
            stay_type,
            booking_status

          FROM bookings

          WHERE hotel_id = ?
            AND reservation_group_id = ?

          ORDER BY booking_id ASC
        `,
        [
          context.hotelId,
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


    /* ========================================================
       ROOM PRICING DATA
    ======================================================== */

    const roomMap =
      await getRoomsForPricing(
        connection,
        context.hotelId,
        items
      );


    /* ========================================================
       EXISTING PRIMARY GUEST ALLOCATION
    ======================================================== */

    let guestContext =
      null;


    let primaryGuestCount =
      0;


    if (
      usesDetailedGuestRoster(
        items
      )
    ) {
      primaryGuestCount =
        await countGroupPrimaryGuestsWithConnection(
          connection,
          {
            hotelId:
              context.hotelId,

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
            hotelId:
              context.hotelId,

            customerId:
              Number(
                group.customer_id
              ),

            forUpdate:
              false,
          }
        );


      guestContext = {
        primaryMode:
          primaryGuestCount === 1
            ? "none"
            : "zero_or_one",

        primaryCustomer,
      };
    }


    /* ========================================================
       CURRENT POLICY PRICING
    ======================================================== */

    const pricingResult =
      await priceBookingItemsWithConnection(
        connection,
        {
          hotelId:
            context.hotelId,

          items,
          roomMap,
          guestContext,
        }
      );


    const quotes =
      pricingResult
        .prices
        .map(
          (
            pricing,
            index
          ) => {
            const item =
              items[index];


            const room =
              roomMap.get(
                item.roomId
              );


            return {
              room_id:
                item.roomId,

              room_number:
                room?.room_number,

              room_type:
                room?.room_type,

              stay_type:
                pricing.stayType,

              pricing_mode:
                pricing.pricingMode,

              check_in:
                item.checkIn,

              check_out:
                item.checkOut,

              nights:
                pricing.nights,

              duration_minutes:
                pricing.durationMinutes,

              rate_per_night:
                pricing.ratePerNight,

              room_charge:
                pricing.roomCharge,

              total_guests:
                pricing.totalGuests ??
                item.totalGuests,

              max_extra_beds:
                Number(
                  pricing.maxExtraBeds ??
                  room?.max_extra_beds ??
                  0
                ),

              extra_beds_used:
                pricing.extraBedsUsed ??
                null,

              child_charge_amount:
                Number(
                  pricing
                    .childChargeAmount ||
                  0
                ),

              extra_bed_charge_amount:
                Number(
                  pricing
                    .extraBedChargeAmount ||
                  0
                ),

              guest_charge_amount:
                Number(
                  pricing
                    .guestChargeAmount ||
                  0
                ),

              total_amount:
                pricing.totalAmount,

              matched_up_to_hours:
                pricing
                  .matchedUpToHours ??
                null,

              applied_value:
                pricing
                  .appliedValue ??
                null,

              exact_hours:
                pricing
                  .exactHours ??
                null,

              hourly_rate_type:
                pricing
                  .hourlyRateType ??
                null,

              hourly_rate_value:
                pricing
                  .hourlyRateValue ??
                null,

              maximum_charge_percent:
                pricing
                  .maximumChargePercent ??
                null,
            };
          }
        );


    const grandTotal =
      Number(
        quotes
          .reduce(
            (
              total,
              quote
            ) =>
              total +
              Number(
                quote.total_amount ||
                0
              ),
            0
          )
          .toFixed(2)
      );


    await connection
      .commit();


    return res
      .status(200)
      .json({
        success: true,

        data: {
          reservation_group_id:
            reservationGroupId,

          group_code:
            group.group_code,

          customer_id:
            Number(
              group.customer_id
            ),

          stay_type:
            groupStayType,

          room_count:
            quotes.length,

          total_amount:
            grandTotal,

          primary_guest_already_allocated:
            primaryGuestCount ===
            1,

          day_use_enabled:
            pricingResult
              .policySnapshot
              ?.day_use
              ?.enabled ===
            true,

          pricing_source:
            "current_hotel_policy",

          rooms:
            quotes,
        },
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "QUOTE_RESERVATION_GROUP_ROOMS",
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


    return sendError(
      res,
      500,
      "RESERVATION_GROUP_ROOM_QUOTE_FAILED",
      "The added room price could not be calculated. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   QUOTE EXISTING RESERVATION EDIT

   Read-only preview for normal pending / confirmed Edit.

   Important:
   - Does NOT update booking.
   - Does NOT update room history.
   - Does NOT create payment / adjustment.
   - Does NOT save another policy snapshot.
   - Excludes the current booking from overlap detection.
   - Uses the exact same edit-pricing resolver as final save.
============================================================ */

exports.quoteBookingEditPrice = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();

    const automaticClosure =
      await reconcileBookingBeforeAction(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
        }
      );


    if (automaticClosure) {
      await connection.commit();

      return sendError(
        res,
        409,
        automaticClosure.code,
        automaticClosure.message
      );
    }


    const [[existing]] =
      await connection.query(
        `
          SELECT
            booking_id,
            reservation_group_id,
            stay_type,
            customer_id,
            room_id,
            booked_rate_per_night,
            booking_status,
            total_amount

          FROM bookings

          WHERE hotel_id = ?
            AND booking_id = ?

          LIMIT 1
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    if (!existing) {
      throwHttp(
        404,
        "BOOKING_NOT_FOUND",
        "The booking was not found in your hotel."
      );
    }


    if (
      !RESERVATION_EDIT_STATUSES.has(
        existing.booking_status
      )
    ) {
      throwHttp(
        409,
        "BOOKING_LIFECYCLE_LOCKED",
        existing.booking_status ===
          "checked_in"
          ? "This guest is already checked in. Use operational stay actions instead of normal Edit."
          : "This booking is read-only and can no longer be modified through normal Edit."
      );
    }


    if (
      req.body.customer_id !==
        undefined &&
      Number(
        req.body.customer_id
      ) !==
        Number(
          existing.customer_id
        )
    ) {
      throwHttp(
        409,
        "BOOKING_CUSTOMER_CHANGE_BLOCKED",
        "A booking cannot be moved to another customer through normal Edit."
      );
    }


    if (
      req.body.stay_type !==
        undefined &&
      String(
        req.body.stay_type
      ).trim() !==
        existing.stay_type
    ) {
      throwHttp(
        409,
        "BOOKING_STAY_TYPE_CHANGE_BLOCKED",
        "The reservation type cannot be changed through normal Edit."
      );
    }


    const validation =
      validateBookingItems(
        {
          stay_type:
            existing.stay_type,

          room_id:
            req.body.room_id,

          check_in:
            req.body.check_in,

          check_out:
            req.body.check_out,

          total_guests:
            req.body.total_guests,

          primary_guest_staying:
            req.body
              .primary_guest_staying,

          guests:
            req.body.guests,

          booking_status:
            req.body.booking_status,

          special_request:
            req.body.special_request,
        },
        {
          allowedStatuses:
            RESERVATION_EDIT_STATUSES,
        }
      );


    if (
      validation.error
    ) {
      throwHttp(
        400,
        "INVALID_BOOKING_DETAILS",
        validation.error
      );
    }


    const [item] =
      validation.value;

    const guestContext =
      await resolveReservationEditGuestContext(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
          existing,
          item,
        }
      );

    const roomMap =
      await getRoomsForPricing(
        connection,
        context.hotelId,
        [item]
      );


    await ensureNoOverlap(
      connection,
      context.hotelId,
      [item],
      bookingId
    );


    const room =
      roomMap.get(
        item.roomId
      );


    const resolved =
      await resolveReservationEditPricing(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
          existing,
          item,
          room,
          guestContext,
        }
      );


    const pricing =
      resolved.pricing;


    const [[paymentSummary]] =
      await connection.query(
        `
          SELECT
            COALESCE(
              SUM(
                CASE

                  WHEN payment_status <>
                    'success'
                    THEN 0

                  WHEN transaction_type =
                    'refund'
                    THEN -amount

                  ELSE amount

                END
              ),
              0
            ) AS net_paid

          FROM payments

          WHERE hotel_id = ?
            AND booking_id = ?
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    const netPaid =
      Math.max(
        0,
        Number(
          paymentSummary
            ?.net_paid ||
          0
        )
      );


    const newTotal =
      Number(
        pricing.totalAmount
      );


    const oldTotal =
      Number(
        existing.total_amount ||
        0
      );


    const difference =
      Number(
        (
          newTotal -
          oldTotal
        ).toFixed(2)
      );


    const paymentConflict =
      netPaid >
      newTotal + 0.009;

    const requiredRefund =
      paymentConflict
        ? Number(
            (
              netPaid -
              newTotal
            ).toFixed(2)
          )
        : 0;

    await connection
      .commit();


    return res
      .status(200)
      .json({
        success: true,

        data: {
          booking_id:
            bookingId,

          room_id:
            item.roomId,

          room_number:
            room
              ?.room_number,

          room_type:
            room
              ?.room_type,

          stay_type:
            existing.stay_type,

          pricing_mode:
            pricing.pricingMode,

          pricing_source:
            resolved.policySource,

          rate_source:
            resolved.rateSource,

          policy_snapshot_id:
            resolved
              .policySnapshotId,

          room_changed:
            resolved.roomChanged,

          check_in:
            item.checkIn,

          check_out:
            item.checkOut,

          nights:
            pricing.nights,

          duration_minutes:
            pricing.durationMinutes,

          rate_per_night:
            pricing.ratePerNight,

          room_charge:
            pricing.roomCharge,

          total_guests:
            pricing.totalGuests ??
            item.totalGuests,

          max_extra_beds:
            Number(
              pricing.maxExtraBeds ??
              room?.max_extra_beds ??
              0
            ),

          extra_beds_used:
            pricing.extraBedsUsed ??
            null,

          child_charge_amount:
            Number(
              pricing
                .childChargeAmount ||
              0
            ),

          extra_bed_charge_amount:
            Number(
              pricing
                .extraBedChargeAmount ||
              0
            ),

          guest_charge_amount:
            Number(
              pricing
                .guestChargeAmount ||
              0
            ),

          total_amount:
            newTotal,

          previous_total_amount:
            oldTotal,

          difference_amount:
            difference,

          amount_paid:
            netPaid,

          outstanding_amount:
            Math.max(
              0,
              Number(
                (
                  newTotal -
                  netPaid
                ).toFixed(2)
              )
            ),

          payment_conflict:
            paymentConflict,

          refund_required:
            paymentConflict,

          refund_required_amount:
            requiredRefund,

          can_save:
            !paymentConflict,

          payment_message:
            paymentConflict
              ? `A refund of ₹${requiredRefund.toFixed(
                  2
                )} is required before the reduced reservation can be saved.`
              : null,

          matched_up_to_hours:
            pricing
              .matchedUpToHours ??
            null,

          applied_value:
            pricing
              .appliedValue ??
            null,

          exact_hours:
            pricing
              .exactHours ??
            null,

          hourly_rate_type:
            pricing
              .hourlyRateType ??
            null,

          hourly_rate_value:
            pricing
              .hourlyRateValue ??
            null,

          maximum_charge_percent:
            pricing
              .maximumChargePercent ??
            null,
        },
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "QUOTE_BOOKING_EDIT_PRICE",
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


    return sendError(
      res,
      500,
      "BOOKING_EDIT_PRICE_QUOTE_FAILED",
      "The updated reservation price could not be calculated. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   CREATE BOOKING
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

exports.updateBooking = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();

    const [[bookingLocator]] =
      await connection.query(
        `
          SELECT
            reservation_group_id

          FROM bookings

          WHERE hotel_id = ?
            AND booking_id = ?

          LIMIT 1
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    if (!bookingLocator) {
      throwHttp(
        404,
        "BOOKING_NOT_FOUND",
        "The booking was not found in your hotel."
      );
    }


    const detailedGuestEditRequested =
      req.body
        ?.primary_guest_staying !==
        undefined ||
      req.body?.guests !==
        undefined;


    if (
      detailedGuestEditRequested
    ) {
      const [[lockedGroup]] =
        await connection.query(
          `
            SELECT
              reservation_group_id

            FROM reservation_groups

            WHERE hotel_id = ?
              AND reservation_group_id = ?

            LIMIT 1

            FOR UPDATE
          `,
          [
            context.hotelId,
            
            bookingLocator
              .reservation_group_id,
          ]
        );


      if (!lockedGroup) {
        throwHttp(
          409,
          "RESERVATION_GROUP_NOT_FOUND",
          "The reservation group could not be locked for guest allocation."
        );
      }
    }

    const automaticClosure =
      await reconcileBookingBeforeAction(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
        }
      );


    if (automaticClosure) {
      await connection.commit();

      return sendError(
        res,
        409,
        automaticClosure.code,
        automaticClosure.message
      );
    }

    const [[existing]] =
      await connection.query(
        `
          SELECT
            booking_id,
            reservation_group_id,
            source_request_id,
            stay_type,
            customer_id,
            room_id,
            booked_rate_per_night,
            check_in,
            check_out,
            booking_status,
            total_amount

          FROM bookings

          WHERE hotel_id = ?
            AND booking_id = ?

          FOR UPDATE
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    if (!existing) {
      throwHttp(
        404,
        "BOOKING_NOT_FOUND",
        "The booking was not found in your hotel."
      );
    }


    if (
      !RESERVATION_EDIT_STATUSES.has(
        existing.booking_status
      )
    ) {
      throwHttp(
        409,
        "BOOKING_LIFECYCLE_LOCKED",
        existing.booking_status ===
          "checked_in"
          ? "This guest is already checked in. Use Change Room, Extend Stay, or Checkout instead of normal Edit."
          : "This booking is read-only and can no longer be modified through normal Edit."
      );
    }

    /*
     * Booking edit must never switch customer identity.
     */
    if (
      req.body.customer_id !==
        undefined &&
      Number(
        req.body.customer_id
      ) !==
        Number(
          existing.customer_id
        )
    ) {
      throwHttp(
        409,
        "BOOKING_CUSTOMER_CHANGE_BLOCKED",
        "A booking cannot be moved to another customer through normal Edit."
      );
    }

    /*
    * Normal reservation edit may change room/time/guest count,
    * but it must not convert the booking product itself.
    *
    * Overnight → Day Use
    * Day Use   → Overnight
    *
    * will use dedicated workflows later.
    */
    if (
      req.body.stay_type !==
        undefined &&
      String(
        req.body.stay_type
      ).trim() !==
        existing.stay_type
    ) {
      throwHttp(
        409,
        "BOOKING_STAY_TYPE_CHANGE_BLOCKED",
        "The reservation type cannot be changed through normal Edit."
      );
    }

    const validation =
      validateBookingItems(
        {
          stay_type:
            existing.stay_type,

          room_id:
            req.body.room_id,

          check_in:
            req.body.check_in,

          check_out:
            req.body.check_out,

          total_guests:
            req.body.total_guests,

          primary_guest_staying:
            req.body
              .primary_guest_staying,

          guests:
            req.body.guests,

          booking_status:
            req.body.booking_status,

          special_request:
            req.body.special_request,
        },
        {
          allowedStatuses:
            RESERVATION_EDIT_STATUSES,
        }
      );


    if (
      validation.error
    ) {
      throwHttp(
        400,
        "INVALID_BOOKING_DETAILS",
        validation.error
      );
    }


    const [item] =
      validation.value;

    const guestContext =
      await resolveReservationEditGuestContext(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
          existing,
          item,
        }
      );

    const roomMap =
      await lockRooms(
        connection,
        context.hotelId,
        [item]
      );


    await ensureNoOverlap(
      connection,
      context.hotelId,
      [item],
      bookingId
    );

    const room =
      roomMap.get(
        item.roomId
      );

    const resolvedPricing =
      await resolveReservationEditPricing(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
          existing,
          item,
          room,
          guestContext,
        }
      );


    const pricing =
      resolvedPricing
        .pricing;


    const ratePerNight =
      Number(
        pricing.ratePerNight
      );


    const nights =
      Number(
        pricing.nights ||
        0
      );


    const durationMinutes =
      Number(
        pricing.durationMinutes ||
        item.durationMinutes ||
        0
      );


    const pricingMode =
      pricing.pricingMode;


    const newTotalAmount =
      Number(
        pricing.totalAmount
      );
    
    const authoritativeTotalGuests =
      Number(
        pricing.totalGuests ??
        item.totalGuests
      );

    const paymentState =
      await getLockedPaymentState(
        connection,
        context.hotelId,
        bookingId,
        newTotalAmount
      );


    /*
    * If the edited reservation becomes cheaper than the
    * amount already paid, refund the exact overpayment
    * inside THIS SAME database transaction.
    *
    * Client never controls the refund amount.
    */
    const refundRequired =
      paymentState.netPaid >
      newTotalAmount + 0.009;


    let refundResult =
      null;


    let finalPaymentState =
      paymentState;


    if (
      refundRequired
    ) {
      const refundDetails =
        req.body?.refund;


      if (
        !refundDetails ||
        typeof refundDetails !==
          "object" ||
        Array.isArray(
          refundDetails
        )
      ) {
        throwHttp(
          400,
          "REFUND_DETAILS_REQUIRED",
          "Refund details are required before this reduced reservation can be saved."
        );
      }


      refundResult =
        await refundBookingOverpaymentService(
          connection,
          {
            hotelId:
              context.hotelId,

            adminId:
              context.adminId,

            bookingId,

            newTotalAmount,

            method:
              refundDetails
                .payment_method,

            transactionId:
              refundDetails
                .transaction_id,

            notes:
              refundDetails
                .notes,
          }
        );


      /*
      * Re-read locked ledger after refund.
      */
      finalPaymentState =
        await getLockedPaymentState(
          connection,
          context.hotelId,
          bookingId,
          newTotalAmount
        );


      if (
        finalPaymentState.netPaid >
        newTotalAmount + 0.009
      ) {
        throwHttp(
          500,
          "REFUND_RECONCILIATION_FAILED",
          "The refund could not be reconciled with the updated reservation total."
        );
      }
    }


    await connection.query(
      `
        UPDATE bookings

        SET
          room_id = ?,
          booked_rate_per_night = ?,
          updated_by_admin_id = ?,
          check_in = ?,
          check_out = ?,
          total_guests = ?,

          guest_roster_captured =
            CASE
              WHEN ? = 1
                THEN 1
              ELSE guest_roster_captured
            END,

          booking_status = ?,
          payment_status = ?,
          total_amount = ?,
          special_request = ?

        WHERE hotel_id = ?
          AND booking_id = ?
      `,
      [
        item.roomId,
        ratePerNight,
        context.adminId,
        item.checkIn,
        item.checkOut,
        authoritativeTotalGuests,

        pricing
          .guestRosterProvided ===
        true
          ? 1
          : 0,

        item.bookingStatus,
        finalPaymentState.paymentStatus,
        newTotalAmount,
        item.specialRequest,
        context.hotelId,
        bookingId,
      ]
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
        await replaceBookingGuestsWithConnection(
          connection,
          {
            hotelId:
              context.hotelId,

            bookingId,

            customerId:
              Number(
                existing.customer_id
              ),

            adminId:
              context.adminId,

            guests:
              rosterGuests,
          }
        );
    }

    /*
     * Before check-in this is still the initial reservation,
     * so update initial history instead of creating fake
     * room-change history.
     */
    const [[initialHistory]] =
      await connection.query(
        `
          SELECT
            room_history_id

          FROM booking_room_history

          WHERE hotel_id = ?
            AND booking_id = ?
            AND change_reason =
              'initial_booking'

          ORDER BY
            room_history_id ASC

          LIMIT 1

          FOR UPDATE
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    if (
      initialHistory
    ) {
      await connection.query(
        `
          UPDATE booking_room_history

          SET
            room_id = ?,
            assignment_start = ?,
            assignment_end = ?,
            assignment_status =
              'planned',
            rate_per_night = ?,
            changed_by_admin_id = ?

          WHERE hotel_id = ?
            AND room_history_id = ?
        `,
        [
          item.roomId,
          item.checkIn,
          item.checkOut,
          ratePerNight,
          context.adminId,
          context.hotelId,
          initialHistory
            .room_history_id,
        ]
      );
    } else {
      await createInitialRoomHistory(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,

          roomId:
            item.roomId,

          checkIn:
            item.checkIn,

          checkOut:
            item.checkOut,

          ratePerNight,

          adminId:
            context.adminId,
        }
      );
    }


    await syncSourceRequestRoom(
      connection,
      {
        hotelId:
          context.hotelId,

        sourceRequestId:
          existing.source_request_id,

        roomId:
          item.roomId,

        adminId:
          context.adminId,
      }
    );


    await connection.commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Reservation updated successfully.",

        data: {
          booking_id:
            bookingId,

          room_id:
            item.roomId,

          stay_type:
            existing.stay_type,

          check_in:
            item.checkIn,

          check_out:
            item.checkOut,

          pricing_mode:
            pricingMode,

          duration_minutes:
            durationMinutes,

          booked_rate_per_night:
            ratePerNight,

          nights,

          total_guests:
            authoritativeTotalGuests,

          max_extra_beds:
            Number(
              pricing.maxExtraBeds ??
              room?.max_extra_beds ??
              0
            ),

          extra_beds_used:
            pricing.extraBedsUsed ??
            null,

          room_charge:
            Number(
              pricing.roomCharge ||
              0
            ),

          child_charge_amount:
            Number(
              pricing
                .childChargeAmount ||
              0
            ),

          extra_bed_charge_amount:
            Number(
              pricing
                .extraBedChargeAmount ||
              0
            ),

          guest_charge_amount:
            Number(
              pricing
                .guestChargeAmount ||
              0
            ),

          guest_roster_saved:
            Number(
              guestSaveResult
                ?.guestCount ||
              0
            ) > 0,

          booking_guest_ids:
            guestSaveResult
              ?.bookingGuestIds ||
            [],

          total_amount:
            newTotalAmount,

          payment_status:
            finalPaymentState
              .paymentStatus,

          amount_paid:
            Math.max(
              0,
              finalPaymentState
                .netPaid
            ),

          outstanding_amount:
            Math.max(
              0,
              Number(
                finalPaymentState
                  .outstandingAmount ||
                0
              )
            ),

          refund:
            refundResult
              ? {
                  payment_id:
                    refundResult
                      .refundPaymentId,

                  amount:
                    refundResult
                      .refundAmount,

                  payment_method:
                    refundResult
                      .refundMethod,

                  transaction_id:
                    refundResult
                      .transactionId,
                }
              : null,
        },
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "UPDATE_BOOKING",
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
        "DUPLICATE_REFUND_TRANSACTION_REFERENCE",
        "This refund transaction reference has already been used."
      );
    }
    
    return sendError(
      res,
      500,
      "BOOKING_UPDATE_FAILED",
      "The reservation could not be updated. Please try again."
    );
  } finally {
    connection.release();
  }
};


/* ============================================================
   CHECK IN BOOKING

   Dedicated operational lifecycle action.

   confirmed
      ↓
   checked_in

   Transaction effects are handled by
   bookingLifecycleService.
============================================================ */

exports.checkInBooking = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();

    const automaticClosure =
      await reconcileBookingBeforeAction(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
        }
      );


    if (automaticClosure) {
      await connection.commit();

      return sendError(
        res,
        409,
        automaticClosure.code,
        automaticClosure.message
      );
    }


    const result =
      await checkInBookingLifecycle(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,
        }
      );


    await connection.commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Guest checked in successfully.",

        data: result,
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "CHECK_IN_BOOKING",
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


    return sendError(
      res,
      500,
      "BOOKING_CHECK_IN_FAILED",
      "The guest could not be checked in. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   CHECK IN INDIVIDUAL GUEST

   Supports:
   - New arriving guest
   - Existing expected guest
   - First guest activates the room booking
   - Later guests may check into the same occupied room
============================================================ */

exports.checkInBookingGuest = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();

    const automaticClosure =
      await reconcileBookingBeforeAction(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
        }
      );


    if (automaticClosure) {
      await connection.commit();

      return sendError(
        res,
        409,
        automaticClosure.code,
        automaticClosure.message
      );
    }


    const result =
      await checkInBookingGuestLifecycle(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          /*
           * Existing expected guest:
           * send booking_guest_id.
           *
           * New arriving guest:
           * leave booking_guest_id empty
           * and send guest_role + guest.
           */
          bookingGuestId:
            req.body
              ?.booking_guest_id,

          guestRole:
            req.body
              ?.guest_role,

          guest:
            req.body
              ?.guest,
        }
      );


    await connection
      .commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          result.roomActivated
            ? "Guest checked in and room stay activated successfully."
            : "Guest checked in successfully.",

        data: {
          booking_id:
            result.bookingId,

          booking_code:
            result.bookingCode,

          room_id:
            result.roomId,

          room_number:
            result.roomNumber,

          room_type:
            result.roomType,

          room_activated:
            result.roomActivated,

          existing_guest:
            result.existingGuest,

          booking_guest_id:
            result.bookingGuestId,

          guest_role:
            result.guestRole,

          guest_type:
            result.guestType,

          full_name:
            result.fullName,

          guest_status:
            result.guestStatus,

          actual_guest_check_in:
            result.actualGuestCheckIn,

          total_guests:
            result.totalGuests,

          child_charge_amount:
            result.childChargeAmount,

          extra_bed_charge_amount:
            result.extraBedChargeAmount,

          added_guest_charge:
            result.addedGuestCharge,

          previous_total_amount:
            result.previousTotalAmount ??
            result.totalAmount,

          total_amount:
            result.totalAmount,

          amount_paid:
            result.amountPaid,

          outstanding_amount:
            result.outstandingAmount,

          payment_status:
            result.paymentStatus,

          booking_status:
            result.bookingStatus,

          room_status:
            result.roomStatus,

          policy_snapshot_id:
            result.policySnapshotId ??
            null,
        },
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "CHECK_IN_BOOKING_GUEST",
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
        "GUEST_CHECK_IN_CONFLICT",
        "This guest allocation conflicts with an existing reservation guest record."
      );
    }


    return sendError(
      res,
      500,
      "BOOKING_GUEST_CHECK_IN_FAILED",
      "The guest could not be checked in. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   CHECK OUT INDIVIDUAL GUEST

   Guest lifecycle only:

   checked_in
      ↓
   checked_out

   Important:
   - Booking remains checked_in.
   - Room remains occupied.
   - Financial settlement is NOT required for one guest leaving.
   - Formal room checkout remains a separate action.
============================================================ */

exports.checkoutBookingGuest = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  const bookingGuestId =
    parsePositiveInteger(
      req.params.guestId
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  if (!bookingGuestId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_GUEST_ID",
      "The booking guest ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const result =
      await checkoutBookingGuestLifecycle(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          bookingGuestId,
        }
      );


    await connection
      .commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Guest checked out successfully.",

        data: {
          booking_id:
            result.bookingId,

          booking_code:
            result.bookingCode,

          room_id:
            result.roomId,

          room_number:
            result.roomNumber,

          room_type:
            result.roomType,

          booking_guest_id:
            result.bookingGuestId,

          guest_role:
            result.guestRole,

          guest_type:
            result.guestType,

          full_name:
            result.fullName,

          guest_status:
            result.guestStatus,

          actual_guest_check_out:
            result.actualGuestCheckOut,

          checked_in_guests_remaining:
            result.checkedInGuestsRemaining,

          expected_guests_remaining:
            result.expectedGuestsRemaining,

          total_guests:
            result.totalGuests,

          booking_status:
            result.bookingStatus,

          room_status:
            result.roomStatus,
        },
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "CHECKOUT_BOOKING_GUEST",
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


    return sendError(
      res,
      500,
      "BOOKING_GUEST_CHECKOUT_FAILED",
      "The guest could not be checked out. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   EXTEND STAY

   Dedicated checked-in lifecycle action.

   checked_in
      ↓
   checked_in with later expected checkout

   Financial and room-history changes are handled by
   bookingLifecycleService.
============================================================ */

exports.extendStayBooking = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const result =
      await extendStayBookingLifecycle(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          newCheckOut:
            req.body
              ?.new_check_out,

          reason:
            req.body
              ?.reason,
        }
      );


    await connection.commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Stay extended successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "EXTEND_STAY",
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


    return sendError(
      res,
      500,
      "STAY_EXTENSION_FAILED",
      "The stay could not be extended. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   COLLECT RESERVATION GROUP PAYMENT

   One customer receipt may be allocated across one or more
   child room bookings.

   Financial source of truth remains:
   reservation_group_payments -> receipt
   payments                   -> booking ledger

   All allocations run inside ONE transaction.
============================================================ */

exports.collectReservationGroupPayment = async (
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
      await collectReservationGroupPaymentService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          reservationGroupId,

          amount:
            req.body?.amount,

          method:
            req.body?.payment_method,

          transactionId:
            req.body?.transaction_id,

          notes:
            req.body?.notes,

          bookingIds:
            req.body?.booking_ids,
        }
      );


    await connection
      .commit();


    return res
      .status(201)
      .json({
        success: true,

        message:
          "Reservation group payment collected successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "COLLECT_GROUP_PAYMENT",
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
      "GROUP_PAYMENT_COLLECTION_FAILED",
      "The reservation group payment could not be recorded. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   COLLECT BOOKING PAYMENT

   Financial source of truth:
   payments table.

   Allowed:
   confirmed
   checked_in
   no_show — only against a finalized No Show settlement
============================================================ */

exports.collectBookingPayment = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();

    const automaticClosure =
      await reconcileBookingBeforeAction(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
        }
      );


    if (automaticClosure) {
      await connection.commit();

      return sendError(
        res,
        409,
        automaticClosure.code,
        automaticClosure.message
      );
    }


    const result =
      await collectBookingPaymentService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          amount:
            req.body?.amount,

          method:
            req.body?.payment_method,

          stage:
            req.body?.payment_stage,

          transactionId:
            req.body?.transaction_id,

          notes:
            req.body?.notes,
        }
      );


    await connection.commit();


    return res
      .status(201)
      .json({
        success: true,

        message:
          "Payment collected successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "COLLECT_PAYMENT",
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
        "This transaction reference has already been used."
      );
    }


    return sendError(
      res,
      500,
      "PAYMENT_COLLECTION_FAILED",
      "The payment could not be recorded. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   REFUND NO-SHOW OVERPAYMENT

   Backend calculates the exact refundable amount.
   Client only chooses refund method/reference/notes.
============================================================ */

exports.refundNoShowOverpayment = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);

  const bookingId =
    parsePositiveInteger(
      req.params.id
    );

  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }

  const connection =
    await db.getConnection();

  try {
    await connection.beginTransaction();

    const result =
      await refundNoShowOverpaymentService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          method:
            req.body?.refund_method,

          transactionId:
            req.body?.transaction_id,

          notes:
            req.body?.notes,
        }
      );

    await connection.commit();

    return res
      .status(201)
      .json({
        success: true,

        message:
          "No Show refund processed successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection.rollback();

    logBookingError(
      "REFUND_NO_SHOW_OVERPAYMENT",
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
        "This refund transaction reference has already been used."
      );
    }

    return sendError(
      res,
      500,
      "NO_SHOW_REFUND_FAILED",
      "The No Show refund could not be processed. Please try again."
    );
  } finally {
    connection.release();
  }
};


/* ============================================================
   CHECKOUT RESERVATION GROUP

   booking_ids omitted / empty:
   → checkout every currently checked-in room in the group

   booking_ids supplied:
   → checkout exactly those selected checked-in rooms

   One transaction:
   any child checkout failure rolls back the complete operation.
============================================================ */

exports.checkoutReservationGroup = async (
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
      await checkoutReservationGroupService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          groupId:
            reservationGroupId,

          bookingIds:
            req.body?.booking_ids,
        }
      );


    await connection
      .commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          result.scope ===
          "selected"
            ? "Selected rooms checked out successfully."
            : "Reservation group checked out successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "CHECKOUT_RESERVATION_GROUP",
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


    return sendError(
      res,
      500,
      "GROUP_CHECKOUT_FAILED",
      "The reservation group could not be checked out. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   CHECKOUT BOOKING

   Dedicated operational lifecycle action.

   checked_in
      ↓
   checked_out

   Checkout is blocked while payment is outstanding.
============================================================ */

exports.checkoutBooking = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const result =
      await checkoutBookingLifecycle(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,
        }
      );


    await connection.commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Guest checked out successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "CHECKOUT_BOOKING",
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


    return sendError(
      res,
      500,
      "BOOKING_CHECKOUT_FAILED",
      "The guest could not be checked out. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   CANCEL BOOKING

   Pre-arrival only:
   pending / confirmed → cancelled

   Business logic lives in bookingCancellationService.
============================================================ */

exports.cancelBooking = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    /*
     * Prevent stale confirmed reservations from being
     * cancelled after they have already crossed into
     * No Show / Expired lifecycle.
     */
    const automaticClosure =
      await reconcileBookingBeforeAction(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
        }
      );


    if (automaticClosure) {
      await connection
        .commit();


      return sendError(
        res,
        409,
        automaticClosure.code,
        automaticClosure.message
      );
    }


    const result =
      await cancelBookingService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          cancellationSource:
            req.body
              ?.cancellation_source,

          cancellationReason:
            req.body
              ?.cancellation_reason,
        }
      );


    await connection
      .commit();


    let message =
      "Booking cancelled successfully.";


    if (
      result
        .financialReviewRequired
    ) {
      message =
        "Booking cancelled. The cancellation financial settlement requires review.";
    } else if (
      result
        .refundReviewRequired
    ) {
      message =
        "Booking cancelled. A refund is due based on the cancellation settlement.";
    } else if (
      Number(
        result
          .outstandingAmount ||
        0
      ) > 0.009
    ) {
      message =
        "Booking cancelled. A cancellation charge remains outstanding.";
    }


    return res
      .status(200)
      .json({
        success: true,
        message,

        data: {
          booking_id:
            result.bookingId,

          booking_code:
            result.bookingCode,

          booking_status:
            result.bookingStatus,

          cancellation_source:
            result
              .cancellationSource,

          cancellation_reason:
            result
              .cancellationReason,

          cancelled_at:
            result.cancelledAt,

          cancelled_by_admin_id:
            result
              .cancelledByAdminId,

          original_total_amount:
            result
              .originalTotalAmount,

          settlement_id:
            result.settlementId,

          settlement_status:
            result
              .settlementStatus,

          final_payable_amount:
            result
              .finalPayableAmount,

          financial_review_required:
            result
              .financialReviewRequired,

          gross_paid:
            result.grossPaid,

          refunded_amount:
            result
              .refundedAmount,

          net_paid:
            result.netPaid,

          outstanding_amount:
            result
              .outstandingAmount,

          overpaid_amount:
            result
              .overpaidAmount,

          refund_review_required:
            result
              .refundReviewRequired,

          payment_status:
            result.paymentStatus,
        },
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "CANCEL_BOOKING",
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


    return sendError(
      res,
      500,
      "BOOKING_CANCEL_FAILED",
      "The booking could not be cancelled. Please try again."
    );
  } finally {
    connection.release();
  }
};


/* ============================================================
   DELETE BOOKING

   Hard delete only for a clean pending draft.

   History-bearing booking must be preserved.
============================================================ */

exports.deleteBooking = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();

    const automaticClosure =
      await reconcileBookingBeforeAction(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
        }
      );


    if (automaticClosure) {
      await connection.commit();

      return sendError(
        res,
        409,
        automaticClosure.code,
        automaticClosure.message
      );
    }


    const [[booking]] =
      await connection.query(
        `
          SELECT
            booking_id,
            booking_status,
            source_request_id

          FROM bookings

          WHERE hotel_id = ?
            AND booking_id = ?

          FOR UPDATE
        `,
        [
          context.hotelId,
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


    const [[paymentSummary]] =
      await connection.query(
        `
          SELECT
            COUNT(*) AS paymentCount

          FROM payments

          WHERE hotel_id = ?
            AND booking_id = ?
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    const [[adjustmentSummary]] =
      await connection.query(
        `
          SELECT
            COUNT(*) AS adjustmentCount

          FROM booking_adjustments

          WHERE hotel_id = ?
            AND booking_id = ?
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    if (
      booking.booking_status !==
        "pending" ||
      booking.source_request_id !==
        null ||
      Number(
        paymentSummary
          .paymentCount ||
        0
      ) > 0 ||
      Number(
        adjustmentSummary
          .adjustmentCount ||
        0
      ) > 0
    ) {
      throwHttp(
        409,
        "BOOKING_HISTORY_MUST_BE_PRESERVED",
        "This booking contains operational or financial history and cannot be deleted. Cancel it instead."
      );
    }


    /*
     * booking_room_history is ON DELETE CASCADE,
     * therefore draft room history is removed safely.
     */
    await connection.query(
      `
        DELETE FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?
      `,
      [
        context.hotelId,
        bookingId,
      ]
    );


    await connection.commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Pending booking deleted successfully.",
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "DELETE_BOOKING",
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
        "ER_ROW_IS_REFERENCED_2" ||
      error?.code ===
        "ER_ROW_IS_REFERENCED"
    ) {
      return sendError(
        res,
        409,
        "BOOKING_IN_USE",
        "This booking is linked to hotel records and cannot be deleted."
      );
    }


    return sendError(
      res,
      500,
      "BOOKING_DELETE_FAILED",
      "The booking could not be deleted. Please try again."
    );
  } finally {
    connection.release();
  }
};