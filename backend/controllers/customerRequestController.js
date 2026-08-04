const db = require("../config/db");
const promisePool = db.promisePool; // needed for the transactional approve flow below

// ===============================
// Create Customer Room Request
// ===============================
exports.createRequest = (req, res) => {
  const {
    room_type,
    full_name,
    phone,
    email,
    gender,
    address,
    check_in,
    check_out,
    guests,
    special_request,
  } = req.body;

  if (!full_name || !phone || !check_in || !check_out) {
    return res.status(400).json({
      success: false,
      message: "Please fill all required fields.",
    });
  }

  const sql = `
    INSERT INTO customer_requests
    (
      room_type,
      full_name,
      phone,
      email,
      gender,
      address,
      check_in,
      check_out,
      guests,
      special_request
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      room_type || null,
      full_name,
      phone,
      email || null,
      gender || null,
      address || null,
      check_in,
      check_out,
      guests || 1,
      special_request || "",
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: err.sqlMessage,
        });
      }

      // Log an admin notification. This runs AFTER the insert succeeds and
      // uses the values already in scope here — fire-and-forget so a
      // notification failure never blocks the customer's response.
      const notificationSql = `
        INSERT INTO notifications (user_id, title, message)
        VALUES (?, ?, ?)
      `;
      db.query(
        notificationSql,
        [
          1, // TODO: replace with the actual admin user_id
          "New Room Request",
          `${full_name} submitted a room request${room_type ? ` for a ${room_type}` : ""}.`,
        ],
        (notifErr) => {
          if (notifErr) console.error("Failed to log notification:", notifErr);
        }
      );

      res.status(201).json({
        success: true,
        message: "Room request submitted successfully.",
        requestId: result.insertId,
      });
    }
  );
};

// ===============================
// Get All Requests
// ===============================
exports.getRequests = (req, res) => {
  const sql = `
    SELECT *
    FROM customer_requests
    ORDER BY created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Database error",
      });
    }

    res.json({
      success: true,
      data: results,
    });
  });
};

// ===============================
// Get Single Request
// ===============================
exports.getRequestById = (req, res) => {
  const sql = `
    SELECT *
    FROM customer_requests
    WHERE request_id = ?
  `;

  db.query(sql, [req.params.id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Database error",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    res.json({
      success: true,
      data: results[0],
    });
  });
};

// ===============================
// Update Status (generic — kept for backward compatibility)
// ===============================
exports.updateStatus = (req, res) => {
  const { status } = req.body;

  const sql = `
    UPDATE customer_requests
    SET status = ?
    WHERE request_id = ?
  `;

  db.query(sql, [status, req.params.id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Database error",
      });
    }

    res.json({
      success: true,
      message: "Status updated successfully.",
    });
  });
};

// ===============================
// Approve Request — admin allocates a room here
// Creates/matches the customer, creates the booking, marks the room
// occupied, and marks the request approved — all in one transaction.
// ===============================
exports.approveRequest = async (req, res) => {
  const { id } = req.params;
  const { assignedRoom } = req.body;

  if (!assignedRoom) {
    return res.status(400).json({
      success: false,
      message: "assignedRoom is required to approve a request.",
    });
  }

  let connection;

  try {
    // 1. Load the request
    const [requestRows] = await promisePool.query(
      `SELECT * FROM customer_requests WHERE request_id = ?`,
      [id]
    );

    if (!requestRows.length) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }

    const request = requestRows[0];

    // 2. Look up the room by the typed room number
    const [roomRows] = await promisePool.query(
      `SELECT room_id, price_per_night, status FROM rooms WHERE room_number = ?`,
      [assignedRoom]
    );

    if (!roomRows.length) {
      return res.status(400).json({
        success: false,
        message: `Room ${assignedRoom} does not exist.`,
      });
    }

    const room = roomRows[0];

    if (room.status === "occupied") {
      return res.status(400).json({
        success: false,
        message: `Room ${assignedRoom} is already occupied.`,
      });
    }

    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    // 3. Find an existing customer by phone, or create one
    let customerId;
    const [existingCustomers] = await connection.query(
      `SELECT customer_id FROM customers WHERE phone = ? LIMIT 1`,
      [request.phone]
    );

    if (existingCustomers.length) {
      customerId = existingCustomers[0].customer_id;
    } else {
      const [customerResult] = await connection.query(
        `INSERT INTO customers (full_name, email, phone, gender, address)
         VALUES (?, ?, ?, ?, ?)`,
        [request.full_name, request.email, request.phone, request.gender, request.address]
      );
      customerId = customerResult.insertId;
    }

    // 4. Work out nights / total amount from the room's nightly rate
    const nights = Math.max(
      1,
      Math.ceil(
        (new Date(request.check_out) - new Date(request.check_in)) / (1000 * 60 * 60 * 24)
      )
    );
    const totalAmount = room.price_per_night ? room.price_per_night * nights : null;
    const bookingCode = `BK${Date.now()}`;

    // 5. Create the booking
    await connection.query(
      `INSERT INTO bookings
        (customer_id, room_id, booking_code, check_in, check_out, total_guests,
         booking_status, payment_status, total_amount, special_request)
       VALUES (?, ?, ?, ?, ?, ?, 'confirmed', 'unpaid', ?, ?)`,
      [
        customerId,
        room.room_id,
        bookingCode,
        request.check_in,
        request.check_out,
        request.guests,
        totalAmount,
        request.special_request,
      ]
    );

    // 6. Mark the room occupied — valid enum value
    await connection.query(
      `UPDATE rooms SET status = 'occupied' WHERE room_id = ?`,
      [room.room_id]
    );

    // 7. Mark the request approved
    await connection.query(
      `UPDATE customer_requests SET status = 'approved', assigned_room = ? WHERE request_id = ?`,
      [assignedRoom, id]
    );

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      message: "Request approved, customer and booking created.",
      data: { customerId, roomId: room.room_id, bookingCode },
    });
  } catch (err) {
    console.error(err);
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    return res.status(500).json({ success: false, message: "Database error" });
  }
};

// ===============================
// Decline Request
// ===============================
exports.declineRequest = (req, res) => {
  const { id } = req.params;

  const updateSql = `
    UPDATE customer_requests
    SET status = 'declined'
    WHERE request_id = ?
  `;

  db.query(updateSql, [id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    db.query(
      `SELECT * FROM customer_requests WHERE request_id = ?`,
      [id],
      (fetchErr, rows) => {
        if (fetchErr || rows.length === 0) {
          return res.json({ success: true, message: "Request declined." });
        }
        res.json({ success: true, message: "Request declined.", data: rows[0] });
      }
    );
  });
};

// ===============================
// Mark Seen
// ===============================
exports.markSeen = (req, res) => {
  db.query(
    `UPDATE customer_requests SET seen = 1 WHERE request_id = ?`,
    [req.params.id],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Database error" });
      }
      res.json({ success: true });
    }
  );
};

// ===============================
// Delete Request
// ===============================
exports.deleteRequest = (req, res) => {
  const sql = `
    DELETE FROM customer_requests
    WHERE request_id = ?
  `;

  db.query(sql, [req.params.id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Database error",
      });
    }

    res.json({
      success: true,
      message: "Request deleted successfully.",
    });
  });
};