// ============================================================
//  Staff.js — Staff Management Page (logic + JSX only)
//  Sections: Staff table, Payroll summary, Attendance donut,
//            Recent attendance, Quick actions, Dept bar chart,
//            Payroll components donut, Leave summary
//  Icons  → ../../utils/icons/StaffIcons.js
//  Styles → ../../styles/Staff.css
// ============================================================

import React, { useState, useMemo } from 'react';
import '../../styles/Staff.css';
import {
  IcoPlus, IcoSearch, IcoFilter, IcoEye, IcoEdit, IcoTrash,
  IcoChevL, IcoChevR, IcoWarn, IcoUsers, IcoDept,
  IcoLeave, IcoPayroll, IcoCheck, IcoCalendar, IcoDownload, IcoAttend,
} from '../../utils/icons/Stafficons';

// ── Constants ─────────────────────────────────────────────────
const DEPARTMENTS  = ['Front Office','Housekeeping','F&B Service','Maintenance','Security','Accounts'];
const DESIGNATIONS = ['Front Office Manager','Housekeeping Supervisor','Restaurant Manager','Receptionist','Maintenance Engineer','Room Attendant','Security Guard','Accountant','Chef','Waiter'];
const AVATAR_COLORS= ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1','#ec4899','#14b8a6'];

// ── Sample Data ───────────────────────────────────────────────
const INITIAL_STAFF = [
  { id:'STF-1001', name:'Rahul Verma',   dept:'Front Office',  designation:'Front Office Manager',      phone:'+91 98765 43210', email:'rahul.verma@ph.com',   salary:'₹ 45,000', joinDate:'01 Jan 2020', status:'Active'   },
  { id:'STF-1002', name:'Priya Sharma',  dept:'Housekeeping',  designation:'Housekeeping Supervisor',   phone:'+91 91234 56789', email:'priya.sharma@ph.com',   salary:'₹ 28,000', joinDate:'15 Mar 2021', status:'Active'   },
  { id:'STF-1003', name:'Amit Singh',    dept:'F&B Service',   designation:'Restaurant Manager',        phone:'+91 99876 54321', email:'amit.singh@ph.com',     salary:'₹ 38,000', joinDate:'10 Jun 2019', status:'Active'   },
  { id:'STF-1004', name:'Neha Patel',    dept:'Front Office',  designation:'Receptionist',              phone:'+91 90987 65432', email:'neha.patel@ph.com',     salary:'₹ 22,000', joinDate:'20 Aug 2022', status:'Active'   },
  { id:'STF-1005', name:'Vikram Das',    dept:'Maintenance',   designation:'Maintenance Engineer',      phone:'+91 87654 32109', email:'vikram.das@ph.com',     salary:'₹ 30,000', joinDate:'05 Feb 2021', status:'Active'   },
  { id:'STF-1006', name:'Sunita Devi',   dept:'Housekeeping',  designation:'Room Attendant',            phone:'+91 98712 34567', email:'sunita.devi@ph.com',    salary:'₹ 18,000', joinDate:'12 Sep 2023', status:'On Leave' },
  { id:'STF-1007', name:'Rohit Kumar',   dept:'Security',      designation:'Security Guard',            phone:'+91 96543 21098', email:'rohit.kumar@ph.com',    salary:'₹ 20,000', joinDate:'01 Nov 2022', status:'Active'   },
  { id:'STF-1008', name:'Meera Kapoor',  dept:'Accounts',      designation:'Accountant',                phone:'+91 82103 45678', email:'meera.kapoor@ph.com',   salary:'₹ 35,000', joinDate:'18 Apr 2021', status:'Active'   },
];

const DEPT_COUNTS = [
  { dept:'Front Office', count:12 },
  { dept:'Housekeeping', count:18 },
  { dept:'F&B Service',  count:16 },
  { dept:'Maintenance',  count:10 },
  { dept:'Security',     count:14 },
  { dept:'Accounts',     count:6  },
  { dept:'Others',       count:10 },
];

