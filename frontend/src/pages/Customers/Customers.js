// ============================================================
//  Customers.js — Customer Management Page (logic + JSX only)
//  Icons  → ../../utils/icons/CustomersIcons.js
//  Styles → ../../styles/Customers.css
//
//  Fix: handleEdit previously required EVERY field (email, gender,
//  address, nationality, customer_type, id_proof_type,
//  id_proof_number) to be filled before it would save anything.
//  Customers created quickly from a booking only have full_name +
//  phone, so this blocked staff from opening Edit just to add a
//  missing email/nationality — they were forced to also fill in
//  everything else first. Now only full_name + phone (the two
//  fields guaranteed to exist on every customer) are required;
//  everything else can be filled in progressively over time.
// ============================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CustomerFormModal from "../../components/CustomerFormModal";
import '../../styles/Customers.css';
import Swal from "sweetalert2";
import {
  IcoPlus, IcoSearch, IcoFilter, IcoEye, IcoEdit, IcoTrash,
  IcoChevL, IcoChevR, IcoWarn, IcoStar,
  IcoUsers, IcoRepeat, IcoUserNew, IcoCalendar,
  IcoBusiness, IcoLeisure, IcoFamily, IcoCouple,
  IcoSeaView, IcoClock, IcoNoSmoke, IcoBreakfast, IcoAirport, IcoHighFloor,
} from '../../utils/icons/CustomersIcons';

// ── Avatar colors ─────────────────────────────────────────────
const AVATAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1'];

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

const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  gender: "",
  address: "",
  nationality: "",
  customer_type: "",
  id_proof_type: "",
  id_proof_number: "",
  profile_image: ""
};

const PER_PAGE = 8;

// ── Helpers ───────────────────────────────────────────────────
const statusClass = (status) => {
  const map = {
    "Checked In": "badge-active",
    "Checked Out": "badge-inactive",
  };

  return `badge ${map[status] || ""}`;
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
const [customers, setCustomers] = useState([]);
const [stats, setStats] = useState({
  totalCustomers: 0,
  activeGuests: 0,
  repeatGuests: 0,
  vipCustomers: 0,
});
 const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/customers");
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };


  const fetchCustomerStats = async () => {
  try {
    const res = await axios.get(
      "http://localhost:5000/api/customers/stats"
    );

    if (res.data.success) {
      setStats(res.data.data);
    }
  } catch (err) {
    console.error(err);
  }
};

  // Modals
  const [showAdd, setShowAdd]       = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showView, setShowView]     = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
