const db = require("../config/db").promisePool;

exports.createRoom = async (req, res) => {
  try {
    const {
      roomNo,
      type,
      floor,
      capacity,
      price,
      status
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO rooms
      (room_number, room_type, floor_number, capacity, price_per_night, status)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        roomNo,
        type,
        floor,
        capacity,
        price,
        status
      ]
    );

    res.status(201).json({
      success: true,
      message: "Room added successfully",
      roomId: result.insertId,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const [rooms] = await db.query(
      "SELECT * FROM rooms ORDER BY room_id DESC"
    );

    res.json(rooms);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      roomNo,
      type,
      floor,
      capacity,
      price,
      status,
    } = req.body;

    await db.query(
      `UPDATE rooms
       SET room_number=?,
           room_type=?,
           floor_number=?,
           capacity=?,
           price_per_night=?,
           status=?
       WHERE room_id=?`,
      [
        roomNo,
        type,
        floor,
        capacity,
        price,
        status,
        id,
      ]
    );

    res.json({
      success: true,
      message: "Room updated successfully",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "DELETE FROM rooms WHERE room_id=?",
      [id]
    );

    res.json({
      success: true,
      message: "Room deleted successfully",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
};

// ========================================
// GET AVAILABLE ROOMS (status + date-range, check-out optional)
// ========================================
exports.getAvailableRooms = async (req, res) => {
  try {
    const { checkIn, checkOut, excludeBookingId } = req.query;

    if (!checkIn) {
      return res.status(400).json({
        success: false,
        message: "checkIn query param is required",
      });
    }

    let overlapCondition;
    let params;

    if (checkOut) {
      // Both dates known: standard overlap check.
      // A booking conflicts if it starts before our check-out AND
      // (it has no end date yet, OR it ends after our check-in).
      overlapCondition = `
        b.check_in < ?
        AND (b.check_out IS NULL OR b.check_out > ?)
      `;
      params = [excludeBookingId || 0, checkOut, checkIn];
    } else {
      // Only check-in known (open-ended stay): a booking conflicts if
      // it's already underway or starts on/before our check-in and
      // hasn't ended by then, OR it starts at any point after our
      // check-in (since our stay has no fixed end, any future booking
      // for that room could conflict).
      overlapCondition = `
        (b.check_out IS NULL OR b.check_out > ?)
      `;
      params = [excludeBookingId || 0, checkIn];
    }

    const [rooms] = await db.query(
      `
      SELECT r.*
      FROM rooms r
      WHERE r.status != 'maintenance'
        AND r.room_id NOT IN (
          SELECT b.room_id
          FROM bookings b
          WHERE LOWER(b.booking_status) != 'cancelled'
            AND b.booking_id != ?
            AND ${overlapCondition}
        )
      ORDER BY r.room_number ASC
      `,
      params
    );

    res.json({ success: true, data: rooms });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};