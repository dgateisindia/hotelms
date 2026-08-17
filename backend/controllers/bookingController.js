const db = require("../config/db").promisePool;

const {
  RESERVATION_EDIT_STATUSES,
  parsePositiveInteger,
  normalizeBookingSource,
  calculateNights,
  validateCustomer,
  validateBookingItems,
  validateInitialPayment,
} = require("../services/bookingValidation");

const {
  lockRooms,
  ensureNoOverlap,
  createInitialRoomHistory,
} = require("../services/bookingRoomService");


const {
  getLockedPaymentState,
  syncBookingPaymentStatus,
  applyInitialPayment,

  collectBookingPayment:
    collectBookingPaymentService,
} = require("../services/bookingPaymentService");

const {
  findOrCreateCustomer,
} = require("../services/bookingCustomerService");

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
    bookingSource,
    item,
    room,
  } = values;


  const nights =
    calculateNights(
      item.checkIn,
      item.checkOut
    );


  if (
    nights <= 0
  ) {
    throwHttp(
      400,
      "INVALID_STAY_DURATION",
      "The booking stay duration is invalid."
    );
  }


  const ratePerNight =
    Number(
      room.price_per_night
    );


  if (
    !Number.isFinite(
      ratePerNight
    ) ||
    ratePerNight < 0
  ) {
    throwHttp(
      500,
      "INVALID_ROOM_RATE",
      "The selected room has an invalid nightly rate."
    );
  }


  const totalAmount =
    Number(
      (
        ratePerNight *
        nights
      ).toFixed(2)
    );


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
          source_request_id,
          booking_source,
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
          booking_status,
          payment_status,
          total_amount,
          special_request
        )

        VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, NULL, ?, ?, ?,
          NULL, NULL,
          ?, ?,
          'unpaid',
          ?,
          ?
        )
      `,
      [
        sourceRequestId,
        bookingSource,
        hotelId,
        customerId,
        item.roomId,
        ratePerNight,
        adminId,
        temporaryCode,
        item.checkIn,
        item.checkOut,
        item.totalGuests,
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

    nights,
    ratePerNight,
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


  const customerResult =
    await findOrCreateCustomer(
      connection,
      hotelId,
      customerValidation.value
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


    const created =
      await insertBooking(
        connection,
        {
          hotelId,
          adminId,

          customerId:
            customerResult
              .customerId,

          sourceRequestId:
            index === 0
              ? sourceRequestId
              : null,

          bookingSource,
          item,
          room,
        }
      );


    bookings.push({
      ...created,

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
    const [rows] =
      await db.query(
        `
          SELECT
            b.booking_id,
            b.booking_code,
            b.source_request_id,
            b.booking_source,

            b.customer_id,
            b.room_id,

            b.booked_rate_per_night,

            b.created_by_admin_id,
            b.updated_by_admin_id,

            b.check_in,
            b.check_out,
            b.actual_check_in,
            b.actual_check_out,

            b.total_guests,
            b.booking_status,
            b.total_amount,
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

            COALESCE(
              pay.gross_paid,
              0
            ) AS gross_paid,

            COALESCE(
              pay.refunded_amount,
              0
            ) AS refunded_amount,

            GREATEST(
              COALESCE(
                pay.net_paid,
                0
              ),
              0
            ) AS amount_paid,

            GREATEST(
              b.total_amount -
              COALESCE(
                pay.net_paid,
                0
              ),
              0
            ) AS outstanding_amount,

            GREATEST(
              COALESCE(
                pay.net_paid,
                0
              ) -
              b.total_amount,
              0
            ) AS overpaid_amount,

            CASE

              WHEN COALESCE(
                pay.net_paid,
                0
              ) <= 0
                THEN 'unpaid'

              WHEN COALESCE(
                pay.net_paid,
                0
              ) < b.total_amount
                THEN 'partial'

              ELSE 'paid'

            END AS payment_status

          FROM bookings b

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
    const [[booking]] =
      await db.query(
        `
          SELECT
            b.booking_id,
            b.booking_code,
            b.source_request_id,
            b.booking_source,

            b.customer_id,
            b.room_id,
            b.booked_rate_per_night,

            b.created_by_admin_id,
            b.updated_by_admin_id,

            b.check_in,
            b.check_out,
            b.actual_check_in,
            b.actual_check_out,

            b.total_guests,
            b.booking_status,
            b.total_amount,
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
            r.status AS room_status,

            COALESCE(
              pay.gross_paid,
              0
            ) AS gross_paid,

            COALESCE(
              pay.refunded_amount,
              0
            ) AS refunded_amount,

            GREATEST(
              COALESCE(
                pay.net_paid,
                0
              ),
              0
            ) AS amount_paid,

            GREATEST(
              b.total_amount -
              COALESCE(
                pay.net_paid,
                0
              ),
              0
            ) AS outstanding_amount,

            CASE

              WHEN COALESCE(
                pay.net_paid,
                0
              ) <= 0
                THEN 'unpaid'

              WHEN COALESCE(
                pay.net_paid,
                0
              ) < b.total_amount
                THEN 'partial'

              ELSE 'paid'

            END AS payment_status

          FROM bookings b

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


    return res
      .status(200)
      .json({
        ...booking,

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
                CASE
                  WHEN booking_status <>
                    'cancelled'
                  THEN total_amount
                  ELSE 0
                END
              ),
              0
            ) AS totalBookedValue

          FROM bookings

          WHERE hotel_id = ?
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


    const [[existing]] =
      await connection.query(
        `
          SELECT
            booking_id,
            source_request_id,
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


    const validation =
      validateBookingItems(
        {
          room_id:
            req.body.room_id,

          check_in:
            req.body.check_in,

          check_out:
            req.body.check_out,

          total_guests:
            req.body.total_guests,

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


    const roomChanged =
      Number(
        existing.room_id
      ) !==
      item.roomId;


    /*
     * Same room:
     * preserve original booked rate snapshot.

     * Pre-stay room change:
     * snapshot new room's current rate.
     */
    const ratePerNight =
      roomChanged
        ? Number(
            room.price_per_night
          )
        : Number(
            existing
              .booked_rate_per_night ??
            room.price_per_night
          );


    const nights =
      calculateNights(
        item.checkIn,
        item.checkOut
      );


    const newTotalAmount =
      Number(
        (
          ratePerNight *
          nights
        ).toFixed(2)
      );


    const paymentState =
      await getLockedPaymentState(
        connection,
        context.hotelId,
        bookingId,
        newTotalAmount
      );


    /*
     * Example:
     *
     * Old booking total = ₹10,000
     * already paid      = ₹10,000
     *
     * edited cheaper total = ₹8,000
     *
     * Do not silently create ₹2,000 overpayment.
     * Refund/credit must be handled explicitly.
     */
    if (
      paymentState.netPaid >
      newTotalAmount + 0.009
    ) {
      throwHttp(
        409,
        "PAYMENT_EXCEEDS_NEW_TOTAL",
        "The new booking total is lower than the amount already paid. Process the required refund or adjustment before reducing this reservation."
      );
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
        item.totalGuests,
        item.bookingStatus,
        paymentState.paymentStatus,
        newTotalAmount,
        item.specialRequest,
        context.hotelId,
        bookingId,
      ]
    );


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

          booked_rate_per_night:
            ratePerNight,

          nights,

          total_amount:
            newTotalAmount,

          payment_status:
            paymentState
              .paymentStatus,

          amount_paid:
            Math.max(
              0,
              paymentState
                .netPaid
            ),

          outstanding_amount:
            Math.max(
              0,
              newTotalAmount -
                Math.max(
                  0,
                  paymentState
                    .netPaid
                )
            ),
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
   COLLECT BOOKING PAYMENT

   Financial source of truth:
   payments table.

   Allowed:
   confirmed
   checked_in
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

   Only pending / confirmed reservations may be cancelled.

   Checked-in stay uses operational lifecycle instead.
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


    const [[booking]] =
      await connection.query(
        `
          SELECT
            booking_id,
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


    if (!booking) {
      throwHttp(
        404,
        "BOOKING_NOT_FOUND",
        "The booking was not found in your hotel."
      );
    }


    if (
      booking.booking_status ===
      "cancelled"
    ) {
      throwHttp(
        409,
        "BOOKING_ALREADY_CANCELLED",
        "This booking is already cancelled."
      );
    }


    if (
      booking.booking_status ===
      "checked_in"
    ) {
      throwHttp(
        409,
        "ACTIVE_STAY_CANNOT_CANCEL",
        "A checked-in stay cannot be cancelled. Use the checkout or early-checkout workflow."
      );
    }


    if (
      booking.booking_status ===
      "checked_out"
    ) {
      throwHttp(
        409,
        "COMPLETED_BOOKING_CANNOT_CANCEL",
        "A checked-out booking cannot be cancelled."
      );
    }


    const paymentState =
      await getLockedPaymentState(
        connection,
        context.hotelId,
        bookingId,
        Number(
          booking.total_amount
        )
      );


    await connection.query(
      `
        UPDATE bookings

        SET
          booking_status =
            'cancelled',

          updated_by_admin_id = ?

        WHERE hotel_id = ?
          AND booking_id = ?
      `,
      [
        context.adminId,
        context.hotelId,
        bookingId,
      ]
    );


    await connection.query(
      `
        UPDATE booking_room_history

        SET
          assignment_status =
            'cancelled',

          changed_by_admin_id = ?

        WHERE hotel_id = ?
          AND booking_id = ?
          AND assignment_status IN (
            'planned',
            'active'
          )
      `,
      [
        context.adminId,
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
          paymentState.netPaid > 0
            ? "Booking cancelled. A payment exists on this booking; review the refund according to hotel policy."
            : "Booking cancelled successfully.",

        refund_review_required:
          paymentState.netPaid >
          0,

        net_paid_amount:
          Math.max(
            0,
            paymentState.netPaid
          ),
      });
  } catch (error) {
    await connection
      .rollback();


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