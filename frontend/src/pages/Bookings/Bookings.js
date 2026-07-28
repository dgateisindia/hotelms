// ============================================================
//  Bookings.js — Booking Management Page (Admin Only)
//  Key change: PHONE NUMBER is the customer-linking key
//  - Each room booked = its own row + own unique Booking ID
//  - Rows sharing the same phone number are visually grouped
//    (shaded band + phone number shown once via rowSpan)
//  - Typing an existing phone in "New Booking" auto-fills guest
//    info and lets admin add more rooms under new Booking IDs
//  - Delete removed — only Cancel remains (admin only)
//  - Room No. is now a live dropdown of rooms actually available
//    for the selected check-in/check-out range (status +
//    date-overlap check against /api/rooms/available)
//  - Check-in is mandatory, check-out is optional. Available
//    rooms load as soon as check-in is picked.
//  - Selecting a room auto-fills Amount (price/night × nights;
//    defaults to 1 night if check-out isn't set yet, and
//    recalculates if check-out is added/changed afterward).
//  - New Booking modal validates Phone, Guest Name, and
//    Check-in Date; errors show inline under each field.
//  - readOnly prop (passed by Dashboard.js for super_admin):
//    hides New Booking / Edit / Cancel / ID upload controls,
//    View + History stay available.
//  - Success/failure messages now use SweetAlert2 instead of
//    native alert()/browser errors.
// ============================================================

import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import Swal from 'sweetalert2';
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


const EMPTY_ROOM_FORM = {
  phone: '', guest: '', roomNo: '', roomType: 'Deluxe',
  checkIn: '', checkOut: '', guests: 1, amount: '',
  status: 'Confirmed', payment: 'Unpaid', idProof: null,
};

const PER_PAGE = 8;

// ── SweetAlert helpers ──────────────────────────────────────────
const showSuccess = (title, text) => {
  Swal.fire({
    icon: 'success',
    title,
    text,
    timer: 2000,
    timerProgressBar: true,
    showConfirmButton: false,
    toast: true,
    position: 'top-end',
  });
};

const showError = (title, err) => {
  const text = err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';
  Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonColor: '#0d1b4b',
  });
};

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

// Number of nights between check-in and check-out. If check-out
// isn't set yet (it's optional), default to 1 night so the amount
// field has a sane starting value instead of ₹0.
const calcNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 1;
  const inD = new Date(checkIn);
  const outD = new Date(checkOut);
  const diff = Math.round((outD - inD) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
};

// Validate only the fields that are actually mandatory:
// Phone Number, Guest Name, Check-in Date. Everything else
// (room, guests, amount, check-out, etc.) is optional at this stage.
const validateRoomForm = (data) => {
  const errs = {};
  if (!data.phone || !data.phone.trim()) errs.phone = 'Phone number is required';
  if (!data.guest || !data.guest.trim()) errs.guest = 'Guest name is required';
  if (!data.checkIn) errs.checkIn = 'Check-in date is required';
  return errs;
};

// Brand color band per unique phone number (cycles through palette)
const GROUP_COLORS = ['#eff6ff', '#f0fdf4', '#fff7ed', '#faf5ff', '#fef2f2', '#ecfeff'];
const groupColorFor = (phone, phoneOrder) => GROUP_COLORS[phoneOrder.indexOf(phone) % GROUP_COLORS.length];

