// controllers/billingController.js

const db = require('../config/db').promisePool;
// Maps the frontend's payment method labels to the DB's payment_method enum
const METHOD_MAP = {
  Cash: "cash",
  Card: "card",
  UPI: "upi",
  "Net Banking": "bank_transfer",
};

/* ===========================================================
   BILLING DASHBOARD
   Accepts optional ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD.
   Invoice-based figures (stats, revenue) filter on generated_at;
   payment-based figures (methods, recent payments) filter on payment_date.
=========================================================== */

exports.getBillingDashboard = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const { dateFrom, dateTo } = req.query;
    const hasRange = Boolean(dateFrom && dateTo);
    const invoiceRange = hasRange ? " AND DATE(generated_at) BETWEEN ? AND ?" : "";
    const paymentRange = hasRange ? " AND DATE(payment_date) BETWEEN ? AND ?" : "";
    const invoiceParams = hasRange ? [hotelId, dateFrom, dateTo] : [hotelId];
    const paymentParams = hasRange ? [hotelId, dateFrom, dateTo] : [hotelId];

    const [[stats]] = await db.query(
      `SELECT COUNT(*) AS totalBills, IFNULL(SUM(total_amount),0) AS totalRevenue, IFNULL(SUM(paid_amount),0) AS paidAmount, IFNULL(SUM(pending_amount),0) AS outstanding
       FROM invoices WHERE hotel_id = ?${invoiceRange}`,
      invoiceParams
    );

    const [revenue] = await db.query(
      `SELECT DATE_FORMAT(generated_at,'%b') AS month, SUM(total_amount) AS val
       FROM invoices WHERE hotel_id = ?${invoiceRange}
       GROUP BY MONTH(generated_at), DATE_FORMAT(generated_at,'%b')
       ORDER BY MONTH(generated_at)`,
      invoiceParams
    );

    const [methods] = await db.query(
      `SELECT payment_method, COUNT(*) total
       FROM payments
       WHERE hotel_id = ? AND payment_status = 'success'${paymentRange}
       GROUP BY payment_method`,
      paymentParams
    );

    const totalMethodCount = methods.reduce((sum, m) => sum + Number(m.total), 0);
    const colors = { cash:"#10b981", card:"#3b82f6", upi:"#f59e0b", bank_transfer:"#8b5cf6" };
    const paymentMethods = methods.map((m) => ({ label:m.payment_method, pct:totalMethodCount === 0 ? 0 : Number(((m.total / totalMethodCount) * 100).toFixed(1)), color:colors[m.payment_method] || "#64748b" }));

    const [recentPayments] = await db.query(
      `SELECT c.full_name guest, i.invoice_number inv, CONCAT('₹ ',FORMAT(p.amount,0)) amount, p.payment_status status, DATE_FORMAT(p.payment_date,'%d %b %Y') date
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id AND b.hotel_id = p.hotel_id
       JOIN customers c ON b.customer_id = c.customer_id
       JOIN invoices i ON i.booking_id = b.booking_id AND i.hotel_id = b.hotel_id
       WHERE p.hotel_id = ?${paymentRange}
       ORDER BY p.payment_date DESC
       LIMIT 5`,
      paymentParams
    );

    return res.json({ stats, revenue, paymentMethods, recentPayments });
  } catch (err) {
    console.error("getBillingDashboard error:", err);
    return res.status(500).json({ message:"Failed to load billing dashboard" });
  }
};

exports.getRevenueChart = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const { dateFrom, dateTo } = req.query;
    const hasRange = Boolean(dateFrom && dateTo);
    const dateRange = hasRange ? " AND DATE(generated_at) BETWEEN ? AND ?" : "";
    const params = hasRange ? [hotelId, dateFrom, dateTo] : [hotelId];

    const [rows] = await db.query(
      `SELECT DATE_FORMAT(generated_at,'%b') month, SUM(total_amount) val
       FROM invoices
       WHERE hotel_id = ?${dateRange}
       GROUP BY MONTH(generated_at), DATE_FORMAT(generated_at,'%b')
       ORDER BY MONTH(generated_at)`,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error("getRevenueChart error:", err);
    return res.status(500).json({ message:"Unable to load revenue chart" });
  }
};

