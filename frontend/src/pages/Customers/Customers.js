// ============================================================
//  Customers.js — Customer Management Page (logic + JSX only)
//  Icons  → ../../utils/icons/CustomersIcons.js
//  Styles → ../../styles/Customers.css
// ============================================================

import React, { useState } from 'react';
import '../../styles/Customers.css';
import {
  IcoPlus, IcoSearch, IcoFilter, IcoEye, IcoEdit, IcoTrash,
  IcoChevL, IcoChevR, IcoWarn, IcoStar,
  IcoUsers, IcoRepeat, IcoUserNew, IcoCalendar,
  IcoBusiness, IcoLeisure, IcoFamily, IcoCouple,
  IcoSeaView, IcoClock, IcoNoSmoke, IcoBreakfast, IcoAirport, IcoHighFloor,
} from '../../utils/icons/CustomersIcons';

// ── Avatar colors ─────────────────────────────────────────────
const AVATAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1'];

// ── Sample Data ───────────────────────────────────────────────
const INITIAL_CUSTOMERS = [
  { id: 'CUS-1001', name: 'John Doe',     email: 'john.doe@email.com',       phone: '+91 98765 43210', nationality: 'Indian',    bookings: 5, lastStay: '20 May 2024', status: 'Active' },
  { id: 'CUS-1002', name: 'Emily Smith',  email: 'emily.smith@email.com',    phone: '+91 91234 56789', nationality: 'USA',       bookings: 3, lastStay: '18 May 2024', status: 'Active' },
  { id: 'CUS-1003', name: 'Michael Brown',email: 'michael.b@email.com',      phone: '+91 99876 54321', nationality: 'UK',        bookings: 4, lastStay: '21 May 2024', status: 'Active' },
  { id: 'CUS-1004', name: 'Priya Sharma', email: 'priya.sharma@email.com',   phone: '+91 99123 45678', nationality: 'Indian',    bookings: 2, lastStay: '15 May 2024', status: 'Active' },
  { id: 'CUS-1005', name: 'David Lee',    email: 'david.lee@email.com',      phone: '+91 90011 22334', nationality: 'Australia', bookings: 6, lastStay: '22 May 2024', status: 'Active' },
  { id: 'CUS-1006', name: 'Sophia Wilson',email: 'sophia.w@email.com',       phone: '+91 88990 11223', nationality: 'Canada',    bookings: 1, lastStay: '10 May 2024', status: 'Inactive' },
  { id: 'CUS-1007', name: 'Rahul Mehta',  email: 'rahul.mehta@email.com',    phone: '+91 87654 32109', nationality: 'Indian',    bookings: 7, lastStay: '23 May 2024', status: 'Active' },
  { id: 'CUS-1008', name: 'Neha Singh',   email: 'neha.s@email.com',         phone: '+91 96543 21098', nationality: 'Indian',    bookings: 2, lastStay: '19 May 2024', status: 'Active' },
];

const EMPTY_FORM = { name: '', email: '', phone: '', nationality: 'Indian', status: 'Active' };
const PER_PAGE = 8;

const SEGMENTS = [
  { label: 'Business Travelers', pct: 38, count: 325, color: '#3b82f6', icon: <IcoBusiness /> },
  { label: 'Leisure Travelers',  pct: 32, count: 274, color: '#10b981', icon: <IcoLeisure /> },
  { label: 'Families',           pct: 18, count: 134, color: '#f59e0b', icon: <IcoFamily /> },
  { label: 'Couples',            pct: 12, count: 103, color: '#ef4444', icon: <IcoCouple /> },
];

const PREFERENCES = [
  { label: 'Sea View Rooms',      icon: <IcoSeaView /> },
  { label: 'Late Check-out',      icon: <IcoClock /> },
  { label: 'Non-Smoking Rooms',   icon: <IcoNoSmoke /> },
  { label: 'Breakfast Included',  icon: <IcoBreakfast /> },
  { label: 'Airport Pickup',      icon: <IcoAirport /> },
  { label: 'High Floor Preference',icon: <IcoHighFloor /> },
];

// ── Helpers ───────────────────────────────────────────────────
const statusClass = (s) => {
  const map = { 'Active':'badge-active', 'Inactive':'badge-inactive', 'VIP':'badge-vip' };
  return `badge ${map[s] || ''}`;
};

const initials = (name) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

