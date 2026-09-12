/* ============================================================
   BOOKING STATUS SERVICE

   Purpose:
   Keep reservation lifecycle status aligned with time.

   Automatic transitions:

   confirmed
    + never checked in
    + booking-time No-Show threshold passed
    → no_show

    confirmed legacy / disabled No-Show handling
    + never checked in
    + complete stay window passed
    → no_show

    pending
    + never activated
    + checkout time passed
    → expired

   Important:
   - checked_in / checked_out / cancelled are never touched.
   - Payment status is never changed here.
   - Room physical status is never changed here.
   - Planned room-history rows are closed as cancelled.
   - Guest rows are preserved for historical visibility.
============================================================ */

const db =
  require("../config/db")
    .promisePool;

const {
  ensureNoShowSettlementWithConnection,
} = require(
  "./bookingFinancialSettlementService"
); 

/* ============================================================
   HELPERS
============================================================ */

function normalizePositiveInteger(
  value
) {
  const number =
    Number(value);

  return (
    Number.isSafeInteger(
      number
    ) &&
    number > 0
  )
    ? number
    : null;
}

async function backfillMissingNoShowSettlementsWithConnection(
  connection,
  {
    hotelId,
    bookingId = null,
    reservationGroupId = null,
  }
) {
  let scopeFilter = "";

  const params = [
    hotelId,
  ];


  if (bookingId) {
    scopeFilter =
      "AND b.booking_id = ?";

    params.push(
      bookingId
    );
  } else if (
    reservationGroupId
  ) {
    scopeFilter =
      "AND b.reservation_group_id = ?";

    params.push(
      reservationGroupId
    );
  }


  const [rows] =
    await connection.query(
      `
        SELECT
          b.booking_id

        FROM bookings b

        WHERE b.hotel_id = ?

          ${scopeFilter}

          AND b.booking_status =
            'no_show'

          AND NOT EXISTS (
            SELECT 1

            FROM booking_financial_settlements bfs

            WHERE bfs.hotel_id =
                  b.hotel_id

              AND bfs.booking_id =
                  b.booking_id

              AND bfs.settlement_type =
                  'no_show'
          )

        ORDER BY
          b.booking_id

        FOR UPDATE
      `,
      params
    );


  const createdBookingIds =
    [];


  for (
    const row of rows
  ) {
    const targetBookingId =
      Number(
        row.booking_id
      );


    const result =
      await ensureNoShowSettlementWithConnection(
        connection,
        {
          hotelId,
          bookingId:
            targetBookingId,
        }
      );


    if (result.created) {
      createdBookingIds.push(
        targetBookingId
      );
    }
  }


  return {
    createdCount:
      createdBookingIds.length,

    bookingIds:
      createdBookingIds,
  };
}


/* ============================================================
   RECONCILE WITH EXISTING CONNECTION

   Caller may already own a transaction.

  * Scope:
  *
  * bookingId
  *   -> reconcile one booking
  *
  * reservationGroupId
  *   -> reconcile only child bookings in one reservation group
  *
  * neither
  *   -> reconcile whole hotel
  *
  * bookingId and reservationGroupId cannot be supplied together.
============================================================ */

