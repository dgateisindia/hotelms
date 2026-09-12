const db =
  require("../../config/db").promisePool;

const {
  parsePositiveInteger,
} = require(
  "../../services/bookingValidation"
);

const {
  getBookingPolicySnapshotWithConnection,
} = require(
  "../../services/hotelSettingsService"
);

const {
  getBookingGuestsWithConnection,
  getReservationGroupGuestsWithConnection,
} = require(
  "../../services/bookingGuestService"
);

const {
  reconcileOverdueBookingsForHotel,
  reconcileOverdueBookingForHotel,
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

function serializeBookingGuestStay(
  stay
) {
  if (!stay) {
    return null;
  }

  return {
    guest_stay_id:
      stay.guestStayId,

    stay_sequence:
      stay.staySequence,

    check_in_at:
      stay.checkInAt ||
      null,

    check_out_at:
      stay.checkOutAt ||
      null,

    checked_in_by_admin_id:
      stay.checkedInByAdminId ??
      null,

    checked_out_by_admin_id:
      stay.checkedOutByAdminId ??
      null,

    entry_type:
      stay.entryType ||
      null,

    record_source:
      stay.recordSource ||
      null,

    reentry_reason:
      stay.reentryReason ||
      null,

    created_at:
      stay.createdAt ||
      null,

    updated_at:
      stay.updatedAt ||
      null,
  };
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

    
    /* ========================================================
       IMMUTABLE GUEST STAY SESSIONS
    ======================================================== */

    stay_count:
      Number(
        guest.stayCount ||
        0
      ),

    current_stay:
      serializeBookingGuestStay(
        guest.currentStay
      ),

    latest_stay:
      serializeBookingGuestStay(
        guest.latestStay
      ),

    stay_history:
      Array.isArray(
        guest.stayHistory
      )
        ? guest.stayHistory
            .map(
              serializeBookingGuestStay
            )
            .filter(
              Boolean
            )
        : [],

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

            DATE_FORMAT(b.check_in,'%Y-%m-%d') AS check_in,
            DATE_FORMAT(b.check_out,'%Y-%m-%d') AS check_out,
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

            DATE_FORMAT(b.check_in,'%Y-%m-%d') AS check_in,
            DATE_FORMAT(b.check_out,'%Y-%m-%d') AS check_out,
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
