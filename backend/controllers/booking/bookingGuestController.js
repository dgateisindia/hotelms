const db =
  require("../../config/db").promisePool;

const {
  parsePositiveInteger,
} = require(
  "../../services/bookingValidation"
);

const {
  checkInBookingGuest:
    checkInBookingGuestLifecycle,

  checkoutBookingGuest:
    checkoutBookingGuestLifecycle,
} = require(
  "../../services/bookingGuestLifecycleService"
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

