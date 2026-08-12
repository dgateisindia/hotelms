const db = require("../config/db").promisePool;

const BOOKING_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
]);

const PAYMENT_STATUSES = new Set([
  "paid",
  "partial",
  "unpaid",
]);

/* ============================================================
   RESPONSE / LOG HELPERS
============================================================ */

function sendError(
  res,
  status,
  code,
  message
) {
  return res.status(status).json({
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
      error?.code || "UNKNOWN_ERROR"
    }: ${
      error?.message ||
      "Unknown booking error"
    }`
  );
}

/* ============================================================
   TRUSTED ADMIN / HOTEL CONTEXT
============================================================ */

function getAdminContext(req) {
  const hotelId = Number(
    req.dbUser?.hotelId
  );

  const adminId = Number(
    req.dbUser?.adminId
  );

  if (
    !Number.isSafeInteger(hotelId) ||
    hotelId <= 0 ||
    !Number.isSafeInteger(adminId) ||
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
   BASIC VALIDATION
============================================================ */

function parsePositiveInteger(value) {
  const parsed = Number(value);

  if (
    Number.isSafeInteger(parsed) &&
    parsed > 0
  ) {
    return parsed;
  }

  return null;
}

function parseAmount(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return 0;
  }

  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 9999999999.99
  ) {
    return null;
  }

  return Number(
    amount.toFixed(2)
  );
}

function normalizePhone(value) {
  const phone = String(
    value || ""
  )
    .trim()
    .replace(
      /[\s()\-]/g,
      ""
    );

  if (
    !/^\+?\d{6,20}$/.test(phone)
  ) {
    return null;
  }

  return phone;
}

function normalizeEmail(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return {
      value: null,
      error: "",
    };
  }

  const email = String(value)
    .trim()
    .toLowerCase();

  if (
    email.length > 191 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    return {
      value: null,
      error:
        "Email address is invalid.",
    };
  }

  return {
    value: email,
    error: "",
  };
}

function normalizeOptionalText(
  value,
  maxLength
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const text = String(value).trim();

  if (
    text.length > maxLength
  ) {
    return null;
  }

  return text;
}

function normalizeEnum(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function normalizeBookingStatus(
  value,
  fallback = "pending"
) {
  const status = normalizeEnum(
    value || fallback
  );

  if (
    !BOOKING_STATUSES.has(status)
  ) {
    return null;
  }

  return status;
}

function normalizePaymentStatus(
  value,
  fallback = "unpaid"
) {
  const status = normalizeEnum(
    value || fallback
  );

  if (
    !PAYMENT_STATUSES.has(status)
  ) {
    return null;
  }

  return status;
}

/* ============================================================
   DATE HELPERS
============================================================ */

function isRealUtcDate(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0
) {
  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    )
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() ===
      minute &&
    date.getUTCSeconds() ===
      second
  );
}

function normalizeDateTime(value) {
  const input = String(
    value || ""
  ).trim();

  if (!input) {
    return null;
  }

  const dateOnly =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      input
    );

  if (dateOnly) {
    const [
      ,
      year,
      month,
      day,
    ] = dateOnly;

    if (
      !isRealUtcDate(
        Number(year),
        Number(month),
        Number(day)
      )
    ) {
      return null;
    }

    return (
      `${year}-${month}-${day}` +
      " 00:00:00"
    );
  }

  const mysqlDateTime =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
      input
    );

  if (mysqlDateTime) {
    const [
      ,
      year,
      month,
      day,
      hour,
      minute,
      rawSecond,
    ] = mysqlDateTime;

    const second =
      rawSecond || "00";

    if (
      !isRealUtcDate(
        Number(year),
        Number(month),
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      )
    ) {
      return null;
    }

    return (
      `${year}-${month}-${day} ` +
      `${hour}:${minute}:${second}`
    );
  }

  const parsed = new Date(input);

  if (
    !Number.isFinite(
      parsed.getTime()
    )
  ) {
    return null;
  }

  const year =
    parsed.getUTCFullYear();

  const month = String(
    parsed.getUTCMonth() + 1
  ).padStart(
    2,
    "0"
  );

  const day = String(
    parsed.getUTCDate()
  ).padStart(
    2,
    "0"
  );

  const hour = String(
    parsed.getUTCHours()
  ).padStart(
    2,
    "0"
  );

  const minute = String(
    parsed.getUTCMinutes()
  ).padStart(
    2,
    "0"
  );

  const second = String(
    parsed.getUTCSeconds()
  ).padStart(
    2,
    "0"
  );

  return (
    `${year}-${month}-${day} ` +
    `${hour}:${minute}:${second}`
  );
}

function toMillis(
  mysqlDateTime
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(
      String(
        mysqlDateTime || ""
      )
    );

  if (!match) {
    return NaN;
  }

  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  );
}

function rangesOverlap(
  first,
  second
) {
  return (
    toMillis(first.checkIn) <
      toMillis(second.checkOut) &&
    toMillis(first.checkOut) >
      toMillis(second.checkIn)
  );
}

/* ============================================================
   INTERNAL HTTP ERROR
============================================================ */

function throwHttp(
  status,
  code,
  message
) {
  const error =
    new Error(message);

  error.status = status;
  error.code = code;

  throw error;
}

/* ============================================================
   CUSTOMER PAYLOAD VALIDATION
============================================================ */

function validateCustomer(body) {
  const fullName = String(
    body?.guest_name ||
      body?.full_name ||
      ""
  ).trim();

  if (!fullName) {
    return {
      error:
        "Guest name is required.",
    };
  }

  if (
    fullName.length > 150
  ) {
    return {
      error:
        "Guest name must not exceed 150 characters.",
    };
  }

  const phone =
    normalizePhone(
      body?.phone
    );

  if (!phone) {
    return {
      error:
        "A valid phone number is required.",
    };
  }

  const emailResult =
    normalizeEmail(
      body?.email
    );

  if (emailResult.error) {
    return {
      error:
        emailResult.error,
    };
  }

  const nationality =
    normalizeOptionalText(
      body?.nationality,
      100
    );

  if (
    body?.nationality &&
    !nationality
  ) {
    return {
      error:
        "Nationality must not exceed 100 characters.",
    };
  }

  return {
    error: "",

    value: {
      fullName,
      phone,
      email:
        emailResult.value,
      nationality,
    },
  };
}

/* ============================================================
   BOOKING PAYLOAD VALIDATION

   Supports:

   OLD SINGLE ROOM:
   {
     room_id,
     check_in,
     check_out,
     ...
   }

   FUTURE MULTI ROOM:
   {
     rooms: [
       {...},
       {...}
     ]
   }

   Each room still creates its own booking row because current
   final DB uses one room_id per booking row.
============================================================ */

function validateBookingItems(body) {
  const source =
    body &&
    typeof body === "object"
      ? body
      : {};

  const rawItems =
    Array.isArray(
      source.rooms
    ) &&
    source.rooms.length
      ? source.rooms
      : [source];

  if (
    rawItems.length > 20
  ) {
    return {
      error:
        "A maximum of 20 rooms can be booked at one time.",
    };
  }

  const items = [];

  for (
    let index = 0;
    index < rawItems.length;
    index += 1
  ) {
    const raw =
      rawItems[index] || {};

    const label =
      `Room ${index + 1}`;

    const roomId =
      parsePositiveInteger(
        raw.room_id
      );

    if (!roomId) {
      return {
        error:
          `${label}: valid room_id is required.`,
      };
    }

    const checkIn =
      normalizeDateTime(
        raw.check_in
      );

    const checkOut =
      normalizeDateTime(
        raw.check_out
      );

    if (!checkIn) {
      return {
        error:
          `${label}: valid check-in is required.`,
      };
    }

    if (!checkOut) {
      return {
        error:
          `${label}: valid check-out is required.`,
      };
    }

    if (
      toMillis(checkOut) <=
      toMillis(checkIn)
    ) {
      return {
        error:
          `${label}: check-out must be later than check-in.`,
      };
    }

    const totalGuests =
      raw.total_guests ===
        undefined ||
      raw.total_guests === null ||
      String(
        raw.total_guests
      ).trim() === ""
        ? 1
        : parsePositiveInteger(
            raw.total_guests
          );

    if (!totalGuests) {
      return {
        error:
          `${label}: total guests must be at least 1.`,
      };
    }

    const bookingStatus =
      normalizeBookingStatus(
        raw.booking_status ??
          source.booking_status
      );

    if (!bookingStatus) {
      return {
        error:
          `${label}: invalid booking status.`,
      };
    }

    const paymentStatus =
      normalizePaymentStatus(
        raw.payment_status ??
          source.payment_status
      );

    if (!paymentStatus) {
      return {
        error:
          `${label}: payment status must be paid, partial, or unpaid.`,
      };
    }

    const totalAmount =
      parseAmount(
        raw.total_amount ??
          source.total_amount
      );

    if (
      totalAmount === null
    ) {
      return {
        error:
          `${label}: total amount is invalid.`,
      };
    }

    const rawSpecialRequest =
      raw.special_request ??
      source.special_request;

    const specialRequest =
      normalizeOptionalText(
        rawSpecialRequest,
        5000
      );

    if (
      rawSpecialRequest &&
      !specialRequest
    ) {
      return {
        error:
          `${label}: special request is too long.`,
      };
    }

    items.push({
      roomId,
      checkIn,
      checkOut,
      totalGuests,
      bookingStatus,
      paymentStatus,
      totalAmount,
      specialRequest,
    });
  }

  /*
   * Prevent the same room from appearing twice
   * for overlapping dates inside one request.
   */
  for (
    let i = 0;
    i < items.length;
    i += 1
  ) {
    for (
      let j = i + 1;
      j < items.length;
      j += 1
    ) {
      if (
        items[i].roomId ===
          items[j].roomId &&
        rangesOverlap(
          items[i],
          items[j]
        )
      ) {
        return {
          error:
            "The same room cannot be booked for overlapping dates in one request.",
        };
      }
    }
  }

  return {
    error: "",
    value: items,
  };
}

/* ============================================================
   FIND / CREATE CUSTOMER

   Customer identity is:
   hotel_id + normalized phone

   Different hotels may have the same phone number.
============================================================ */

async function findOrCreateCustomer(
  connection,
  hotelId,
  customer
) {
  const [rows] =
    await connection.query(
      `
        SELECT
          customer_id,
          full_name,
          email,
          nationality

        FROM customers

        WHERE hotel_id = ?
          AND phone = ?

        ORDER BY customer_id ASC

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotelId,
        customer.phone,
      ]
    );

  if (rows.length) {
    const existing =
      rows[0];

    const updates = [];
    const params = [];

    /*
     * Booking Desk may correct the customer name.
     */
    if (
      existing.full_name !==
      customer.fullName
    ) {
      updates.push(
        "full_name = ?"
      );

      params.push(
        customer.fullName
      );
    }

    /*
     * Existing saved email is never silently overwritten.
     */
    if (
      !existing.email &&
      customer.email
    ) {
      updates.push(
        "email = ?"
      );

      params.push(
        customer.email
      );
    }

    /*
     * Existing nationality is also preserved.
     */
    if (
      !existing.nationality &&
      customer.nationality
    ) {
      updates.push(
        "nationality = ?"
      );

      params.push(
        customer.nationality
      );
    }

    if (
      updates.length
    ) {
      params.push(
        existing.customer_id,
        hotelId
      );

      await connection.query(
        `
          UPDATE customers

          SET ${
            updates.join(", ")
          }

          WHERE customer_id = ?
            AND hotel_id = ?
        `,
        params
      );
    }

    return Number(
      existing.customer_id
    );
  }

  const [result] =
    await connection.query(
      `
        INSERT INTO customers (
          hotel_id,
          full_name,
          email,
          phone,
          nationality
        )

        VALUES (?, ?, ?, ?, ?)
      `,
      [
        hotelId,
        customer.fullName,
        customer.email,
        customer.phone,
        customer.nationality,
      ]
    );

  return Number(
    result.insertId
  );
}

