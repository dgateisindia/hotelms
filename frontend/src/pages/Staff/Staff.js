// ============================================================
//  Staff.js — Staff Management Page (logic + JSX only)
//  Sections: Staff table, Payroll summary, Staff status donut,
//            Recently joined staff, Quick actions, Dept bar chart,
//            Salary distribution by department
//  Icons  → ../../utils/icons/StaffIcons.js
//  Styles → ../../styles/Staff.css
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import '../../styles/Staff.css';
import {
  IcoPlus, IcoSearch, IcoFilter, IcoEye, IcoEdit, IcoTrash,
  IcoChevL, IcoChevR, IcoWarn, IcoUsers, IcoDept,
  IcoLeave, IcoPayroll, IcoCheck, IcoCalendar, IcoDownload, IcoAttend,
} from '../../utils/icons/Stafficons';

// ── Config ────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api/staff';

// ── Constants (form options only — NOT data) ───────────────────
const DEPARTMENTS  = ['Front Office','Housekeeping','F&B Service','Maintenance','Security','Accounts'];
const DESIGNATIONS = ['Front Office Manager','Housekeeping Supervisor','Restaurant Manager','Receptionist','Maintenance Engineer','Room Attendant','Security Guard','Accountant','Chef','Waiter'];
const AVATAR_COLORS= ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1','#ec4899','#14b8a6'];
const STATUS_COLORS = { Active:'#10b981', 'On Leave':'#f59e0b', Inactive:'#ef4444' };

const EMPTY_FORM = { name:'', dept:'', designation:'', phone:'', email:'', salary:'', joinDate:'', emergencyContact:'', status:'' };
const PER_PAGE = 8;

// ── Helpers ───────────────────────────────────────────────────
const statusClass = (s) => {
  const m = { 'Active':'badge-active','On Leave':'badge-onleave','Inactive':'badge-inactive' };
  return `badge ${m[s]||''}`;
};
const initials = (name='') => name.split(' ').filter(Boolean).map(n=>n[0]).join('').slice(0,2).toUpperCase();

