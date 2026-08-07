const crypto = require("crypto");

const db =
  require("../config/db").promisePool;

/* ============================================================
   RESPONSE HELPERS
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

function logHotelError(
  operation,
  error
) {
  console.error(
    `[HOTEL:${operation}] ${
      error?.code ||
      "UNKNOWN_ERROR"
    }: ${
      error?.message ||
      "Unknown hotel error"
    }`
  );
}

/* ============================================================
   DISPLAY ID HELPERS
============================================================ */

function formatHotelDisplayId(
  hotelId
) {
  return `HT-${String(
    hotelId
  ).padStart(4, "0")}`;
}

function parseHotelDisplayId(
  value
) {
  const match =
    /^HT-(\d+)$/i.exec(
      String(value || "").trim()
    );

  if (!match) {
    return null;
  }

  const hotelId =
    Number(match[1]);

  if (
    !Number.isSafeInteger(
      hotelId
    ) ||
    hotelId <= 0
  ) {
    return null;
  }

  return hotelId;
}

/* ============================================================
   VALIDATION HELPERS
============================================================ */

function cleanOptionalString(
  value,
  maxLength,
  fieldLabel
) {
  if (
    value === undefined ||
    value === null
  ) {
    return {
      value: null,
      error: "",
    };
  }

  const cleanedValue =
    String(value).trim();

  if (!cleanedValue) {
    return {
      value: null,
      error: "",
    };
  }

  if (
    cleanedValue.length >
    maxLength
  ) {
    return {
      value: null,

      error:
        `${fieldLabel} must not exceed ` +
        `${maxLength} characters.`,
    };
  }

  return {
    value: cleanedValue,
    error: "",
  };
}

function validateHotelPayload(
  body
) {
  const source =
    body &&
    typeof body === "object"
      ? body
      : {};

  const hotelName =
    String(
      source.hotelName || ""
    ).trim();

  if (!hotelName) {
    return {
      error:
        "Hotel name is required.",
    };
  }

  if (
    hotelName.length < 2 ||
    hotelName.length > 255
  ) {
    return {
      error:
        "Hotel name must contain between 2 and 255 characters.",
    };
  }

  const hotelType =
    cleanOptionalString(
      source.hotelType,
      100,
      "Hotel type"
    );

  if (hotelType.error) {
    return {
      error: hotelType.error,
    };
  }

  const hotelDescription =
    cleanOptionalString(
      source.hotelDescription,
      5000,
      "Hotel description"
    );

  if (
    hotelDescription.error
  ) {
    return {
      error:
        hotelDescription.error,
    };
  }

  const gstNumber =
    cleanOptionalString(
      source.gstNumber,
      20,
      "GST number"
    );

  if (gstNumber.error) {
    return {
      error: gstNumber.error,
    };
  }

  const panNumber =
    cleanOptionalString(
      source.panNumber,
      20,
      "PAN number"
    );

  if (panNumber.error) {
    return {
      error: panNumber.error,
    };
  }

  const businessRegistrationNumber =
    cleanOptionalString(
      source.businessRegistrationNumber,
      100,
      "Business registration number"
    );

  if (
    businessRegistrationNumber.error
  ) {
    return {
      error:
        businessRegistrationNumber.error,
    };
  }

  const hotelLogo =
    cleanOptionalString(
      source.hotelLogo,
      255,
      "Hotel logo URL"
    );

  if (hotelLogo.error) {
    return {
      error: hotelLogo.error,
    };
  }

  let starRating = null;

  if (
    source.starRating !==
      undefined &&
    source.starRating !== null &&
    String(
      source.starRating
    ).trim() !== ""
  ) {
    starRating = Number(
      source.starRating
    );

    if (
      !Number.isInteger(
        starRating
      ) ||
      starRating < 1 ||
      starRating > 5
    ) {
      return {
        error:
          "Star rating must be a whole number between 1 and 5.",
      };
    }
  }

  let yearEstablished = null;

  if (
    source.yearEstablished !==
      undefined &&
    source.yearEstablished !==
      null &&
    String(
      source.yearEstablished
    ).trim() !== ""
  ) {
    yearEstablished = Number(
      source.yearEstablished
    );

    const maximumYear =
      new Date().getFullYear() +
      1;

    if (
      !Number.isInteger(
        yearEstablished
      ) ||
      yearEstablished < 1800 ||
      yearEstablished >
        maximumYear
    ) {
      return {
        error:
          `Year established must be between ` +
          `1800 and ${maximumYear}.`,
      };
    }
  }

  return {
    error: "",

    value: {
      hotelName,

      hotelType:
        hotelType.value,

      hotelDescription:
        hotelDescription.value,

      starRating,
      yearEstablished,

      gstNumber:
        gstNumber.value
          ?.toUpperCase() ||
        null,

      panNumber:
        panNumber.value
          ?.toUpperCase() ||
        null,

      businessRegistrationNumber:
        businessRegistrationNumber.value,

      hotelLogo:
        hotelLogo.value,
    },
  };
}

