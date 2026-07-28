const db = require("../config/db").promisePool;

// ===============================
// GET ALL BOOKINGS
// ===============================
exports.getBookingDetails = async (req, res) => {

    try {

        const { id } = req.params;

        const [[booking]] = await db.query(`

        SELECT

            b.booking_id,

            b.booking_code,

            b.check_in,

            b.check_out,

            b.payment_status,

            c.full_name,

            c.phone,

            c.email,

            r.room_number,

            r.price_per_night

        FROM bookings b

        JOIN customers c
        ON b.customer_id=c.customer_id

        JOIN rooms r
        ON b.room_id=r.room_id

        WHERE b.booking_id=?

        `, [id]);

        if (!booking) {

            return res.status(404).json({
                message: "Booking not found"
            });

        }

        res.json(booking);

    }
    catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Server Error"
        });

    }

};
// ===============================
// GET ALL BOOKINGS
// ===============================
exports.getBookings = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        b.booking_id,
        b.booking_code,
        b.customer_id,
        b.room_id,
        b.check_in,
        b.check_out,
        b.total_guests,
        b.booking_status,
        b.payment_status,
        b.total_amount,
        b.special_request,

        c.full_name,
        c.phone,

        r.room_number,
        r.room_type,
        r.price_per_night

      FROM bookings b

      LEFT JOIN customers c
        ON b.customer_id = c.customer_id

      LEFT JOIN rooms r
        ON b.room_id = r.room_id

      ORDER BY b.booking_id DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error("Get Bookings Error:", err);

    res.status(500).json({
      success: false,
      message: "Unable to fetch bookings"
    });
  }
};
// ===============================
// GET SINGLE BOOKING
// ===============================
exports.getBooking = async (req, res) => {

  try {

    const [rows] = await db.query(`
      SELECT
        b.*,

        c.full_name,
        c.phone,
        c.email,
        c.gender,
        c.nationality,
        c.address,
        c.customer_type,
        c.id_proof_type,
        c.id_proof_number,

        r.room_number,
        r.room_type,
        r.price_per_night

      FROM bookings b

      LEFT JOIN customers c
      ON b.customer_id=c.customer_id

      LEFT JOIN rooms r
      ON b.room_id=r.room_id

      WHERE b.booking_id=?
    `,[req.params.id]);

    if(rows.length===0){

      return res.status(404).json({
        success:false,
        message:"Booking not found"
      });

    }

    res.json(rows[0]);

  } catch(err){

    console.error(err);

    res.status(500).json({
      success:false,
      message:"Server Error"
    });

  }

};

// ===============================
// BOOKING DASHBOARD STATS
// ===============================
// ===============================
// BOOKING DASHBOARD STATS
// ===============================
exports.getBookingStats = async (req,res)=>{

  try{

    const [[stats]] = await db.query(`
      SELECT

      COUNT(*) AS totalBookings,

      SUM(
        booking_status='Confirmed'
      ) AS confirmedBookings,

      SUM(
        booking_status='Pending'
      ) AS pendingBookings,

      IFNULL(
        SUM(total_amount),
        0
      ) AS totalRevenue

      FROM bookings
    `);
    // ...unchanged below

    res.json({

      success:true,

      data:{

        totalBookings:Number(stats.totalBookings),

        confirmedBookings:Number(stats.confirmedBookings),

        pendingBookings:Number(stats.pendingBookings),

        totalRevenue:Number(stats.totalRevenue)

      }

    });

  }catch(err){

    console.error(err);

    res.status(500).json({

      success:false,

      message:"Server Error"

    });

  }

};
// ========================================
// ADD BOOKING
// ========================================