//====================================================
useEffect(() => {
  fetchCustomers();
  fetchCustomerStats();
}, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // ── Filter ──
 const filtered = customers.filter(c =>
  c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
  c.email?.toLowerCase().includes(search.toLowerCase()) ||
  c.phone?.includes(search) ||
  String(c.customer_id).includes(search)
);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Handlers ──
const openAdd = () => {
  setForm(EMPTY_FORM);
  setShowAdd(true);
};
const openEdit = (c) => {
  setSelected(c);

  setForm({
    full_name: c.full_name,
    email: c.email,
    phone: c.phone,
    gender: c.gender,
    address: c.address,
    id_proof_type: c.id_proof_type,
    id_proof_number: c.id_proof_number,
    nationality: c.nationality,
    customer_type: c.customer_type,
    profile_image: c.profile_image
  });

  setShowEdit(true);
}; 
const openView = async (customer) => {
  try {
    const res = await axios.get(
      `http://localhost:5000/api/customers/${customer.customer_id}`
    );

    setSelected(res.data);
    setShowView(true);
  } catch (err) {
    console.error(err);
  }
}; const openDelete = (c) => { setSelected(c); setShowDelete(true); };

const handleAdd = async () => {

    const requiredFields = [
        { key: "full_name", label: "Full Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone Number" },
        { key: "gender", label: "Gender" },
        { key: "address", label: "Address" },
        { key: "nationality", label: "Nationality" },
        { key: "customer_type", label: "Customer Type" },
        { key: "id_proof_type", label: "ID Proof Type" },
        { key: "id_proof_number", label: "ID Proof Number" },
        { key: "profile_image", label: "Profile Image" },
    ];

    const missing = requiredFields.filter(field => !form[field.key]);

    if (missing.length > 0) {

        Swal.fire({
            icon: "warning",
            title: "Incomplete Form",
            text: `Please fill: ${missing.map(f => f.label).join(", ")}`,
            confirmButtonColor: "#f59e0b",
        });

        return;
    }

    try {

        await axios.post(
            "http://localhost:5000/api/customers",
            form
        );

        Swal.fire({
            icon: "success",
            title: "Success",
            text: "Customer information saved successfully.",
            confirmButtonColor: "#2563eb",
        });

        await fetchCustomers();
        await fetchCustomerStats();

        setShowAdd(false);
        setForm(EMPTY_FORM);

    } catch (err) {

        if (err.response?.status === 409) {

            Swal.fire({
                icon: "warning",
                title: "Duplicate Customer",
                text: err.response.data.message,
                confirmButtonColor: "#f59e0b",
            });

            return;
        }

        Swal.fire({
            icon: "error",
            title: "Save Failed",
            text: err.response?.data?.message || "Unable to save customer information.",
            confirmButtonColor: "#dc2626",
        });

        console.log(err);
    }
};

// ── EDIT ──────────────────────────────────────────────────────
// Only full_name and phone are required — those are the two
// fields guaranteed to exist on every customer, including ones
// created quickly from the booking flow (find-or-create by
// phone). Everything else (email, gender, address, nationality,
// customer_type, ID proof) can be added or changed independently
// through this same modal, one field at a time, instead of being
// gated behind filling out the entire profile in one go.
 const handleEdit = async () => {

    if (!selected) return;

    if (!form.full_name || !form.phone) {
        Swal.fire({
            icon: "warning",
            title: "Incomplete Form",
            text: "Full Name and Phone Number are required.",
            confirmButtonColor: "#f59e0b",
        });

        return;
    }

    try {

        await axios.put(
            `http://localhost:5000/api/customers/${selected.customer_id}`,
            form
        );

        Swal.fire({
            icon: "success",
            title: "Updated",
            text: "Customer information updated successfully.",
            confirmButtonColor: "#2563eb",
        });

await fetchCustomers();
await fetchCustomerStats();
        setShowEdit(false);

    } catch (err) {

        Swal.fire({
            icon: "error",
            title: "Update Failed",
            text: "Unable to update customer information.",
            confirmButtonColor: "#dc2626",
        });

        console.log(err);
    }
};
  const handleDelete = async () => {

    const result = await Swal.fire({
        title: "Delete Customer?",
        text: "This action cannot be undone.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, Delete",
    });

    if (!result.isConfirmed) return;

    try {

        await axios.delete(
            `http://localhost:5000/api/customers/${selected.customer_id}`
        );

        Swal.fire({
            icon: "success",
            title: "Deleted",
            text: "Customer deleted successfully.",
            confirmButtonColor: "#2563eb",
        });

await fetchCustomers();
await fetchCustomerStats();
        setShowDelete(false);

    } catch (err) {

        Swal.fire({
            icon: "error",
            title: "Delete Failed",
            text: "Unable to delete customer.",
            confirmButtonColor: "#dc2626",
        });
    }
};

const handleImageChange = (e) => {

    const file = e.target.files[0];

    if (!file) return;

    if (file.size > 100 * 1024) {

        alert("Maximum file size is 100 KB");

        e.target.value = "";

        return;
    }

    setForm(prev => ({
        ...prev,
        profile_image: file
    }));

};
  

  // ── Shared Customer Form Modal ──

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

  {/* Total Customers */}
  <div className="cstat-card">
    <div className="cstat-icon blue">
      <IcoUsers />
    </div>

    <div className="cstat-info">
      <div className="cstat-label">Total Customers</div>

      <div className="cstat-value">
        {stats.totalCustomers}
      </div>

      <div className="cstat-change">
        Registered Customers
      </div>
    </div>
  </div>

  {/* Active Guests */}
  <div className="cstat-card">
    <div className="cstat-icon green">
      <IcoRepeat />
    </div>

    <div className="cstat-info">
      <div className="cstat-label">Active Guests</div>

      <div className="cstat-value">
        {stats.activeGuests}
      </div>

      <div className="cstat-change">
        Currently Checked In
      </div>
    </div>
  </div>

  {/* Repeat Guests */}
  <div className="cstat-card">
    <div className="cstat-icon orange">
      <IcoUserNew />
    </div>

    <div className="cstat-info">
      <div className="cstat-label">Repeat Guests</div>

      <div className="cstat-value">
        {stats.repeatGuests}
      </div>

      <div className="cstat-change">
        Returning Guests
      </div>
    </div>
  </div>

  {/* VIP Customers */}
  <div className="cstat-card">
    <div className="cstat-icon purple">
      <IcoCalendar />
    </div>

    <div className="cstat-info">
      <div className="cstat-label">VIP Customers</div>

      <div className="cstat-value">
        {stats.vipCustomers}
      </div>

      <div className="cstat-change">
        Premium Members
      </div>
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
                <tr key={c.customer_id}>
                  <td style={{ fontWeight: 600 }}>{c.customer_id}</td>
                  <td>
                    <div className="cust-avatar-cell">
                      <div className="cust-avatar" style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                        {initials(c.full_name)}
                      </div>
                      {c.full_name}
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
<SegmentDonut
  segments={SEGMENTS}
  total={stats.totalCustomers}
/>
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
      {/* Add Customer */}
{showAdd && (
  <CustomerFormModal
    title="+ Add New Customer"
    form={form}
    handleFormChange={handleFormChange}
    handleImageChange={handleImageChange}
    onSave={handleAdd}
    onClose={() => setShowAdd(false)}
  />
)}

{showEdit && (
  <CustomerFormModal
    title="Edit Customer"
    form={form}
    handleFormChange={handleFormChange}
    handleImageChange={handleImageChange}
    onSave={handleEdit}
    onClose={() => setShowEdit(false)}
  />
)}

{/* View Modal */}
{showView && selected && (
  <div
    className="modal-overlay"
    onClick={() => setShowView(false)}
  >
    <div
      className="modal-box"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-header">
        <h3>Customer Details</h3>

        <button
          className="modal-close"
          onClick={() => setShowView(false)}
        >
          ×
        </button>
      </div>

      <div className="modal-body">

        <div className="detail-section">
          <h4>Customer Information</h4>

          <div className="detail-row">
            <span className="detail-key">Customer ID</span>
            <span className="detail-value">{selected.customer_id}</span>
          </div>

          <div className="detail-row">
            <span className="detail-key">Full Name</span>
            <span className="detail-value">{selected.full_name}</span>
          </div>

          <div className="detail-row">
            <span className="detail-key">Email</span>
            <span className="detail-value">{selected.email}</span>
          </div>

          <div className="detail-row">
            <span className="detail-key">Phone</span>
            <span className="detail-value">{selected.phone}</span>
          </div>

          <div className="detail-row">
            <span className="detail-key">Gender</span>
            <span className="detail-value">{selected.gender}</span>
          </div>

          <div className="detail-row">
            <span className="detail-key">Nationality</span>
            <span className="detail-value">{selected.nationality}</span>
          </div>

          <div className="detail-row">
            <span className="detail-key">Customer Type</span>
            <span className="detail-value">{selected.customer_type}</span>
          </div>

          <div className="detail-row">
            <span className="detail-key">Address</span>
            <span className="detail-value">{selected.address}</span>
          </div>
        </div>

        <div className="detail-section">
          <h4>Identity Details</h4>

          <div className="detail-row">
            <span className="detail-key">ID Proof Type</span>
            <span className="detail-value">{selected.id_proof_type}</span>
          </div>

          <div className="detail-row">
            <span className="detail-key">ID Proof Number</span>
            <span className="detail-value">{selected.id_proof_number}</span>
          </div>
        </div>

        <div className="detail-section">
          <h4>Booking Summary</h4>

          <div className="detail-row">
            <span className="detail-key">Total Bookings</span>
            <span className="detail-value">
              {selected.bookings ?? 0}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-key">Last Stay</span>
            <span className="detail-value">
              {selected.lastStay || "No Booking"}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-key">Status</span>
            <span className="detail-value">
              {selected.status || "-"}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-key">Registered On</span>
            <span className="detail-value">
              {selected.created_at
                ? new Date(selected.created_at).toLocaleDateString("en-IN")
                : "-"}
            </span>
          </div>
        </div>

      </div>

      <div className="modal-footer">
        <button
          className="btn-save"
          onClick={() => setShowView(false)}
        >
          Close
        </button>
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
              <h4>Delete {selected.full_name}?</h4>
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