/* ============================================================
   DATABASE ROW MAPPING
============================================================ */

function mapHotelRow(row) {
  const totalRooms =
    Number(
      row.total_rooms || 0
    );

  const occupiedRooms =
    Number(
      row.occupied_rooms || 0
    );

  const availableRooms =
    Number(
      row.available_rooms || 0
    );

  return {
    displayId:
      formatHotelDisplayId(
        row.hotel_id
      ),

    name: row.hotel_name,
    type: row.hotel_type,
    description: row.hotel_desc,

    starRating:
      row.star_rating === null
        ? null
        : Number(
            row.star_rating
          ),

    yearEstablished:
      row.year_established ===
      null
        ? null
        : Number(
            row.year_established
          ),

    gstNumber:
      row.gst_number,

    panNumber:
      row.pan_number,

    businessRegistrationNumber:
      row.business_reg_number,

    logo: row.hotel_logo,
    status: row.status,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,

    admins: {
      count: Number(
        row.admin_count || 0
      ),

      names: row.admin_names
        ? String(
            row.admin_names
          )
            .split("||")
            .map((name) =>
              name.trim()
            )
            .filter(Boolean)
        : [],
    },

    rooms: {
      total: totalRooms,

      occupied:
        occupiedRooms,

      available:
        availableRooms,

      /*
       * Null means occupancy is not applicable
       * because the hotel has no rooms yet.
       */
      occupancyRate:
        totalRooms === 0
          ? null
          : Math.round(
              (occupiedRooms /
                totalRooms) *
                100
            ),
    },

    today: {
      bookings: Number(
        row.today_bookings ||
          0
      ),

      revenue: Number(
        row.today_revenue ||
          0
      ),
    },

    pendingRequests:
      Number(
        row.pending_requests ||
          0
      ),

    qr: {
      status:
        row.qr_status ||
        "missing",

      publicToken:
        row.public_token ||
        null,
    },
  };
}

/* ============================================================
   COMMON PORTFOLIO QUERY
============================================================ */