/* ============================================================
   LOCK QR CUSTOMER REQUEST

   Future QR approve flow will call the SAME booking engine.

   Final rules:
   - request belongs to current hotel
   - declined request cannot create booking
   - one customer request can create only one booking
============================================================ */

async function lockSourceRequest(
  connection,
  hotelId,
  sourceRequestId
) {
  if (!sourceRequestId) {
    return null;
  }

  const [[request]] =
    await connection.query(
      `
        SELECT
          request_id,
          status,
          assigned_room_id

        FROM customer_requests

        WHERE hotel_id = ?
          AND request_id = ?

        FOR UPDATE
      `,
      [
        hotelId,
        sourceRequestId,
      ]
    );

  if (!request) {
    throwHttp(
      404,
      "CUSTOMER_REQUEST_NOT_FOUND",
      "The customer request was not found in this hotel."
    );
  }

  if (
    request.status ===
    "declined"
  ) {
    throwHttp(
      409,
      "CUSTOMER_REQUEST_DECLINED",
      "A declined customer request cannot be converted into a booking."
    );
  }

  const [[existingBooking]] =
    await connection.query(
      `
        SELECT
          booking_id

        FROM bookings

        WHERE hotel_id = ?
          AND source_request_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hotelId,
        sourceRequestId,
      ]
    );

  if (existingBooking) {
    throwHttp(
      409,
      "CUSTOMER_REQUEST_ALREADY_BOOKED",
      "This customer request has already been converted into a booking."
    );
  }

  return request;
}

/* ============================================================
   LOCK ROOMS

   Locking room rows is critical.

   Two Admins trying to book the same room simultaneously:
   second transaction waits for the first transaction.
============================================================ */

async function lockRooms(
  connection,
  hotelId,
  items
) {
  const roomIds = [
    ...new Set(
      items.map(
        (item) =>
          item.roomId
      )
    ),
  ].sort(
    (a, b) =>
      a - b
  );

  const placeholders =
    roomIds
      .map(() => "?")
      .join(", ");

  const [rooms] =
    await connection.query(
      `
        SELECT
          room_id,
          room_number,
          room_type,
          capacity,
          status,
          price_per_night

        FROM rooms

        WHERE hotel_id = ?
          AND room_id IN (${placeholders})

        ORDER BY room_id ASC

        FOR UPDATE
      `,
      [
        hotelId,
        ...roomIds,
      ]
    );

  if (
    rooms.length !==
    roomIds.length
  ) {
    const found =
      new Set(
        rooms.map(
          (room) =>
            Number(
              room.room_id
            )
        )
      );

    const missing =
      roomIds.find(
        (roomId) =>
          !found.has(roomId)
      );

    throwHttp(
      404,
      "ROOM_NOT_FOUND",
      `Room ${missing} was not found in this hotel.`
    );
  }

  const roomMap =
    new Map(
      rooms.map(
        (room) => [
          Number(
            room.room_id
          ),
          room,
        ]
      )
    );

  items.forEach(
    (item) => {
      const room =
        roomMap.get(
          item.roomId
        );

      if (
        room.status ===
        "maintenance"
      ) {
        throwHttp(
          409,
          "ROOM_UNAVAILABLE",
          `Room ${room.room_number} is under maintenance and cannot be booked.`
        );
      }

      if (
        item.totalGuests >
        Number(
          room.capacity
        )
      ) {
        throwHttp(
          400,
          "ROOM_CAPACITY_EXCEEDED",
          `Room ${room.room_number} allows a maximum of ${room.capacity} guest(s).`
        );
      }
    }
  );

  return roomMap;
}

/* ============================================================
   DOUBLE BOOKING CHECK
============================================================ */

async function ensureNoOverlap(
  connection,
  hotelId,
  items,
  excludeBookingId = null
) {
  for (
    const item of items
  ) {
    const params = [
      hotelId,
      item.roomId,
      item.checkOut,
      item.checkIn,
    ];

    let exclude = "";

    if (
      excludeBookingId
    ) {
      exclude =
        "AND booking_id <> ?";

      params.push(
        excludeBookingId
      );
    }

    const [conflicts] =
      await connection.query(
        `
          SELECT
            booking_id

          FROM bookings

          WHERE hotel_id = ?
            AND room_id = ?
            AND booking_status <> 'cancelled'

            AND check_in < ?
            AND check_out > ?

            ${exclude}

          LIMIT 1

          FOR UPDATE
        `,
        params
      );

    if (
      conflicts.length
    ) {
      throwHttp(
        409,
        "ROOM_BOOKING_CONFLICT",
        "Room is not available for the selected dates."
      );
    }
  }
}

/* ============================================================
   INSERT SINGLE BOOKING
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
    item,
  } = values;

  /*
   * booking_code is NOT NULL + UNIQUE per hotel.
   *
   * We first insert a guaranteed temporary code.
   * After insertId is known, replace it with BK-xxxx.
   */
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
          hotel_id,
          customer_id,
          room_id,
          created_by_admin_id,
          updated_by_admin_id,
          booking_code,
          check_in,
          check_out,
          total_guests,
          booking_status,
          payment_status,
          total_amount,
          special_request
        )

        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          NULL,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `,
      [
        sourceRequestId,
        hotelId,
        customerId,
        item.roomId,
        adminId,
        temporaryCode,
        item.checkIn,
        item.checkOut,
        item.totalGuests,
        item.bookingStatus,
        item.paymentStatus,
        item.totalAmount,
        item.specialRequest,
      ]
    );

  const bookingId =
    Number(
      result.insertId
    );

  const bookingCode =
    `BK-${1000 + bookingId}`;

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

  return {
    bookingId,
    bookingCode,
    roomId:
      item.roomId,
  };
}

