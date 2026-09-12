const db =
  require("../../config/db").promisePool;

const {
  RESERVATION_EDIT_STATUSES,
  parsePositiveInteger,
  validateBookingItems,
} = require(
  "../../services/bookingValidation"
);

const {
  calculateOvernightPrice,
  priceBookingItemsFromSnapshotWithConnection,
} = require(
  "../../services/bookingPricingService"
);

const {
  lockRooms,
  getRoomsForPricing,
  ensureNoOverlap,
  createInitialRoomHistory,
} = require(
  "../../services/bookingRoomService"
);

const {
  getLockedPaymentState,

  refundBookingOverpayment:
    refundBookingOverpaymentService,
} = require(
  "../../services/bookingPaymentService"
);

const {
  loadPrimaryCustomerWithConnection,
  replaceBookingGuestsWithConnection,
  getBookingGuestsWithConnection,
  countGroupPrimaryGuestsWithConnection,
} = require(
  "../../services/bookingGuestService"
);

const {
  syncSourceRequestRoom,
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

/* ============================================================
   CHANGE ROOM DURING ACTIVE STAY

   Dedicated post-check-in workflow.
   Normal reservation Edit remains pending / confirmed only.
============================================================ */

/* ============================================================
   START TEMPORARY ROOM CHANGE

   Checked-in stay only.
   Creates explicit temporary adjustment state.
============================================================ */

/* ============================================================
   MARK ORIGINAL ROOM READY

   Temporary room change remains unresolved.
   Current booking stays in replacement room until resolution.
============================================================ */

/* ============================================================
   RETURN TO ORIGINAL ROOM

   Resolves an awaiting temporary room change by moving the
   checked-in booking back to its reserved original room.
============================================================ */
