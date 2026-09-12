const db = require("../config/db");
const promisePool = db.promisePool; // needed for the transactional approve flow below

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

  if (!full_name || !phone || !check_in || !check_out) {
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
    const [qrRows] = await promisePool.query(
      `
        SELECT qr.hotel_id
        FROM qr_codes qr
        INNER JOIN hotels h
          ON h.hotel_id = qr.hotel_id
        WHERE qr.public_token = ?
          AND qr.status = 'active'
          AND h.status = 'active'
        LIMIT 1
      `,
      [publicToken]
    );

    if (!qrRows.length) {
      return res.status(404).json({
        success: false,
        message: "This QR code is invalid or inactive.",
      });
    }

    const hotelId = Number(qrRows[0].hotel_id);

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
        room_type || null,
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