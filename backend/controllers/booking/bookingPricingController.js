const db =
  require("../../config/db").promisePool;

const {
  RESERVATION_EDIT_STATUSES,
  parsePositiveInteger,
  validateCustomer,
  validateBookingItems,
} = require(
  "../../services/bookingValidation"
);

const {
  priceBookingItemsWithConnection,
} = require(
  "../../services/bookingPricingService"
);

const {
  getRoomsForPricing,
} = require(
  "../../services/bookingRoomService"
);

const {
  loadPrimaryCustomerWithConnection,
  countGroupPrimaryGuestsWithConnection,
} = require(
  "../../services/bookingGuestService"
);

const {
  reconcileOverdueReservationGroupForHotel,
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