const HOTEL_PORTFOLIO_QUERY = `
  SELECT
    h.hotel_id,
    h.hotel_name,
    h.hotel_type,
    h.hotel_desc,
    h.star_rating,
    h.year_established,
    h.gst_number,
    h.pan_number,
    h.business_reg_number,
    h.hotel_logo,
    h.status,
    h.created_at,
    h.updated_at,

    COALESCE(
      admin_summary.admin_count,
      0
    ) AS admin_count,

    admin_summary.admin_names,

    COALESCE(
      room_summary.total_rooms,
      0
    ) AS total_rooms,

    COALESCE(
      room_summary.occupied_rooms,
      0
    ) AS occupied_rooms,

    COALESCE(
      room_summary.available_rooms,
      0
    ) AS available_rooms,

    COALESCE(
      booking_summary.today_bookings,
      0
    ) AS today_bookings,

    COALESCE(
      payment_summary.today_revenue,
      0
    ) AS today_revenue,

    COALESCE(
      request_summary.pending_requests,
      0
    ) AS pending_requests,

    qr.status AS qr_status,
    qr.public_token

  FROM hotels h

  LEFT JOIN (
    SELECT
      superadmin_id,
      hotel_id,
      COUNT(*) AS admin_count,

      GROUP_CONCAT(
        full_name
        ORDER BY full_name
        SEPARATOR '||'
      ) AS admin_names

    FROM admins

    WHERE superadmin_id = ?

    GROUP BY
      superadmin_id,
      hotel_id
  ) admin_summary

    ON admin_summary.superadmin_id =
       h.superadmin_id

   AND admin_summary.hotel_id =
       h.hotel_id

  LEFT JOIN (
    SELECT
      hotel_id,

      COUNT(*) AS total_rooms,

      SUM(
        status = 'occupied'
      ) AS occupied_rooms,

      SUM(
        status = 'available'
      ) AS available_rooms

    FROM rooms

    GROUP BY hotel_id
  ) room_summary

    ON room_summary.hotel_id =
       h.hotel_id

  LEFT JOIN (
    SELECT
      hotel_id,
      COUNT(*) AS today_bookings

    FROM bookings

    WHERE DATE(created_at) =
          CURDATE()

    GROUP BY hotel_id
  ) booking_summary

    ON booking_summary.hotel_id =
       h.hotel_id

  LEFT JOIN (
    SELECT
      hotel_id,

      COALESCE(
        SUM(amount),
        0
      ) AS today_revenue

    FROM payments

    WHERE payment_status =
          'success'

      AND DATE(payment_date) =
          CURDATE()

    GROUP BY hotel_id
  ) payment_summary

    ON payment_summary.hotel_id =
       h.hotel_id

  LEFT JOIN (
    SELECT
      hotel_id,
      COUNT(*) AS pending_requests

    FROM customer_requests

    WHERE status = 'pending'

    GROUP BY hotel_id
  ) request_summary

    ON request_summary.hotel_id =
       h.hotel_id

  LEFT JOIN qr_codes qr

    ON qr.hotel_id =
       h.hotel_id
`;

/* ============================================================
   GET /api/superadmin/hotels
============================================================ */

async function getHotels(
  req,
  res
) {
  const superadminId =
    req.dbUser?.superadminId;

  if (!superadminId) {
    return sendError(
      res,
      403,
      "SUPER_ADMIN_CONTEXT_MISSING",
      "Your Super Admin account could not be identified. Please sign in again."
    );
  }

  try {
    const [rows] =
      await db.query(
        `
          ${HOTEL_PORTFOLIO_QUERY}

          WHERE h.superadmin_id = ?

          ORDER BY
            h.created_at DESC,
            h.hotel_id DESC
        `,
        [
          superadminId,
          superadminId,
        ]
      );

    const hotels =
      rows.map(mapHotelRow);

    return res
      .status(200)
      .json({
        success: true,

        summary: {
          totalHotels:
            hotels.length,

          activeHotels:
            hotels.filter(
              (hotel) =>
                hotel.status ===
                "active"
            ).length,

          pendingHotels:
            hotels.filter(
              (hotel) =>
                hotel.status ===
                "pending"
            ).length,

          rejectedHotels:
            hotels.filter(
              (hotel) =>
                hotel.status ===
                "rejected"
            ).length,
        },

        hotels,
      });
  } catch (error) {
    logHotelError(
      "GET_HOTELS",
      error
    );

    return sendError(
      res,
      500,
      "HOTEL_LIST_FETCH_FAILED",
      "Your hotels could not be loaded. Please try again."
    );
  }
}

/* ============================================================
   GET /api/superadmin/hotels/:hotelDisplayId
============================================================ */

async function getHotelByDisplayId(
  req,
  res
) {
  const superadminId =
    req.dbUser?.superadminId;

  const hotelId =
    parseHotelDisplayId(
      req.params.hotelDisplayId
    );

  if (!superadminId) {
    return sendError(
      res,
      403,
      "SUPER_ADMIN_CONTEXT_MISSING",
      "Your Super Admin account could not be identified. Please sign in again."
    );
  }

  if (!hotelId) {
    return sendError(
      res,
      400,
      "INVALID_HOTEL_ID",
      "The hotel ID is invalid. Use a value such as HT-0001."
    );
  }

  try {
    const [rows] =
      await db.query(
        `
          ${HOTEL_PORTFOLIO_QUERY}

          WHERE h.hotel_id = ?
            AND h.superadmin_id = ?

          LIMIT 1
        `,
        [
          superadminId,
          hotelId,
          superadminId,
        ]
      );

    if (
      rows.length === 0
    ) {
      return sendError(
        res,
        404,
        "HOTEL_NOT_FOUND",
        "The requested hotel was not found in your portfolio."
      );
    }

    return res
      .status(200)
      .json({
        success: true,

        hotel:
          mapHotelRow(
            rows[0]
          ),
      });
  } catch (error) {
    logHotelError(
      "GET_HOTEL",
      error
    );

    return sendError(
      res,
      500,
      "HOTEL_FETCH_FAILED",
      "The hotel details could not be loaded. Please try again."
    );
  }
}

