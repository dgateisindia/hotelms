const db = require("../config/db"); // adjust path if your db file is elsewhere

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