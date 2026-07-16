// controllers/billingController.js

const db = require("../config/db");

// Maps the frontend's payment method labels to the DB's payment_method enum
const METHOD_MAP = {
  Cash: "cash",
  Card: "card",
  UPI: "upi",
  "Net Banking": "bank_transfer",
};

/* ===========================================================
   BILLING DASHBOARD
=========================================================== */

exports.getBillingDashboard = async (req, res) => {
  try {
    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) AS totalBills,
        IFNULL(SUM(total_amount),0) AS totalRevenue,
        IFNULL(SUM(paid_amount),0) AS paidAmount,
        IFNULL(SUM(pending_amount),0) AS outstanding
      FROM invoices
    `);

    const [revenue] = await db.query(`
      SELECT
        DATE_FORMAT(generated_at,'%b') AS month,
        SUM(total_amount) AS val
      FROM invoices
      GROUP BY MONTH(generated_at), DATE_FORMAT(generated_at,'%b')
      ORDER BY MONTH(generated_at)
    `);

    const [methods] = await db.query(`
      SELECT
        payment_method,
        COUNT(*) total
      FROM payments
      WHERE payment_status='success'
      GROUP BY payment_method
    `);

    const totalMethodCount = methods.reduce((sum, m) => sum + Number(m.total), 0);

    const colors = {
      cash: "#10b981",
      card: "#3b82f6",
      upi: "#f59e0b",
      bank_transfer: "#8b5cf6",
    };

    const paymentMethods = methods.map((m) => ({
      label: m.payment_method,
      pct: totalMethodCount === 0 ? 0 : Number(((m.total / totalMethodCount) * 100).toFixed(1)),
      color: colors[m.payment_method] || "#64748b",
    }));

    const [recentPayments] = await db.query(`
      SELECT
          c.full_name guest,
          i.invoice_number inv,
          CONCAT('₹ ',FORMAT(p.amount,0)) amount,
          p.payment_status status,
          DATE_FORMAT(p.payment_date,'%d %b %Y') date
      FROM payments p
      JOIN bookings b ON p.booking_id=b.booking_id
      JOIN customers c ON b.customer_id=c.customer_id
      JOIN invoices i ON i.booking_id=b.booking_id
      ORDER BY p.payment_date DESC
      LIMIT 5
    `);

    res.json({ stats, revenue, paymentMethods, recentPayments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load billing dashboard" });
  }
};

/* ===========================================================
   REVENUE CHART
=========================================================== */

exports.getRevenueChart = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(generated_at,'%b') month,
        SUM(total_amount) val
      FROM invoices
      GROUP BY MONTH(generated_at), DATE_FORMAT(generated_at,'%b')
      ORDER BY MONTH(generated_at)
    `);

    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Unable to load revenue chart" });
  }
};

/* ===========================================================
   PAYMENT METHODS
=========================================================== */

