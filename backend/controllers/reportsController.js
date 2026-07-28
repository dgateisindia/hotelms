const db = require('../config/db').promisePool;// ============================================================
// Helpers
// ============================================================
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthShort = (d) => d.toLocaleDateString('en-IN', { month: 'short' });

const ROOM_TYPE_COLORS = {
  Standard: '#6b7280',
  Deluxe: '#3b82f6',
  Suite: '#f59e0b',
  Executive: '#8b5cf6',
  'Presidential Suite': '#ef4444',
};
const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

const STATUS_COLORS = {
  Confirmed: '#3b82f6',
  Pending: '#f59e0b',
  'Checked-in': '#10b981',
  'Checked-out': '#6b7280',
  Cancelled: '#ef4444',
};

const ATT_STATUS_COLORS = { present: '#10b981', absent: '#ef4444', half_day: '#f59e0b', leave: '#8b5cf6' };

// Builds `count` buckets of the given granularity, ending today (inclusive).
// unit: 'day' | 'week' | 'month'
// NOTE: 'week' buckets are rolling 7-day windows anchored on today, not
// calendar (Mon-Sun) weeks — simpler to compute and fine for trend display,
// but flag it if you need ISO week alignment for reporting elsewhere.
function buildBuckets(period, anchorDate) {
  const now = anchorDate || new Date();
  let count, unit;
  if (period === 'daily') { count = 14; unit = 'day'; }
  else if (period === 'weekly') { count = 8; unit = 'week'; }
  else { count = 6; unit = 'month'; }

  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    let start, end, label;
    if (unit === 'day') {
      const d = new Date(now); d.setDate(now.getDate() - i);
      start = fmt(d); end = fmt(d);
      label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } else if (unit === 'week') {
      const endD = new Date(now); endD.setDate(now.getDate() - i * 7);
      const startD = new Date(endD); startD.setDate(endD.getDate() - 6);
      start = fmt(startD); end = fmt(endD);
      label = `${String(startD.getDate()).padStart(2, '0')} ${monthShort(startD)}`;
    } else {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endD = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      start = fmt(d); end = fmt(endD);
      label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    }
    buckets.push({ start, end, label });
  }
  return { buckets, count, unit };
}

// Shifts a start/end pair back by one full window length (for "last period" comparisons)
function shiftBack(start, end, count, unit) {
  if (unit === 'month') {
    const s = new Date(start);
    const prevStart = new Date(s.getFullYear(), s.getMonth() - count, 1);
    const prevEnd = new Date(s.getFullYear(), s.getMonth() - count + 1, 0);
    return { start: fmt(prevStart), end: fmt(new Date(end)).length ? fmt(prevEnd) : fmt(prevEnd) };
  }
  const days = unit === 'week' ? 7 : 1;
  const shift = count * days;
  const sd = new Date(start); sd.setDate(sd.getDate() - shift);
  const ed = new Date(end); ed.setDate(ed.getDate() - shift);
  return { start: fmt(sd), end: fmt(ed) };
}