/* ============================================================
   POST /api/superadmin/hotels

   Creates both:
   1. Hotel record
   2. Hotel-level QR record

   Both operations run inside one transaction.
============================================================ */

async function createHotel(
  req,
  res
) {
  const superadminId =
    req.dbUser?.superadminId;

  if (!superadminId) {
    return sendError(
      res,
      403,
      "SUPER_ADMIN_CONTEXT_MISSING",
      "Your Super Admin account could not be identified. Please sign in again."
    );
  }

  const validation =
    validateHotelPayload(
      req.body
    );

  if (validation.error) {
    return sendError(
      res,
      400,
      "INVALID_HOTEL_DETAILS",
      validation.error
    );
  }

  const hotel =
    validation.value;

  /*
   * 32 random bytes produce a
   * 64-character hexadecimal token.
   */
  const publicToken =
    crypto
      .randomBytes(32)
      .toString("hex");

  let connection;

  try {
    connection =
      await db.getConnection();

    await connection.beginTransaction();

    const [hotelResult] =
      await connection.query(
        `
          INSERT INTO hotels (
            superadmin_id,
            hotel_name,
            hotel_type,
            hotel_desc,
            star_rating,
            year_established,
            gst_number,
            pan_number,
            business_reg_number,
            hotel_logo,
            status
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'active'
          )
        `,
        [
          superadminId,
          hotel.hotelName,
          hotel.hotelType,
          hotel.hotelDescription,
          hotel.starRating,
          hotel.yearEstablished,
          hotel.gstNumber,
          hotel.panNumber,
          hotel.businessRegistrationNumber,
          hotel.hotelLogo,
        ]
      );

    const hotelId =
      Number(
        hotelResult.insertId
      );

    await connection.query(
      `
        INSERT INTO qr_codes (
          hotel_id,
          public_token,
          status
        )
        VALUES (
          ?,
          ?,
          'active'
        )
      `,
      [
        hotelId,
        publicToken,
      ]
    );

    await connection.commit();

    return res
      .status(201)
      .json({
        success: true,

        message:
          "Hotel created successfully.",

        hotel: {
          displayId:
            formatHotelDisplayId(
              hotelId
            ),

          name:
            hotel.hotelName,

          type:
            hotel.hotelType,

          description:
            hotel.hotelDescription,

          starRating:
            hotel.starRating,

          yearEstablished:
            hotel.yearEstablished,

          gstNumber:
            hotel.gstNumber,

          panNumber:
            hotel.panNumber,

          businessRegistrationNumber:
            hotel.businessRegistrationNumber,

          logo:
            hotel.hotelLogo,

          status: "active",

          admins: {
            count: 0,
            names: [],
          },

          rooms: {
            total: 0,
            occupied: 0,
            available: 0,
            occupancyRate: null,
          },

          today: {
            bookings: 0,
            revenue: 0,
          },

          pendingRequests: 0,

          qr: {
            status: "active",
            publicToken,
          },
        },
      });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (
        rollbackError
      ) {
        logHotelError(
          "CREATE_HOTEL_ROLLBACK",
          rollbackError
        );
      }
    }

    logHotelError(
      "CREATE_HOTEL",
      error
    );

    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "HOTEL_CONFLICT",
        "The hotel could not be created because one of its unique details is already in use."
      );
    }

    return sendError(
      res,
      500,
      "HOTEL_CREATE_FAILED",
      "The hotel could not be created. No partial hotel or QR record was saved."
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  getHotels,
  getHotelByDisplayId,
  createHotel,
};