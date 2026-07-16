const db = require("../config/db");

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
exports.getBookingStats = async (req,res)=>{

  try{

    const [[stats]] = await db.query(`
      SELECT

      COUNT(*) AS totalBookings,

      SUM(
        booking_status='confirmed'
      ) AS confirmedBookings,

      SUM(
        booking_status='pending'
      ) AS pendingBookings,

      IFNULL(
        SUM(total_amount),
        0
      ) AS totalRevenue

      FROM bookings
    `);

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

exports.addBooking = async (req, res) => {
    console.log("POST BODY");
  console.log(req.body);
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
    // Check Availability
    // -----------------------------
    if (room[0].status !== "available") {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Room is not available.",
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
        check_in,
        check_out,
        total_guests,
        booking_status,
        payment_status,
        total_amount,
        special_request,
      ]
    );

    // -----------------------------
    // Update Room Status
    // -----------------------------
    await connection.query(
      `
      UPDATE rooms
      SET status='occupied'
      WHERE room_id=?
      `,
      [room_id]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      booking_id: result.insertId,
      booking_code: bookingCode,
    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
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

    const oldRoom = existing[0].room_id;

    // Room changed
    if (oldRoom != room_id) {

      // Old room available
      await connection.query(
        "UPDATE rooms SET status='available' WHERE room_id=?",
        [oldRoom]
      );

      // New room occupied
      await connection.query(
        "UPDATE rooms SET status='occupied' WHERE room_id=?",
        [room_id]
      );
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
        check_out,
        total_guests,
        booking_status,
        payment_status,
        total_amount,
        special_request,
        bookingId

      ]

    );

    await connection.commit();

    res.json({

      success: true,
      message: "Booking updated successfully"

    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    res.status(500).json({

      success: false,
      message: "Server Error"

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

      "SELECT room_id FROM bookings WHERE booking_id=?",

      [bookingId]

    );

    if (!rows.length) {

      await connection.rollback();

      return res.status(404).json({

        success: false,

        message: "Booking not found"

      });

    }

    const roomId = rows[0].room_id;

    await connection.query(

      `UPDATE bookings

       SET booking_status='cancelled'

       WHERE booking_id=?`,

      [bookingId]

    );

    await connection.query(

      `UPDATE rooms

       SET status='available'

       WHERE room_id=?`,

      [roomId]

    );

    await connection.commit();

    res.json({

      success: true,

      message: "Booking cancelled successfully"

    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    res.status(500).json({

      success: false,

      message: "Server Error"

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

      "SELECT room_id FROM bookings WHERE booking_id=?",

      [bookingId]

    );

    if (!booking.length) {

      await connection.rollback();

      return res.status(404).json({

        success: false,

        message: "Booking not found"

      });

    }

    const roomId = booking[0].room_id;

    await connection.query(

      "DELETE FROM bookings WHERE booking_id=?",

      [bookingId]

    );

    await connection.query(

      "UPDATE rooms SET status='available' WHERE room_id=?",

      [roomId]

    );

    await connection.commit();

    res.json({

      success: true,

      message: "Booking deleted successfully"

    });

  } catch (err) {

    await connection.rollback();

    console.error(err);

    res.status(500).json({

      success: false,

      message: "Server Error"

    });

  } finally {

    connection.release();

  }

};