async function reconcileOverdueBookingsWithConnection(
  connection,
  {
    hotelId,
    bookingId = null,
    reservationGroupId = null,
  }
) {
  const safeHotelId =
    normalizePositiveInteger(
      hotelId
    );

  if (!safeHotelId) {
    throw new Error(
      "A valid hotelId is required to reconcile booking statuses."
    );
  }


  const safeBookingId =
    bookingId === null ||
    bookingId === undefined
      ? null
      : normalizePositiveInteger(
          bookingId
        );

  const safeReservationGroupId =
    reservationGroupId === null ||
    reservationGroupId === undefined
      ? null
      : normalizePositiveInteger(
          reservationGroupId
        );


  if (
    reservationGroupId !== null &&
    reservationGroupId !== undefined &&
    !safeReservationGroupId
  ) {
    throw new Error(
      "A valid reservationGroupId is required to reconcile this reservation group."
    );
  }


  if (
    safeBookingId &&
    safeReservationGroupId
  ) {
    throw new Error(
      "Reconcile by bookingId or reservationGroupId, not both."
    );
  }


  if (
    bookingId !== null &&
    bookingId !== undefined &&
    !safeBookingId
  ) {
    throw new Error(
      "A valid bookingId is required to reconcile this booking."
    );
  }


  let bookingFilter = "";

  const params = [
    safeHotelId,
  ];


  if (safeBookingId) {
    bookingFilter =
      "AND b.booking_id = ?";

    params.push(
      safeBookingId
    );
  } else if (
    safeReservationGroupId
  ) {
    bookingFilter =
      "AND b.reservation_group_id = ?";

    params.push(
      safeReservationGroupId
    );
  }


  /*
   * Lock only bookings that are candidates for automatic closure.
   *
   * Defensive guest check:
   * a booking must never become no_show / expired if a guest
   * somehow already has an active checked-in row.
   */
  const [candidates] =
    await connection.query(
      `
        SELECT
          b.booking_id,
          b.booking_status,
          b.check_in,
          b.check_out,
          b.actual_check_in,
          b.actual_check_out

        FROM bookings b

        LEFT JOIN booking_policy_snapshots bps
          ON bps.hotel_id =
            b.hotel_id

        AND bps.booking_id =
            b.booking_id

        WHERE b.hotel_id = ?

          ${bookingFilter}

          AND b.booking_status IN (
            'pending',
            'confirmed'
          )

          AND b.actual_check_in IS NULL
          AND b.actual_check_out IS NULL

          AND (
            (
              b.booking_status =
                'pending'

              AND b.check_out <= NOW()
            )

            OR

            (
              b.booking_status =
                'confirmed'

              AND (
                /*
                * Final safety fallback:
                * a confirmed reservation can never remain open
                * after its complete reserved stay window has passed.
                */
                b.check_out <= NOW()

                OR

                (
                  /*
                  * Booking-time immutable No-Show policy.
                  *
                  * Do NOT use today's hotel settings.
                  */
                  JSON_VALID(
                    bps.policy_snapshot
                  ) = 1

                  AND JSON_UNQUOTE(
                    JSON_EXTRACT(
                      bps.policy_snapshot,
                      '$.no_show.enabled'
                    )
                  ) = 'true'

                  AND JSON_EXTRACT(
                    bps.policy_snapshot,
                    '$.no_show.mark_after_hours'
                  ) IS NOT NULL

                  AND TIMESTAMPADD(
                    HOUR,

                    GREATEST(
                      0,
                      CAST(
                        JSON_UNQUOTE(
                          JSON_EXTRACT(
                            bps.policy_snapshot,
                            '$.no_show.mark_after_hours'
                          )
                        )
                        AS SIGNED
                      )
                    ),

                    GREATEST(
                      b.check_in,
                      b.created_at
                    )
                  ) <= NOW()
                )
              )
            )
          )

          AND NOT EXISTS (
            SELECT 1

            FROM booking_guests bg

            WHERE bg.hotel_id =
                  b.hotel_id

              AND bg.booking_id =
                  b.booking_id

              AND bg.guest_status =
                  'checked_in'
          )
        ORDER BY
          b.booking_id

        FOR UPDATE
      `,
      params
    );


  if (
    !Array.isArray(
      candidates
    ) ||
    candidates.length === 0
  ) {
    const financialBackfill =
      await backfillMissingNoShowSettlementsWithConnection(
        connection,
        {
          hotelId:
            safeHotelId,

          bookingId:
            safeBookingId,

          reservationGroupId:
            safeReservationGroupId,
        }
      );


    return {
      changed:
        false,

      totalChanged:
        0,

      noShowCount:
        0,

      expiredCount:
        0,

      bookingIds:
        [],

      financialSettlementsCreated:
        financialBackfill
          .createdCount,

      financialSettlementBookingIds:
        financialBackfill
          .bookingIds,
    };
  }


  const bookingIds =
    candidates.map(
      (row) =>
        Number(
          row.booking_id
        )
    );


  const noShowBookingIds =
    candidates
      .filter(
        (row) =>
          row.booking_status ===
          "confirmed"
      )
      .map(
        (row) =>
          Number(
            row.booking_id
          )
      );


  const noShowCount =
    noShowBookingIds.length;


  const expiredCount =
    candidates.filter(
      (row) =>
        row.booking_status ===
        "pending"
    ).length;


  /*
   * Status transition.
   *
   * Do not set updated_by_admin_id:
   * this is an automatic system transition,
   * not an Admin action.
   *
   * updated_at updates automatically from DB definition.
   */
  await connection.query(
    `
      UPDATE bookings b

      SET
        b.booking_status =
          CASE

            WHEN b.booking_status =
              'confirmed'
              THEN 'no_show'

            WHEN b.booking_status =
              'pending'
              THEN 'expired'

            ELSE
              b.booking_status

          END

      WHERE b.hotel_id = ?

        AND b.booking_id IN (
          ${bookingIds
            .map(
              () => "?"
            )
            .join(", ")}
        )

        AND b.booking_status IN (
          'pending',
          'confirmed'
        )

        AND b.actual_check_in IS NULL
        AND b.actual_check_out IS NULL
    `,
    [
      safeHotelId,
      ...bookingIds,
    ]
  );

  /*
  * Financial settlement belongs to the same transaction as
  * the lifecycle transition.
  *
  * If settlement creation fails unexpectedly, the entire
  * No Show transition rolls back rather than leaving booking
  * status and financial truth inconsistent.
  */
  const newlyCreatedSettlementBookingIds =
    [];


  for (
    const noShowBookingId
    of noShowBookingIds
  ) {
    const settlementResult =
      await ensureNoShowSettlementWithConnection(
        connection,
        {
          hotelId:
            safeHotelId,

          bookingId:
            noShowBookingId,
        }
      );


    if (
      settlementResult.created
    ) {
      newlyCreatedSettlementBookingIds.push(
        noShowBookingId
      );
    }
  }


  /*
   * Reservation room-history is no longer an open/planned
   * assignment after No Show / Expired.
   *
   * Only PLANNED is touched.
   * ACTIVE room history must never be auto-closed here.
   */
  await connection.query(
    `
      UPDATE booking_room_history h

      INNER JOIN bookings b
        ON b.hotel_id =
           h.hotel_id

       AND b.booking_id =
           h.booking_id

      SET
        h.assignment_status =
          'cancelled',

        h.notes =
          CASE

            WHEN b.booking_status =
              'no_show'
              THEN
                CONCAT(
                  COALESCE(
                    NULLIF(
                      h.notes,
                      ''
                    ),
                    'Room assignment'
                  ),
                  ' | Auto-closed: reservation became No Show.'
                )

            WHEN b.booking_status =
              'expired'
              THEN
                CONCAT(
                  COALESCE(
                    NULLIF(
                      h.notes,
                      ''
                    ),
                    'Room assignment'
                  ),
                  ' | Auto-closed: pending reservation expired.'
                )

            ELSE
              h.notes

          END

      WHERE h.hotel_id = ?

        AND h.booking_id IN (
          ${bookingIds
            .map(
              () => "?"
            )
            .join(", ")}
        )

        AND h.assignment_status =
          'planned'

        AND b.booking_status IN (
          'no_show',
          'expired'
        )
    `,
    [
      safeHotelId,
      ...bookingIds,
    ]
  );

  /*
  * Expected guests can no longer remain operationally
  * "expected" after the reservation itself has closed.
  *
  * Preserve the guest rows for history, but close their
  * lifecycle as cancelled.
  */
  await connection.query(
    `
      UPDATE booking_guests

      SET
        guest_status =
          'cancelled',

        updated_at =
          CURRENT_TIMESTAMP

      WHERE hotel_id = ?

        AND booking_id IN (
          ${bookingIds
            .map(
              () => "?"
            )
            .join(", ")}
        )

        AND guest_status =
          'expected'
    `,
    [
      safeHotelId,
      ...bookingIds,
    ]
  );

  const financialBackfill =
    await backfillMissingNoShowSettlementsWithConnection(
      connection,
      {
        hotelId:
          safeHotelId,

        bookingId:
          safeBookingId,

        reservationGroupId:
          safeReservationGroupId,
      }
    );

  /*
  * booking_guests are never deleted.
  *
  * Expected guests are closed as cancelled when the
  * reservation becomes No Show / Expired.
  *
  * This preserves the historical guest record while
  * correctly closing its operational lifecycle.
  */


  return {
    changed: true,

    totalChanged:
      candidates.length,

    noShowCount,

    financialSettlementsCreated:
      newlyCreatedSettlementBookingIds.length +
      financialBackfill.createdCount,

    financialSettlementBookingIds: [
      ...newlyCreatedSettlementBookingIds,
      ...financialBackfill.bookingIds,
    ],

    expiredCount,

    bookingIds,
  };
}