const ATTEND_DATA = [
  { label:'Present',  count:64, pct:'74.4%', color:'#10b981' },
  { label:'Absent',   count:12, pct:'14.0%', color:'#ef4444' },
  { label:'On Leave', count:7,  pct:'8.1%',  color:'#f59e0b' },
  { label:'Half Day', count:3,  pct:'3.5%',  color:'#3b82f6' },
];

const RECENT_ATTEND = [
  { name:'Rahul Verma',  dept:'Front Office',  status:'Present', color:'#3b82f6' },
  { name:'Priya Sharma', dept:'Housekeeping',  status:'On Leave',color:'#10b981' },
  { name:'Amit Singh',   dept:'F&B Service',   status:'Present', color:'#f59e0b' },
  { name:'Vikram Das',   dept:'Maintenance',   status:'Present', color:'#8b5cf6' },
  { name:'Rohit Kumar',  dept:'Security',      status:'Absent',  color:'#ef4444' },
];

const PAYCOMP = [
  { label:'Basic Salary', pct:67, color:'#1a2a5e' },
  { label:'Allowances',   pct:20, color:'#3b82f6'  },
  { label:'Overtime',     pct:8,  color:'#f59e0b'  },
  { label:'Bonuses',      pct:5,  color:'#10b981'  },
];

const EMPTY_FORM = { name:'', dept:'Front Office', designation:'Receptionist', phone:'', email:'', salary:'', joinDate:'', status:'Active' };
const PER_PAGE = 8;

// ── Helpers ───────────────────────────────────────────────────
const statusClass = (s) => {
  const m = { 'Active':'badge-active','On Leave':'badge-onleave','Inactive':'badge-inactive' };
  return `badge ${m[s]||''}`;
};
const initials = (name) => name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
const raClass   = (s) => { const m = { 'Present':'ra-present','On Leave':'ra-onleave','Absent':'ra-absent' }; return `ra-status ${m[s]||''}`; };

