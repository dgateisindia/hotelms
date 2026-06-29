const db = require('../config/db');

// GET /api/dashboard/super-admin-stats
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

module.exports = { getSuperAdminStats, getAdminsStatus };