exports.getPaymentMethods = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const { dateFrom, dateTo } = req.query;
    const hasRange = Boolean(dateFrom && dateTo);
    const dateRange = hasRange ? " AND DATE(payment_date) BETWEEN ? AND ?" : "";
    const params = hasRange ? [hotelId, dateFrom, dateTo] : [hotelId];

    const [rows] = await db.query(
      `SELECT payment_method, COUNT(*) total
       FROM payments
       WHERE hotel_id = ? AND payment_status = 'success'${dateRange}
       GROUP BY payment_method`,
      params
    );

    const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
    const colors = { cash:"#10b981", card:"#3b82f6", upi:"#f59e0b", bank_transfer:"#8b5cf6" };

    return res.json(rows.map((row) => ({
      label:row.payment_method,
      pct:total === 0 ? 0 : Number(((row.total / total) * 100).toFixed(1)),
      color:colors[row.payment_method] || "#64748b",
    })));
  } catch (err) {
    console.error("getPaymentMethods error:", err);
    return res.status(500).json({ message:"Unable to load payment methods" });
  }
};

exports.getRecentPayments = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const { dateFrom, dateTo, limit = 5 } = req.query;
    const hasRange = Boolean(dateFrom && dateTo);
    const dateRange = hasRange ? " AND DATE(p.payment_date) BETWEEN ? AND ?" : "";
    const params = hasRange ? [hotelId, dateFrom, dateTo] : [hotelId];

    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 5));

    const [rows] = await db.query(
      `SELECT c.full_name guest, i.invoice_number inv, CONCAT('₹ ',FORMAT(p.amount,0)) amount, p.payment_status status, DATE_FORMAT(p.payment_date,'%d %b %Y') date
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id AND b.hotel_id = p.hotel_id
       JOIN customers c ON b.customer_id = c.customer_id
       JOIN invoices i ON i.booking_id = b.booking_id AND i.hotel_id = b.hotel_id
       WHERE p.hotel_id = ?${dateRange}
       ORDER BY p.payment_date DESC
       LIMIT ?`,
      [...params, safeLimit]
    );

    return res.json(rows);
  } catch (err) {
    console.error("getRecentPayments error:", err);
    return res.status(500).json({ message:"Unable to fetch recent payments" });
  }
};

