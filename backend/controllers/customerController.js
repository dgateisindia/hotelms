const db = require("../config/db");

// Get All Customers
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
        WHEN SUM(CASE WHEN b.booking_status='checked_in' THEN 1 ELSE 0 END) > 0
        THEN 'Checked In'
        ELSE 'Checked Out'
    END AS status

FROM customers c

LEFT JOIN bookings b
ON c.customer_id = b.customer_id

GROUP BY c.customer_id

ORDER BY c.customer_id ASC
`);

    res.status(200).json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get Customer By ID
exports.getCustomer = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM customers WHERE customer_id = ?",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Add Customer
// Add Customer
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

// Update Customer
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

// Delete Customer
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
// Customer Dashboard Statistics
// Get All Customers
// Get Customer By ID
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
          WHEN SUM(CASE WHEN b.booking_status='checked_in' THEN 1 ELSE 0 END) > 0
          THEN 'Checked In'
          ELSE 'Checked Out'
        END AS currentStatus

      FROM customers c

      LEFT JOIN bookings b
      ON c.customer_id=b.customer_id

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
        c.created_at
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
// Customer Dashboard Statistics
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