// ============================================================
//  payrollController.js — Payroll Management (backend logic)
//  Table: payroll(payroll_id, staff_id, month_year, basic_salary,
//                 bonus, deductions, net_salary, payment_status,
//                 generated_at) FK staff_id -> staff(staff_id)
//
//  NOTE ON DB IMPORT: adjust the require() below to match whatever
//  connection module your other controllers use (e.g. the same
//  pool/module used in attendanceController.js / staffController.js).
//  This file assumes a mysql2 promise pool exposing db.query(sql, params)
//  and resolving to [rows, fields].
// ============================================================

const db = require('../config/db'); // TODO: adjust path if your db module lives elsewhere

// ── Helper: scope queries to the logged-in admin's hotel, if available ──
// Mirrors the open question from the attendance work: staff may or may not
// have a hotel_id column. If req.dbUser.hotel_id isn't set, this is a no-op,
// so nothing breaks if that column doesn't exist yet — but once staff.hotel_id
// is confirmed, this same pattern should be added to every staff-joined query
// in the app (attendance, billing, etc.) for real multi-tenant isolation.
function hotelScope(req) {
  if (req.dbUser && req.dbUser.hotel_id) {
    return { clause: ' AND s.hotel_id = ?', param: req.dbUser.hotel_id };
  }
  return { clause: '', param: null };
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// ── GET /api/payroll ──────────────────────────────────────────
// Query params: month_year, department, status, search
exports.getAllPayroll = async (req, res) => {
  try {
    const { month_year, department, status, search } = req.query;
    const scope = hotelScope(req);

    let sql = `
      SELECT p.payroll_id, p.staff_id, p.month_year, p.basic_salary, p.bonus,
             p.deductions, p.net_salary, p.payment_status, p.generated_at,
             s.full_name AS employee_name, s.department
      FROM payroll p
      JOIN staff s ON p.staff_id = s.staff_id
      WHERE 1=1${scope.clause}
    `;
    const params = [];
    if (scope.param) params.push(scope.param);

    if (month_year) {
      sql += ' AND p.month_year = ?';
      params.push(month_year);
    }
    if (department && department !== 'All Departments') {
      sql += ' AND s.department = ?';
      params.push(department);
    }
    if (status && status !== 'All Status') {
      sql += ' AND p.payment_status = ?';
      params.push(status.toLowerCase());
    }
    if (search) {
      sql += ' AND (s.full_name LIKE ? OR p.payroll_id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY p.generated_at DESC';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('getAllPayroll error:', err);
    res.status(500).json({ error: 'Failed to fetch payroll records' });
  }
};

// ── GET /api/payroll/:id ──────────────────────────────────────
exports.getPayrollById = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = hotelScope(req);
    const params = [id];
    if (scope.param) params.push(scope.param);

    const [rows] = await db.query(
      `SELECT p.payroll_id, p.staff_id, p.month_year, p.basic_salary, p.bonus,
              p.deductions, p.net_salary, p.payment_status, p.generated_at,
              s.full_name AS employee_name, s.department
       FROM payroll p
       JOIN staff s ON p.staff_id = s.staff_id
       WHERE p.payroll_id = ?${scope.clause}`,
      params
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Payroll record not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('getPayrollById error:', err);
    res.status(500).json({ error: 'Failed to fetch payroll record' });
  }
};

// ── POST /api/payroll ─────────────────────────────────────────
// Body: { staff_id, month_year, basic_salary, bonus, deductions, payment_status }
exports.createPayroll = async (req, res) => {
  try {
    const {
      staff_id,
      month_year,
      basic_salary,
      bonus = 0,
      deductions = 0,
      payment_status = 'pending',
    } = req.body;

    if (!staff_id || !month_year || basic_salary == null) {
      return res.status(400).json({ error: 'staff_id, month_year and basic_salary are required' });
    }

    const [dupe] = await db.query(
      'SELECT payroll_id FROM payroll WHERE staff_id = ? AND month_year = ?',
      [staff_id, month_year]
    );
    if (dupe.length > 0) {
      return res.status(409).json({ error: 'A payroll record for this employee and period already exists' });
    }

    const net_salary = round2(Number(basic_salary) + Number(bonus) - Number(deductions));

    const [result] = await db.query(
      `INSERT INTO payroll (staff_id, month_year, basic_salary, bonus, deductions, net_salary, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staff_id, month_year, basic_salary, bonus, deductions, net_salary, payment_status]
    );

    res.status(201).json({
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
    console.error('createPayroll error:', err);
    res.status(500).json({ error: 'Failed to create payroll record' });
  }
};

// ── POST /api/payroll/generate ────────────────────────────────
// Body: { month_year }
// Bulk-creates payroll rows for every Active staff member who doesn't
// already have one for that period, seeded from staff.salary.
exports.generatePayroll = async (req, res) => {
  try {
    const { month_year } = req.body;
    if (!month_year) return res.status(400).json({ error: 'month_year is required' });

    const scope = hotelScope(req);
    const params = [month_year];
    if (scope.param) params.push(scope.param);

    const [eligibleStaff] = await db.query(
      `SELECT s.staff_id, COALESCE(s.salary, 0) AS basic_salary
       FROM staff s
       WHERE s.status = 'Active'
         AND s.staff_id NOT IN (SELECT staff_id FROM payroll WHERE month_year = ?)
         ${scope.clause}`,
      params
    );

    if (eligibleStaff.length === 0) {
      return res.json({
        generated: 0,
        message: 'No new payroll records to generate — every active staff member already has one for this period.',
      });
    }

    const values = eligibleStaff.map((s) => [
      s.staff_id,
      month_year,
      s.basic_salary,
      0,
      0,
      s.basic_salary,
      'pending',
    ]);

    await db.query(
      `INSERT INTO payroll (staff_id, month_year, basic_salary, bonus, deductions, net_salary, payment_status)
       VALUES ?`,
      [values]
    );

    res.status(201).json({ generated: eligibleStaff.length });
  } catch (err) {
    console.error('generatePayroll error:', err);
    res.status(500).json({ error: 'Failed to generate payroll' });
  }
};

// ── PUT /api/payroll/:id ───────────────────────────────────────
// Body: any of { basic_salary, bonus, deductions, payment_status }
// net_salary is always recomputed server-side so it can never drift
// from the three inputs that make it up.
exports.updatePayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = hotelScope(req);
    const lookupParams = [id];
    if (scope.param) lookupParams.push(scope.param);

    const [rows] = await db.query(
      `SELECT p.* FROM payroll p JOIN staff s ON p.staff_id = s.staff_id
       WHERE p.payroll_id = ?${scope.clause}`,
      lookupParams
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Payroll record not found' });
    const current = rows[0];

    const basic_salary = req.body.basic_salary != null ? req.body.basic_salary : current.basic_salary;
    const bonus = req.body.bonus != null ? req.body.bonus : current.bonus;
    const deductions = req.body.deductions != null ? req.body.deductions : current.deductions;
    const payment_status = req.body.payment_status || current.payment_status;
    const net_salary = round2(Number(basic_salary) + Number(bonus) - Number(deductions));

    await db.query(
      `UPDATE payroll SET basic_salary = ?, bonus = ?, deductions = ?, net_salary = ?, payment_status = ?
       WHERE payroll_id = ?`,
      [basic_salary, bonus, deductions, net_salary, payment_status, id]
    );

    res.json({
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
    console.error('updatePayroll error:', err);
    res.status(500).json({ error: 'Failed to update payroll record' });
  }
};

// ── DELETE /api/payroll/:id ────────────────────────────────────
exports.deletePayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM payroll WHERE payroll_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Payroll record not found' });
    res.json({ deleted: true, payroll_id: Number(id) });
  } catch (err) {
    console.error('deletePayroll error:', err);
    res.status(500).json({ error: 'Failed to delete payroll record' });
  }
};