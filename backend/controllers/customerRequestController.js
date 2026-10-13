const db = require("../config/db");
const promisePool = db.promisePool; // needed for the transactional approve flow below


/* ============================================================
   PUBLIC QR HELPERS

   The public token resolves the hotel on the server.
   The browser never sends or chooses hotel_id.
============================================================ */

async function findActiveQrHotelByToken(
  publicToken
) {
  const [rows] =
    await promisePool.query(
      `
        SELECT
          qr.hotel_id,
          h.hotel_name,
          h.hotel_type,
          h.star_rating

        FROM qr_codes qr

        INNER JOIN hotels h
          ON h.hotel_id =
            qr.hotel_id

        WHERE qr.public_token = ?
          AND qr.status = 'active'
          AND h.status = 'active'

        LIMIT 1
      `,
      [
        publicToken,
      ]
    );

  return rows[0] || null;
}


async function getHotelRoomTypes(
  hotelId
) {
  const [rows] =
    await promisePool.query(
      `
        SELECT DISTINCT
          TRIM(room_type) AS room_type

        FROM rooms

        WHERE hotel_id = ?
          AND room_type IS NOT NULL
          AND TRIM(room_type) <> ''

        ORDER BY
          room_type ASC
      `,
      [
        hotelId,
      ]
    );

  return rows
    .map(
      (row) =>
        String(
          row.room_type || ""
        ).trim()
    )
    .filter(Boolean);
}