// ── ID Proof Cell ─────────────────────────────────────────────
const IdProofCell = ({ booking, onUpload, readOnly }) => {
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
        {!readOnly && (
          <>
            <label htmlFor={inputId} className="id-proof-replace-btn">Replace</label>
            <input id={inputId} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} style={{ display: 'none' }} />
          </>
        )}
      </div>
    );
  }
  if (readOnly) {
    return (
      <div className="id-proof-cell">
        <span style={{ color: '#9ca3af', fontSize: 12 }}>Not uploaded</span>
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

// ── Inline field error ──────────────────────────────────────────
const FieldError = ({ message }) => {
  if (!message) return null;
  return <span className="field-error">{message}</span>;
};

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Bookings({ readOnly = false }) {
  const [bookings, setBookings] = useState([]);
const [stats, setStats] = useState({
    totalBookings: 0,
    confirmedBookings: 0,
    pendingBookings: 0,
    totalRevenue: 0
});
  const [search, setSearch]               = useState('');
  const [filterStatus, setFilterStatus]   = useState('All Status');
  const [filterPayment, setFilterPayment] = useState('All Payment Status');
  const [page, setPage]                   = useState(1);
  const [rooms,setRooms]=useState([]);

  // Available rooms per date-range, keyed by which room slot is asking:
  // 'main' for Room 1, or the numeric index of an extra room.
  const [roomAvailability, setRoomAvailability] = useState({});

  // Field-level validation errors for the New Booking modal.
  // formErrors covers Room 1; extraRoomErrors is keyed by extra-room index.
  const [formErrors, setFormErrors] = useState({});
  const [extraRoomErrors, setExtraRoomErrors] = useState({});

  useEffect(() => {
  fetchBookings();
  fetchBookingStats();
  fetchRooms();
  fetchCustomers();
}, []);
const fetchRooms = async () => {
    const res = await axios.get("http://localhost:5000/api/rooms");
    setRooms(res.data);
};

// Fetch rooms actually available (status + no date overlap) for a
// given check-in date, optionally narrowed by check-out. Check-out
// is optional — if it isn't set yet, we still ask the backend for
// rooms free starting from check-in. Stash the result under `key`
// so Room 1 and each extra-room row have independent lists.
const loadAvailableRooms = async (key, checkIn, checkOut) => {
  if (!checkIn) {
    setRoomAvailability(prev => ({ ...prev, [key]: [] }));
    return;
  }
  try {
    const res = await axios.get("http://localhost:5000/api/rooms/available", {
      params: checkOut ? { checkIn, checkOut } : { checkIn }
    });
    setRoomAvailability(prev => ({ ...prev, [key]: res.data.data }));
  } catch (err) {
    console.error(err);
    setRoomAvailability(prev => ({ ...prev, [key]: [] }));
  }
};

// Fetch booking statistics from the backend
const fetchBookings = async () => {
  try {
    const res = await axios.get("http://localhost:5000/api/bookings");

    const formatted = res.data.map((b) => ({
      booking_id: b.booking_id,
      id: b.booking_code || '',
      guest: b.full_name || '',
      phone: b.phone || '',
      // Guard against a null room_number so we don't end up with the
      // literal text "null" (String(null) === "null") being displayed
      // or matched against in search.
      roomNumber: b.room_number != null ? String(b.room_number) : '',
      roomType: b.room_type,
      checkIn: b.check_in,
      checkOut: b.check_out,
      guests: b.total_guests,
      amount: b.total_amount,
      status: b.booking_status,
      payment: b.payment_status,
      customer_id: b.customer_id,
      room_id: b.room_id,
      idProof: null,
    }));

    setBookings(formatted);

  } catch (err) {
    console.error(err);
    showError('Could not load bookings', err);
  }
};


// Fetch booking statistics from the backend
const fetchBookingStats = async () => {

    try{

        const res = await axios.get(
            "http://localhost:5000/api/bookings/stats"
        );

        setStats(res.data.data);

    }catch(err){

        console.log(err);

    }

}

const fetchCustomers = async () => {
  try {
    const res = await axios.get("http://localhost:5000/api/customers");
    setCustomers(res.data);
  } catch (err) {
    console.error(err);
  }
};
  // Modals
  const [showAdd, setShowAdd]       = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showView, setShowView]     = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState(EMPTY_ROOM_FORM);
  const [customers, setCustomers] = useState([]);

  // For "New Booking" modal — extra rooms added in the same session,
  // all sharing the same phone/guest from the first room's form.
  const [extraRooms, setExtraRooms] = useState([]);

  // Reload the Room 1 availability list whenever its dates change
  // (check-in alone is enough to trigger it — check-out is optional),
  // but only while the New Booking modal is actually open.
  useEffect(() => {
    if (showAdd) loadAvailableRooms('main', form.checkIn, form.checkOut);
  }, [form.checkIn, form.checkOut, showAdd]);

  // Reload each extra room's availability list whenever any of their
  // dates change.
  useEffect(() => {
    extraRooms.forEach((r, idx) => {
      loadAvailableRooms(idx, r.checkIn, r.checkOut);
    });
  }, [extraRooms.map(r => `${r.checkIn}|${r.checkOut}`).join(',')]);

  // If check-out is added or changed AFTER a room has already been
  // picked for Room 1, recalculate the amount using the new night
  // count instead of leaving it at the 1-night default.
  useEffect(() => {
    if (!showAdd || !form.roomNumber) return;
    const picked = (roomAvailability.main || []).find(
      r => String(r.room_number) === String(form.roomNumber)
    );
    if (picked) {
      setForm(prev => ({
        ...prev,
        amount: picked.price_per_night * calcNights(prev.checkIn, prev.checkOut),
      }));
    }
  }, [form.checkOut]);

  useEffect(() => {
    if (!showAdd) return;
    setExtraRooms(prev => prev.map((r, idx) => {
      if (!r.roomNumber) return r;
      const picked = (roomAvailability[idx] || []).find(
        opt => String(opt.room_number) === String(r.roomNumber)
      );
      if (!picked) return r;
      return { ...r, amount: picked.price_per_night * calcNights(r.checkIn, r.checkOut) };
    }));
  }, [extraRooms.map(r => r.checkOut).join(',')]);

  // ── Filter ──
  // NOTE: guest/id/phone/roomNumber can be null/undefined if a booking's
  // linked customer or room record is missing (LEFT JOINs on the backend
  // return null for unmatched rows). Guard every field with `|| ''`
  // before calling string methods on it, or this crashes the whole page
  // with "Cannot read properties of null (reading 'toLowerCase')".
  const filtered = bookings.filter(b => {
    const guest      = b.guest || '';
    const id         = b.id || '';
    const phone      = b.phone || '';
    const roomNumber = b.roomNumber || '';
    const searchTerm = search.toLowerCase();

    const matchSearch = guest.toLowerCase().includes(searchTerm)
      || id.toLowerCase().includes(searchTerm)
      || phone.includes(search)
      || roomNumber.includes(search);
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
    setRoomAvailability({});
    setFormErrors({});
    setExtraRoomErrors({});
    setShowAdd(true);
  };

  const openEdit = (b) => {
    setSelected(b);
    setForm({ phone: b.phone, guest: b.guest, roomNumber: b.roomNumber, roomType: b.roomType, checkIn: b.checkIn, checkOut: b.checkOut, guests: b.guests, amount: b.amount, status: b.status, payment: b.payment, idProof: b.idProof });
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
const handleAdd = async () => {
  // Validate Room 1 and every extra room. Mandatory fields are only
  // Phone Number, Guest Name, and Check-in Date — everything else
  // (room, guests, amount, check-out) is optional at submit time.
  const mainErrors = validateRoomForm(form);
  const allExtraErrors = {};
  extraRooms.forEach((r, idx) => {
    // Extra rooms share phone/guest with Room 1, so only check-in
    // needs separate validation per row.
    const errs = {};
    if (!r.checkIn) errs.checkIn = 'Check-in date is required';
    if (Object.keys(errs).length) allExtraErrors[idx] = errs;
  });

  setFormErrors(mainErrors);
  setExtraRoomErrors(allExtraErrors);

  if (Object.keys(mainErrors).length || Object.keys(allExtraErrors).length) {
    return; // stop submit — inline errors are now shown under each field
  }

  try {
    const customer = customers.find(
      (c) => c.phone === form.phone
    );

    if (!customer) {
      showError('Customer not found', { message: 'Please add the customer first before creating a booking.' });
      return;
    }

   const room = rooms.find(
  (r) => Number(r.room_number) === Number(form.roomNumber)
);

    if (!room) {
      showError('Room not selected', { message: 'Please select a room before saving the booking.' });
      return;
    }

    await axios.post("http://localhost:5000/api/bookings", {
      customer_id: customer.customer_id,
      room_id: room.room_id,
      check_in: form.checkIn,
      check_out: form.checkOut || null,
      total_guests: Number(form.guests),
      booking_status: form.status,
      payment_status: form.payment,
      total_amount: Number(form.amount),
      special_request: ""
    });

    await fetchBookings();
    await fetchBookingStats();

    setShowAdd(false);
    setForm(EMPTY_ROOM_FORM);

    showSuccess('Booking created', `${1 + extraRooms.length} booking${(1 + extraRooms.length) > 1 ? 's' : ''} saved successfully.`);
  } catch (err) {
    console.error(err);
    showError('Could not create booking', err);
  }
};

// ── EDIT ──────────────────────────────────────────────────────
// The `form` state uses frontend field names (phone, guest, roomNumber,
// checkIn, checkOut, guests, amount, status, payment). The backend's
// updateBooking controller expects a different shape entirely
// (customer_id, room_id, check_in, check_out, total_guests,
// booking_status, payment_status, total_amount, special_request).
// Previously this sent `form` straight through, so every field arrived
// as undefined server-side. Fixed by resolving customer_id/room_id the
// same way handleAdd does, and mapping every field to its backend name.
const handleEdit = async () => {
  try {
    const customer = customers.find(
      (c) => c.phone === form.phone
    );

    if (!customer) {
      showError('Customer not found', { message: 'Please add the customer first before saving changes.' });
      return;
    }

    const room = rooms.find(
      (r) => Number(r.room_number) === Number(form.roomNumber)
    );

    if (!room) {
      showError('Room not found', { message: 'The selected room number does not match any existing room.' });
      return;
    }

    await axios.put(
      `http://localhost:5000/api/bookings/${selected.booking_id}`,
      {
        customer_id: customer.customer_id,
        room_id: room.room_id,
        check_in: form.checkIn,
        check_out: form.checkOut || null,
        total_guests: Number(form.guests),
        booking_status: form.status,
        payment_status: form.payment,
        total_amount: Number(form.amount),
        special_request: form.special_request || "",
      }
    );

    await fetchBookings();
    await fetchBookingStats();

    setShowEdit(false);
    showSuccess('Booking updated', `Booking ${selected?.id || ''} was updated successfully.`);
  } catch (err) {
    console.error(err);
    showError('Could not update booking', err);
  }
};
  
  const handleCancel = async () => {
  try {
    await axios.put(
      `http://localhost:5000/api/bookings/${selected.booking_id}/cancel`
    );

    await fetchBookings();
    await fetchBookingStats();

    setShowCancel(false);
    showSuccess('Booking cancelled', `Booking ${selected?.id || ''} has been cancelled.`);
  } catch (err) {
    console.error(err);
    showError('Could not cancel booking', err);
  }
};

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    // Changing either date invalidates whatever room was picked under
    // the old range, since it may no longer be available (or a
    // previously-unavailable room may now be free). Clear the
    // selection so the admin can't submit a stale room/date pairing.
    const clearsRoom = name === 'checkIn' || name === 'checkOut';

    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(clearsRoom ? { roomNumber: '' } : {}),
    }));

    // Clear that field's error as soon as the user starts fixing it.
    if (formErrors[name]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // When Room 1's room number changes, auto-fill Room Type to match
  // the selected room's actual type, and auto-fill Amount from the
  // room's price/night × number of nights (defaults to 1 night if
  // check-out hasn't been set yet).
  const handleMainRoomSelect = (e) => {
    const value = e.target.value;
    const picked = (roomAvailability.main || []).find(
      r => String(r.room_number) === String(value)
    );
    setForm(prev => ({
      ...prev,
      roomNumber: value,
      ...(picked ? {
        roomType: picked.room_type,
        amount: picked.price_per_night * calcNights(prev.checkIn, prev.checkOut),
      } : {}),
    }));
  };

  // ── Extra room queue (only inside "New Booking" modal) ──
  const addExtraRoom    = () => setExtraRooms(prev => [...prev, { ...EMPTY_ROOM_FORM, phone: form.phone, guest: form.guest }]);
  const removeExtraRoom = (idx) => {
    setExtraRooms(prev => prev.filter((_, i) => i !== idx));
    setRoomAvailability(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    setExtraRoomErrors(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };
  const handleExtraRoomChange = (idx, field, value) => {
    setExtraRooms(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const clearsRoom = field === 'checkIn' || field === 'checkOut';
      return { ...r, [field]: value, ...(clearsRoom ? { roomNumber: '' } : {}) };
    }));

    if (extraRoomErrors[idx]?.[field]) {
      setExtraRoomErrors(prev => {
        const next = { ...prev };
        const rowErrs = { ...next[idx] };
        delete rowErrs[field];
        if (Object.keys(rowErrs).length) next[idx] = rowErrs;
        else delete next[idx];
        return next;
      });
    }
  };

  // Same auto-fill behavior as the main room (type + amount), but for
  // an extra-room row.
  const handleExtraRoomSelect = (idx, value) => {
    const picked = (roomAvailability[idx] || []).find(
      r => String(r.room_number) === String(value)
    );
    setExtraRooms(prev => prev.map((r, i) => i === idx
      ? {
          ...r,
          roomNumber: value,
          ...(picked ? {
            roomType: picked.room_type,
            amount: picked.price_per_night * calcNights(r.checkIn, r.checkOut),
          } : {}),
        }
      : r
    ));
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
    // Only check-in is required to start showing available rooms —
    // check-out is optional and can be added/changed later.
    const mainDatesSet = Boolean(form.checkIn);
    const mainRoomOptions = roomAvailability.main || [];

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
                <label className="form-label">Phone Number *</label>
                <input
                  className={`form-input${formErrors.phone ? ' input-error' : ''}`}
                  name="phone"
                  value={form.phone}
                  onChange={handleFormChange}
                  onBlur={handlePhoneBlur}
                  placeholder="+91 00000 00000"
                />
                <FieldError message={formErrors.phone} />
              </div>
              <div className="form-group">
                <label className="form-label">Guest Name *</label>
                <input
                  className={`form-input${formErrors.guest ? ' input-error' : ''}`}
                  name="guest"
                  value={form.guest}
                  onChange={handleFormChange}
                  placeholder="Enter guest name"
                />
                <FieldError message={formErrors.guest} />
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
                {/* Dates come first so the room dropdown below can react to them */}
                <div className="form-group">
                  <label className="form-label">Check-in Date *</label>
                  <input
                    className={`form-input${formErrors.checkIn ? ' input-error' : ''}`}
                    type="date"
                    name="checkIn"
                    value={form.checkIn}
                    onChange={handleFormChange}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <FieldError message={formErrors.checkIn} />
                </div>
                <div className="form-group">
                  <label className="form-label">Check-out Date</label>
                  <input
                    className="form-input"
                    type="date"
                    name="checkOut"
                    value={form.checkOut}
                    onChange={handleFormChange}
                    min={form.checkIn || new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Room No.</label>
                  <select
                    className="form-select"
                    name="roomNumber"
                    value={form.roomNumber}
                    onChange={handleMainRoomSelect}
                    disabled={!mainDatesSet}
                  >
                    <option value="">
                      {!mainDatesSet
                        ? 'Select check-in date first'
                        : mainRoomOptions.length === 0
                          ? 'No rooms available'
                          : 'Select a room'}
                    </option>
                    {mainRoomOptions.map(r => (
  <option key={r.room_id} value={r.room_number}>
    {r.room_number} · {r.room_type}
  </option>
))}
                  </select>
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
            {extraRooms.map((room, idx) => {
              // Only check-in gates room availability — check-out is optional.
              const datesSet = Boolean(room.checkIn);
              const options = roomAvailability[idx] || [];
              const rowErrors = extraRoomErrors[idx] || {};
              return (
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
                      <label className="form-label">Check-in Date *</label>
                      <input
                        className={`form-input${rowErrors.checkIn ? ' input-error' : ''}`}
                        type="date"
                        value={room.checkIn}
                        onChange={e => handleExtraRoomChange(idx, 'checkIn', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <FieldError message={rowErrors.checkIn} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Check-out Date</label>
                      <input
                        className="form-input"
                        type="date"
                        value={room.checkOut}
                        onChange={e => handleExtraRoomChange(idx, 'checkOut', e.target.value)}
                        min={room.checkIn || new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Room No.</label>
                      <select
                        className="form-select"
                        value={room.roomNumber}
                        onChange={e => handleExtraRoomSelect(idx, e.target.value)}
                        disabled={!datesSet}
                      >
                        <option value="">
                          {!datesSet
                            ? 'Select check-in date first'
                            : options.length === 0
                              ? 'No rooms available'
                              : 'Select a room'}
                        </option>
                        {options.map(r => (
  <option key={r.room_id} value={r.room_number}>
    {r.room_number} · {r.room_type}
  </option>
))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Room Type</label>
                      <select className="form-select" value={room.roomType} onChange={e => handleExtraRoomChange(idx, 'roomType', e.target.value)}>
                        <option>Standard</option><option>Deluxe</option><option>Suite</option>
                        <option>Executive</option><option>Presidential Suite</option>
                      </select>
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
              );
            })}

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
              <input className="form-input" name="roomNumber" value={form.roomNumber} onChange={handleFormChange} placeholder="e.g. 101" />
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
        {!readOnly && (
          <button className="btn-new-booking" onClick={openAdd}>
            <IcoPlus /> New Booking
          </button>
        )}
      </div>

      {/* ── Stat Cards ── */}
      <div className="booking-stats">
        <div className="bstat-card">
          <div className="bstat-icon blue"><IcoCalendar /></div>
          <div className="bstat-info">
            <div className="bstat-label">Total Bookings</div>
<div className="bstat-value">
{stats.totalBookings}
</div>            <div className="bstat-change">↑ 12.5% from last month</div>
          </div>
        </div>
        <div className="bstat-card">
          <div className="bstat-icon green"><IcoCheck /></div>
          <div className="bstat-info">
            <div className="bstat-label">Confirmed Bookings</div>
            <div className="bstat-value">{stats.confirmedBookings}</div>
            <div className="bstat-change">↑ 8.7% from last month</div>
          </div>
        </div>
        <div className="bstat-card">
          <div className="bstat-icon orange"><IcoClock /></div>
          <div className="bstat-info">
            <div className="bstat-label">Pending Bookings</div>
            <div className="bstat-value">{stats.pendingBookings}</div>
            <div className="bstat-change down">↓ 3.2% from last month</div>
          </div>
        </div>
        <div className="bstat-card">
          <div className="bstat-icon purple"><IcoRupee /></div>
          <div className="bstat-info">
            <div className="bstat-label">Total Revenue</div>
            <div className="bstat-value">₹ {Number(stats.totalRevenue).toLocaleString("en-IN")}</div>
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
                    <td style={{ fontWeight: 600 }}>{b.roomNumber}</td>
                    <td>{b.roomType}</td>
                    <td>{new Date(b.checkIn).toLocaleDateString("en-IN")}</td>
                    <td>{b.checkOut ? new Date(b.checkOut).toLocaleDateString("en-IN") : '—'}</td>
                    <td>{b.guests}</td>
                    <td style={{ fontWeight: 600 }}>{b.amount}</td>
                    <td><span className={statusClass(b.status)}>{b.status}</span></td>
                    <td><span className={payClass(b.payment)}>{b.payment}</span></td>
                    <td><IdProofCell booking={b} onUpload={handleIdProofUpload} readOnly={readOnly} /></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon btn-icon-view" title="View" onClick={() => openView(b)}><IcoEye /></button>
                        {!readOnly && (
                          <button className="btn-icon btn-icon-edit" title="Edit" onClick={() => openEdit(b)}><IcoEdit /></button>
                        )}
                        {!readOnly && b.status !== 'Cancelled' && b.status !== 'Checked-out' && (
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

      {!readOnly && showAdd  && NewBookingModal()}
      {!readOnly && showEdit && EditBookingModal()}

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
                ['Room Number',   selected.roomNumber],
                ['Room Type',     selected.roomType],
                ['Check-in',      selected.checkIn],
                ['Check-out',     selected.checkOut || 'Not set'],
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
                  <div className="room-view-title">{r.id} — Room {r.roomNumber} ({r.roomType})</div>
                  {[
                    ['Check-in',  r.checkIn],
                    ['Check-out', r.checkOut || 'Not set'],
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
      {!readOnly && showCancel && selected && (
        <div className="modal-overlay" onClick={() => setShowCancel(false)}>
          <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cancel Booking</h3>
              <button className="modal-close" onClick={() => setShowCancel(false)}>×</button>
            </div>
            <div className="confirm-body">
              <div className="confirm-icon amber"><IcoWarn /></div>
              <h4>Cancel this booking?</h4>
              <p>Booking <strong>{selected.id}</strong> (Room {selected.roomNumber}) for <strong>{selected.guest}</strong> will be marked as Cancelled and payment set to Refunded.</p>
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