/* ============================================================
   SHARED BOOKING ENGINE

   Used by:
   - Manual Booking Desk
   - Future QR request approval

   Caller owns:
   - beginTransaction
   - commit
   - rollback
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
      payload
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

  const items =
    bookingValidation.value;

  let sourceRequestId =
    null;

  if (
    payload?.source_request_id !==
      undefined &&
    payload?.source_request_id !==
      null &&
    String(
      payload.source_request_id
    ).trim() !== ""
  ) {
    sourceRequestId =
      parsePositiveInteger(
        payload.source_request_id
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

  /*
   * Final architecture:
   * one QR request -> one booking only.
   */
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
   * Room rows are already locked.
   * Now verify dates against committed/current bookings.
   */
  await ensureNoOverlap(
    connection,
    hotelId,
    items
  );

  const customerId =
    await findOrCreateCustomer(
      connection,
      hotelId,
      customerValidation.value
    );

  const bookings = [];

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const item =
      items[index];

    const created =
      await insertBooking(
        connection,
        {
          hotelId,
          adminId,
          customerId,

          sourceRequestId:
            index === 0
              ? sourceRequestId
              : null,

          item,
        }
      );

    const room =
      roomMap.get(
        item.roomId
      );

    bookings.push({
      ...created,

      roomNumber:
        room.room_number,

      roomType:
        room.room_type,

      checkIn:
        item.checkIn,

      checkOut:
        item.checkOut,

      bookingStatus:
        item.bookingStatus,

      paymentStatus:
        item.paymentStatus,

      totalAmount:
        item.totalAmount,
    });
  }

  /*
   * QR approval is part of the SAME transaction.
   *
   * Booking failure => QR remains unchanged.
   * QR update failure => booking rolls back.
   */
  if (
    sourceRequestId
  ) {
    await connection.query(
      `
        UPDATE customer_requests

        SET
          status = 'approved',
          assigned_room_id = ?,
          handled_by_admin_id = ?,
          updated_by_admin_id = ?,
          handled_at = NOW(),
          seen = 1

        WHERE hotel_id = ?
          AND request_id = ?
      `,
      [
        items[0].roomId,
        adminId,
        adminId,
        hotelId,
        sourceRequestId,
      ]
    );
  }

  return {
    customerId,
    bookings,
  };
}

