'use strict';

// SUPER ADMIN-SA4A — Portfolio reports (read-only, owner scoped).
// Financial definition matches Hotel Admin Reports:
// successful payments minus successful refunds = NET COLLECTIONS.
// Overnight occupancy = booked overnight room-nights / current rooms * days.
const db = require('../config/db').promisePool;
const DAY_MS = 86400000;

const pad = value => String(value).padStart(2, '0');
const iso = date => date.toISOString().slice(0, 10);

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && iso(date) === value ? date : null;
}

function moveDay(day, offset) {
  const date = parseDay(day);
  if (!date) throw new Error('Invalid report date.');
  date.setUTCDate(date.getUTCDate() + offset);
  return iso(date);
}

function monthStart(day, offset = 0) {
  const date = parseDay(day);
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)));
}

function monthEnd(day, offset = 0) {
  const date = parseDay(day);
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset + 1, 0)));
}

function inclusiveDays(start, end) {
  return Math.round((parseDay(end) - parseDay(start)) / DAY_MS) + 1;
}

function labelFor(start, end) {
  const fmt = day => new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC', month: 'short', day: '2-digit',
  }).format(parseDay(day));
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

function buildRange(query) {
  const period = query.period === undefined ? 'monthly' : query.period;
  if (!['daily', 'weekly', 'monthly', 'custom'].includes(period)) {
    return { error: 'period must be daily, weekly, monthly or custom.' };
  }

  const today = new Date();
  const defaultAnchor = [today.getFullYear(), pad(today.getMonth() + 1), pad(today.getDate())].join('-');
  const anchor = query.date === undefined ? defaultAnchor : query.date;
  if (!parseDay(anchor)) return { error: 'date must be a valid YYYY-MM-DD date.' };

  const buckets = [];
  let shiftPrevious;
  if (period === 'custom') {
    if (!parseDay(query.from) || !parseDay(query.to) || query.from > query.to) {
      return { error: 'Custom range requires valid from/to (YYYY-MM-DD), from <= to.' };
    }
    const days = inclusiveDays(query.from, query.to);
    if (days > 366) return { error: 'Custom report range cannot exceed 366 days.' };
    const size = Math.ceil(days / 12);
    for (let offset = 0; offset < days; offset += size) {
      const start = moveDay(query.from, offset);
      const end = moveDay(query.from, Math.min(days - 1, offset + size - 1));
      buckets.push({ start, end, label: labelFor(start, end) });
    }
    shiftPrevious = ({ start, end }) => ({ start: moveDay(start, -days), end: moveDay(end, -days) });
  } else if (period === 'monthly') {
    for (let offset = -5; offset <= 0; offset += 1) {
      const start = monthStart(anchor, offset);
      const end = monthEnd(anchor, offset);
      buckets.push({ start, end, label: new Intl.DateTimeFormat('en-IN', {
        timeZone: 'UTC', month: 'short', year: '2-digit',
      }).format(parseDay(start)) });
    }
    shiftPrevious = ({ start }) => ({ start: monthStart(start, -6), end: monthEnd(start, -6) });
  } else {
    const count = period === 'daily' ? 14 : 8;
    const length = period === 'daily' ? 1 : 7;
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const end = moveDay(anchor, -offset * length);
      const start = moveDay(end, -(length - 1));
      buckets.push({ start, end, label: labelFor(start, end) });
    }
    const days = count * length;
    shiftPrevious = ({ start, end }) => ({ start: moveDay(start, -days), end: moveDay(end, -days) });
  }

  const rangeStart = buckets[0].start;
  const rangeEnd = buckets[buckets.length - 1].end;
  const previousBuckets = buckets.map(shiftPrevious);
  return {
    period, buckets, previousBuckets, rangeStart, rangeEnd,
    prevStart: previousBuckets[0].start,
    prevEnd: previousBuckets[previousBuckets.length - 1].end,
    anchor: period === 'custom' ? query.to : anchor,
  };
}

const asNumber = value => Number(value || 0);
const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
const rate = (part, whole) => whole > 0 ? Math.round(part / whole * 1000) / 10 : 0;
const changePct = (current, previous) => previous > 0
  ? Math.round((current - previous) / previous * 1000) / 10
  : current === 0 && previous === 0 ? 0 : null;
