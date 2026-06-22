// ============================================================
//  Bookings.js — Booking Management Page (Admin Only)
//  Key change: PHONE NUMBER is the customer-linking key
//  - Each room booked = its own row + own unique Booking ID
//  - Rows sharing the same phone number are visually grouped
//    (shaded band + phone number shown once via rowSpan)
//  - Typing an existing phone in "New Booking" auto-fills guest
//    info and lets admin add more rooms under new Booking IDs
//  - Delete removed — only Cancel remains (admin only)
// ============================================================

import React, { useState, useMemo } from 'react';
import '../../styles/Bookings.css';
import {
  IcoPlus, IcoSearch, IcoFilter, IcoEye, IcoEdit,
  IcoChevL, IcoChevR, IcoCalendar, IcoCheck, IcoClock, IcoRupee,
  IcoWarn, IcoCancel,
} from '../../utils/icons/BookingIcons';

// ── Inline extra icons ────────────────────────────────────────
const IcoUpload = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IcoFile   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IcoPlusSm = () => <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
const IcoMinusSm= () => <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>;
const IcoHistory= () => <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;

// ── Sample Data ───────────────────────────────────────────────
// Each row = ONE room = ONE Booking ID. Rows sharing the same
// `phone` belong to the same guest/customer.
const INITIAL_BOOKINGS = [
  { id: 'BK-1250', phone: '+91 98765 43210', guest: 'John Doe',      roomNo: '101', roomType: 'Deluxe',   checkIn: '20 May 2024', checkOut: '22 May 2024', guests: 2, amount: '₹ 8,000',  status: 'Confirmed',   payment: 'Paid',     idProof: null },
  { id: 'BK-1251', phone: '+91 98765 43210', guest: 'John Doe',      roomNo: '102', roomType: 'Standard', checkIn: '20 May 2024', checkOut: '23 May 2024', guests: 1, amount: '₹ 4,000',  status: 'Confirmed',   payment: 'Paid',     idProof: null },
  { id: 'BK-1249', phone: '+91 91234 56789', guest: 'Emily Smith',   roomNo: '205', roomType: 'Suite',    checkIn: '20 May 2024', checkOut: '23 May 2024', guests: 2, amount: '₹ 15,000', status: 'Confirmed',   payment: 'Paid',     idProof: null },
  { id: 'BK-1248', phone: '+91 99876 54321', guest: 'Michael Brown', roomNo: '302', roomType: 'Standard', checkIn: '20 May 2024', checkOut: '24 May 2024', guests: 3, amount: '₹ 18,000', status: 'Checked-in',  payment: 'Partial',  idProof: null },
  { id: 'BK-1247', phone: '+91 99123 45678', guest: 'Sarah Wilson',  roomNo: '103', roomType: 'Deluxe',   checkIn: '20 May 2024', checkOut: '21 May 2024', guests: 1, amount: '₹ 8,000',  status: 'Checked-out', payment: 'Paid',     idProof: null },
  { id: 'BK-1246', phone: '+91 90011 22334', guest: 'David Lee',     roomNo: '401', roomType: 'Suite',    checkIn: '21 May 2024', checkOut: '24 May 2024', guests: 2, amount: '₹ 16,000', status: 'Confirmed',   payment: 'Paid',     idProof: null },
  { id: 'BK-1245', phone: '+91 88990 11223', guest: 'Priya Sharma',  roomNo: '204', roomType: 'Deluxe',   checkIn: '21 May 2024', checkOut: '22 May 2024', guests: 2, amount: '₹ 11,000', status: 'Pending',     payment: 'Unpaid',   idProof: null },
  { id: 'BK-1244', phone: '+91 87654 32109', guest: 'Amit Verma',    roomNo: '501', roomType: 'Suite',    checkIn: '22 May 2024', checkOut: '25 May 2024', guests: 2, amount: '₹ 14,000', status: 'Confirmed',   payment: 'Paid',     idProof: null },
  { id: 'BK-1243', phone: '+91 96543 21098', guest: 'Neha Singh',    roomNo: '201', roomType: 'Standard', checkIn: '22 May 2024', checkOut: '23 May 2024', guests: 1, amount: '₹ 9,000',  status: 'Cancelled',   payment: 'Refunded', idProof: null },
];

const EMPTY_ROOM_FORM = {
  phone: '', guest: '', roomNo: '', roomType: 'Deluxe',
  checkIn: '', checkOut: '', guests: 1, amount: '',
  status: 'Confirmed', payment: 'Unpaid', idProof: null,
};