/* ============================================================
   HOTEL-WIDE RECONCILIATION

   Own transaction.
============================================================ */

async function reconcileOverdueBookingsForHotel(
  hotelId
) {
  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const result =
      await reconcileOverdueBookingsWithConnection(
        connection,
        {
          hotelId,
        }
      );


    await connection
      .commit();


    return result;
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );

    throw error;
  } finally {
    connection.release();
  }
}


/* ============================================================
   SINGLE BOOKING RECONCILIATION

   Useful before:
   - opening booking
   - guest check-in
   - lifecycle action
============================================================ */

async function reconcileOverdueBookingForHotel(
  hotelId,
  bookingId
) {
  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const result =
      await reconcileOverdueBookingsWithConnection(
        connection,
        {
          hotelId,
          bookingId,
        }
      );


    await connection
      .commit();


    return result;
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );

    throw error;
  } finally {
    connection.release();
  }
}

/* ============================================================
   RESERVATION GROUP RECONCILIATION

   Own transaction.

   Useful for read flows that need the complete reservation
   group lifecycle synchronized without scanning the hotel.
============================================================ */

async function reconcileOverdueReservationGroupForHotel(
  hotelId,
  reservationGroupId
) {
  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const result =
      await reconcileOverdueBookingsWithConnection(
        connection,
        {
          hotelId,
          reservationGroupId,
        }
      );


    await connection
      .commit();


    return result;
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );

    throw error;
  } finally {
    connection.release();
  }
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  reconcileOverdueBookingsWithConnection,
  reconcileOverdueBookingsForHotel,
  reconcileOverdueBookingForHotel,
  reconcileOverdueReservationGroupForHotel,
};