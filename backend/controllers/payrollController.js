const db = require("../config/db").promisePool;

const PAYMENT_STATUSES = ["pending", "paid"];
const MONTH_YEAR_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const round2 = (value) => Math.round(Number(value) * 100) / 100;

exports.getAllPayroll = async (req, res) => {
  const hotelId = req.dbUser.hotelId;
  const { month_year, department, status, search } = req.query;

  try {
    let sql = `
      SELECT p.payroll_id, p.staff_id, p.month_year, p.basic_salary, p.bonus,
             p.deductions, p.net_salary, p.payment_status, p.generated_at,
             s.full_name AS employee_name, s.department
      FROM payroll p
      JOIN staff s ON s.staff_id = p.staff_id AND s.hotel_id = p.hotel_id
      WHERE p.hotel_id = ?
    `;
    const params = [hotelId];

    if (month_year) {
      sql += " AND p.month_year = ?";
      params.push(month_year);
    }

    if (department && department !== "All Departments") {
      sql += " AND s.department = ?";
      params.push(department);
    }

    if (status && status !== "All Status") {
      sql += " AND p.payment_status = ?";
      params.push(status.toLowerCase());
    }

    if (search) {
      sql += " AND (s.full_name LIKE ? OR p.payroll_id LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY p.generated_at DESC";

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("getAllPayroll error:", err);
    return res.status(500).json({ error: "Failed to fetch payroll records" });
  }
};

exports.getPayrollById = async (req, res) => {
  const hotelId = req.dbUser.hotelId;
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT p.payroll_id, p.staff_id, p.month_year, p.basic_salary, p.bonus,
              p.deductions, p.net_salary, p.payment_status, p.generated_at,
              s.full_name AS employee_name, s.department
       FROM payroll p
       JOIN staff s ON s.staff_id = p.staff_id AND s.hotel_id = p.hotel_id
       WHERE p.payroll_id = ? AND p.hotel_id = ?`,
      [id, hotelId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Payroll record not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("getPayrollById error:", err);
    return res.status(500).json({ error: "Failed to fetch payroll record" });
  }
};

exports.createPayroll = async (req, res) => {
  const hotelId = req.dbUser.hotelId;
  const { staff_id, month_year, basic_salary, bonus = 0, deductions = 0, payment_status = "pending" } = req.body;

  if (!staff_id || !month_year || basic_salary == null) {
    return res.status(400).json({ error: "staff_id, month_year and basic_salary are required" });
  }

  if (!PAYMENT_STATUSES.includes(payment_status)) {
    return res.status(400).json({ error: "payment_status must be pending or paid" });
  }

  try {
    const [staffRows] = await db.query(
      "SELECT staff_id FROM staff WHERE staff_id = ? AND hotel_id = ?",
      [staff_id, hotelId]
    );

    if (staffRows.length === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const [dupe] = await db.query(
      "SELECT payroll_id FROM payroll WHERE hotel_id = ? AND staff_id = ? AND month_year = ?",
      [hotelId, staff_id, month_year]
    );

    if (dupe.length > 0) {
      return res.status(409).json({ error: "A payroll record for this employee and period already exists" });
    }

    const net_salary = round2(Number(basic_salary) + Number(bonus) - Number(deductions));

    const [result] = await db.query(
      `INSERT INTO payroll
       (hotel_id, staff_id, month_year, basic_salary, bonus, deductions, net_salary, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [hotelId, staff_id, month_year, basic_salary, bonus, deductions, net_salary, payment_status]
    );

    return res.status(201).json({
      payroll_id: result.insertId,
      staff_id,
      month_year,
      basic_salary,
      bonus,
      deductions,
      net_salary,
      payment_status,
    });
  } catch (err) {
    console.error("createPayroll error:", err);
    return res.status(500).json({ error: "Failed to create payroll record" });
  }
};

exports.generatePayroll = async (req, res) => {
  const hotelId = req.dbUser.hotelId;
  const { month_year } = req.body;

  if (!MONTH_YEAR_RE.test(String(month_year || ""))) {
    return res.status(400).json({ error: "month_year must use YYYY-MM format" });
  }

  try {
    const [eligibleStaff] = await db.query(
      `SELECT s.staff_id, COALESCE(s.salary, 0) AS basic_salary
       FROM staff s
       WHERE s.hotel_id = ?
         AND s.status = 'Active'
         AND NOT EXISTS (
           SELECT 1
           FROM payroll p
           WHERE p.hotel_id = ?
             AND p.staff_id = s.staff_id
             AND p.month_year = ?
         )`,
      [hotelId, hotelId, month_year]
    );

    if (eligibleStaff.length === 0) {
      return res.json({
        generated: 0,
        message: "No new payroll records to generate — every active staff member already has one for this period.",
      });
    }

    const values = eligibleStaff.map((staff) => [
      hotelId,
      staff.staff_id,
      month_year,
      staff.basic_salary,
      0,
      0,
      staff.basic_salary,
      "pending",
    ]);

    await db.query(
      `INSERT INTO payroll
       (hotel_id, staff_id, month_year, basic_salary, bonus, deductions, net_salary, payment_status)
       VALUES ?`,
      [values]
    );

    return res.status(201).json({ generated: eligibleStaff.length });
  } catch (err) {
    console.error("generatePayroll error:", err);
    return res.status(500).json({ error: "Failed to generate payroll" });
  }
};

exports.updatePayroll = async (req, res) => {
  const hotelId = req.dbUser.hotelId;
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT p.*
       FROM payroll p
       JOIN staff s ON s.staff_id = p.staff_id AND s.hotel_id = p.hotel_id
       WHERE p.payroll_id = ? AND p.hotel_id = ?`,
      [id, hotelId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Payroll record not found" });
    }

    const current = rows[0];
    const basic_salary = req.body.basic_salary != null ? req.body.basic_salary : current.basic_salary;
    const bonus = req.body.bonus != null ? req.body.bonus : current.bonus;
    const deductions = req.body.deductions != null ? req.body.deductions : current.deductions;
    const payment_status = req.body.payment_status || current.payment_status;

    if (!PAYMENT_STATUSES.includes(payment_status)) {
      return res.status(400).json({ error: "payment_status must be pending or paid" });
    }

    const net_salary = round2(Number(basic_salary) + Number(bonus) - Number(deductions));

    await db.query(
      `UPDATE payroll
       SET basic_salary = ?, bonus = ?, deductions = ?, net_salary = ?, payment_status = ?
       WHERE payroll_id = ? AND hotel_id = ?`,
      [basic_salary, bonus, deductions, net_salary, payment_status, id, hotelId]
    );

    return res.json({
      payroll_id: Number(id),
      staff_id: current.staff_id,
      month_year: current.month_year,
      basic_salary,
      bonus,
      deductions,
      net_salary,
      payment_status,
    });
  } catch (err) {
    console.error("updatePayroll error:", err);
    return res.status(500).json({ error: "Failed to update payroll record" });
  }
};

exports.deletePayroll = async (req, res) => {
  const hotelId = req.dbUser.hotelId;
  const { id } = req.params;

  try {
    const [result] = await db.query(
      "DELETE FROM payroll WHERE payroll_id = ? AND hotel_id = ?",
      [id, hotelId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Payroll record not found" });
    }

    return res.json({ deleted: true, payroll_id: Number(id) });
  } catch (err) {
    console.error("deletePayroll error:", err);
    return res.status(500).json({ error: "Failed to delete payroll record" });
  }
};