const parseSalary = (val) => {
  const n = parseFloat(String(val ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const formatCurrency = (n) => `₹ ${Math.round(n).toLocaleString('en-IN')}`;

// Every field in the Add/Edit Staff form is mandatory.
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^[0-9+\-\s]{7,20}$/;
const validateStaffForm = (form) => {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Full name is required.';
  if (!form.dept.trim()) errors.dept = 'Department is required.';
  if (!form.designation.trim()) errors.designation = 'Designation is required.';
  if (!form.phone.trim()) errors.phone = 'Phone number is required.';
  else if (!PHONE_RE.test(form.phone.trim())) errors.phone = 'Enter a valid phone number.';
  if (!form.email.trim()) errors.email = 'Email address is required.';
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!String(form.salary).trim()) errors.salary = 'Monthly salary is required.';
  else if (parseSalary(form.salary) <= 0) errors.salary = 'Salary must be greater than 0.';
  if (!form.joinDate.trim()) errors.joinDate = 'Join date is required.';
  if (!form.emergencyContact.trim()) errors.emergencyContact = 'Emergency contact is required.';
  else if (!PHONE_RE.test(form.emergencyContact.trim())) errors.emergencyContact = 'Enter a valid contact number.';
  if (!form.status.trim()) errors.status = 'Status is required.';
  return errors;
};

// ── Donut SVG helper ──────────────────────────────────────────
const DonutChart = ({ segments, size=110, stroke=16, centerLabel, centerSub }) => {
  const R   = (size - stroke) / 2;
  const CX  = size / 2;
  const circ= 2 * Math.PI * R;
  let offset = 0;
  const total = segments.reduce((s, seg) => s + seg.pct, 0) || 1;
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={CX} cy={CX} r={R} fill="none" stroke="#f1f4f9" strokeWidth={stroke}/>
        {segments.map((seg, i) => {
          const dash = (seg.pct / total) * circ;
          const el = (
            <circle key={i} cx={CX} cy={CX} r={R} fill="none"
              stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${CX} ${CX})`}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      {centerLabel && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:18, fontWeight:800, color:'#1a1f36', lineHeight:1 }}>{centerLabel}</span>
          {centerSub && <span style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>{centerSub}</span>}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  STAFF FORM MODAL — top-level component (NOT declared inside
//  Staff()). Keeping it here means React sees the same component
//  type across re-renders while typing, so inputs keep focus.
// ════════════════════════════════════════════════════════════
const FieldError = ({ msg }) =>
  msg ? <div style={{ color:'#dc2626', fontSize:11, marginTop:4 }}>{msg}</div> : null;

const StaffFormModal = ({ title, form, onChange, onSave, onClose, submitting, errors = {} }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-box" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h3>{title}</h3><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <div className="modal-grid">
          <div className="form-group full">
            <label className="form-label">Full Name *</label>
            <input className="form-input" name="name" value={form.name} onChange={onChange} placeholder="Enter full name" required
              style={errors.name ? { borderColor:'#dc2626' } : undefined}/>
            <FieldError msg={errors.name}/>
          </div>
          <div className="form-group">
            <label className="form-label">Department *</label>
            <select className="form-select" name="dept" value={form.dept} onChange={onChange} required
              style={errors.dept ? { borderColor:'#dc2626' } : undefined}>
              <option value="" disabled>Select Department</option>
              {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
            </select>
            <FieldError msg={errors.dept}/>
          </div>
          <div className="form-group">
            <label className="form-label">Designation *</label>
            <select className="form-select" name="designation" value={form.designation} onChange={onChange} required
              style={errors.designation ? { borderColor:'#dc2626' } : undefined}>
              <option value="" disabled>Select Designation</option>
              {DESIGNATIONS.map(d=><option key={d}>{d}</option>)}
            </select>
            <FieldError msg={errors.designation}/>
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <input className="form-input" name="phone" value={form.phone} onChange={onChange} placeholder="+91 00000 00000" required
              style={errors.phone ? { borderColor:'#dc2626' } : undefined}/>
            <FieldError msg={errors.phone}/>
          </div>
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input className="form-input" name="email" value={form.email} onChange={onChange} placeholder="staff@hotel.com" required
              style={errors.email ? { borderColor:'#dc2626' } : undefined}/>
            <FieldError msg={errors.email}/>
          </div>
          <div className="form-group">
            <label className="form-label">Monthly Salary *</label>
            <input className="form-input" name="salary" value={form.salary} onChange={onChange} placeholder="e.g. 25000" required
              style={errors.salary ? { borderColor:'#dc2626' } : undefined}/>
            <FieldError msg={errors.salary}/>
          </div>
          <div className="form-group">
            <label className="form-label">Join Date *</label>
            <input className="form-input" type="date" name="joinDate" value={form.joinDate} onChange={onChange} required
              style={errors.joinDate ? { borderColor:'#dc2626' } : undefined}/>
            <FieldError msg={errors.joinDate}/>
          </div>
          <div className="form-group">
            <label className="form-label">Emergency Contact *</label>
            <input className="form-input" name="emergencyContact" value={form.emergencyContact} onChange={onChange} placeholder="+91 00000 00000" required
              style={errors.emergencyContact ? { borderColor:'#dc2626' } : undefined}/>
            <FieldError msg={errors.emergencyContact}/>
          </div>
          <div className="form-group">
            <label className="form-label">Status *</label>
            <select className="form-select" name="status" value={form.status} onChange={onChange} required
              style={errors.status ? { borderColor:'#dc2626' } : undefined}>
              <option value="" disabled>Select Status</option>
              <option>Active</option><option>On Leave</option><option>Inactive</option>
            </select>
            <FieldError msg={errors.status}/>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn-cancel" onClick={onClose} disabled={submitting}>Cancel</button>
        <button className="btn-save" onClick={onSave} disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Staff'}
        </button>
      </div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Staff() {
  const [staff, setStaff]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState('');
  const [search, setSearch]           = useState('');
  const [filterDept, setFilterDept]   = useState('All Departments');
  const [filterDesig, setFilterDesig] = useState('All Designations');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [page, setPage]               = useState(1);
  const [submitting, setSubmitting]   = useState(false);

  // Modals
  const [showAdd, setShowAdd]     = useState(false);
  const [showEdit, setShowEdit]   = useState(false);
  const [showView, setShowView]   = useState(false);
  const [showDel, setShowDel]     = useState(false);
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  // ── Fetch staff from backend ──
  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await axios.get(API_BASE);
      setStaff(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setLoadError('Could not load staff. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // ── Filter ──
  const filtered = staff.filter(s => {
    const q = search.toLowerCase();
    const ms  = (s.name||'').toLowerCase().includes(q)
      || (s.staffId||'').toLowerCase().includes(q)
      || (s.phone||'').includes(search)
      || (s.dept||'').toLowerCase().includes(q)
      || (s.designation||'').toLowerCase().includes(q)
      || (s.email||'').toLowerCase().includes(q);
    const md  = filterDept   === 'All Departments'  || s.dept        === filterDept;
    const mde = filterDesig  === 'All Designations' || s.designation === filterDesig;
    const mst = filterStatus === 'All Status'        || s.status     === filterStatus;
    return ms && md && mde && mst;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  // ════════════════════════════════════════════════════════
  //  LIVE STATISTICS — all derived from the real `staff` array,
  //  so every card recalculates the moment staff is added,
  //  edited, or deleted.
  // ════════════════════════════════════════════════════════
  const stats = useMemo(() => {
    const totalStaff = staff.length;
    const totalDepartments = new Set(staff.map(s => s.dept).filter(Boolean)).size;
    const onLeave = staff.filter(s => s.status === 'On Leave').length;
    const inactive = staff.filter(s => s.status === 'Inactive').length;
    const active = staff.filter(s => s.status === 'Active').length;
    const grossSalary = staff.reduce((sum, s) => sum + parseSalary(s.salary), 0);

    const deptCounts = DEPARTMENTS.map(dept => ({
      dept,
      count: staff.filter(s => s.dept === dept).length,
    }));
    const otherCount = staff.filter(s => !DEPARTMENTS.includes(s.dept)).length;
    if (otherCount > 0) deptCounts.push({ dept: 'Others', count: otherCount });

    const salaryByDept = DEPARTMENTS
      .map(dept => ({
        dept,
        total: staff.filter(s => s.dept === dept).reduce((sum, s) => sum + parseSalary(s.salary), 0),
      }))
      .filter(d => d.total > 0);

    const recentlyJoined = [...staff]
      .filter(s => s.joinDate)
      .sort((a, b) => new Date(b.joinDate) - new Date(a.joinDate))
      .slice(0, 5);

    return { totalStaff, totalDepartments, onLeave, inactive, active, grossSalary, deptCounts, salaryByDept, recentlyJoined };
  }, [staff]);

  const maxDept = Math.max(1, ...stats.deptCounts.map(d => d.count));
  const maxSalaryDept = Math.max(1, ...stats.salaryByDept.map(d => d.total));

  // ── Handlers ──
  const openAdd  = () => { setForm(EMPTY_FORM); setFormErrors({}); setShowAdd(true); };
  const openEdit = (s) => {
    setSelected(s);
    setForm({ name:s.name, dept:s.dept, designation:s.designation, phone:s.phone, email:s.email, salary:s.salary, joinDate:s.joinDate ? s.joinDate.slice(0,10) : '', emergencyContact:s.emergencyContact || '', status:s.status });
    setFormErrors({});
    setShowEdit(true);
  };
  const openView = (s) => { setSelected(s); setShowView(true); };
  const openDel  = (s) => { setSelected(s); setShowDel(true); };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const handleAdd = async () => {
    if (submitting) return;
    const errs = validateStaffForm(form);
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setSubmitting(true);
    try {
      await axios.post(API_BASE, form);
      await fetchStaff();
      setShowAdd(false);
      setForm(EMPTY_FORM);
      setFormErrors({});
    } catch (err) {
      console.error(err);
      alert('Failed to add staff. Please check the details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (submitting || !selected) return;
    const errs = validateStaffForm(form);
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setSubmitting(true);
    try {
      await axios.put(`${API_BASE}/${selected.id}`, form);
      await fetchStaff();
      setShowEdit(false);
      setSelected(null);
      setFormErrors({});
    } catch (err) {
      console.error(err);
      alert('Failed to update staff. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDel = async () => {
    if (submitting || !selected) return;
    setSubmitting(true);
    try {
      await axios.delete(`${API_BASE}/${selected.id}`);
      await fetchStaff();
      setShowDel(false);
      setSelected(null);
    } catch (err) {
      console.error(err);
      alert('Failed to delete staff. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>Staff Management</h2>
          <p>Manage all staff members and their information</p>
        </div>
        <div className="page-header-right">
          <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
            <IcoSearch style={{ position:'absolute', left:10 }}/>
            <input className="search-input" style={{ paddingLeft:34, minWidth:220 }} placeholder="Search by name/department/ID..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
          </div>
          <button className="btn-add-staff" onClick={openAdd}><IcoPlus/> Add New Staff</button>
        </div>
      </div>

      {loadError && (
        <div style={{ background:'#fef2f2', color:'#b91c1c', padding:'10px 16px', borderRadius:8, marginBottom:16, fontSize:13 }}>
          {loadError}
        </div>
      )}

      {/* ── Stat Cards (all live, derived from real staff data) ── */}
      <div className="staff-stats">
        <div className="sstat-card">
          <div className="sstat-icon blue"><IcoUsers/></div>
          <div><div className="sstat-label">Total Staff</div><div className="sstat-value">{stats.totalStaff}</div><div className="sstat-sub">All registered staff</div></div>
        </div>
        <div className="sstat-card">
          <div className="sstat-icon green"><IcoDept/></div>
          <div><div className="sstat-label">Total Departments</div><div className="sstat-value">{stats.totalDepartments}</div><div className="sstat-sub">Currently staffed</div></div>
        </div>
        <div className="sstat-card">
          <div className="sstat-icon orange"><IcoLeave/></div>
          <div><div className="sstat-label">On Leave</div><div className="sstat-value">{stats.onLeave}</div><div className="sstat-sub">{stats.totalStaff ? ((stats.onLeave/stats.totalStaff)*100).toFixed(1) : '0.0'}% of total staff</div></div>
        </div>
        <div className="sstat-card">
          <div className="sstat-icon purple"><IcoWarn/></div>
          <div><div className="sstat-label">Inactive</div><div className="sstat-value">{stats.inactive}</div><div className="sstat-sub">{stats.totalStaff ? ((stats.inactive/stats.totalStaff)*100).toFixed(1) : '0.0'}% of total staff</div></div>
        </div>
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="staff-layout">

        {/* ── LEFT: Table ── */}
        <div>
          {/* Filter bar */}
          <div className="filter-bar">
            <select className="filter-select" value={filterDept} onChange={e=>{setFilterDept(e.target.value);setPage(1);}}>
              <option>All Departments</option>
              {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
            </select>
            <select className="filter-select" value={filterDesig} onChange={e=>{setFilterDesig(e.target.value);setPage(1);}}>
              <option>All Designations</option>
              {DESIGNATIONS.map(d=><option key={d}>{d}</option>)}
            </select>
            <select className="filter-select" value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setPage(1);}}>
              <option>All Status</option>
              <option>Active</option><option>On Leave</option><option>Inactive</option>
            </select>
            <div style={{flex:1}}/>
            <button className="btn-filter"><IcoFilter/> Filter</button>
          </div>

          {/* Table */}
          <div className="staff-card">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'#9ca3af'}}>Loading staff...</td></tr>
                ) : paginated.length===0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'#9ca3af'}}>No staff found.</td></tr>
                ) : paginated.map((s,idx)=>(
                  <tr key={s.id}>
                    <td style={{fontWeight:600}}>{s.staffId}</td>
                    <td>
                      <div className="staff-avatar-cell">
                        <div className="staff-avatar" style={{background:AVATAR_COLORS[idx%AVATAR_COLORS.length]}}>{initials(s.name)}</div>
                        {s.name}
                      </div>
                    </td>
                    <td>{s.dept}</td>
                    <td style={{color:'#6b7280'}}>{s.designation}</td>
                    <td>{s.phone}</td>
                    <td style={{color:'#6b7280',fontSize:12}}>{s.email}</td>
                    <td><span className={statusClass(s.status)}>{s.status}</span></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon btn-icon-view" title="View"   onClick={()=>openView(s)}><IcoEye/></button>
                        <button className="btn-icon btn-icon-edit" title="Edit"   onClick={()=>openEdit(s)}><IcoEdit/></button>
                        <button className="btn-icon btn-icon-del"  title="Delete" onClick={()=>openDel(s)}><IcoTrash/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <span className="pagination-info">Showing {filtered.length===0?0:(page-1)*PER_PAGE+1} to {Math.min(page*PER_PAGE,filtered.length)} of {filtered.length} staff members</span>
              <div className="pagination-btns">
                <button className="pg-btn" onClick={()=>setPage(p=>p-1)} disabled={page===1}><IcoChevL/></button>
                {Array.from({length:Math.min(totalPages,3)},(_,i)=>i+1).map(n=>(
                  <button key={n} className={`pg-btn ${page===n?'active':''}`} onClick={()=>setPage(n)}>{n}</button>
                ))}
                {totalPages>3 && <button className="pg-btn dots">…</button>}
                {totalPages>3 && <button className={`pg-btn ${page===totalPages?'active':''}`} onClick={()=>setPage(totalPages)}>{totalPages}</button>}
                <button className="pg-btn" onClick={()=>setPage(p=>p+1)} disabled={page===totalPages||totalPages===0}><IcoChevR/></button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="staff-sidebar">

          {/* Payroll Summary — derived from real salaries */}
          <div className="payroll-card">
            <div className="payroll-card-title">Payroll Summary</div>
            <div className="payroll-row"><span className="payroll-key">Total Employees</span><span className="payroll-value">{stats.totalStaff}</span></div>
            <div className="payroll-row payroll-net"><span>Total Gross Salary</span><span>{formatCurrency(stats.grossSalary)}</span></div>
            <div style={{fontSize:11,color:'#9ca3af',marginTop:8}}>
              Deductions and net payout require the Payroll module.
            </div>
          </div>

          {/* Staff Status Overview — real Active / On Leave / Inactive split */}
          <div className="attend-card">
            <div className="attend-card-title">Staff Status Overview</div>
            <div className="attend-donut-wrap">
              <DonutChart
                segments={[
                  { pct: stats.active,  color: STATUS_COLORS.Active },
                  { pct: stats.onLeave, color: STATUS_COLORS['On Leave'] },
                  { pct: stats.inactive,color: STATUS_COLORS.Inactive },
                ]}
                size={110} stroke={18}
                centerLabel={stats.totalStaff} centerSub="Total Staff"
              />
              <div className="attend-legend">
                {[
                  { label:'Active',    count:stats.active,   color:STATUS_COLORS.Active },
                  { label:'On Leave',  count:stats.onLeave,  color:STATUS_COLORS['On Leave'] },
                  { label:'Inactive',  count:stats.inactive, color:STATUS_COLORS.Inactive },
                ].map(a=>(
                  <div className="attend-leg-item" key={a.label}>
                    <span className="attend-dot" style={{background:a.color}}/>
                    <span>{a.label}</span>
                    <span className="attend-leg-count">{a.count}</span>
                    <span className="attend-leg-pct">({stats.totalStaff ? ((a.count/stats.totalStaff)*100).toFixed(1) : '0.0'}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="staff-bottom">

        {/* Department wise staff bar chart — real counts */}
        <div className="dept-chart-card">
          <div className="dept-chart-title">Department Wise Staff</div>
          {stats.deptCounts.map(d=>(
            <div className="dept-bar-item" key={d.dept}>
              <span className="dept-bar-label">{d.dept}</span>
              <div className="dept-bar-track">
                <div className="dept-bar-fill" style={{width:`${(d.count/maxDept)*100}%`}}/>
              </div>
              <span className="dept-bar-count">{d.count}</span>
            </div>
          ))}
        </div>

        {/* Salary distribution by department — real, derived from salary field */}
        <div className="dept-chart-card">
          <div className="dept-chart-title">Salary Distribution by Department</div>
          {stats.salaryByDept.length === 0 ? (
            <div style={{color:'#9ca3af',fontSize:13,padding:'12px 0'}}>No salary data yet.</div>
          ) : stats.salaryByDept.map(d=>(
            <div className="dept-bar-item" key={d.dept}>
              <span className="dept-bar-label">{d.dept}</span>
              <div className="dept-bar-track">
                <div className="dept-bar-fill" style={{width:`${(d.total/maxSalaryDept)*100}%`}}/>
              </div>
              <span className="dept-bar-count">{formatCurrency(d.total)}</span>
            </div>
          ))}
        </div>

        {/* Recently joined staff — real, sorted by joinDate */}
        <div className="leave-card">
          <div className="leave-title">Recently Joined Staff</div>
          {stats.recentlyJoined.length === 0 ? (
            <div style={{color:'#9ca3af',fontSize:13,padding:'12px 0'}}>No join dates recorded yet.</div>
          ) : stats.recentlyJoined.map(s=>(
            <div className="leave-item" key={s.id}>
              <div className="leave-icon-wrap" style={{background:'#eff6ff'}}>
                <span style={{fontSize:12,fontWeight:700,color:'#3b82f6'}}>{initials(s.name)}</span>
              </div>
              <div className="leave-info">
                <div className="leave-label">{s.name}</div>
                <div className="leave-count" style={{fontSize:12,fontWeight:500,color:'#6b7280'}}>{s.dept} · {s.joinDate ? s.joinDate.slice(0,10) : '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ MODALS ══════════ */}
      {showAdd && (
        <StaffFormModal
          title="Add New Staff"
          form={form}
          onChange={handleFormChange}
          onSave={handleAdd}
          onClose={()=>setShowAdd(false)}
          submitting={submitting}
          errors={formErrors}
        />
      )}
      {showEdit && (
        <StaffFormModal
          title="Edit Staff"
          form={form}
          onChange={handleFormChange}
          onSave={handleEdit}
          onClose={()=>setShowEdit(false)}
          submitting={submitting}
          errors={formErrors}
        />
      )}

      {/* View Modal */}
      {showView && selected && (
        <div className="modal-overlay" onClick={()=>setShowView(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>Staff Details — {selected.staffId}</h3><button className="modal-close" onClick={()=>setShowView(false)}>×</button></div>
            <div className="modal-body">
              {[['Staff ID',selected.staffId],['Full Name',selected.name],['Department',selected.dept],['Designation',selected.designation],['Phone',selected.phone],['Email',selected.email],['Monthly Salary',formatCurrency(parseSalary(selected.salary))],['Join Date',selected.joinDate ? selected.joinDate.slice(0,10) : '—'],['Emergency Contact',selected.emergencyContact || '—'],['Status',selected.status]].map(([k,v])=>(
                <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-value">{v}</span></div>
              ))}
            </div>
            <div className="modal-footer"><button className="btn-save" onClick={()=>setShowView(false)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDel && selected && (
        <div className="modal-overlay" onClick={()=>setShowDel(false)}>
          <div className="modal-box confirm-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>Delete Staff</h3><button className="modal-close" onClick={()=>setShowDel(false)}>×</button></div>
            <div className="confirm-body">
              <div className="confirm-icon red"><IcoWarn/></div>
              <h4>Delete {selected.name}?</h4>
              <p>This staff member will be permanently removed. This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={()=>setShowDel(false)} disabled={submitting}>Cancel</button>
              <button className="btn-danger" onClick={handleDel} disabled={submitting}>{submitting ? 'Deleting...' : 'Yes, Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Staff;