// ============================================================
//  Bookings.js — Booking Management Page (Admin Only)
//  Features: List, Add, Edit, View, Delete, Cancel bookings
//            Filter by status, room type, date, search
// ============================================================

import React, { useState } from 'react';
import '../../styles/Bookings.css';
import {
  IcoPlus, IcoSearch, IcoFilter, IcoEye, IcoEdit, IcoTrash,
  IcoChevL, IcoChevR, IcoCalendar, IcoCheck, IcoClock, IcoRupee,
  IcoWarn, IcoCancel,
} from '../../utils/icons/BookingIcons';

// ── Sample Data ───────────────────────────────────────────────
// NOTE: `idProof` added per booking. Use null when no document has been
// uploaded yet, or { name, url } once a file is attached.
const INITIAL_BOOKINGS = [
  { id: 'BK-1250', guest: 'John Doe',      room: '101', roomType: 'Deluxe',  checkIn: '20 May 2024', checkOut: '22 May 2024', guests: 2, amount: '₹ 12,000', status: 'Confirmed',  payment: 'Paid',     idProof: null },
  { id: 'BK-1249', guest: 'Emily Smith',   room: '205', roomType: 'Suite',   checkIn: '20 May 2024', checkOut: '23 May 2024', guests: 2, amount: '₹ 15,000', status: 'Confirmed',  payment: 'Paid',     idProof: null },
  { id: 'BK-1248', guest: 'Michael Brown', room: '302', roomType: 'Standard',checkIn: '20 May 2024', checkOut: '24 May 2024', guests: 3, amount: '₹ 18,000', status: 'Checked-in', payment: 'Partial',  idProof: null },
  { id: 'BK-1247', guest: 'Sarah Wilson',  room: '103', roomType: 'Deluxe',  checkIn: '20 May 2024', checkOut: '21 May 2024', guests: 1, amount: '₹ 8,000',  status: 'Checked-out',payment: 'Paid',     idProof: null },
  { id: 'BK-1246', guest: 'David Lee',     room: '401', roomType: 'Suite',   checkIn: '21 May 2024', checkOut: '24 May 2024', guests: 2, amount: '₹ 16,000', status: 'Confirmed',  payment: 'Paid',     idProof: null },
  { id: 'BK-1245', guest: 'Priya Sharma',  room: '204', roomType: 'Deluxe',  checkIn: '21 May 2024', checkOut: '22 May 2024', guests: 2, amount: '₹ 11,000', status: 'Pending',    payment: 'Unpaid',   idProof: null },
  { id: 'BK-1244', guest: 'Amit Verma',    room: '501', roomType: 'Suite',   checkIn: '22 May 2024', checkOut: '25 May 2024', guests: 2, amount: '₹ 14,000', status: 'Confirmed',  payment: 'Paid',     idProof: null },
  { id: 'BK-1243', guest: 'Neha Singh',    room: '201', roomType: 'Standard',checkIn: '22 May 2024', checkOut: '23 May 2024', guests: 1, amount: '₹ 9,000',  status: 'Cancelled',  payment: 'Refunded', idProof: null },
];