exports.getPaymentMethods = async (req, res) => {
  try {
    const [rows] = await db.query(`
        SELECT
            payment_method,
            COUNT(*) total
        FROM payments
        WHERE payment_status='success'
        GROUP BY payment_method
    `);

    const total = rows.reduce((s, r) => s + Number(r.total), 0);

    const colors = {
      cash: "#10b981",
      card: "#3b82f6",
      upi: "#f59e0b",
      bank_transfer: "#8b5cf6",
    };

    const data = rows.map((r) => ({
      label: r.payment_method,
      pct: total === 0 ? 0 : Number(((r.total / total) * 100).toFixed(1)),
      color: colors[r.payment_method] || "#64748b",
    }));

    res.json(data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Unable to load payment methods" });
  }
};

/* ===========================================================
   RECENT PAYMENTS
=========================================================== */

exports.getRecentPayments = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        c.full_name guest,
        i.invoice_number inv,
        CONCAT('₹ ',FORMAT(p.amount,0)) amount,
        p.payment_status status,
        DATE_FORMAT(payment_date,'%d %b %Y') date
      FROM payments p
      JOIN bookings b ON p.booking_id=b.booking_id
      JOIN customers c ON b.customer_id=c.customer_id
      JOIN invoices i ON b.booking_id=i.booking_id
      ORDER BY payment_date DESC
      LIMIT 5
    `);

    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Unable to fetch recent payments" });
  }
};

/* ===========================================================
   GET ALL INVOICES (search + status filter + pagination)
=========================================================== */

exports.getAllInvoices = async (req, res) => {
  try {
    const { search = "", status, page = 1, limit = 8 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [];
    const params = [];

    if (search) {
      const like = `%${search}%`;
      conditions.push(`(i.invoice_number LIKE ? OR c.full_name LIKE ? OR b.booking_id LIKE ?)`);
      params.push(like, like, like);
    }

    // "All Bills" is the frontend's default tab label, not a real status — skip filtering on it
    if (status && status !== "All Bills") {
      conditions.push(`i.invoice_status = ?`);
      params.push(status.toLowerCase());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM invoices i
       JOIN bookings b ON i.booking_id = b.booking_id
       JOIN customers c ON b.customer_id = c.customer_id
       ${whereClause}`,
      params
    );

  const [rows] = await db.query(
  `SELECT
    i.invoice_id,
    i.invoice_number,

    b.booking_id,
    DATE_FORMAT(b.check_in, '%Y-%m-%d')  AS check_in,
    DATE_FORMAT(b.check_out, '%Y-%m-%d') AS check_out,

    c.full_name, r.room_number,
    i.total_amount, i.paid_amount, i.pending_amount,
    i.invoice_status,

    (SELECT payment_method FROM payments
     WHERE booking_id = b.booking_id
     ORDER BY payment_date DESC LIMIT 1) AS payment_method

  FROM invoices i
  JOIN bookings b ON i.booking_id = b.booking_id
  JOIN customers c ON b.customer_id = c.customer_id
  JOIN rooms r ON b.room_id = r.room_id
  ${whereClause}
  ORDER BY i.generated_at DESC
  LIMIT ? OFFSET ?`,
  [...params, Number(limit), offset]
);

    const invoices = rows.map((row) => ({
      invoice_id: row.invoice_id,
      id: row.invoice_number,
      bookingId: row.booking_id,
      guest: row.full_name,
      room: row.room_number,
      checkIn: row.check_in,
      checkOut: row.check_out,
      amount: Number(row.total_amount),
      paid: Number(row.paid_amount),
      due: Number(row.pending_amount),
      status:
        row.invoice_status === "paid"
          ? "Paid"
          : row.invoice_status === "partial"
          ? "Partial"
          : "Unpaid",
      method: row.payment_method || "-",
    }));

    res.json({
      invoices,
      total,
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Unable to fetch invoices" });
  }
};

/* ===========================================================
   GET SINGLE INVOICE
=========================================================== */

exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[invoice]] = await db.query(
      `
      SELECT
        i.invoice_id,
        i.invoice_number,

        b.booking_id,
        b.check_in,
        b.check_out,

        c.full_name,
        c.phone,
        c.email,

        r.room_number,

        i.room_charges,
        i.food_charges,
        i.laundry_charges,
        i.extra_service_charges,

        i.tax_amount,
        i.total_amount,
        i.paid_amount,
        i.pending_amount,
        i.invoice_status

      FROM invoices i
      JOIN bookings b ON i.booking_id=b.booking_id
      JOIN customers c ON b.customer_id=c.customer_id
      JOIN rooms r ON b.room_id=r.room_id
      WHERE i.invoice_id=?
    `,
      [id]
    );

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const [[payment]] = await db.query(
      `
      SELECT
        payment_method,
        payment_status,
        payment_date,
        transaction_id
      FROM payments
      WHERE booking_id=?
      ORDER BY payment_date DESC
      LIMIT 1
    `,
      [invoice.booking_id]
    );

    const response = {
      invoice_id: invoice.invoice_id,
      id: invoice.invoice_number,
      bookingId: invoice.booking_id,
      guest: invoice.full_name,
      phone: invoice.phone,
      email: invoice.email,
      room: invoice.room_number,
      checkIn: invoice.check_in,
      checkOut: invoice.check_out,
      roomCharges: Number(invoice.room_charges),
      foodCharges: Number(invoice.food_charges),
      laundryCharges: Number(invoice.laundry_charges),
      serviceCharges: Number(invoice.extra_service_charges),
      tax: Number(invoice.tax_amount),
      total: Number(invoice.total_amount),
      paid: Number(invoice.paid_amount),
      due: Number(invoice.pending_amount),
      status: invoice.invoice_status,
      paymentMethod: payment?.payment_method || "-",
      paymentStatus: payment?.payment_status || "-",
      transactionId: payment?.transaction_id || "-",
      paymentDate: payment?.payment_date || null,
    };

    res.json(response);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Unable to fetch invoice" });
  }
};

/* ===========================================================
   CREATE INVOICE
=========================================================== */