// ========================================
// ADD BOOKING
// ========================================
exports.addBooking = async (req, res) => {
  console.log("POST BODY");
  console.log(req.body);

  const formatMySQLDate = (value) => {
  if (!value) return null;

  return new Date(value)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
};

const formattedCheckIn = formatMySQLDate(check_in);
const formattedCheckOut = check_out
  ? formatMySQLDate(check_out)
  : null;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
const {
  customer_id,
  room_id,
  check_in,
  check_out,
  total_guests,
  booking_status,
  payment_status,
  total_amount,
  special_request,
} = req.body;
    // -----------------------------
    // Validate Required Fields
    // -----------------------------
    if (!customer_id || !room_id || !check_in) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "customer_id, room_id, and check_in are required.",
      });
    }

    // -----------------------------
    // Validate Customer
    // -----------------------------
    const [customer] = await connection.query(
      "SELECT customer_id FROM customers WHERE customer_id = ?",
      [customer_id]
    );

    if (customer.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // -----------------------------
    // Validate Room
    // -----------------------------
    const [room] = await connection.query(
      "SELECT room_id, status FROM rooms WHERE room_id = ?",
      [room_id]
    );

    if (room.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // -----------------------------
    // Check Room Not Under Maintenance
    // (status column is only a hard gate for maintenance now — a
    // room's day-to-day "occupied/available" state is date-specific
    // and handled by the overlap check below, not this static field)
    // -----------------------------
    if (room[0].status === "maintenance") {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Room is under maintenance and cannot be booked.",
      });
    }

    // -----------------------------
    // Check Date-Overlap Availability
    // Mirrors the logic in getAvailableRooms: check-out is optional
    // (open-ended stay), and an existing booking with a NULL
    // check-out is treated as still ongoing.
    // -----------------------------
    let overlapCondition;
    let overlapParams;

    if (check_out) {
      overlapCondition = `
        check_in < ?
        AND (check_out IS NULL OR check_out > ?)
      `;
      overlapParams = [room_id, check_out, check_in];
    } else {
      overlapCondition = `
        (check_out IS NULL OR check_out > ?)
      `;
      overlapParams = [room_id, check_in];
    }

    const [conflicts] = await connection.query(
      `
      SELECT booking_id FROM bookings
      WHERE room_id = ?
        AND LOWER(booking_status) != 'cancelled'
        AND ${overlapCondition}
      `,
      overlapParams
    );

    if (conflicts.length > 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Room is not available for the selected dates.",
      });
    }

    // -----------------------------
    // Generate Booking Code
    // -----------------------------
    const [[lastBooking]] = await connection.query(`
      SELECT booking_id
      FROM bookings
      ORDER BY booking_id DESC
      LIMIT 1
    `);

    let bookingCode = "BK-1001";

    if (lastBooking) {
      bookingCode = `BK-${1001 + lastBooking.booking_id}`;
    }

    // -----------------------------
    // Insert Booking
    // -----------------------------
    const [result] = await connection.query(
      `
      INSERT INTO bookings
      (
        booking_code,
        customer_id,
        room_id,
        check_in,
        check_out,
        total_guests,
        booking_status,
        payment_status,
        total_amount,
        special_request
      )

      VALUES
      (?,?,?,?,?,?,?,?,?,?)
      `,
      [
        bookingCode,
        customer_id,
        room_id,
       formattedCheckIn,
      formattedCheckOut,
        total_guests,
        booking_status,
        payment_status,
        total_amount,
        special_request,
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      booking_id: result.insertId,
      booking_code: bookingCode,
    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server Error while creating booking.",
    });

  } finally {

    connection.release();

  }
};

