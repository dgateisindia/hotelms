const db = require("../config/db").promisePool;

// ===============================
// Get All Customers
// ===============================
exports.getCustomers = async (req, res) => {
  try {
   const [customers] = await db.query(`
SELECT
    c.customer_id,
    c.full_name,
    c.email,
    c.phone,
    c.gender,
    c.address,
    c.id_proof_type,
    c.id_proof_number,
    c.profile_image,
    c.nationality,
    c.customer_type,
    c.created_at,

    COUNT(b.booking_id) AS bookings,

    DATE_FORMAT(MAX(b.check_out), '%d %b %Y') AS lastStay,

    CASE
        WHEN latest.booking_status = 'checked_in' THEN 'Checked In'
        WHEN latest.booking_status = 'confirmed'
             AND CURDATE() BETWEEN DATE(latest.check_in) AND DATE(latest.check_out)
             THEN 'Checked In'
        WHEN latest.booking_status = 'confirmed'
             AND latest.check_in > CURDATE()
             THEN 'Upcoming'
        WHEN latest.booking_status = 'pending' THEN 'Pending'
        WHEN latest.booking_status = 'cancelled' THEN 'Cancelled'
        WHEN latest.booking_status = 'checked_out' THEN 'Checked Out'
        WHEN latest.booking_status IS NULL THEN 'No Bookings'
        ELSE 'Checked Out'
    END AS status

FROM customers c

LEFT JOIN bookings b
ON c.customer_id = b.customer_id

LEFT JOIN (
    SELECT b1.customer_id, b1.booking_status, b1.check_in, b1.check_out
    FROM bookings b1
    INNER JOIN (
        SELECT customer_id, MAX(booking_id) AS max_id
        FROM bookings
        GROUP BY customer_id
    ) latest_ids
    ON b1.customer_id = latest_ids.customer_id
    AND b1.booking_id = latest_ids.max_id
) latest
ON latest.customer_id = c.customer_id

GROUP BY
    c.customer_id, c.full_name, c.email, c.phone, c.gender, c.address,
    c.id_proof_type, c.id_proof_number, c.profile_image, c.nationality,
    c.customer_type, c.created_at,
    latest.booking_status, latest.check_in, latest.check_out

ORDER BY c.customer_id ASC
`);

    res.status(200).json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ===============================
// Add Customer
// ===============================
exports.addCustomer = async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      gender,
      address,
      id_proof_type,
      id_proof_number,
      profile_image,
      nationality,
      customer_type,
    } = req.body;

    // Check duplicate email
    const [emailExists] = await db.query(
      "SELECT customer_id FROM customers WHERE email = ?",
      [email]
    );

    if (emailExists.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already exists."
      });
    }

    // Check duplicate phone
    const [phoneExists] = await db.query(
      "SELECT customer_id FROM customers WHERE phone = ?",
      [phone]
    );

    if (phoneExists.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Phone number already exists."
      });
    }

    // Insert customer
    const [result] = await db.query(
      `INSERT INTO customers
      (full_name,email,phone,gender,address,id_proof_type,id_proof_number,profile_image,nationality,customer_type)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        full_name,
        email,
        phone,
        gender,
        address,
        id_proof_type,
        id_proof_number,
        profile_image,
        nationality,
        customer_type,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Customer added successfully",
      customer_id: result.insertId,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

// ===============================
// Get Customer By ID
// ===============================
exports.getCustomer = async (req, res) => {
  try {

    const [[customer]] = await db.query(`
      SELECT

        c.customer_id,
        c.full_name,
        c.email,
        c.phone,
        c.gender,
        c.address,
        c.id_proof_type,
        c.id_proof_number,
        c.profile_image,
        c.nationality,
        c.customer_type,
        c.created_at,

        COUNT(b.booking_id) AS totalBookings,

        IFNULL(SUM(b.total_amount),0) AS totalSpent,

        DATE_FORMAT(MAX(b.check_out),'%d %b %Y') AS lastStay,

        CASE
          WHEN latest.booking_status = 'checked_in' THEN 'Checked In'
          WHEN latest.booking_status = 'confirmed'
               AND CURDATE() BETWEEN DATE(latest.check_in) AND DATE(latest.check_out)
               THEN 'Checked In'
          WHEN latest.booking_status = 'confirmed'
               AND latest.check_in > CURDATE()
               THEN 'Upcoming'
          WHEN latest.booking_status = 'pending' THEN 'Pending'
          WHEN latest.booking_status = 'cancelled' THEN 'Cancelled'
          WHEN latest.booking_status = 'checked_out' THEN 'Checked Out'
          WHEN latest.booking_status IS NULL THEN 'No Bookings'
          ELSE 'Checked Out'
        END AS currentStatus

      FROM customers c

      LEFT JOIN bookings b
      ON c.customer_id=b.customer_id

      LEFT JOIN (
          SELECT b1.customer_id, b1.booking_status, b1.check_in, b1.check_out
          FROM bookings b1
          INNER JOIN (
              SELECT customer_id, MAX(booking_id) AS max_id
              FROM bookings
              GROUP BY customer_id
          ) latest_ids
          ON b1.customer_id = latest_ids.customer_id
          AND b1.booking_id = latest_ids.max_id
      ) latest
      ON latest.customer_id = c.customer_id

      WHERE c.customer_id=?

      GROUP BY
        c.customer_id,
        c.full_name,
        c.email,
        c.phone,
        c.gender,
        c.address,
        c.id_proof_type,
        c.id_proof_number,
        c.profile_image,
        c.nationality,
        c.customer_type,
        c.created_at,
        latest.booking_status, latest.check_in, latest.check_out
    `, [req.params.id]);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.json({
      success: true,
      data: customer,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });

  }
};

// ===============================
// Update Customer
// ===============================
exports.updateCustomer = async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      gender,
      address,
      id_proof_type,
      id_proof_number,
      profile_image,
      nationality,
      customer_type,
    } = req.body;

    await db.query(
      `UPDATE customers
      SET
      full_name=?,
      email=?,
      phone=?,
      gender=?,
      address=?,
      id_proof_type=?,
      id_proof_number=?,
      profile_image=?,
      nationality=?,
      customer_type=?
      WHERE customer_id=?`,
      [
        full_name,
        email,
        phone,
        gender,
        address,
        id_proof_type,
        id_proof_number,
        profile_image,
        nationality,
        customer_type,
        req.params.id,
      ]
    );

    res.json({
      message: "Customer updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ===============================
// Delete Customer
// ===============================
exports.deleteCustomer = async (req, res) => {
  try {
    await db.query(
      "DELETE FROM customers WHERE customer_id=?",
      [req.params.id]
    );

    res.json({
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ===============================
// Customer Dashboard Statistics
// ===============================
exports.getCustomerStats = async (req, res) => {
  try {

    const [[stats]] = await db.query(`
      SELECT

      (SELECT COUNT(*) FROM customers) AS totalCustomers,

      (
        SELECT COUNT(*)
        FROM bookings
        WHERE booking_status='checked_in'
      ) AS activeGuests,

      (
        SELECT COUNT(*)
        FROM (
          SELECT customer_id
          FROM bookings
          GROUP BY customer_id
          HAVING COUNT(*) > 1
        ) repeatGuests
      ) AS repeatGuests,

      (
        SELECT COUNT(*)
        FROM customers
        WHERE customer_type='VIP'
      ) AS vipCustomers
    `);

    res.status(200).json({
      success: true,
      data: stats,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });

  }
};