exports.createInvoice = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      booking_id,
      payment_method,
      room_charges = 0,
      food_charges = 0,
      laundry_charges = 0,
      extra_service_charges = 0,
      tax_amount = 0,
      paid_amount = 0,
    } = req.body;

    // NOTE: booking_id here is the numeric primary key (bookings.booking_id),
    // the same value the frontend uses to fetch booking details for autofill
    // (GET /api/bookings/:id) and the same value stored in the dropdown's
    // option `value`. It is NOT the human-readable booking_code (e.g. "BK-1001"),
    // so this must look up by booking_id, not booking_code.
    const [[booking]] = await connection.query(
      "SELECT * FROM bookings WHERE booking_id=?",
      [booking_id]
    );

    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: "Booking not found" });
    }

    const total_amount =
      Number(room_charges) +
      Number(food_charges) +
      Number(laundry_charges) +
      Number(extra_service_charges) +
      Number(tax_amount);

    const pending_amount = total_amount - Number(paid_amount);

    let invoice_status = "unpaid";
    if (pending_amount <= 0) invoice_status = "paid";
    else if (paid_amount > 0) invoice_status = "partial";

    const invoice_number = "INV-" + Date.now();

    const [result] = await connection.query(
      `INSERT INTO invoices
      (
        booking_id,
        invoice_number,
        room_charges,
        food_charges,
        laundry_charges,
        extra_service_charges,
        tax_amount,
        total_amount,
        paid_amount,
        pending_amount,
        invoice_status
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [
        booking_id,
        invoice_number,
        room_charges,
        food_charges,
        laundry_charges,
        extra_service_charges,
        tax_amount,
        total_amount,
        paid_amount,
        pending_amount,
        invoice_status,
      ]
    );

    // Record the payment so it shows up in Payment Methods / Recent Payments,
    // which both read from the `payments` table — previously nothing was
    // ever inserted there, so those widgets stayed empty no matter what.
    if (Number(paid_amount) > 0) {
      const dbMethod = METHOD_MAP[payment_method] || payment_method?.toLowerCase() || "cash";

      await connection.query(
        `INSERT INTO payments
          (booking_id, amount, payment_method, payment_status, payment_date)
         VALUES (?, ?, ?, 'success', NOW())`,
        [booking_id, paid_amount, dbMethod]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: "Invoice generated successfully",
      invoice_id: result.insertId,
    });
  } catch (err) {
    await connection.rollback();
    console.log(err);
    res.status(500).json({ message: "Unable to generate invoice" });
  } finally {
    connection.release();
  }
};

/* ===========================================================
   UPDATE INVOICE
=========================================================== */

exports.updateInvoice = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    const {
      payment_method,
      room_charges,
      food_charges,
      laundry_charges,
      extra_service_charges,
      tax_amount,
      paid_amount,
    } = req.body;

    const [[existing]] = await connection.query(
      "SELECT booking_id, paid_amount AS previously_paid FROM invoices WHERE invoice_id=?",
      [id]
    );

    if (!existing) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found" });
    }

    const total_amount =
      Number(room_charges) +
      Number(food_charges) +
      Number(laundry_charges) +
      Number(extra_service_charges) +
      Number(tax_amount);

    const pending_amount = total_amount - Number(paid_amount);

    let invoice_status = "unpaid";
    if (pending_amount <= 0) invoice_status = "paid";
    else if (paid_amount > 0) invoice_status = "partial";

    await connection.query(
      `
      UPDATE invoices
      SET
        room_charges=?,
        food_charges=?,
        laundry_charges=?,
        extra_service_charges=?,
        tax_amount=?,
        total_amount=?,
        paid_amount=?,
        pending_amount=?,
        invoice_status=?
      WHERE invoice_id=?
      `,
      [
        room_charges,
        food_charges,
        laundry_charges,
        extra_service_charges,
        tax_amount,
        total_amount,
        paid_amount,
        pending_amount,
        invoice_status,
        id,
      ]
    );

    // Only record a new payment for the amount newly paid in this edit,
    // so re-saving an already-paid invoice doesn't double-count it in
    // Payment Methods / Recent Payments.
    const newlyPaid = Number(paid_amount) - Number(existing.previously_paid);

    if (newlyPaid > 0) {
      const dbMethod = METHOD_MAP[payment_method] || payment_method?.toLowerCase() || "cash";

      await connection.query(
        `INSERT INTO payments
          (booking_id, amount, payment_method, payment_status, payment_date)
         VALUES (?, ?, ?, 'success', NOW())`,
        [existing.booking_id, newlyPaid, dbMethod]
      );
    }

    await connection.commit();

    res.json({ message: "Invoice updated successfully" });
  } catch (err) {
    await connection.rollback();
    console.log(err);
    res.status(500).json({ message: "Unable to update invoice" });
  } finally {
    connection.release();
  }
};

/* ===========================================================
   DELETE INVOICE
=========================================================== */

exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM invoices WHERE invoice_id=?", [id]);

    res.json({ message: "Invoice deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Unable to delete invoice" });
  }
};