// ========================================
// UPDATE BOOKING
// ========================================
exports.updateBooking = async (req, res) => {

  const connection = await db.getConnection();

  try {

    await connection.beginTransaction();

    const bookingId = req.params.id;

    const {
      customer_id,
      room_id,
      check_in,
      check_out,
      total_guests,
      booking_status,
      payment_status,
      total_amount,
      special_request,
    } = req.body;

    if (!customer_id || !room_id || !check_in) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "customer_id, room_id, and check_in are required.",
      });
    }

    // Existing booking
    const [existing] = await connection.query(
      "SELECT * FROM bookings WHERE booking_id=?",
      [bookingId]
    );

    if (!existing.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // -----------------------------
    // Validate Room
    // -----------------------------
    const [room] = await connection.query(
      "SELECT room_id, status FROM rooms WHERE room_id = ?",
      [room_id]
    );

    if (room.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    if (room[0].status === "maintenance") {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Room is under maintenance and cannot be booked.",
      });
    }

    // -----------------------------
    // Check Date-Overlap Availability
    // Exclude THIS booking itself from the conflict check, since
    // we're updating it, not creating a new one.
    // -----------------------------
    let overlapCondition;
    let overlapParams;

    if (check_out) {
      overlapCondition = `
        check_in < ?
        AND (check_out IS NULL OR check_out > ?)
      `;
      overlapParams = [room_id, bookingId, check_out, check_in];
    } else {
      overlapCondition = `
        (check_out IS NULL OR check_out > ?)
      `;
      overlapParams = [room_id, bookingId, check_in];
    }

    const [conflicts] = await connection.query(
      `
      SELECT booking_id FROM bookings
      WHERE room_id = ?
        AND booking_id != ?
        AND LOWER(booking_status) != 'cancelled'
        AND ${overlapCondition}
      `,
      overlapParams
    );

    if (conflicts.length > 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Room is not available for the selected dates.",
      });
    }

    await connection.query(

      `UPDATE bookings

      SET

      customer_id=?,
      room_id=?,
      check_in=?,
      check_out=?,
      total_guests=?,
      booking_status=?,
      payment_status=?,
      total_amount=?,
      special_request=?

      WHERE booking_id=?`,

      [

        customer_id,
        room_id,
        check_in,
        check_out || null,
        total_guests,
        booking_status,
        payment_status,
        total_amount,
        special_request,
        bookingId

      ]

    );

    await connection.commit();

    return res.json({

      success: true,
      message: "Booking updated successfully"

    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    return res.status(500).json({

      success: false,
      message: "Server Error while updating booking."

    });

  } finally {

    connection.release();

  }

};

// ========================================
// CANCEL BOOKING
// ========================================
exports.cancelBooking = async (req, res) => {

  const connection = await db.getConnection();

  try {

    await connection.beginTransaction();

    const bookingId = req.params.id;

    const [rows] = await connection.query(

      "SELECT booking_id, booking_status FROM bookings WHERE booking_id=?",

      [bookingId]

    );

    if (!rows.length) {

      await connection.rollback();

      return res.status(404).json({

        success: false,

        message: "Booking not found"

      });

    }

    if (rows[0].booking_status && rows[0].booking_status.toLowerCase() === "cancelled") {

      await connection.rollback();

      return res.status(400).json({

        success: false,

        message: "Booking is already cancelled."

      });

    }

    await connection.query(

      `UPDATE bookings

       SET booking_status='Cancelled'

       WHERE booking_id=?`,

      [bookingId]

    );

    await connection.commit();

    return res.json({

      success: true,

      message: "Booking cancelled successfully"

    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    return res.status(500).json({

      success: false,

      message: "Server Error while cancelling booking."

    });

  } finally {

    connection.release();

  }

};

// ========================================
// DELETE BOOKING
// ========================================
exports.deleteBooking = async (req, res) => {

  const connection = await db.getConnection();

  try {

    await connection.beginTransaction();

    const bookingId = req.params.id;

    const [booking] = await connection.query(

      "SELECT booking_id FROM bookings WHERE booking_id=?",

      [bookingId]

    );

    if (!booking.length) {

      await connection.rollback();

      return res.status(404).json({

        success: false,

        message: "Booking not found"

      });

    }

    await connection.query(

      "DELETE FROM bookings WHERE booking_id=?",

      [bookingId]

    );

    await connection.commit();

    return res.json({

      success: true,

      message: "Booking deleted successfully"

    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    return res.status(500).json({

      success: false,

      message: "Server Error while deleting booking."

    });

  } finally {

    connection.release();

  }

};