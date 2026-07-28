const db = require('../config/db').promisePool;// GET /api/dashboard/super-admin-stats
const getSuperAdminStats = async (req, res) => {
  try {
    const [[bookingsRow]] = await db.query(`SELECT COUNT(*) AS total FROM bookings`);
    const [[occupiedRow]] = await db.query(`SELECT COUNT(*) AS occupied FROM rooms WHERE status = 'occupied'`);
    const [[availableRow]] = await db.query(`SELECT COUNT(*) AS available FROM rooms WHERE status = 'available'`);
    const [[revenueRow]] = await db.query(`SELECT COALESCE(SUM(amount), 0) AS revenue FROM payments WHERE DATE(payment_date) = CURDATE()`);
    const [monthlyRevenue] = await db.query(
      `SELECT MONTH(payment_date) AS month, SUM(amount) AS total
       FROM payments
       WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 7 MONTH)
       GROUP BY MONTH(payment_date)
       ORDER BY MONTH(payment_date)`
    );

    res.status(200).json({
      success: true,
      stats: {
        totalBookings: bookingsRow.total,
        occupiedRooms: occupiedRow.occupied,
        availableRooms: availableRow.available,
        todaysRevenue: revenueRow.revenue,
        monthlyRevenue
      }
    });
  } catch (err) {
    console.error('getSuperAdminStats error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching stats' });
  }
};

// GET /api/dashboard/admins-status
const getAdminsStatus = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT User_id AS id, full_name, email, role, last_login,
              CASE WHEN last_active >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                   THEN 'active' ELSE 'inactive' END AS status
       FROM users
       WHERE role != 'customer' AND role != 'super_admin'
       ORDER BY last_login DESC`
    );
    res.status(200).json({ success: true, admins: rows });
  } catch (err) {
    console.error('getAdminsStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching admin status' });
  }
};

// ===============================
// GET /api/dashboard/admin-daily-stats?date=YYYY-MM-DD
// ===============================
// NOTE: rooms/bookings have no hotel_id column yet, so — same as
// getSuperAdminStats above — this queries globally rather than scoped
// to req.dbUser.hotelId. If multi-hotel support gets added later
// (hotel_id on rooms), reintroduce the WHERE r.hotel_id = ? filters here.
const getAdminDailyStats = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query param is required' });
    }

    // ── Current snapshot ──
    const [[bookingsRow]] = await db.query(`SELECT COUNT(*) AS total FROM bookings`);

    const [roomStatusRows] = await db.query(
      `SELECT status, COUNT(*) AS cnt FROM rooms GROUP BY status`
    );
    const roomStatus = { occupied: 0, available: 0, maintenance: 0, cleaning: 0, reserved: 0 };
    roomStatusRows.forEach((r) => { roomStatus[r.status] = r.cnt; });

    // ── Date-scoped revenue ──
    // ASSUMPTION: payments has a booking_id FK. Adjust the join if it's named differently.
    const [[revenueRow]] = await db.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS revenue
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       WHERE DATE(p.payment_date) = ?`,
      [date]
    );

    // ── Date-scoped bookings list (arrivals on the selected date) ──
    const [recentBookings] = await db.query(
      `SELECT
         b.booking_id,
         b.booking_code,
         b.check_in,
         b.check_out,
         b.booking_status,
         c.full_name AS customer_name,
         r.room_number
       FROM bookings b
       LEFT JOIN customers c ON b.customer_id = c.customer_id
       LEFT JOIN rooms r ON b.room_id = r.room_id
       WHERE DATE(b.check_in) = ?
       ORDER BY b.booking_id DESC`,
      [date]
    );

    // ── Monthly revenue trend (last 7 months) ──
    const [monthlyRevenue] = await db.query(
      `SELECT MONTH(p.payment_date) AS month, SUM(p.amount) AS total
       FROM payments p
       WHERE p.payment_date >= DATE_SUB(CURDATE(), INTERVAL 7 MONTH)
       GROUP BY MONTH(p.payment_date)
       ORDER BY MONTH(p.payment_date)`
    );

    // ── Monthly bookings trend (last 7 months, by check_in month) ──
    const [monthlyBookings] = await db.query(
      `SELECT MONTH(b.check_in) AS month, COUNT(*) AS total
       FROM bookings b
       WHERE b.check_in >= DATE_SUB(CURDATE(), INTERVAL 7 MONTH)
       GROUP BY MONTH(b.check_in)
       ORDER BY MONTH(b.check_in)`
    );

    // ── Monthly occupancy trend (last 7 months) ──
    // No historical room-status snapshot table exists yet, so this is an
    // approximation: % of rooms that had at least one confirmed/checked-in
    // booking overlapping that month.
    const [[roomCountRow]] = await db.query(`SELECT COUNT(*) AS total FROM rooms`);
    const totalRooms = roomCountRow.total || 1;

    const monthlyOccupancy = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
      const monthEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      const monthEnd = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

      const [[occRow]] = await db.query(
        `SELECT COUNT(DISTINCT b.room_id) AS occupiedRooms
         FROM bookings b
         WHERE b.booking_status IN ('confirmed', 'checked-in')
           AND b.check_in <= ? AND b.check_out >= ?`,
        [monthEnd, monthStart]
      );

      monthlyOccupancy.push({
        month: monthDate.getMonth() + 1,
        total: Math.round((occRow.occupiedRooms / totalRooms) * 100),
      });
    }

    res.status(200).json({
      success: true,
      stats: {
        totalBookings: bookingsRow.total,
        occupiedRooms: roomStatus.occupied,
        availableRooms: roomStatus.available,
        maintenanceRooms: roomStatus.maintenance,
        cleaningRooms: roomStatus.cleaning,
        reservedRooms: roomStatus.reserved,
        todaysRevenue: revenueRow.revenue,
        monthlyRevenue,
        monthlyBookings,
        monthlyOccupancy,
        recentBookings,
      },
    });
  } catch (err) {
    console.error('getAdminDailyStats error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching daily stats' });
  }
};

module.exports = { getSuperAdminStats, getAdminsStatus, getAdminDailyStats };