const inRange = (day, start, end) => day >= start && day <= end;
const hotelDisplay = id => `HT-${String(id).padStart(4, '0')}`;

async function getSuperAdminReportsOverview(req, res) {
  const ownerId = Number(req.dbUser?.superadminId);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
    return res.status(403).json({ success: false, code: 'SUPER_ADMIN_CONTEXT_MISSING', message: 'Super Admin context missing.' });
  }

  const range = buildRange(req.query || {});
  if (range.error) {
    return res.status(400).json({ success: false, code: 'INVALID_REPORT_RANGE', message: range.error });
  }

  const hotelFilter = req.query.hotel === undefined ? 'all' : req.query.hotel;
  if (typeof hotelFilter !== 'string' || (hotelFilter !== 'all' && !/^HT-\d{1,10}$/.test(hotelFilter))) {
    return res.status(400).json({ success: false, code: 'INVALID_HOTEL_FILTER', message: 'hotel must be all or a valid HT-XXXX identifier.' });
  }

  try {
    const [ownedRows] = await db.query(`
      /* SA4A-OWNED */
      SELECT h.hotel_id, h.hotel_name
      FROM hotels h
      WHERE h.superadmin_id = ?
      ORDER BY h.hotel_id ASC
    `, [ownerId]);

    const owned = ownedRows.map(row => ({
      hotelId: Number(row.hotel_id),
      displayId: hotelDisplay(row.hotel_id),
      name: row.hotel_name,
    }));
    const selectedId = hotelFilter === 'all' ? null : Number(hotelFilter.slice(3));
    const selected = selectedId === null ? owned : owned.filter(h => h.hotelId === selectedId);
    if (selectedId !== null && selected.length !== 1) {
      return res.status(404).json({ success: false, code: 'HOTEL_NOT_FOUND', message: 'Hotel not found in your portfolio.' });
    }

    const months = Array.from({ length: 6 }, (_, i) => {
      const start = monthStart(range.anchor, i - 5);
      return { start, end: monthEnd(range.anchor, i - 5) };
    });
    const queryStart = [range.prevStart, range.rangeStart, months[0].start].sort()[0];
    const queryEnd = [range.rangeEnd, months[5].end].sort().slice(-1)[0];

    const rooms = new Map(selected.map(h => [h.hotelId, 0]));
    let paymentRows = [];
    let bookingRows = [];
    const soldByRange = async (start, end) => {
      const [rows] = await db.query(`
        /* SA4A-SOLD-NIGHTS */
        SELECT b.hotel_id,
          COALESCE(SUM(GREATEST(0, DATEDIFF(
            LEAST(DATE(b.check_out), DATE_ADD(?, INTERVAL 1 DAY)),
            GREATEST(DATE(b.check_in), ?)
          ))), 0) AS sold_room_nights
        FROM bookings b
        INNER JOIN hotels h ON h.hotel_id = b.hotel_id
        WHERE h.superadmin_id = ?
          AND (? IS NULL OR h.hotel_id = ?)
          AND b.stay_type = 'overnight'
          AND b.booking_status IN ('confirmed', 'checked_in', 'checked_out')
          AND DATE(b.check_in) < DATE_ADD(?, INTERVAL 1 DAY)
          AND DATE(b.check_out) > ?
        GROUP BY b.hotel_id
      `, [end, start, ownerId, selectedId, selectedId, end, start]);
      return new Map(rows.map(row => [Number(row.hotel_id), asNumber(row.sold_room_nights)]));
    };

    if (selected.length) {
      const [roomRows] = await db.query(`
        /* SA4A-ROOMS */
        SELECT h.hotel_id, COUNT(r.room_id) AS total_rooms
        FROM hotels h
        LEFT JOIN rooms r ON r.hotel_id = h.hotel_id
        WHERE h.superadmin_id = ?
          AND (? IS NULL OR h.hotel_id = ?)
        GROUP BY h.hotel_id
      `, [ownerId, selectedId, selectedId]);
      roomRows.forEach(row => rooms.set(Number(row.hotel_id), asNumber(row.total_rooms)));

      [paymentRows] = await db.query(`
        /* SA4A-PAYMENTS */
        SELECT p.hotel_id,
          DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS day,
          COALESCE(SUM(CASE
            WHEN p.transaction_type = 'payment' THEN p.amount
            WHEN p.transaction_type = 'refund' THEN -p.amount
            ELSE 0 END), 0) AS net_collections
        FROM payments p
        INNER JOIN hotels h ON h.hotel_id = p.hotel_id
        WHERE h.superadmin_id = ?
          AND (? IS NULL OR h.hotel_id = ?)
          AND p.payment_status = 'success'
          AND p.payment_date >= ?
          AND p.payment_date < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY p.hotel_id, DATE_FORMAT(p.payment_date, '%Y-%m-%d')
      `, [ownerId, selectedId, selectedId, queryStart, queryEnd]);

      [bookingRows] = await db.query(`
        /* SA4A-BOOKINGS */
        SELECT b.hotel_id,
          DATE_FORMAT(b.check_in, '%Y-%m-%d') AS day,
          b.booking_status AS status,
          COUNT(*) AS bookings_count
        FROM bookings b
        INNER JOIN hotels h ON h.hotel_id = b.hotel_id
        WHERE h.superadmin_id = ?
          AND (? IS NULL OR h.hotel_id = ?)
          AND b.check_in >= ?
          AND b.check_in < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY b.hotel_id, DATE_FORMAT(b.check_in, '%Y-%m-%d'), b.booking_status
      `, [ownerId, selectedId, selectedId, queryStart, queryEnd]);
    }

    const paymentsFor = (start, end, id = null) => roundMoney(paymentRows.reduce(
      (sum, row) => sum + (inRange(row.day, start, end) && (id === null || Number(row.hotel_id) === id) ? asNumber(row.net_collections) : 0), 0
    ));
    const bookingCounts = (start, end, id = null) => bookingRows.reduce((result, row) => {
      if (inRange(row.day, start, end) && (id === null || Number(row.hotel_id) === id)) {
        const count = asNumber(row.bookings_count);
        result.total += count;
        if (row.status === 'cancelled') result.cancelled += count;
      }
      return result;
    }, { total: 0, cancelled: 0 });

    const soldCurrent = selected.length ? await soldByRange(range.rangeStart, range.rangeEnd) : new Map();
    const soldPrevious = selected.length ? await soldByRange(range.prevStart, range.prevEnd) : new Map();
    const selectedRooms = selected.reduce((sum, h) => sum + (rooms.get(h.hotelId) || 0), 0);
    const days = inclusiveDays(range.rangeStart, range.rangeEnd);
    const previousDays = inclusiveDays(range.prevStart, range.prevEnd);
    const availableNights = selectedRooms * days;
    const previousAvailableNights = selectedRooms * previousDays;
    const soldNights = selected.reduce((sum, h) => sum + (soldCurrent.get(h.hotelId) || 0), 0);
    const prevSoldNights = selected.reduce((sum, h) => sum + (soldPrevious.get(h.hotelId) || 0), 0);
    const net = paymentsFor(range.rangeStart, range.rangeEnd);
    const prevNet = paymentsFor(range.prevStart, range.prevEnd);
    const bookings = bookingCounts(range.rangeStart, range.rangeEnd);
    const prevBookings = bookingCounts(range.prevStart, range.prevEnd);
    const occ = rate(soldNights, availableNights);
    const prevOcc = rate(prevSoldNights, previousAvailableNights);
    const cancelRate = rate(bookings.cancelled, bookings.total);
    const prevCancelRate = rate(prevBookings.cancelled, prevBookings.total);

    const hotelPerformance = selected.map(h => {
      const totalRooms = rooms.get(h.hotelId) || 0;
      const sold = soldCurrent.get(h.hotelId) || 0;
      const roomNights = totalRooms * days;
      const count = bookingCounts(range.rangeStart, range.rangeEnd, h.hotelId);
      return {
        ...h, totalRooms, netCollections: paymentsFor(range.rangeStart, range.rangeEnd, h.hotelId),
        totalBookings: count.total, cancelledBookings: count.cancelled,
        cancellationRate: rate(count.cancelled, count.total),
        soldRoomNights: sold, availableRoomNights: roomNights,
        occupancyRate: rate(sold, roomNights),
      };
    });

    const revenueTrend = range.buckets.map((b, i) => ({
      label: b.label, start: b.start, end: b.end,
      thisPeriod: paymentsFor(b.start, b.end),
      lastPeriod: paymentsFor(range.previousBuckets[i].start, range.previousBuckets[i].end),
    }));
    const bookingTrend = range.buckets.map(b => ({
      label: b.label, start: b.start, end: b.end,
      count: bookingCounts(b.start, b.end).total,
    }));

    const statusMap = new Map();
    bookingRows.forEach(row => {
      if (!inRange(row.day, range.rangeStart, range.rangeEnd)) return;
      statusMap.set(row.status, (statusMap.get(row.status) || 0) + asNumber(row.bookings_count));
    });
    const bookingStatusBreakdown = [...statusMap.entries()]
      .map(([status, count]) => ({ status, count, pct: rate(count, bookings.total) }))
      .sort((a, b) => b.count - a.count);

    const monthlySummary = [];
    for (const month of months) {
      const monthBookings = bookingCounts(month.start, month.end);
      const monthNet = paymentsFor(month.start, month.end);
      const monthSoldMap = selected.length ? await soldByRange(month.start, month.end) : new Map();
      const monthSold = selected.reduce((sum, h) => sum + (monthSoldMap.get(h.hotelId) || 0), 0);
      const monthAvailable = selectedRooms * inclusiveDays(month.start, month.end);
      monthlySummary.push({
        month: new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'short', year: 'numeric' }).format(parseDay(month.start)),
        start: month.start, end: month.end,
        netCollections: monthNet, bookings: monthBookings.total,
        soldRoomNights: monthSold, availableRoomNights: monthAvailable,
        occupancyRate: rate(monthSold, monthAvailable),
        collectionsPerSoldRoomNight: monthSold > 0 ? Math.round(monthNet / monthSold) : 0,
        collectionsPerAvailableRoomNight: monthAvailable > 0 ? Math.round(monthNet / monthAvailable) : 0,
      });
    }

    return res.status(200).json({ success: true, data: {
      period: range.period, rangeStart: range.rangeStart, rangeEnd: range.rangeEnd,
      rangeLabel: `${range.rangeStart} to ${range.rangeEnd}`,
      previousRange: { start: range.prevStart, end: range.prevEnd },
      isCustomRange: range.period === 'custom',
      hotelFilter: selectedId === null ? 'all' : hotelDisplay(selectedId),
      totalOwnedHotels: owned.length, hotelCount: selected.length, hotels: owned,
      monthlySummaryScope: 'Last 6 calendar months ending in the selected anchor month',
      stats: {
        netCollections: net, netCollectionsPrev: prevNet,
        netCollectionsChangePct: changePct(net, prevNet),
        totalBookings: bookings.total, totalBookingsPrev: prevBookings.total,
        totalBookingsChangePct: changePct(bookings.total, prevBookings.total),
        cancelledBookings: bookings.cancelled,
        cancellationRate: cancelRate, cancellationRatePrev: prevCancelRate,
        cancellationRateChangePp: Math.round((cancelRate - prevCancelRate) * 10) / 10,
        totalRoomsCount: selectedRooms,
        soldRoomNights: soldNights, previousSoldRoomNights: prevSoldNights,
        availableRoomNights: availableNights, previousAvailableRoomNights: previousAvailableNights,
        occupancyRate: occ, occupancyRatePrev: prevOcc,
        occupancyRateChangePct: changePct(occ, prevOcc),
        collectionsPerSoldRoomNight: soldNights > 0 ? Math.round(net / soldNights) : 0,
        collectionsPerAvailableRoomNight: availableNights > 0 ? Math.round(net / availableNights) : 0,
      },
      revenueTrend, bookingTrend, bookingStatusBreakdown, hotelPerformance, monthlySummary,
    }});
  } catch (error) {
    console.error(`[SUPER_ADMIN_REPORTS] ${error.code || 'UNKNOWN'}: ${error.message || 'Query failed'}`);
    return res.status(500).json({ success: false, code: 'PORTFOLIO_REPORT_FAILED', message: 'Portfolio report could not be loaded.' });
  }
}

module.exports = { getSuperAdminReportsOverview };