function colorFor(label, idx, map) {
  return map[label] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function futureLabels(period, count, lastBucket) {
  const labels = [];
  const unit = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';
  const base = new Date(lastBucket.end);
  for (let i = 1; i <= count; i++) {
    let d, label;
    if (unit === 'day') {
      d = new Date(base); d.setDate(base.getDate() + i);
      label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } else if (unit === 'week') {
      d = new Date(base); d.setDate(base.getDate() + i * 7);
      label = `${String(d.getDate()).padStart(2, '0')} ${monthShort(d)}`;
    } else {
      d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    }
    labels.push(label);
  }
  return labels;
}

// ============================================================
// GET /api/reports/overview?period=daily|weekly|monthly
// ============================================================
const getReportsOverview = async (req, res) => {
  try {
    const period = ['daily', 'weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'monthly';

    // Anchor date: everything (buckets, monthly summary) is computed as of
    // this date instead of always defaulting to "today".
    let anchorDate = new Date();
    if (req.query.date) {
      const parsed = new Date(req.query.date);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date query param — expected YYYY-MM-DD' });
      }
      anchorDate = parsed;
    }

    const { buckets, count, unit } = buildBuckets(period, anchorDate);
    const rangeStart = buckets[0].start;
    const rangeEnd = buckets[buckets.length - 1].end;
    const prevRange = shiftBack(rangeStart, rangeEnd, count, unit);

    // ---- Total rooms (used for occupancy/RevPAR math) ----
    const [[roomCountRow]] = await db.query(`SELECT COUNT(*) AS total FROM rooms`);
    const totalRooms = roomCountRow.total || 1;

    // ---- Revenue + booking trend, bucket by bucket (also fetches the
    // equivalent bucket from the previous period, for the dashed comparison line) ----
    const revenueTrend = [];
    const bookingTrend = [];
    for (const b of buckets) {
      const [[cur]] = await db.query(
        `SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE DATE(payment_date) BETWEEN ? AND ?`,
        [b.start, b.end]
      );
      const prevBucket = shiftBack(b.start, b.end, count, unit);
      const [[prev]] = await db.query(
        `SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE DATE(payment_date) BETWEEN ? AND ?`,
        [prevBucket.start, prevBucket.end]
      );
      const [[bkg]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM bookings WHERE DATE(check_in) BETWEEN ? AND ?`,
        [b.start, b.end]
      );
      revenueTrend.push({ label: b.label, thisPeriod: Number(cur.revenue), lastPeriod: Number(prev.revenue) });
      bookingTrend.push({ label: b.label, count: bkg.cnt });
    }

    // ---- Stat cards: current range vs previous equivalent range ----
    const [[revCur]] = await db.query(
      `SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE DATE(payment_date) BETWEEN ? AND ?`,
      [rangeStart, rangeEnd]
    );
    const [[revPrev]] = await db.query(
      `SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE DATE(payment_date) BETWEEN ? AND ?`,
      [prevRange.start, prevRange.end]
    );
    const [[bkgCur]] = await db.query(
      `SELECT COUNT(*) AS total, SUM(booking_status='Cancelled') AS cancelled
       FROM bookings WHERE DATE(check_in) BETWEEN ? AND ?`,
      [rangeStart, rangeEnd]
    );
    const [[bkgPrev]] = await db.query(
      `SELECT COUNT(*) AS total, SUM(booking_status='Cancelled') AS cancelled
       FROM bookings WHERE DATE(check_in) BETWEEN ? AND ?`,
      [prevRange.start, prevRange.end]
    );

    // Occupancy approximation: % of rooms with at least one confirmed/checked-in
    // booking overlapping the range (mirrors the approach already used in
    // getAdminDailyStats for monthly occupancy trend).
    const occOverlapQuery = `
      SELECT COUNT(DISTINCT room_id) AS occupiedRooms
      FROM bookings
      WHERE booking_status IN ('Confirmed','Checked-in')
        AND check_in <= ? AND check_out >= ?`;
    const [[occCur]] = await db.query(occOverlapQuery, [rangeEnd, rangeStart]);
    const [[occPrev]] = await db.query(occOverlapQuery, [prevRange.end, prevRange.start]);
    const occupancyRate = Math.round((occCur.occupiedRooms / totalRooms) * 1000) / 10;
    const occupancyRatePrev = Math.round((occPrev.occupiedRooms / totalRooms) * 1000) / 10;

    const daysInRange = Math.max(1, Math.round((new Date(rangeEnd) - new Date(rangeStart)) / 86400000) + 1);
    const revpar = Math.round(Number(revCur.revenue) / (totalRooms * daysInRange));

    const pctChange = (curr, prev) => (prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : (curr > 0 ? 100 : 0));

    const stats = {
      totalRevenue: Number(revCur.revenue),
      totalRevenueChangePct: pctChange(Number(revCur.revenue), Number(revPrev.revenue)),
      occupancyRate,
      occupancyRateChangePct: pctChange(occupancyRate, occupancyRatePrev),
      totalBookings: bkgCur.total,
      totalBookingsChangePct: pctChange(bkgCur.total, bkgPrev.total),
      cancellationRate: bkgCur.total > 0 ? Math.round((bkgCur.cancelled / bkgCur.total) * 1000) / 10 : 0,
      cancellationRatePrev: bkgPrev.total > 0 ? Math.round((bkgPrev.cancelled / bkgPrev.total) * 1000) / 10 : 0,
      revpar,
      occupiedRooms: occCur.occupiedRooms,
      totalRoomsCount: totalRooms,
    };
    stats.cancellationRateChangePp = Math.round((stats.cancellationRate - stats.cancellationRatePrev) * 10) / 10;

    // ---- Revenue by room type (within range) ----
    const [revByRoomRows] = await db.query(
      `SELECT r.room_type AS label, COALESCE(SUM(p.amount),0) AS revenue
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN rooms r ON b.room_id = r.room_id
       WHERE DATE(p.payment_date) BETWEEN ? AND ?
       GROUP BY r.room_type
       ORDER BY revenue DESC`,
      [rangeStart, rangeEnd]
    );
    const revByRoomTotal = revByRoomRows.reduce((s, r) => s + Number(r.revenue), 0) || 1;
    const revenueByRoom = revByRoomRows.map((r, i) => ({
      label: r.label,
      pct: Math.round((Number(r.revenue) / revByRoomTotal) * 1000) / 10,
      color: colorFor(r.label, i, ROOM_TYPE_COLORS),
    }));

    // ---- Occupancy by room type (overlap approximation, per room type) ----
    const [roomTypes] = await db.query(`SELECT DISTINCT room_type FROM rooms`);
    const occupancyByRoom = [];
    for (const rt of roomTypes) {
      const [[totalOfType]] = await db.query(`SELECT COUNT(*) AS cnt FROM rooms WHERE room_type = ?`, [rt.room_type]);
      const [[occOfType]] = await db.query(
        `SELECT COUNT(DISTINCT b.room_id) AS occupiedRooms
         FROM bookings b JOIN rooms r ON b.room_id = r.room_id
         WHERE r.room_type = ? AND b.booking_status IN ('Confirmed','Checked-in')
           AND b.check_in <= ? AND b.check_out >= ?`,
        [rt.room_type, rangeEnd, rangeStart]
      );
      occupancyByRoom.push({
        label: rt.room_type,
        pct: totalOfType.cnt > 0 ? Math.round((occOfType.occupiedRooms / totalOfType.cnt) * 1000) / 10 : 0,
      });
    }
    occupancyByRoom.sort((a, b) => b.pct - a.pct);

    // ---- Booking status breakdown (replaces the old hardcoded "channels" card —
    // there's no source/channel column in `bookings` to compute real channel data from) ----
    const [statusRows] = await db.query(
      `SELECT booking_status AS label, COUNT(*) AS cnt
       FROM bookings WHERE DATE(check_in) BETWEEN ? AND ?
       GROUP BY booking_status ORDER BY cnt DESC`,
      [rangeStart, rangeEnd]
    );
    const statusTotal = statusRows.reduce((s, r) => s + r.cnt, 0) || 1;
    const bookingStatusBreakdown = statusRows.map((r, i) => ({
      label: r.label,
      pct: Math.round((r.cnt / statusTotal) * 1000) / 10,
      color: colorFor(r.label, i, STATUS_COLORS),
    }));

    // ---- Monthly performance summary — always the last 6 calendar months,
    // regardless of the daily/weekly/monthly period toggle (the table is
    // inherently a monthly view). ----
    const monthlySummary = [];
    for (let i = 5; i >= 0; i--) {
      const d = anchorDate;
      const mStart = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() - i + 1, 0);
      const sStart = fmt(mStart), sEnd = fmt(mEnd);
      const daysInMonth = mEnd.getDate();

      const [[mRev]] = await db.query(
        `SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE DATE(payment_date) BETWEEN ? AND ?`,
        [sStart, sEnd]
      );
      const [[mBkg]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM bookings WHERE DATE(check_in) BETWEEN ? AND ?`,
        [sStart, sEnd]
      );
      const [[mOcc]] = await db.query(occOverlapQuery, [sEnd, sStart]);

      const mOccPct = Math.round((mOcc.occupiedRooms / totalRooms) * 1000) / 10;
      const mAdr = mBkg.cnt > 0 ? Math.round(Number(mRev.revenue) / mBkg.cnt) : 0;
      const mRevpar = Math.round(Number(mRev.revenue) / (totalRooms * daysInMonth));

      monthlySummary.push({
        month: mStart.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        revenue: Number(mRev.revenue),
        occ: mOccPct,
        adr: mAdr,
        revpar: mRevpar,
        bookings: mBkg.cnt,
      });
    }

    // ---- Revenue forecast: simple average-growth-rate projection off the
    // actual revenueTrend series. This is a naive linear-growth estimate, not
    // a real forecasting model — good enough for a rough trend line, not for
    // financial planning. ----
    const growthRates = [];
    for (let i = 1; i < revenueTrend.length; i++) {
      const prev = revenueTrend[i - 1].thisPeriod;
      const curr = revenueTrend[i].thisPeriod;
      if (prev > 0) growthRates.push((curr - prev) / prev);
    }
    const avgGrowth = growthRates.length ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0;

    const forecast = revenueTrend.map((r) => ({ label: r.label, actual: r.thisPeriod, forecast: r.thisPeriod }));
    let lastVal = revenueTrend.length ? revenueTrend[revenueTrend.length - 1].thisPeriod : 0;
    const futLabels = futureLabels(period, count, buckets[buckets.length - 1]);
    futLabels.forEach((label) => {
      lastVal = Math.max(0, Math.round(lastVal * (1 + avgGrowth)));
      forecast.push({ label, actual: null, forecast: lastVal });
    });

    // ---- Insights, generated from the numbers above instead of hardcoded text ----
    const insights = [];
    insights.push({
      type: stats.totalRevenueChangePct >= 0 ? 'up' : 'down',
      text: `Revenue is ${stats.totalRevenueChangePct >= 0 ? 'up' : 'down'} by ${Math.abs(stats.totalRevenueChangePct)}% compared to the previous period.`,
    });
    insights.push({
      type: stats.occupancyRateChangePct >= 0 ? 'up' : 'down',
      text: `Occupancy rate ${stats.occupancyRateChangePct >= 0 ? 'improved' : 'declined'} by ${Math.abs(stats.occupancyRateChangePct)}% compared to the previous period.`,
    });
    if (revenueByRoom.length) {
      insights.push({ type: 'top', text: `${revenueByRoom[0].label}s are generating the highest revenue (${revenueByRoom[0].pct}% of total).` });
    }
    insights.push({
      type: stats.cancellationRateChangePp >= 0 ? 'down' : 'up',
      text: `Cancellation rate is ${stats.cancellationRate}%, ${stats.cancellationRateChangePp >= 0 ? 'up' : 'down'} ${Math.abs(stats.cancellationRateChangePp)} points from the previous period.`,
    });

    // ============================================================
    // ---- Staff overview ----
    // ============================================================
    const [[staffCountRow]] = await db.query(
      `SELECT COUNT(*) AS total, SUM(status='Active') AS active, SUM(status='On Leave') AS onLeave FROM staff`
    );
    const totalStaff = staffCountRow.total || 0;

    const [deptRows] = await db.query(
      `SELECT department AS label, COUNT(*) AS cnt FROM staff GROUP BY department ORDER BY cnt DESC`
    );
    const deptTotal = deptRows.reduce((s, r) => s + r.cnt, 0) || 1;
    const staffByDept = deptRows.map((r, i) => ({
      label: r.label,
      pct: Math.round((r.cnt / deptTotal) * 1000) / 10,
      color: colorFor(r.label, i, {}),
    }));

    // Attendance trend — same buckets as revenue/booking trend.
    // Rate = present-days / (totalStaff * days-in-bucket), mirroring the
    // occupancy-overlap-ratio pattern already used for rooms.
    const attendanceTrend = [];
    for (const b of buckets) {
      const bucketDays = Math.round((new Date(b.end) - new Date(b.start)) / 86400000) + 1;
      const [[att]] = await db.query(
        `SELECT SUM(status='present') AS present FROM attendance WHERE attendance_date BETWEEN ? AND ?`,
        [b.start, b.end]
      );
      const expected = totalStaff * bucketDays;
      const rate = expected > 0 ? Math.round(((att.present || 0) / expected) * 1000) / 10 : 0;
      attendanceTrend.push({ label: b.label, count: rate });
    }

    // Attendance status breakdown within the selected range
    const [attStatusRows] = await db.query(
      `SELECT status AS label, COUNT(*) AS cnt FROM attendance WHERE attendance_date BETWEEN ? AND ? GROUP BY status ORDER BY cnt DESC`,
      [rangeStart, rangeEnd]
    );
    const attStatusTotal = attStatusRows.reduce((s, r) => s + r.cnt, 0) || 1;
    const attendanceStatusBreakdown = attStatusRows.map((r, i) => ({
      label: r.label,
      pct: Math.round((r.cnt / attStatusTotal) * 1000) / 10,
      color: colorFor(r.label, i, ATT_STATUS_COLORS),
    }));

    // Staff monthly summary — last 6 calendar months, same shape as
    // monthlySummary above. totalStaff is current headcount (no historical
    // snapshot table exists, so this is a simplification — flag if you add one).
    const staffMonthlySummary = [];
    for (let i = 5; i >= 0; i--) {
      const d = anchorDate;
      const mStart = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() - i + 1, 0);
      const sStart = fmt(mStart), sEnd = fmt(mEnd);
      const daysInMonth = mEnd.getDate();
      const [[mAtt]] = await db.query(
        `SELECT SUM(status='present') AS present FROM attendance WHERE attendance_date BETWEEN ? AND ?`,
        [sStart, sEnd]
      );
      const expected = totalStaff * daysInMonth;
      staffMonthlySummary.push({
        month: mStart.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        totalStaff,
        attendanceRate: expected > 0 ? Math.round(((mAtt.present || 0) / expected) * 1000) / 10 : 0,
      });
    }

    // Attendance rate for the current range (for the insight line + a stat)
    const [[rangeAtt]] = await db.query(
      `SELECT SUM(status='present') AS present FROM attendance WHERE attendance_date BETWEEN ? AND ?`,
      [rangeStart, rangeEnd]
    );
    const staffAttendanceRate = totalStaff > 0
      ? Math.round(((rangeAtt.present || 0) / (totalStaff * daysInRange)) * 1000) / 10
      : 0;

    const staffInsights = [];
    if (staffByDept.length) {
      staffInsights.push({ type: 'top', text: `${staffByDept[0].label} has the largest headcount (${staffByDept[0].pct}% of staff).` });
    }
    staffInsights.push({
      type: staffAttendanceRate >= 90 ? 'up' : 'down',
      text: `Attendance rate for the selected period is ${staffAttendanceRate}%.`,
    });
    if (staffCountRow.onLeave > 0) {
      staffInsights.push({ type: 'target', text: `${staffCountRow.onLeave} staff member(s) currently on leave.` });
    }

    const staffOverview = {
      totalStaff,
      activeStaff: staffCountRow.active || 0,
      onLeaveStaff: staffCountRow.onLeave || 0,
      attendanceRate: staffAttendanceRate,
      staffByDept,
      attendanceTrend,
      attendanceStatusBreakdown,
      staffMonthlySummary,
      insights: staffInsights,
    };

    res.status(200).json({
      success: true,
      data: {
        period,
        rangeLabel: `${rangeStart} to ${rangeEnd}`,
        stats,
        revenueTrend,
        revenueByRoom,
        occupancyByRoom,
        bookingTrend,
        bookingStatusBreakdown,
        monthlySummary,
        forecast,
        insights,
        staffOverview,
      },
    });
  } catch (err) {
    console.error('getReportsOverview error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching reports' });
  }
};

module.exports = { getReportsOverview };