const PER_PAGE = 8;

// ── Helpers ───────────────────────────────────────────────────
const statusClass = (s) => {
  const map = { 'Confirmed':'badge-confirmed','Pending':'badge-pending','Checked-in':'badge-checkedin','Checked-out':'badge-checkedout','Cancelled':'badge-cancelled' };
  return `badge ${map[s] || ''}`;
};
const payClass = (p) => {
  const map = { 'Paid':'pay-paid','Unpaid':'pay-unpaid','Partial':'pay-partial','Refunded':'pay-refunded' };
  return map[p] || '';
};
const genId = () => `BK-${Math.floor(1000 + Math.random() * 9000)}`;

// Brand color band per unique phone number (cycles through palette)
const GROUP_COLORS = ['#eff6ff', '#f0fdf4', '#fff7ed', '#faf5ff', '#fef2f2', '#ecfeff'];
const groupColorFor = (phone, phoneOrder) => GROUP_COLORS[phoneOrder.indexOf(phone) % GROUP_COLORS.length];

// ── ID Proof Cell ─────────────────────────────────────────────
const IdProofCell = ({ booking, onUpload }) => {
  const inputId = `id-proof-${booking.id}`;
  const handleChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) onUpload(booking.id, file);
    e.target.value = '';
  };
  if (booking.idProof) {
    return (
      <div className="id-proof-cell">
        <a href={booking.idProof.url} target="_blank" rel="noopener noreferrer" className="id-proof-filename" title={booking.idProof.name}>
          <IcoFile /><span>{booking.idProof.name}</span>
        </a>
        <label htmlFor={inputId} className="id-proof-replace-btn">Replace</label>
        <input id={inputId} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} style={{ display: 'none' }} />
      </div>
    );
  }
  return (
    <div className="id-proof-cell">
      <label htmlFor={inputId} className="id-proof-upload-btn"><IcoUpload /> Upload ID</label>
      <input id={inputId} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} style={{ display: 'none' }} />
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Bookings() {
  const [bookings, setBookings]           = useState(INITIAL_BOOKINGS);
  const [search, setSearch]               = useState('');
  const [filterStatus, setFilterStatus]   = useState('All Status');
  const [filterPayment, setFilterPayment] = useState('All Payment Status');
  const [page, setPage]                   = useState(1);

  // Modals
  const [showAdd, setShowAdd]       = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showView, setShowView]     = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState(EMPTY_ROOM_FORM);

  // For "New Booking" modal — extra rooms added in the same session,
  // all sharing the same phone/guest from the first room's form.
  const [extraRooms, setExtraRooms] = useState([]);

  // ── Filter ──
  const filtered = bookings.filter(b => {
    const matchSearch = b.guest.toLowerCase().includes(search.toLowerCase())
      || b.id.toLowerCase().includes(search.toLowerCase())
      || b.phone.includes(search)
      || b.roomNo.includes(search);
    const matchStatus  = filterStatus  === 'All Status'        || b.status  === filterStatus;
    const matchPayment = filterPayment === 'All Payment Status' || b.payment === filterPayment;
    return matchSearch && matchStatus && matchPayment;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Order of first-appearance for phone numbers on this page → used for
  // alternating group shading + rowSpan grouping.
  const phoneOrderOnPage = useMemo(() => {
    const order = [];
    paginated.forEach(b => { if (!order.includes(b.phone)) order.push(b.phone); });
    return order;
  }, [paginated]);

  // Pre-compute rowSpan: only the FIRST row of a phone-group on this page
  // gets a rowSpan covering all rows of that phone in `paginated`.
  const rowMeta = useMemo(() => {
    const seen = {};
    return paginated.map(b => {
      const isFirst = !seen[b.phone];
      if (isFirst) {
        seen[b.phone] = paginated.filter(x => x.phone === b.phone).length;
      }
      return { ...b, _isFirstOfGroup: isFirst, _rowSpan: isFirst ? seen[b.phone] : 0 };
    });
  }, [paginated]);

  // ── Stats ──
  const confirmedBookings = bookings.filter(b => b.status === 'Confirmed').length;
  const pendingBookings   = bookings.filter(b => b.status === 'Pending').length;

  // ── Handlers ──
  const openAdd = () => {
    setForm(EMPTY_ROOM_FORM);
    setExtraRooms([]);
    setShowAdd(true);
  };

  const openEdit = (b) => {
    setSelected(b);
    setForm({ phone: b.phone, guest: b.guest, roomNo: b.roomNo, roomType: b.roomType, checkIn: b.checkIn, checkOut: b.checkOut, guests: b.guests, amount: b.amount, status: b.status, payment: b.payment, idProof: b.idProof });
    setShowEdit(true);
  };

  const openView    = (b) => { setSelected(b); setShowView(true); };
  const openCancel  = (b) => { setSelected(b); setShowCancel(true); };
  const openHistory = (b) => { setSelected(b); setShowHistory(true); };

  // Look up existing guest by phone — used to auto-fill the form
  const lookupByPhone = (phone) => bookings.find(b => b.phone === phone);

  const handlePhoneBlur = () => {
    const existing = lookupByPhone(form.phone);
    if (existing && !form.guest) {
      setForm(prev => ({ ...prev, guest: existing.guest }));
    }
  };

  const handleAdd = () => {
    // Save the room currently in `form`, plus any rooms queued in extraRooms.
    // Every room gets its OWN id (own Booking ID), all sharing the same phone.
    const allRooms = [form, ...extraRooms];
    const newBookings = allRooms
      .filter(r => r.roomNo) // skip totally empty rows
      .map(r => ({ ...r, id: genId() }));
    setBookings(prev => [...newBookings, ...prev]);
    setShowAdd(false);
    setExtraRooms([]);
    setPage(1);
  };

  const handleEdit = () => {
    setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, ...form } : b));
    setShowEdit(false);
  };

  const handleCancel = () => {
    setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, status: 'Cancelled', payment: 'Refunded' } : b));
    setShowCancel(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // ── Extra room queue (only inside "New Booking" modal) ──
  const addExtraRoom    = () => setExtraRooms(prev => [...prev, { ...EMPTY_ROOM_FORM, phone: form.phone, guest: form.guest }]);
  const removeExtraRoom = (idx) => setExtraRooms(prev => prev.filter((_, i) => i !== idx));
  const handleExtraRoomChange = (idx, field, value) => {
    setExtraRooms(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleIdProofUpload = (bookingId, file) => {
    const fileMeta = { name: file.name, url: URL.createObjectURL(file) };
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, idProof: fileMeta } : b));
  };

  // ════════════════════════════════════════════════════════════
  //  NEW BOOKING MODAL — phone-driven, multi-room queue
  // ════════════════════════════════════════════════════════════
  const NewBookingModal = () => {
    const existingGuest = lookupByPhone(form.phone);

    return (
      <div className="modal-overlay" onClick={() => setShowAdd(false)}>
        <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>+ New Booking</h3>
            <button className="modal-close" onClick={() => setShowAdd(false)}>×</button>
          </div>
          <div className="modal-body">

            {/* ── Phone lookup ── */}
            <div className="modal-section-title">Guest Lookup</div>
            <div className="modal-grid">
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="form-input"
                  name="phone"
                  value={form.phone}
                  onChange={handleFormChange}
                  onBlur={handlePhoneBlur}
                  placeholder="+91 00000 00000"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Guest Name</label>
                <input className="form-input" name="guest" value={form.guest} onChange={handleFormChange} placeholder="Enter guest name" />
              </div>
            </div>

            {existingGuest && (
              <div className="phone-found-banner">
                ✓ Existing guest found — <strong>{existingGuest.guest}</strong> has {bookings.filter(b => b.phone === form.phone).length} room(s) booked previously. New rooms will be linked to this phone number with their own Booking IDs.
              </div>
            )}

            {/* ── First room (always present) ── */}
            <div className="modal-section-header">
              <span className="modal-section-title">Room 1</span>
            </div>
            <div className="room-row-card">
              <div className="modal-grid">
                <div className="form-group">
                  <label className="form-label">Room No.</label>
                  <input className="form-input" name="roomNo" value={form.roomNo} onChange={handleFormChange} placeholder="e.g. 101" />
                </div>
                <div className="form-group">
                  <label className="form-label">Room Type</label>
                  <select className="form-select" name="roomType" value={form.roomType} onChange={handleFormChange}>
                    <option>Standard</option><option>Deluxe</option><option>Suite</option>
                    <option>Executive</option><option>Presidential Suite</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Check-in Date</label>
                  <input className="form-input" type="date" name="checkIn" value={form.checkIn} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Check-out Date</label>
                  <input className="form-input" type="date" name="checkOut" value={form.checkOut} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">No. of Guests</label>
                  <input className="form-input" type="number" name="guests" value={form.guests} onChange={handleFormChange} min={1} />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount</label>
                  <input className="form-input" name="amount" value={form.amount} onChange={handleFormChange} placeholder="e.g. ₹ 8,000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select className="form-select" name="payment" value={form.payment} onChange={handleFormChange}>
                    <option>Paid</option><option>Unpaid</option><option>Partial</option><option>Refunded</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Booking Status</label>
                  <select className="form-select" name="status" value={form.status} onChange={handleFormChange}>
                    <option>Confirmed</option><option>Pending</option><option>Checked-in</option><option>Checked-out</option><option>Cancelled</option>
                  </select>
                </div>
                <div className="form-group full">
                  <label className="form-label">ID Proof</label>
                  <input className="form-input" type="file" accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0];
                      if (file) setForm(prev => ({ ...prev, idProof: { name: file.name, url: URL.createObjectURL(file) } }));
                    }}
                  />
                  {form.idProof && <span style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'block' }}>Attached: {form.idProof.name}</span>}
                </div>
              </div>
            </div>

            {/* ── Extra rooms queued for the same phone number ── */}
            {extraRooms.map((room, idx) => (
              <div key={idx}>
                <div className="modal-section-header">
                  <span className="modal-section-title">Room {idx + 2}</span>
                  <button className="btn-remove-room" onClick={() => removeExtraRoom(idx)}>
                    <IcoMinusSm /> Remove
                  </button>
                </div>
                <div className="room-row-card">
                  <div className="modal-grid">
                    <div className="form-group">
                      <label className="form-label">Room No.</label>
                      <input className="form-input" value={room.roomNo} onChange={e => handleExtraRoomChange(idx, 'roomNo', e.target.value)} placeholder="e.g. 102" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Room Type</label>
                      <select className="form-select" value={room.roomType} onChange={e => handleExtraRoomChange(idx, 'roomType', e.target.value)}>
                        <option>Standard</option><option>Deluxe</option><option>Suite</option>
                        <option>Executive</option><option>Presidential Suite</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Check-in Date</label>
                      <input className="form-input" type="date" value={room.checkIn} onChange={e => handleExtraRoomChange(idx, 'checkIn', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Check-out Date</label>
                      <input className="form-input" type="date" value={room.checkOut} onChange={e => handleExtraRoomChange(idx, 'checkOut', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">No. of Guests</label>
                      <input className="form-input" type="number" value={room.guests} onChange={e => handleExtraRoomChange(idx, 'guests', e.target.value)} min={1} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount</label>
                      <input className="form-input" value={room.amount} onChange={e => handleExtraRoomChange(idx, 'amount', e.target.value)} placeholder="e.g. ₹ 5,000" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payment Status</label>
                      <select className="form-select" value={room.payment} onChange={e => handleExtraRoomChange(idx, 'payment', e.target.value)}>
                        <option>Paid</option><option>Unpaid</option><option>Partial</option><option>Refunded</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Booking Status</label>
                      <select className="form-select" value={room.status} onChange={e => handleExtraRoomChange(idx, 'status', e.target.value)}>
                        <option>Confirmed</option><option>Pending</option><option>Checked-in</option><option>Checked-out</option><option>Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button className="btn-add-room-row" onClick={addExtraRoom} style={{ marginTop: 8 }}>
              <IcoPlusSm /> Add Another Room (same phone)
            </button>

          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn-save" onClick={handleAdd}>
              Save {1 + extraRooms.length} Booking{(1 + extraRooms.length) > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  //  EDIT MODAL — single room only
  // ════════════════════════════════════════════════════════════
  const EditBookingModal = () => (
    <div className="modal-overlay" onClick={() => setShowEdit(false)}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Booking — {selected?.id}</h3>
          <button className="modal-close" onClick={() => setShowEdit(false)}>×</button>
        </div>
        <div className="modal-body">
          <div className="modal-grid">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" name="phone" value={form.phone} onChange={handleFormChange} placeholder="+91 00000 00000" />
            </div>
            <div className="form-group">
              <label className="form-label">Guest Name</label>
              <input className="form-input" name="guest" value={form.guest} onChange={handleFormChange} placeholder="Enter guest name" />
            </div>
            <div className="form-group">
              <label className="form-label">Room No.</label>
              <input className="form-input" name="roomNo" value={form.roomNo} onChange={handleFormChange} placeholder="e.g. 101" />
            </div>
            <div className="form-group">
              <label className="form-label">Room Type</label>
              <select className="form-select" name="roomType" value={form.roomType} onChange={handleFormChange}>
                <option>Standard</option><option>Deluxe</option><option>Suite</option>
                <option>Executive</option><option>Presidential Suite</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">No. of Guests</label>
              <input className="form-input" type="number" name="guests" value={form.guests} onChange={handleFormChange} min={1} />
            </div>
            <div className="form-group">
              <label className="form-label">Check-in Date</label>
              <input className="form-input" type="date" name="checkIn" value={form.checkIn} onChange={handleFormChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Check-out Date</label>
              <input className="form-input" type="date" name="checkOut" value={form.checkOut} onChange={handleFormChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Amount</label>
              <input className="form-input" name="amount" value={form.amount} onChange={handleFormChange} placeholder="e.g. ₹ 8,000" />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Status</label>
              <select className="form-select" name="payment" value={form.payment} onChange={handleFormChange}>
                <option>Paid</option><option>Unpaid</option><option>Partial</option><option>Refunded</option>
              </select>
            </div>
            <div className="form-group full">
              <label className="form-label">Booking Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleFormChange}>
                <option>Confirmed</option><option>Pending</option><option>Checked-in</option><option>Checked-out</option><option>Cancelled</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={() => setShowEdit(false)}>Cancel</button>
          <button className="btn-save" onClick={handleEdit}>Save Booking</button>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>Bookings</h2>
          <p>Manage all reservations and bookings</p>
        </div>
        <button className="btn-new-booking" onClick={openAdd}>
          <IcoPlus /> New Booking
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="booking-stats">
        <div className="bstat-card">
          <div className="bstat-icon blue"><IcoCalendar /></div>
          <div className="bstat-info">
            <div className="bstat-label">Total Bookings</div>
            <div className="bstat-value">1,248</div>
            <div className="bstat-change">↑ 12.5% from last month</div>
          </div>
        </div>
        <div className="bstat-card">
          <div className="bstat-icon green"><IcoCheck /></div>
          <div className="bstat-info">
            <div className="bstat-label">Confirmed Bookings</div>
            <div className="bstat-value">{confirmedBookings}</div>
            <div className="bstat-change">↑ 8.7% from last month</div>
          </div>
        </div>
        <div className="bstat-card">
          <div className="bstat-icon orange"><IcoClock /></div>
          <div className="bstat-info">
            <div className="bstat-label">Pending Bookings</div>
            <div className="bstat-value">{pendingBookings}</div>
            <div className="bstat-change down">↓ 3.2% from last month</div>
          </div>
        </div>
        <div className="bstat-card">
          <div className="bstat-icon purple"><IcoRupee /></div>
          <div className="bstat-info">
            <div className="bstat-label">Total Revenue</div>
            <div className="bstat-value">₹ 24,50,000</div>
            <div className="bstat-change">↑ 15.2% from last month</div>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="filter-bar">
        <select className="filter-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option>All Status</option>
          <option>Confirmed</option><option>Pending</option>
          <option>Checked-in</option><option>Checked-out</option><option>Cancelled</option>
        </select>
        <select className="filter-select" value={filterPayment} onChange={e => { setFilterPayment(e.target.value); setPage(1); }}>
          <option>All Payment Status</option>
          <option>Paid</option><option>Unpaid</option>
          <option>Partial</option><option>Refunded</option>
        </select>
        <div className="search-wrap">
          <IcoSearch />
          <input className="search-input"
            placeholder="Search by booking ID, phone number, guest name, room no."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <button className="btn-filter"><IcoFilter /> Filter</button>
      </div>

      {/* ── Bookings Table ── */}
      <div className="bookings-card">
        <table className="bookings-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Phone Number</th>
              <th>Guest Name</th>
              <th>Room No.</th>
              <th>Room Type</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Guests</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Payment</th>
              <th>ID Proof</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rowMeta.length === 0 ? (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No bookings found.</td></tr>
            ) : (
              rowMeta.map((b) => {
                const bg = groupColorFor(b.phone, phoneOrderOnPage);
                return (
                  <tr key={b.id} style={{ background: bg }}>
                    <td style={{ fontWeight: 600 }}>{b.id}</td>

                    {/* Phone shown once per group via rowSpan */}
                    {b._isFirstOfGroup && (
                      <td rowSpan={b._rowSpan} style={{ fontWeight: 700, color: '#1a2a5e', verticalAlign: 'top', borderRight: '2px solid #e4e8f0' }}>
                        <div className="phone-cell">
                          {b.phone}
                          {b._rowSpan > 1 && (
                            <button className="btn-history-link" onClick={() => openHistory(b)} title="View all bookings for this guest">
                              <IcoHistory /> {b._rowSpan} rooms
                            </button>
                          )}
                        </div>
                      </td>
                    )}

                    <td>{b.guest}</td>
                    <td style={{ fontWeight: 600 }}>{b.roomNo}</td>
                    <td>{b.roomType}</td>
                    <td>{b.checkIn}</td>
                    <td>{b.checkOut}</td>
                    <td>{b.guests}</td>
                    <td style={{ fontWeight: 600 }}>{b.amount}</td>
                    <td><span className={statusClass(b.status)}>{b.status}</span></td>
                    <td><span className={payClass(b.payment)}>{b.payment}</span></td>
                    <td><IdProofCell booking={b} onUpload={handleIdProofUpload} /></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon btn-icon-view" title="View" onClick={() => openView(b)}><IcoEye /></button>
                        <button className="btn-icon btn-icon-edit" title="Edit" onClick={() => openEdit(b)}><IcoEdit /></button>
                        {b.status !== 'Cancelled' && b.status !== 'Checked-out' && (
                          <button className="btn-icon btn-icon-delete" title="Cancel"
                            style={{ background: '#fffbeb', color: '#f59e0b' }} onClick={() => openCancel(b)}>
                            <IcoCancel />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="pagination">
          <span className="pagination-info">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} bookings
          </span>
          <div className="pagination-btns">
            <button className="pg-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}><IcoChevL /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} className={`pg-btn ${page === n ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="pg-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages || totalPages === 0}><IcoChevR /></button>
          </div>
        </div>
      </div>

      {/* ══════════ MODALS ══════════ */}

      {showAdd  && <NewBookingModal />}
      {showEdit && <EditBookingModal />}

      {/* View Modal — single room */}
      {showView && selected && (
        <div className="modal-overlay" onClick={() => setShowView(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Booking Details — {selected.id}</h3>
              <button className="modal-close" onClick={() => setShowView(false)}>×</button>
            </div>
            <div className="modal-body">
              {[
                ['Booking ID',    selected.id],
                ['Phone Number',  selected.phone],
                ['Guest Name',    selected.guest],
                ['Room No.',      selected.roomNo],
                ['Room Type',     selected.roomType],
                ['Check-in',      selected.checkIn],
                ['Check-out',     selected.checkOut],
                ['No. of Guests', selected.guests],
                ['Amount',        selected.amount],
                ['Status',        selected.status],
                ['Payment',       selected.payment],
                ['ID Proof',      selected.idProof ? selected.idProof.name : 'Not uploaded'],
              ].map(([k, v]) => (
                <div className="detail-row" key={k}>
                  <span className="detail-key">{k}</span>
                  <span className="detail-value">{v}</span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-save" onClick={() => setShowView(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal — all bookings for this phone number */}
      {showHistory && selected && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Booking History — {selected.phone}</h3>
              <button className="modal-close" onClick={() => setShowHistory(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="modal-section-title">{selected.guest} — All Rooms Booked</div>
              {bookings.filter(b => b.phone === selected.phone).map((r, i) => (
                <div className="room-view-card" key={r.id}>
                  <div className="room-view-title">{r.id} — Room {r.roomNo} ({r.roomType})</div>
                  {[
                    ['Check-in',  r.checkIn],
                    ['Check-out', r.checkOut],
                    ['Guests',    r.guests],
                    ['Amount',    r.amount],
                    ['Status',    r.status],
                    ['Payment',   r.payment],
                  ].map(([k, v]) => (
                    <div className="detail-row" key={k}>
                      <span className="detail-key">{k}</span>
                      <span className="detail-value">{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-save" onClick={() => setShowHistory(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancel && selected && (
        <div className="modal-overlay" onClick={() => setShowCancel(false)}>
          <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cancel Booking</h3>
              <button className="modal-close" onClick={() => setShowCancel(false)}>×</button>
            </div>
            <div className="confirm-body">
              <div className="confirm-icon amber"><IcoWarn /></div>
              <h4>Cancel this booking?</h4>
              <p>Booking <strong>{selected.id}</strong> (Room {selected.roomNo}) for <strong>{selected.guest}</strong> will be marked as Cancelled and payment set to Refunded.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowCancel(false)}>Keep Booking</button>
              <button className="btn-amber" onClick={handleCancel}>Yes, Cancel It</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Bookings;