const EMPTY_FORM = {
  guest: '', room: '', roomType: 'Deluxe', checkIn: '', checkOut: '',
  guests: 1, amount: '', status: 'Confirmed', payment: 'Unpaid', idProof: null,
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

// ── Small inline icon for the upload control ───────────────────
const IcoUpload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IcoFile = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

// ── ID Proof cell: shows an upload control, or the attached file
//    with the option to replace it ─────────────────────────────
const IdProofCell = ({ booking, onUpload }) => {
  const inputId = `id-proof-${booking.id}`;

  const handleChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) onUpload(booking.id, file);
    // allow re-selecting the same file name later
    e.target.value = '';
  };

  if (booking.idProof) {
    return (
      <div className="id-proof-cell">
        <a
          href={booking.idProof.url}
          target="_blank"
          rel="noopener noreferrer"
          className="id-proof-filename"
          title={booking.idProof.name}
        >
          <IcoFile />
          <span>{booking.idProof.name}</span>
        </a>
        <label htmlFor={inputId} className="id-proof-replace-btn">
          Replace
        </label>
        <input
          id={inputId}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  return (
    <div className="id-proof-cell">
      <label htmlFor={inputId} className="id-proof-upload-btn">
        <IcoUpload />
        Upload ID
      </label>
      <input
        id={inputId}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Bookings() {
  const [bookings, setBookings]       = useState(INITIAL_BOOKINGS);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [filterRoom, setFilterRoom]   = useState('All Room Types');
  const [filterPayment, setFilterPayment] = useState('All Payment Status');
  const [page, setPage]               = useState(1);

  // Modals
  const [showAdd, setShowAdd]         = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [showView, setShowView]       = useState(false);
  const [showDelete, setShowDelete]   = useState(false);
  const [showCancel, setShowCancel]   = useState(false);
  const [selected, setSelected]       = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);

  // ── Filter ──
  const filtered = bookings.filter(b => {
    const matchSearch  = b.guest.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase()) || b.room.includes(search);
    const matchStatus  = filterStatus  === 'All Status'        || b.status   === filterStatus;
    const matchRoom    = filterRoom    === 'All Room Types'     || b.roomType === filterRoom;
    const matchPayment = filterPayment === 'All Payment Status' || b.payment  === filterPayment;
    return matchSearch && matchStatus && matchRoom && matchPayment;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Stats ──
  const totalBookings     = bookings.length;
  const confirmedBookings = bookings.filter(b => b.status === 'Confirmed').length;
  const pendingBookings   = bookings.filter(b => b.status === 'Pending').length;

  // ── Handlers ──
  const openAdd = () => { setForm(EMPTY_FORM); setShowAdd(true); };

  const openEdit = (b) => {
    setSelected(b);
    setForm({ guest: b.guest, room: b.room, roomType: b.roomType, checkIn: b.checkIn, checkOut: b.checkOut, guests: b.guests, amount: b.amount, status: b.status, payment: b.payment, idProof: b.idProof });
    setShowEdit(true);
  };

  const openView   = (b) => { setSelected(b); setShowView(true); };
  const openDelete = (b) => { setSelected(b); setShowDelete(true); };
  const openCancel = (b) => { setSelected(b); setShowCancel(true); };

  const handleAdd = () => {
    const newBooking = { ...form, id: genId() };
    setBookings(prev => [newBooking, ...prev]);
    setShowAdd(false);
    setPage(1);
  };

  const handleEdit = () => {
    setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, ...form } : b));
    setShowEdit(false);
  };

  const handleDelete = () => {
    setBookings(prev => prev.filter(b => b.id !== selected.id));
    setShowDelete(false);
  };

  const handleCancel = () => {
    setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, status: 'Cancelled', payment: 'Refunded' } : b));
    setShowCancel(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Attach/replace the ID proof document directly from the table row.
  // TODO: replace the local object URL with an actual upload to your
  // backend / storage (e.g. POST to /api/bookings/:id/id-proof) and
  // store the returned file URL instead of a blob URL.
  const handleIdProofUpload = (bookingId, file) => {
    const fileMeta = { name: file.name, url: URL.createObjectURL(file) };
    setBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, idProof: fileMeta } : b))
    );
  };

  // ── Booking Form Modal (shared for Add & Edit) ──
  const BookingFormModal = ({ title, onSave, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="modal-grid">
            <div className="form-group">
              <label className="form-label">Guest Name</label>
              <input className="form-input" name="guest" value={form.guest} onChange={handleFormChange} placeholder="Enter guest name" />
            </div>
            <div className="form-group">
              <label className="form-label">Room No.</label>
              <input className="form-input" name="room" value={form.room} onChange={handleFormChange} placeholder="e.g. 101" />
            </div>
            <div className="form-group">
              <label className="form-label">Room Type</label>
              <select className="form-select" name="roomType" value={form.roomType} onChange={handleFormChange}>
                <option>Standard</option>
                <option>Deluxe</option>
                <option>Suite</option>
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
              <input className="form-input" name="amount" value={form.amount} onChange={handleFormChange} placeholder="e.g. ₹ 12,000" />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Status</label>
              <select className="form-select" name="payment" value={form.payment} onChange={handleFormChange}>
                <option>Paid</option>
                <option>Unpaid</option>
                <option>Partial</option>
                <option>Refunded</option>
              </select>
            </div>
            <div className="form-group full">
              <label className="form-label">Booking Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleFormChange}>
                <option>Confirmed</option>
                <option>Pending</option>
                <option>Checked-in</option>
                <option>Checked-out</option>
                <option>Cancelled</option>
              </select>
            </div>
            <div className="form-group full">
              <label className="form-label">ID Proof</label>
              <input
                className="form-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  if (file) {
                    setForm(prev => ({ ...prev, idProof: { name: file.name, url: URL.createObjectURL(file) } }));
                  }
                }}
              />
              {form.idProof && (
                <span style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'inline-block' }}>
                  Attached: {form.idProof.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={onSave}>Save Booking</button>
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
          <option>Confirmed</option>
          <option>Pending</option>
          <option>Checked-in</option>
          <option>Checked-out</option>
          <option>Cancelled</option>
        </select>

        <select className="filter-select" value={filterRoom} onChange={e => { setFilterRoom(e.target.value); setPage(1); }}>
          <option>All Room Types</option>
          <option>Standard</option>
          <option>Deluxe</option>
          <option>Suite</option>
        </select>

        <select className="filter-select" value={filterPayment} onChange={e => { setFilterPayment(e.target.value); setPage(1); }}>
          <option>All Payment Status</option>
          <option>Paid</option>
          <option>Unpaid</option>
          <option>Partial</option>
          <option>Refunded</option>
        </select>

        <div className="search-wrap">
          <IcoSearch />
          <input
            className="search-input"
            placeholder="Search by booking ID, guest name, room no."
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
              <th>Guest Name</th>
              <th>Room No.</th>
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
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                  No bookings found.
                </td>
              </tr>
            ) : (
              paginated.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{b.id}</td>
                  <td>{b.guest}</td>
                  <td>{b.room}</td>
                  <td>{b.checkIn}</td>
                  <td>{b.checkOut}</td>
                  <td>{b.guests}</td>
                  <td style={{ fontWeight: 600 }}>{b.amount}</td>
                  <td><span className={statusClass(b.status)}>{b.status}</span></td>
                  <td><span className={payClass(b.payment)}>{b.payment}</span></td>
                  <td>
                    <IdProofCell booking={b} onUpload={handleIdProofUpload} />
                  </td>
                  <td>
                    <div className="action-btns">
                      {/* View — everyone */}
                      <button className="btn-icon btn-icon-view" title="View" onClick={() => openView(b)}><IcoEye /></button>
                      {/* Edit — admin only */}
                      <button className="btn-icon btn-icon-edit" title="Edit" onClick={() => openEdit(b)}><IcoEdit /></button>
                      {/* Cancel — admin only, only if not already cancelled/checked-out */}
                      {b.status !== 'Cancelled' && b.status !== 'Checked-out' && (
                        <button className="btn-icon btn-icon-delete" title="Cancel" style={{ background: '#fffbeb', color: '#f59e0b' }} onClick={() => openCancel(b)}>
                          <IcoCancel />
                        </button>
                      )}
                      
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* ── Pagination ── */}
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

      {/* Add Booking */}
      {showAdd && (
        <BookingFormModal title="+ New Booking" onSave={handleAdd} onClose={() => setShowAdd(false)} />
      )}

      {/* Edit Booking */}
      {showEdit && (
        <BookingFormModal title="Edit Booking" onSave={handleEdit} onClose={() => setShowEdit(false)} />
      )}

      {/* View Booking */}
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
                ['Guest Name',    selected.guest],
                ['Room No.',      selected.room],
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

      {/* Cancel Confirm */}
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
              <p>Booking <strong>{selected.id}</strong> for <strong>{selected.guest}</strong> will be marked as Cancelled and payment status set to Refunded.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowCancel(false)}>Keep Booking</button>
              <button className="btn-amber" onClick={handleCancel}>Yes, Cancel It</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDelete && selected && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Booking</h3>
              <button className="modal-close" onClick={() => setShowDelete(false)}>×</button>
            </div>
            <div className="confirm-body">
              <div className="confirm-icon red"><IcoWarn /></div>
              <h4>Delete this booking?</h4>
              <p>Booking <strong>{selected.id}</strong> for <strong>{selected.guest}</strong> will be permanently deleted. This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Bookings;