// ── Donut Chart SVG ───────────────────────────────────────────
const SegmentDonut = ({ segments, total }) => {
  const R = 50, CX = 65, CY = 65;
  const circumference = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <div className="donut-svg-wrap">
        <svg viewBox="0 0 130 130" width="130" height="130">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f4f9" strokeWidth="18" />
          {segments.map((seg, i) => {
            const dash = (seg.pct / 100) * circumference;
            const gap  = circumference - dash;
            const arc = (
              <circle
                key={i}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth="18"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${CX} ${CY})`}
              />
            );
            offset += dash;
            return arc;
          })}
        </svg>
        <div className="donut-center">
          <span className="donut-total">{total}</span>
          <span className="donut-label">Total Customers</span>
        </div>
      </div>
      <div className="seg-legend">
        {segments.map((seg, i) => (
          <div className="seg-item" key={i}>
            <span className="seg-dot" style={{ background: seg.color }} />
            <span className="seg-name">{seg.label}</span>
            <span className="seg-pct">{seg.pct}%</span>
            <span className="seg-count">({seg.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Customers() {
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);

  // Modals
  const [showAdd, setShowAdd]       = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showView, setShowView]     = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);

  // ── Filter ──
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Handlers ──
  const openAdd    = () => { setForm(EMPTY_FORM); setShowAdd(true); };
  const openEdit   = (c) => { setSelected(c); setForm({ name: c.name, email: c.email, phone: c.phone, nationality: c.nationality, status: c.status }); setShowEdit(true); };
  const openView   = (c) => { setSelected(c); setShowView(true); };
  const openDelete = (c) => { setSelected(c); setShowDelete(true); };

  const handleAdd = () => {
    const newCust = {
      ...form,
      id: `CUS-${1009 + customers.length}`,
      bookings: 0,
      lastStay: '—',
    };
    setCustomers(prev => [newCust, ...prev]);
    setShowAdd(false);
  };

  const handleEdit = () => {
    setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, ...form } : c));
    setShowEdit(false);
  };

  const handleDelete = () => {
    setCustomers(prev => prev.filter(c => c.id !== selected.id));
    setShowDelete(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // ── Shared Customer Form Modal ──
  const CustomerFormModal = ({ title, onSave, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="modal-grid">
            <div className="form-group full">
              <label className="form-label">Full Name</label>
              <input className="form-input" name="name" value={form.name} onChange={handleFormChange} placeholder="Enter full name" />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" name="email" value={form.email} onChange={handleFormChange} placeholder="email@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" name="phone" value={form.phone} onChange={handleFormChange} placeholder="+91 00000 00000" />
            </div>
            <div className="form-group">
              <label className="form-label">Nationality</label>
              <select className="form-select" name="nationality" value={form.nationality} onChange={handleFormChange}>
                <option>Indian</option>
                <option>USA</option>
                <option>UK</option>
                <option>Australia</option>
                <option>Canada</option>
                <option>Germany</option>
                <option>France</option>
                <option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleFormChange}>
                <option>Active</option>
                <option>Inactive</option>
                <option>VIP</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={onSave}>Save Customer</button>
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
          <h2>Customers</h2>
          <p>Manage all customer / guest information</p>
        </div>
        <div className="page-header-right">
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search by name, phone or email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <IcoSearch />
          </div>
          <button className="btn-filter-outline"><IcoFilter /> Filter</button>
          <button className="btn-add-customer" onClick={openAdd}>
            <IcoPlus />Add New Customer
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="cust-stats">
        <div className="cstat-card">
          <div className="cstat-icon blue"><IcoUsers /></div>
          <div className="cstat-info">
            <div className="cstat-label">Total Customers</div>
            <div className="cstat-value">856</div>
            <div className="cstat-change">↑ 12.5% from last month</div>
          </div>
        </div>
        <div className="cstat-card">
          <div className="cstat-icon green"><IcoRepeat /></div>
          <div className="cstat-info">
            <div className="cstat-label">Repeat Guests</div>
            <div className="cstat-value">342</div>
            <div className="cstat-change">↑ 8.7% from last month</div>
          </div>
        </div>
        <div className="cstat-card">
          <div className="cstat-icon orange"><IcoUserNew /></div>
          <div className="cstat-info">
            <div className="cstat-label">New Customers</div>
            <div className="cstat-value">125</div>
            <div className="cstat-change">↑ 15.3% from last month</div>
          </div>
        </div>
        <div className="cstat-card">
          <div className="cstat-icon purple"><IcoCalendar /></div>
          <div className="cstat-info">
            <div className="cstat-label">Total Bookings</div>
            <div className="cstat-value">1,248</div>
            <div className="cstat-change">↑ 10.2% from last month</div>
          </div>
        </div>
      </div>

      {/* ── Customers Table ── */}
      <div className="customers-card">
        <table className="customers-table">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Nationality</th>
              <th>Total Bookings</th>
              <th>Last Stay</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No customers found.</td></tr>
            ) : (
              paginated.map((c, idx) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.id}</td>
                  <td>
                    <div className="cust-avatar-cell">
                      <div className="cust-avatar" style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                        {initials(c.name)}
                      </div>
                      {c.name}
                    </div>
                  </td>
                  <td style={{ color: '#6b7280' }}>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{c.nationality}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.bookings}</td>
                  <td>{c.lastStay}</td>
                  <td><span className={statusClass(c.status)}>{c.status}</span></td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon btn-icon-view"   title="View"   onClick={() => openView(c)}><IcoEye /></button>
                      <button className="btn-icon btn-icon-edit"   title="Edit"   onClick={() => openEdit(c)}><IcoEdit /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="pagination">
          <span className="pagination-info">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} customers
          </span>
          <div className="pagination-btns">
            <button className="pg-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}><IcoChevL /></button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map(n => (
              <button key={n} className={`pg-btn ${page === n ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            {totalPages > 3 && <button className="pg-btn dots">…</button>}
            {totalPages > 3 && (
              <button className={`pg-btn ${page === totalPages ? 'active' : ''}`} onClick={() => setPage(totalPages)}>{totalPages}</button>
            )}
            <button className="pg-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages || totalPages === 0}><IcoChevR /></button>
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="bottom-row">

        {/* Top Customer Segments */}
        <div className="segment-card">
          <h4>Top Customer Segments</h4>
          <SegmentDonut segments={SEGMENTS} total={856} />
        </div>

        {/* Customer Preferences */}
        <div className="pref-card">
          <h4>Customer Preferences (Popular)</h4>
          <div className="pref-grid">
            {PREFERENCES.map((p, i) => (
              <div className="pref-item" key={i}>
                <span className="pref-icon">{p.icon}</span>
                {p.label}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="review-card">
          <h4>Recent Customer Reviews</h4>
          <div className="review-item">
            <div style={{ flex: 1 }}>
              <div className="review-stars">
                {[1,2,3,4,5].map(i => <IcoStar key={i} />)}
              </div>
              <div className="review-text">
                "Excellent stay! The room was clean, staff was very polite and the service was exceptional."
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="review-author">— John Doe</span>
                <span className="review-date">21 May 2024</span>
              </div>
            </div>
            <div className="review-img">🏨</div>
          </div>
        </div>
      </div>

      {/* ══════════ MODALS ══════════ */}

      {showAdd  && <CustomerFormModal title="+ Add New Customer" onSave={handleAdd}  onClose={() => setShowAdd(false)} />}
      {showEdit && <CustomerFormModal title="Edit Customer"      onSave={handleEdit} onClose={() => setShowEdit(false)} />}

      {/* View Modal */}
      {showView && selected && (
        <div className="modal-overlay" onClick={() => setShowView(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Customer Details — {selected.id}</h3>
              <button className="modal-close" onClick={() => setShowView(false)}>×</button>
            </div>
            <div className="modal-body">
              {[
                ['Customer ID',    selected.id],
                ['Full Name',      selected.name],
                ['Email',          selected.email],
                ['Phone',          selected.phone],
                ['Nationality',    selected.nationality],
                ['Total Bookings', selected.bookings],
                ['Last Stay',      selected.lastStay],
                ['Status',         selected.status],
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

      {/* Delete Modal */}
      {showDelete && selected && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Customer</h3>
              <button className="modal-close" onClick={() => setShowDelete(false)}>×</button>
            </div>
            <div className="confirm-body">
              <div className="confirm-icon red"><IcoWarn /></div>
              <h4>Delete {selected.name}?</h4>
              <p>This customer record will be permanently deleted. This action cannot be undone.</p>
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

export default Customers;
