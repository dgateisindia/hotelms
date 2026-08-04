const express = require('express');
const router = express.Router();
const { requireAuth } = require('@clerk/express');
const { attachDbUser, requireRole } = require('../middleware/roleMiddleware');
const db = require('../config/db');

router.use(requireAuth(), attachDbUser(), requireRole('super_admin'));

router.get('/stats', async (req, res) => {
  const [[bookingCount]] = await db.query(`SELECT COUNT(*) AS totalBookings FROM bookings`);
  const [[rooms]] = await db.query(`
    SELECT SUM(status='occupied') AS occupiedRooms, SUM(status='available') AS availableRooms
    FROM rooms
  `);
  const [[revenueToday]] = await db.query(`
    SELECT COALESCE(SUM(amount),0) AS todaysRevenue
    FROM payments WHERE payment_status='success' AND DATE(payment_date)=CURDATE()
  `);
  const [monthlyRevenue] = await db.query(`
    SELECT MONTH(payment_date) AS month, SUM(amount) AS total
    FROM payments WHERE payment_status='success' AND YEAR(payment_date)=YEAR(CURDATE())
    GROUP BY MONTH(payment_date) ORDER BY month
  `);

  res.json({
    stats: {
      totalBookings: bookingCount.totalBookings,
      occupiedRooms: rooms.occupiedRooms || 0,
      availableRooms: rooms.availableRooms || 0,
      todaysRevenue: revenueToday.todaysRevenue,
      monthlyRevenue,
    },
  });
});

router.get('/admins', async (req, res) => {
  const [admins] = await db.query(`
    SELECT a.admin_id AS id, u.full_name AS name, u.email, a.role,
           a.must_change_password, u.status
    FROM admins a
    JOIN users u ON u.user_id = a.user_id
    WHERE a.role = 'admin'
    ORDER BY a.admin_id DESC
  `);
  res.json({ admins });
});

module.exports = router;