exports.getAllInvoices = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const { search = "", status, page = 1, limit = 8, dateFrom, dateTo } = req.query;
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 8));
    const offset = (safePage - 1) * safeLimit;
    const conditions = ["i.hotel_id = ?"];
    const params = [hotelId];

    if (search) {
      const like = `%${search}%`;
      conditions.push("(i.invoice_number LIKE ? OR c.full_name LIKE ? OR b.booking_id LIKE ?)");
      params.push(like, like, like);
    }

    if (status && status !== "All Bills") {
      conditions.push("i.invoice_status = ?");
      params.push(status.toLowerCase());
    }

    if (dateFrom && dateTo) {
      conditions.push("DATE(i.generated_at) BETWEEN ? AND ?");
      params.push(dateFrom, dateTo);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM invoices i
       JOIN bookings b ON i.booking_id = b.booking_id AND b.hotel_id = i.hotel_id
       JOIN customers c ON b.customer_id = c.customer_id
       ${whereClause}`,
      params
    );

    const [rows] = await db.query(
      `SELECT i.invoice_id, i.invoice_number, b.booking_id, DATE_FORMAT(b.check_in,'%Y-%m-%d') AS check_in, DATE_FORMAT(b.check_out,'%Y-%m-%d') AS check_out,
       c.full_name, r.room_number, i.total_amount, i.paid_amount, i.pending_amount, i.invoice_status,
       COALESCE((SELECT SUM(CASE
         WHEN p.transaction_type='payment' THEN p.amount
         WHEN p.transaction_type='refund' THEN -p.amount
         ELSE 0 END)
       FROM payments p
       WHERE p.booking_id=b.booking_id AND p.hotel_id=i.hotel_id AND p.payment_status='success'),0) AS net_paid,
       (SELECT payment_method FROM payments WHERE booking_id = b.booking_id AND hotel_id = i.hotel_id ORDER BY payment_date DESC LIMIT 1) AS payment_method
       FROM invoices i
       JOIN bookings b ON i.booking_id = b.booking_id AND b.hotel_id = i.hotel_id
       JOIN customers c ON b.customer_id = c.customer_id
       JOIN rooms r ON b.room_id = r.room_id
       ${whereClause}
       ORDER BY i.generated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
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
      netPaid: Number(row.net_paid),
      refundDue: Math.max(0, Number(row.net_paid) - Number(row.total_amount)),
      status: row.invoice_status === "paid" ? "Paid" : row.invoice_status === "partial" ? "Partial" : "Unpaid",
      method: row.payment_method || "-",
    }));

    return res.json({ invoices, total, totalPages: Math.max(1, Math.ceil(total / safeLimit)) });
  } catch (err) {
    console.error("getAllInvoices error:", err);
    return res.status(500).json({ message: "Unable to fetch invoices" });
  }
};

exports.getInvoiceById = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const { id } = req.params;

    const [[invoice]] = await db.query(
      `SELECT i.invoice_id, i.invoice_number, b.booking_id, DATE_FORMAT(b.check_in,'%Y-%m-%d') AS check_in, DATE_FORMAT(b.check_out,'%Y-%m-%d') AS check_out,
       c.full_name, c.phone, c.email, r.room_number, i.room_charges, i.food_charges, i.laundry_charges, i.extra_service_charges,
       i.tax_amount, i.total_amount, i.paid_amount, i.pending_amount, i.invoice_status,
       COALESCE((SELECT SUM(CASE
         WHEN p.transaction_type='payment' THEN p.amount
         WHEN p.transaction_type='refund' THEN -p.amount
         ELSE 0 END)
       FROM payments p
       WHERE p.booking_id=b.booking_id AND p.hotel_id=i.hotel_id AND p.payment_status='success'),0) AS net_paid
       FROM invoices i
       JOIN bookings b ON i.booking_id = b.booking_id AND b.hotel_id = i.hotel_id
       JOIN customers c ON b.customer_id = c.customer_id
       JOIN rooms r ON b.room_id = r.room_id
       WHERE i.invoice_id = ? AND i.hotel_id = ?`,
      [id, hotelId]
    );

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const [[payment]] = await db.query(
      `SELECT payment_method, payment_status, payment_date, transaction_id
       FROM payments
       WHERE booking_id = ? AND hotel_id = ?
       ORDER BY payment_date DESC
       LIMIT 1`,
      [invoice.booking_id, hotelId]
    );

    return res.json({
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
      netPaid: Number(invoice.net_paid),
      refundDue: Math.max(0, Number(invoice.net_paid) - Number(invoice.total_amount)),
      status: invoice.invoice_status,
      paymentMethod: payment?.payment_method || "-",
      paymentStatus: payment?.payment_status || "-",
      transactionId: payment?.transaction_id || "-",
      paymentDate: payment?.payment_date || null,
    });
  } catch (err) {
    console.error("getInvoiceById error:", err);
    return res.status(500).json({ message: "Unable to fetch invoice" });
  }
};

