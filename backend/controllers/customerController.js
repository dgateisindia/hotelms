const db = require("../config/db");

// Get All Customers
exports.getCustomers = async (req, res) => {
  try {
    const [customers] = await db.query(
      "SELECT * FROM customers ORDER BY customer_id DESC"
    );

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