// ── Donut SVG helper ──────────────────────────────────────────
const DonutChart = ({ segments, size=110, stroke=16, centerLabel, centerSub }) => {
  const R   = (size - stroke) / 2;
  const CX  = size / 2;
  const circ= 2 * Math.PI * R;
  let offset = 0;
  const total = segments.reduce((s, seg) => s + seg.pct, 0);
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
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Staff() {
  const [staff, setStaff]             = useState(INITIAL_STAFF);
  const [search, setSearch]           = useState('');
  const [filterDept, setFilterDept]   = useState('All Departments');
  const [filterDesig, setFilterDesig] = useState('All Designations');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [page, setPage]               = useState(1);

  // Modals
  const [showAdd, setShowAdd]     = useState(false);
  const [showEdit, setShowEdit]   = useState(false);
  const [showView, setShowView]   = useState(false);
  const [showDel, setShowDel]     = useState(false);
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);

  // ── Filter ──
  const filtered = staff.filter(s => {
    const ms  = s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search);
    const md  = filterDept   === 'All Departments'  || s.dept        === filterDept;
    const mde = filterDesig  === 'All Designations' || s.designation === filterDesig;
    const mst = filterStatus === 'All Status'        || s.status     === filterStatus;
    return ms && md && mde && mst;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  // ── Handlers ──
  const openAdd  = () => { setForm(EMPTY_FORM); setShowAdd(true); };
  const openEdit = (s) => { setSelected(s); setForm({ name:s.name, dept:s.dept, designation:s.designation, phone:s.phone, email:s.email, salary:s.salary, joinDate:s.joinDate, status:s.status }); setShowEdit(true); };
  const openView = (s) => { setSelected(s); setShowView(true); };
  const openDel  = (s) => { setSelected(s); setShowDel(true); };

  const handleAdd  = () => { const ns = { ...form, id:`STF-${1009+staff.length}` }; setStaff(prev=>[ns,...prev]); setShowAdd(false); };
  const handleEdit = () => { setStaff(prev=>prev.map(s=>s.id===selected.id?{...s,...form}:s)); setShowEdit(false); };
  const handleDel  = () => { setStaff(prev=>prev.filter(s=>s.id!==selected.id)); setShowDel(false); };
  const handleFormChange = (e) => { const{name,value}=e.target; setForm(prev=>({...prev,[name]:value})); };

  // ── Staff Form Modal ──
  const StaffFormModal = ({ title, onSave, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h3>{title}</h3><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="modal-grid">
            <div className="form-group full">
              <label className="form-label">Full Name</label>
              <input className="form-input" name="name" value={form.name} onChange={handleFormChange} placeholder="Enter full name"/>
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-select" name="dept" value={form.dept} onChange={handleFormChange}>
                {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Designation</label>
              <select className="form-select" name="designation" value={form.designation} onChange={handleFormChange}>
                {DESIGNATIONS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" name="phone" value={form.phone} onChange={handleFormChange} placeholder="+91 00000 00000"/>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" name="email" value={form.email} onChange={handleFormChange} placeholder="staff@hotel.com"/>
            </div>
            <div className="form-group">
              <label className="form-label">Monthly Salary</label>
              <input className="form-input" name="salary" value={form.salary} onChange={handleFormChange} placeholder="e.g. ₹ 25,000"/>
            </div>
            <div className="form-group">
              <label className="form-label">Join Date</label>
              <input className="form-input" type="date" name="joinDate" value={form.joinDate} onChange={handleFormChange}/>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleFormChange}>
                <option>Active</option><option>On Leave</option><option>Inactive</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={onSave}>Save Staff</button>
        </div>
      </div>
    </div>
  );

  const maxDept = Math.max(...DEPT_COUNTS.map(d=>d.count));

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

      {/* ── Stat Cards ── */}
      <div className="staff-stats">
        <div className="sstat-card">
          <div className="sstat-icon blue"><IcoUsers/></div>
          <div><div className="sstat-label">Total Staff</div><div className="sstat-value">{staff.length}</div><div className="sstat-sub">↑ 6.2% from last month</div></div>
        </div>
        <div className="sstat-card">
          <div className="sstat-icon green"><IcoDept/></div>
          <div><div className="sstat-label">Departments</div><div className="sstat-value">8</div><div className="sstat-sub">Active Departments</div></div>
        </div>
        <div className="sstat-card">
          <div className="sstat-icon orange"><IcoLeave/></div>
          <div><div className="sstat-label">On Leave Today</div><div className="sstat-value">{staff.filter(s=>s.status==='On Leave').length}</div><div className="sstat-sub">8.1% of total staff</div></div>
        </div>
        <div className="sstat-card">
          <div className="sstat-icon purple"><IcoPayroll/></div>
          <div><div className="sstat-label">Monthly Payroll</div><div className="sstat-value" style={{fontSize:16}}>₹ 18,75,000</div><div className="sstat-sub gold">↑ 12.4% from last month</div></div>
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
            <div style={{fontSize:12,color:'#6b7280'}}></div>
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
                {paginated.length===0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'#9ca3af'}}>No staff found.</td></tr>
                ) : paginated.map((s,idx)=>(
                  <tr key={s.id}>
                    <td style={{fontWeight:600}}>{s.id}</td>
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

          {/* Payroll Summary */}
          <div className="payroll-card">
            <div className="payroll-card-title">Payroll Summary</div>
            {[['Total Employees','86'],['Gross Salary','₹ 18,75,000'],['Deductions','₹ 2,15,000']].map(([k,v])=>(
              <div className="payroll-row" key={k}><span className="payroll-key">{k}</span><span className="payroll-value">{v}</span></div>
            ))}
            <div className="payroll-row payroll-net"><span>Net Salary Paid</span><span>₹ 16,60,000</span></div>
            <button className="btn-process-payroll">Process Payroll</button>
          </div>

          {/* Attendance Overview */}
          <div className="attend-card">
            <div className="attend-card-title">Attendance Overview (May 2024)</div>
            <div className="attend-donut-wrap">
              <DonutChart
                segments={ATTEND_DATA.map(a=>({pct:a.count,color:a.color}))}
                size={110} stroke={18}
                centerLabel="86" centerSub="Total Staff"
              />
              <div className="attend-legend">
                {ATTEND_DATA.map(a=>(
                  <div className="attend-leg-item" key={a.label}>
                    <span className="attend-dot" style={{background:a.color}}/>
                    <span>{a.label}</span>
                    <span className="attend-leg-count">{a.count}</span>
                    <span className="attend-leg-pct">({a.pct})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          </div>
        
          </div>

      {/* ── Bottom 3-col row ── */}
      <div className="staff-bottom">

        {/* Department wise staff bar chart */}
        <div className="dept-chart-card">
          <div className="dept-chart-title">Department Wise Staff</div>
          {DEPT_COUNTS.map(d=>(
            <div className="dept-bar-item" key={d.dept}>
              <span className="dept-bar-label">{d.dept}</span>
              <div className="dept-bar-track">
                <div className="dept-bar-fill" style={{width:`${(d.count/maxDept)*100}%`}}/>
              </div>
              <span className="dept-bar-count">{d.count}</span>
            </div>
          ))}
        </div>

        {/* Payroll components donut */}
        <div className="paycomp-card">
          <div className="paycomp-title">Payroll Components (May 2024)</div>
          <div className="paycomp-wrap">
            <div className="paycomp-donut">
              <DonutChart
                segments={PAYCOMP.map(p=>({pct:p.pct,color:p.color}))}
                size={110} stroke={18}
                centerLabel="₹18,75k" centerSub="Total Payroll"
              />
            </div>
            <div className="paycomp-legend">
              {PAYCOMP.map(p=>(
                <div className="paycomp-leg-item" key={p.label}>
                  <span className="paycomp-dot" style={{background:p.color}}/>
                  <span>{p.label}</span>
                  <span className="paycomp-pct">{p.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Leave Summary */}
        <div className="leave-card">
          <div className="leave-title">Leave Summary (May 2024)</div>
          {[
            { label:'Total Leaves', count:42, icon:'📋', bg:'#eff6ff' },
            { label:'Approved',     count:28, icon:'✅', bg:'#f0fdf4' },
            { label:'Pending',      count:10, icon:'⏳', bg:'#fffbeb' },
            { label:'Rejected',     count:4,  icon:'❌', bg:'#fef2f2' },
          ].map(l=>(
            <div className="leave-item" key={l.label}>
              <div className="leave-icon-wrap" style={{background:l.bg}}>{l.icon}</div>
              <div className="leave-info">
                <div className="leave-label">{l.label}</div>
                <div className="leave-count">{l.count}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ MODALS ══════════ */}
      {showAdd  && <StaffFormModal title="Add New Staff" onSave={handleAdd}  onClose={()=>setShowAdd(false)}/>}
      {showEdit && <StaffFormModal title="Edit Staff"      onSave={handleEdit} onClose={()=>setShowEdit(false)}/>}

      {/* View Modal */}
      {showView && selected && (
        <div className="modal-overlay" onClick={()=>setShowView(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>Staff Details — {selected.id}</h3><button className="modal-close" onClick={()=>setShowView(false)}>×</button></div>
            <div className="modal-body">
              {[['Staff ID',selected.id],['Full Name',selected.name],['Department',selected.dept],['Designation',selected.designation],['Phone',selected.phone],['Email',selected.email],['Monthly Salary',selected.salary],['Join Date',selected.joinDate],['Status',selected.status]].map(([k,v])=>(
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
              <button className="btn-cancel" onClick={()=>setShowDel(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDel}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Staff;