exports.createInvoice = async (req, res) => {
  const hotelId = req.dbUser.hotelId;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      booking_id,
      room_charges = 0,
      food_charges = 0,
      laundry_charges = 0,
      extra_service_charges = 0,
      tax_amount = 0,
    } = req.body;

    const [[booking]] = await connection.query(
      `SELECT b.booking_id,b.booking_status,
              (SELECT bfs.final_payable_amount
               FROM booking_financial_settlements bfs
               WHERE bfs.hotel_id=b.hotel_id AND bfs.booking_id=b.booking_id
                 AND bfs.settlement_status='finalized'
               ORDER BY bfs.settlement_id DESC LIMIT 1) AS final_payable_amount
       FROM bookings b
       WHERE b.booking_id=? AND b.hotel_id=?
       FOR UPDATE`,
      [booking_id, hotelId]
    );

    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: "Booking not found" });
    }

    const [[duplicate]] = await connection.query(
      "SELECT invoice_id FROM invoices WHERE booking_id=? AND hotel_id=? LIMIT 1",
      [booking_id, hotelId]
    );

    if (duplicate) {
      await connection.rollback();
      return res.status(409).json({ message: "Invoice already exists for this booking" });
    }

    const manualTotal =
      Number(room_charges) +
      Number(food_charges) +
      Number(laundry_charges) +
      Number(extra_service_charges) +
      Number(tax_amount);

    const isFinalizedLifecycle =
      ["no_show", "cancelled"].includes(booking.booking_status) &&
      booking.final_payable_amount !== null;

    const total_amount = isFinalizedLifecycle
      ? Math.max(0, Number(booking.final_payable_amount))
      : manualTotal;

    const invoiceRoomCharges = isFinalizedLifecycle ? total_amount : Number(room_charges);
    const invoiceFoodCharges = isFinalizedLifecycle ? 0 : Number(food_charges);
    const invoiceLaundryCharges = isFinalizedLifecycle ? 0 : Number(laundry_charges);
    const invoiceExtraCharges = isFinalizedLifecycle ? 0 : Number(extra_service_charges);
    const invoiceTaxAmount = isFinalizedLifecycle ? 0 : Number(tax_amount);

    const [[ledger]] = await connection.query(
      `SELECT COALESCE(SUM(CASE
         WHEN transaction_type='payment' THEN amount
         WHEN transaction_type='refund' THEN -amount
         ELSE 0 END),0) AS net_paid
       FROM payments
       WHERE booking_id=? AND hotel_id=? AND payment_status='success'`,
      [booking_id, hotelId]
    );

    const netPaid = Math.max(0, Number(ledger.net_paid) || 0);
    const paid_amount = Math.min(netPaid, total_amount);
    const pending_amount = Math.max(0, total_amount - paid_amount);

    let invoice_status = "unpaid";
    if (total_amount <= 0 || paid_amount >= total_amount) invoice_status = "paid";
    else if (paid_amount > 0) invoice_status = "partial";

    const invoice_number = "INV-" + Date.now();

    const [result] = await connection.query(
      `INSERT INTO invoices
       (hotel_id, booking_id, invoice_number, room_charges, food_charges, laundry_charges,
        extra_service_charges, tax_amount, total_amount, paid_amount, pending_amount, invoice_status)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        hotelId, booking_id, invoice_number, invoiceRoomCharges, invoiceFoodCharges,
        invoiceLaundryCharges, invoiceExtraCharges, invoiceTaxAmount, total_amount,
        paid_amount, pending_amount, invoice_status,
      ]
    );

    await connection.commit();

    return res.status(201).json({
      message: "Invoice generated successfully",
      invoice_id: result.insertId,
      paid_amount,
      pending_amount,
      invoice_status,
      settlement_applied: isFinalizedLifecycle,
    });
  } catch (err) {
    await connection.rollback();
    console.error("createInvoice error:", err);
    return res.status(500).json({ message: "Unable to generate invoice" });
  } finally {
    connection.release();
  }
};

/* ===========================================================
   UPDATE INVOICE
=========================================================== */
exports.updateInvoice = async (req, res) => {
  const hotelId = req.dbUser.hotelId;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      room_charges,
      food_charges,
      laundry_charges,
      extra_service_charges,
      tax_amount,
    } = req.body;

    const [[existing]] = await connection.query(
      `SELECT i.booking_id,b.booking_status,
              (SELECT bfs.final_payable_amount
               FROM booking_financial_settlements bfs
               WHERE bfs.hotel_id=b.hotel_id AND bfs.booking_id=b.booking_id
                 AND bfs.settlement_status='finalized'
               ORDER BY bfs.settlement_id DESC LIMIT 1) AS final_payable_amount
       FROM invoices i
       JOIN bookings b ON b.booking_id=i.booking_id AND b.hotel_id=i.hotel_id
       WHERE i.invoice_id=? AND i.hotel_id=?
       FOR UPDATE`,
      [id, hotelId]
    );

    if (!existing) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found" });
    }

    const manualTotal =
      Number(room_charges) +
      Number(food_charges) +
      Number(laundry_charges) +
      Number(extra_service_charges) +
      Number(tax_amount);

    const isFinalizedLifecycle =
      ["no_show", "cancelled"].includes(existing.booking_status) &&
      existing.final_payable_amount !== null;

    const total_amount = isFinalizedLifecycle
      ? Math.max(0, Number(existing.final_payable_amount))
      : manualTotal;

    const invoiceRoomCharges = isFinalizedLifecycle ? total_amount : Number(room_charges);
    const invoiceFoodCharges = isFinalizedLifecycle ? 0 : Number(food_charges);
    const invoiceLaundryCharges = isFinalizedLifecycle ? 0 : Number(laundry_charges);
    const invoiceExtraCharges = isFinalizedLifecycle ? 0 : Number(extra_service_charges);
    const invoiceTaxAmount = isFinalizedLifecycle ? 0 : Number(tax_amount);

    const [[ledger]] = await connection.query(
      `SELECT COALESCE(SUM(CASE
         WHEN transaction_type='payment' THEN amount
         WHEN transaction_type='refund' THEN -amount
         ELSE 0 END),0) AS net_paid
       FROM payments
       WHERE booking_id=? AND hotel_id=? AND payment_status='success'`,
      [existing.booking_id, hotelId]
    );

    const netPaid = Math.max(0, Number(ledger.net_paid) || 0);
    const paid_amount = Math.min(netPaid, total_amount);
    const pending_amount = Math.max(0, total_amount - paid_amount);

    let invoice_status = "unpaid";
    if (total_amount <= 0 || paid_amount >= total_amount) invoice_status = "paid";
    else if (paid_amount > 0) invoice_status = "partial";

    await connection.query(
      `UPDATE invoices
       SET room_charges=?, food_charges=?, laundry_charges=?, extra_service_charges=?,
           tax_amount=?, total_amount=?, paid_amount=?, pending_amount=?, invoice_status=?
       WHERE invoice_id=? AND hotel_id=?`,
      [
        invoiceRoomCharges, invoiceFoodCharges, invoiceLaundryCharges, invoiceExtraCharges,
        invoiceTaxAmount, total_amount, paid_amount, pending_amount,
        invoice_status, id, hotelId,
      ]
    );

    await connection.commit();

    return res.json({
      message: "Invoice updated successfully",
      paid_amount,
      pending_amount,
      invoice_status,
      settlement_applied: isFinalizedLifecycle,
    });
  } catch (err) {
    await connection.rollback();
    console.error("updateInvoice error:", err);
    return res.status(500).json({ message: "Unable to update invoice" });
  } finally {
    connection.release();
  }
};

/* ===========================================================
   DELETE INVOICE
=========================================================== */
exports.deleteInvoice = async (req, res) => {
  const hotelId = req.dbUser.hotelId;

  try {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM invoices WHERE invoice_id=? AND hotel_id=?",
      [id, hotelId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json({ message: "Invoice deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Unable to delete invoice" });
  }
};