// ===============================
// Create Customer Room Request
// ===============================
exports.createRequest = async (req, res) => {
  const publicToken = String(req.params.publicToken || "").trim();

  const {
    room_type,
    full_name,
    phone,
    email,
    gender,
    nationality,
    address,
    check_in,
    check_out,
    guests,
    special_request,
  } = req.body || {};

  if (!publicToken) {
    return res.status(400).json({
      success: false,
      message: "QR token is required.",
    });
  }

  if (
    !full_name ||
    !phone ||
    !room_type ||
    !check_in ||
    !check_out
  ) {
    return res.status(400).json({
      success: false,
      message: "Please fill all required fields.",
    });
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(check_in) || !datePattern.test(check_out)) {
    return res.status(400).json({
      success: false,
      message: "Check-in and check-out dates are invalid.",
    });
  }

  if (check_out <= check_in) {
    return res.status(400).json({
      success: false,
      message: "Check-out date must be after check-in date.",
    });
  }

  const guestCount =
    guests === undefined ||
    guests === null ||
    guests === ""
      ? 1
      : Number(guests);

  if (!Number.isInteger(guestCount) || guestCount < 1) {
    return res.status(400).json({
      success: false,
      message: "Guests must be at least 1.",
    });
  }

  try {
    const qrHotel =
      await findActiveQrHotelByToken(
        publicToken
      );

    if (!qrHotel) {
      return res.status(404).json({
        success: false,
        message: "This QR code is invalid or inactive.",
      });
    }

    const hotelId =
      Number(
        qrHotel.hotel_id
      );

    const roomTypes =
      await getHotelRoomTypes(
        hotelId
      );

    const requestedRoomType =
      String(
        room_type || ""
      ).trim();

    const canonicalRoomType =
      roomTypes.find(
        (candidate) =>
          candidate.toLowerCase() ===
          requestedRoomType.toLowerCase()
      );

    if (!canonicalRoomType) {
      return res.status(400).json({
        success: false,
        message:
          "Please select a valid room type for this hotel.",
      });
    }

    const [result] = await promisePool.query(
      `
        INSERT INTO customer_requests (
          hotel_id,
          room_type,
          full_name,
          phone,
          email,
          gender,
          nationality,
          address,
          check_in,
          check_out,
          guests,
          special_request
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        hotelId,
        canonicalRoomType,
        full_name.trim(),
        phone.trim(),
        email || null,
        gender || null,
        nationality || null,
        address || null,
        check_in,
        check_out,
        guestCount,
        special_request || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Room request submitted successfully.",
      requestId: result.insertId,
    });
  } catch (err) {
    console.error("Create customer request error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to submit the room request.",
    });
  }
};


/* ============================================================
   PUBLIC QR REQUEST CONTEXT

   Safe public information only:
   - hotel name
   - hotel type
   - star rating
   - actual room types configured for that hotel

   No hotel_id or internal IDs are returned.
============================================================ */

exports.getPublicRequestContext = async (
  req,
  res
) => {
  const publicToken =
    String(
      req.params.publicToken ||
      ""
    ).trim();

  if (!publicToken) {
    return res.status(400).json({
      success: false,
      message:
        "QR token is required.",
    });
  }

  try {
    const qrHotel =
      await findActiveQrHotelByToken(
        publicToken
      );

    if (!qrHotel) {
      return res.status(404).json({
        success: false,
        message:
          "This QR code is invalid or inactive.",
      });
    }

    const roomTypes =
      await getHotelRoomTypes(
        Number(
          qrHotel.hotel_id
        )
      );

    return res.json({
      success: true,

      data: {
        hotelName:
          qrHotel.hotel_name,

        hotelType:
          qrHotel.hotel_type ||
          null,

        starRating:
          qrHotel.star_rating ===
            null ||
          qrHotel.star_rating ===
            undefined
            ? null
            : Number(
                qrHotel.star_rating
              ),

        roomTypes,
      },
    });
  } catch (err) {
    console.error(
      "Get public QR request context error:",
      err
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load this hotel request form.",
    });
  }
};


exports.getHotelQrToken = async (req, res) => {
  const hotelId = Number(req.dbUser.hotelId);

  if (!Number.isInteger(hotelId) || hotelId < 1) {
    return res.status(403).json({
      success: false,
      message: "Hotel context is unavailable.",
    });
  }

  try {
    const [rows] = await promisePool.query(
      `
        SELECT public_token, status
        FROM qr_codes
        WHERE hotel_id = ?
        LIMIT 1
      `,
      [hotelId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "QR code is not configured for this hotel.",
      });
    }

    if (rows[0].status !== "active") {
      return res.status(409).json({
        success: false,
        message: "The hotel QR code is inactive.",
      });
    }

    return res.json({
      success: true,
      data: {
        publicToken: rows[0].public_token,
        status: rows[0].status,
      },
    });
  } catch (err) {
    console.error("Get hotel QR token error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to load the hotel QR code.",
    });
  }
};

// ===============================
// Get All Requests
// ===============================
exports.getRequests = async (req, res) => {
  const hotelId = Number(req.dbUser.hotelId);

  try {
    const [rows] = await promisePool.query(
      `
        SELECT
          request_id,
          hotel_id,
          room_type,
          full_name,
          phone,
          email,
          gender,
          nationality,
          address,
          DATE_FORMAT(check_in,'%Y-%m-%d') AS check_in,
          DATE_FORMAT(check_out,'%Y-%m-%d') AS check_out,
          guests,
          special_request,
          status,
          assigned_room_id,
          (
            SELECT r.room_number
            FROM rooms r
            WHERE r.room_id = customer_requests.assigned_room_id
              AND r.hotel_id = customer_requests.hotel_id
            LIMIT 1
          ) AS assigned_room_number,
          handled_by_admin_id,
          updated_by_admin_id,
          handled_at,
          seen,
          created_at,
          updated_at
        FROM customer_requests
        WHERE hotel_id = ?
        ORDER BY created_at DESC
      `,
      [hotelId]
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("Get customer requests error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to load customer requests.",
    });
  }
};

// ===============================
// Get Single Request
// ===============================
exports.getRequestById = async (req, res) => {
  const hotelId = Number(req.dbUser.hotelId);
  const requestId = Number(req.params.id);

  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID.",
    });
  }

  try {
    const [rows] = await promisePool.query(
      `
        SELECT
          request_id,
          hotel_id,
          room_type,
          full_name,
          phone,
          email,
          gender,
          nationality,
          address,
          DATE_FORMAT(check_in,'%Y-%m-%d') AS check_in,
          DATE_FORMAT(check_out,'%Y-%m-%d') AS check_out,
          guests,
          special_request,
          status,
          assigned_room_id,
          (
            SELECT r.room_number
            FROM rooms r
            WHERE r.room_id = customer_requests.assigned_room_id
              AND r.hotel_id = customer_requests.hotel_id
            LIMIT 1
          ) AS assigned_room_number,
          handled_by_admin_id,
          updated_by_admin_id,
          handled_at,
          seen,
          created_at,
          updated_at
        FROM customer_requests
        WHERE hotel_id = ?
          AND request_id = ?
        LIMIT 1
      `,
      [hotelId, requestId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    console.error("Get customer request error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to load the customer request.",
    });
  }
};

// ===============================
// Update Status (generic — kept for backward compatibility)
// ===============================
exports.updateStatus = async (req, res) => {
  const hotelId = Number(req.dbUser.hotelId);
  const adminId = Number(req.dbUser.adminId);
  const requestId = Number(req.params.id);
  const status = String(req.body?.status || "").trim().toLowerCase();

  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID.",
    });
  }

  if (!["pending", "declined"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Only pending or declined status can be set through this endpoint.",
    });
  }

  try {
    const [result] = await promisePool.query(
      `
        UPDATE customer_requests
        SET
          status = ?,
          updated_by_admin_id = ?,
          handled_by_admin_id = CASE WHEN ?='declined' THEN ? ELSE handled_by_admin_id END,
          handled_at = CASE WHEN ?='declined' THEN NOW() ELSE handled_at END
        WHERE hotel_id = ?
          AND request_id = ?
          AND status <> 'approved'
      `,
      [
        status,
        adminId,
        status,
        adminId,
        status,
        hotelId,
        requestId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found or cannot be changed.",
      });
    }

    return res.json({
      success: true,
      message: "Status updated successfully.",
    });
  } catch (err) {
    console.error("Update customer request status error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to update request status.",
    });
  }
};

// ===============================
// Approve Request — admin allocates a room here
// Creates/matches the customer, creates the booking, marks the room
// occupied, and marks the request approved — all in one transaction.
// ===============================
exports.approveRequest = async (req, res) => {
  return res.status(409).json({
    success: false,
    code: "USE_CANONICAL_BOOKING_FLOW",
    message: "Convert this request through the booking flow. Direct request approval is disabled.",
  });
};

// ===============================
// Decline Request
// ===============================
exports.declineRequest = async (req, res) => {
  const hotelId = Number(req.dbUser.hotelId);
  const adminId = Number(req.dbUser.adminId);
  const requestId = Number(req.params.id);

  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID.",
    });
  }

  try {
    const [result] = await promisePool.query(
      `
        UPDATE customer_requests
        SET
          status = 'declined',
          handled_by_admin_id = ?,
          updated_by_admin_id = ?,
          handled_at = NOW(),
          seen = 1
        WHERE hotel_id = ?
          AND request_id = ?
          AND status = 'pending'
      `,
      [adminId, adminId, hotelId, requestId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending request not found.",
      });
    }

    const [rows] = await promisePool.query(
      `
        SELECT
          request_id,
          hotel_id,
          room_type,
          full_name,
          phone,
          email,
          gender,
          nationality,
          address,
          DATE_FORMAT(check_in,'%Y-%m-%d') AS check_in,
          DATE_FORMAT(check_out,'%Y-%m-%d') AS check_out,
          guests,
          special_request,
          status,
          assigned_room_id,
          (
            SELECT r.room_number
            FROM rooms r
            WHERE r.room_id = customer_requests.assigned_room_id
              AND r.hotel_id = customer_requests.hotel_id
            LIMIT 1
          ) AS assigned_room_number,
          handled_by_admin_id,
          updated_by_admin_id,
          handled_at,
          seen,
          created_at,
          updated_at
        FROM customer_requests
        WHERE hotel_id = ?
          AND request_id = ?
        LIMIT 1
      `,
      [hotelId, requestId]
    );

    return res.json({
      success: true,
      message: "Request declined.",
      data: rows[0] || null,
    });
  } catch (err) {
    console.error("Decline customer request error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to decline the request.",
    });
  }
};

// ===============================
// Mark Seen
// ===============================
exports.markSeen = async (req, res) => {
  const hotelId = Number(req.dbUser.hotelId);
  const adminId = Number(req.dbUser.adminId);
  const requestId = Number(req.params.id);

  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID.",
    });
  }

  try {
    const [result] = await promisePool.query(
      `
        UPDATE customer_requests
        SET
          seen = 1,
          updated_by_admin_id = ?
        WHERE hotel_id = ?
          AND request_id = ?
      `,
      [adminId, hotelId, requestId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    return res.json({
      success: true,
    });
  } catch (err) {
    console.error("Mark customer request seen error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to update the request.",
    });
  }
};

// ===============================
// Delete Request
// ===============================
exports.deleteRequest = async (req, res) => {
  const hotelId = Number(req.dbUser.hotelId);
  const requestId = Number(req.params.id);

  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID.",
    });
  }

  try {
    const [result] = await promisePool.query(
      `
        DELETE FROM customer_requests
        WHERE hotel_id = ?
          AND request_id = ?
          AND status IN ('pending','declined')
      `,
      [hotelId, requestId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found or its history must be preserved.",
      });
    }

    return res.json({
      success: true,
      message: "Request deleted successfully.",
    });
  } catch (err) {
    console.error("Delete customer request error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to delete the request.",
    });
  }
};