/*
 * Export shared engine so QR controller can reuse it later.
 */
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
            b.customer_id,
            b.room_id,
            b.created_by_admin_id,
            b.updated_by_admin_id,
            b.check_in,
            b.check_out,
            b.total_guests,
            b.booking_status,
            b.payment_status,
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
            r.price_per_night,

            COALESCE(
              payment_summary.amount_paid,
              0
            ) AS amount_paid,

            GREATEST(
              b.total_amount -
              COALESCE(
                payment_summary.amount_paid,
                0
              ),
              0
            ) AS outstanding_amount

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
              SUM(amount)
                AS amount_paid

            FROM payments

            WHERE payment_status =
              'success'

            GROUP BY
              hotel_id,
              booking_id
          ) payment_summary
            ON payment_summary.hotel_id =
              b.hotel_id
           AND payment_summary.booking_id =
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
            b.customer_id,
            b.room_id,
            b.created_by_admin_id,
            b.updated_by_admin_id,
            b.check_in,
            b.check_out,
            b.total_guests,
            b.booking_status,
            b.payment_status,
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
            c.profile_image,

            r.room_number,
            r.room_type,
            r.floor_number,
            r.capacity,
            r.price_per_night,
            r.status
              AS room_status,

            COALESCE(
              payment_summary.amount_paid,
              0
            ) AS amount_paid,

            GREATEST(
              b.total_amount -
              COALESCE(
                payment_summary.amount_paid,
                0
              ),
              0
            ) AS outstanding_amount

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
              SUM(amount)
                AS amount_paid

            FROM payments

            WHERE payment_status =
              'success'

            GROUP BY
              hotel_id,
              booking_id
          ) payment_summary
            ON payment_summary.hotel_id =
              b.hotel_id
           AND payment_summary.booking_id =
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

    /*
     * Payment history is real data and later will also be used
     * inside Customer Details and Room Details pages.
     */
    const [payments] =
      await db.query(
        `
          SELECT
            payment_id,
            amount,
            payment_method,
            transaction_id,
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

    return res
      .status(200)
      .json({
        ...booking,
        payments,
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

/*
 * Backward compatibility for existing route/controller references.
 */
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
            COUNT(*)
              AS totalBookings,

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

    /*
     * Actual revenue comes from successful payments,
     * NOT simply total_amount.
     */
    const [[paymentStats]] =
      await db.query(
        `
          SELECT
            COALESCE(
              SUM(amount),
              0
            ) AS totalRevenue

          FROM payments

          WHERE hotel_id = ?
            AND payment_status =
              'success'
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

   Supports:
   - single room
   - multiple rooms in one transaction

   Multi-room:
   every room becomes its own booking row.
   Failure of ANY room => entire transaction rollback.
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

        booking_id:
          first.bookingId,

        booking_code:
          first.bookingCode,

        bookings:
          result.bookings,
      });
  } catch (error) {
    await connection.rollback();

    logBookingError(
      "CREATE_BOOKING",
      error
    );

    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "BOOKING_DUPLICATE",
        "A duplicate booking reference already exists. Please try again."
      );
    }

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
      "BOOKING_CREATE_FAILED",
      "The booking could not be created. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   UPDATE BOOKING
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

    /*
     * Lock booking and verify tenant.
     */
    const [[existing]] =
      await connection.query(
        `
          SELECT
            booking_id,
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

    if (!existing) {
      await connection.rollback();

      return sendError(
        res,
        404,
        "BOOKING_NOT_FOUND",
        "The booking was not found in your hotel."
      );
    }

    /*
     * Update currently accepts explicit customer_id.
     * Customer must belong to SAME hotel.
     */
    const customerId =
      parsePositiveInteger(
        req.body.customer_id
      );

    if (!customerId) {
      await connection.rollback();

      return sendError(
        res,
        400,
        "INVALID_CUSTOMER_ID",
        "A valid customer_id is required."
      );
    }

    const [[customer]] =
      await connection.query(
        `
          SELECT
            customer_id

          FROM customers

          WHERE hotel_id = ?
            AND customer_id = ?

          FOR UPDATE
        `,
        [
          context.hotelId,
          customerId,
        ]
      );

    if (!customer) {
      await connection.rollback();

      return sendError(
        res,
        404,
        "CUSTOMER_NOT_FOUND",
        "The customer was not found in your hotel."
      );
    }

    const validation =
      validateBookingItems({
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

        payment_status:
          req.body.payment_status,

        total_amount:
          req.body.total_amount,

        special_request:
          req.body.special_request,
      });

    if (
      validation.error
    ) {
      await connection.rollback();

      return sendError(
        res,
        400,
        "INVALID_BOOKING_DETAILS",
        validation.error
      );
    }

    const [item] =
      validation.value;

    /*
     * Verify + lock destination room.
     */
    await lockRooms(
      connection,
      context.hotelId,
      [item]
    );

    /*
     * Prevent overlap while excluding this booking itself.
     */
    await ensureNoOverlap(
      connection,
      context.hotelId,
      [item],
      bookingId
    );

    await connection.query(
      `
        UPDATE bookings

        SET
          customer_id = ?,
          room_id = ?,
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
        customerId,
        item.roomId,
        context.adminId,
        item.checkIn,
        item.checkOut,
        item.totalGuests,
        item.bookingStatus,
        item.paymentStatus,
        item.totalAmount,
        item.specialRequest,
        context.hotelId,
        bookingId,
      ]
    );

    /*
     * QR originated booking:
     * keep assigned room synchronized.
     */
    if (
      existing
        .source_request_id
    ) {
      await connection.query(
        `
          UPDATE customer_requests

          SET
            assigned_room_id = ?,
            updated_by_admin_id = ?

          WHERE hotel_id = ?
            AND request_id = ?
        `,
        [
          item.roomId,
          context.adminId,
          context.hotelId,
          existing
            .source_request_id,
        ]
      );
    }

    await connection.commit();

    return res
      .status(200)
      .json({
        success: true,
        message:
          "Booking updated successfully.",
      });
  } catch (error) {
    await connection.rollback();

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
      "The booking could not be updated. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   CANCEL BOOKING

   We preserve history instead of deleting real records.
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
            booking_status

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
      await connection.rollback();

      return sendError(
        res,
        404,
        "BOOKING_NOT_FOUND",
        "The booking was not found in your hotel."
      );
    }

    if (
      booking.booking_status ===
      "cancelled"
    ) {
      await connection.rollback();

      return sendError(
        res,
        409,
        "BOOKING_ALREADY_CANCELLED",
        "This booking is already cancelled."
      );
    }

    if (
      booking.booking_status ===
      "checked_out"
    ) {
      await connection.rollback();

      return sendError(
        res,
        409,
        "COMPLETED_BOOKING_CANNOT_CANCEL",
        "A checked-out booking cannot be cancelled."
      );
    }

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

    await connection.commit();

    return res
      .status(200)
      .json({
        success: true,
        message:
          "Booking cancelled successfully.",
      });
  } catch (error) {
    await connection.rollback();

    logBookingError(
      "CANCEL_BOOKING",
      error
    );

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

   Important for future Room Details + Customer Details:

   Real booking history should NOT disappear.

   Hard delete allowed only when:
   - booking is still pending
   - it is NOT a QR booking
   - it has ZERO payment records

   Otherwise Admin must Cancel Booking.
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
      await connection.rollback();

      return sendError(
        res,
        404,
        "BOOKING_NOT_FOUND",
        "The booking was not found in your hotel."
      );
    }

    const [[paymentSummary]] =
      await connection.query(
        `
          SELECT
            COUNT(*)
              AS paymentCount

          FROM payments

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
      ) > 0
    ) {
      await connection.rollback();

      return sendError(
        res,
        409,
        "BOOKING_HISTORY_MUST_BE_PRESERVED",
        "This booking has history and cannot be deleted. Cancel it instead."
      );
    }

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
    await connection.rollback();

    logBookingError(
      "DELETE_BOOKING",
      error
    );

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
        "This booking is linked to hotel records and cannot be deleted. Cancel it instead."
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