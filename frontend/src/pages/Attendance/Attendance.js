// ============================================================
//  Attendance.js — Staff Attendance & Performance (logic + JSX)
//  Sections: Stat cards, Tabs, Attendance table, Summary donut,
//            Leave requests, Birthdays, Dept bar, Performance
//            donut, Top performers, Alerts
//  Icons  → ../../utils/icons/AttendanceIcons.js
//  Styles → ../../styles/Attendance.css
// ============================================================

import React, { useState } from 'react';
import '../../styles/Attendance.css';
import {
  IcoFilter, IcoSearch, IcoExport, IcoEye, IcoEdit,
  IcoChevL, IcoChevR, IcoUsers, IcoPresent, IcoLeave,
  IcoAbsent, IcoClock, IcoCalendar, IcoBell, IcoBirthday,
  IcoStar, IcoAlert,
} from '../../utils/icons/AttendanceIcons';

// ── Constants ─────────────────────────────────────────────────
const AVATAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1'];
const initials = (name) => name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
const DEPARTMENTS = ['Front Office','Housekeeping','F&B Service','Maintenance','Security','Accounts'];

// ── Sample Data ───────────────────────────────────────────────
const INITIAL_ATTENDANCE = [
  { id:'STF-1001', name:'Rahul Verma',  dept:'Front Office',  checkIn:'08:58 AM', checkOut:'05:12 PM', hours:'8h 14m', status:'Present' },
  { id:'STF-1002', name:'Priya Sharma', dept:'Housekeeping',  checkIn:'09:05 AM', checkOut:'05:18 PM', hours:'8h 13m', status:'Present' },
  { id:'STF-1003', name:'Amit Singh',   dept:'F&B Service',   checkIn:'09:00 AM', checkOut:'05:07 PM', hours:'8h 07m', status:'Present' },
  { id:'STF-1004', name:'Neha Patel',   dept:'Front Office',  checkIn:'09:02 AM', checkOut:'02:15 PM', hours:'5h 13m', status:'Half Day' },
  { id:'STF-1005', name:'Vikram Das',   dept:'Maintenance',   checkIn:'-',        checkOut:'-',        hours:'-',      status:'On Leave' },
  { id:'STF-1006', name:'Sunita Devi',  dept:'Housekeeping',  checkIn:'-',        checkOut:'-',        hours:'-',      status:'On Leave' },
  { id:'STF-1007', name:'Rohit Kumar',  dept:'Security',      checkIn:'09:10 AM', checkOut:'05:20 PM', hours:'8h 10m', status:'Present' },
  { id:'STF-1008', name:'Meera Kapoor', dept:'Accounts',      checkIn:'09:00 AM', checkOut:'05:05 PM', hours:'8h 05m', status:'Present' },
];

const ATTEND_SUMMARY = [
  { label:'Present',  count:64, pct:'74.4%', color:'#10b981' },
  { label:'Absent',   count:12, pct:'14.0%', color:'#ef4444' },
  { label:'On Leave', count:7,  pct:'8.1%',  color:'#f59e0b' },
  { label:'Half Day', count:3,  pct:'3.5%',  color:'#3b82f6' },
];

const LEAVE_REQUESTS = [
  { name:'Vikram Das',  dept:'Maintenance',  type:'Annual Leave', dates:'23 - 26 May 2024', status:'Pending',  color:'#8b5cf6' },
  { name:'Sunita Devi', dept:'Housekeeping', type:'Sick Leave',   dates:'22 May 2024',       status:'Approved', color:'#10b981' },
  { name:'Rohit Kumar', dept:'Security',     type:'Casual Leave', dates:'24 May 2024',       status:'Pending',  color:'#f97316' },
];

const BIRTHDAYS = [
  { name:'Priya Sharma', dept:'Housekeeping', date:'24 May' },
  { name:'Amit Singh',   dept:'F&B Service',  date:'27 May' },
  { name:'Neha Patel',   dept:'Front Office', date:'30 May' },
];

const ALERTS = [
  { text:'12 staff members are absent today', color:'red' },
  { text:'3 leave requests are pending approval', color:'orange' },
  { text:'2 staff members have late check-in', color:'blue' },
];

const DEPT_PRESENT = [
  { dept:'Front Office', present:14, total:18 },
  { dept:'Housekeeping', present:18, total:23 },
  { dept:'F&B Service',  present:12, total:15 },
  { dept:'Maintenance',  present:6,  total:10 },
  { dept:'Security',     present:8,  total:9  },
  { dept:'Accounts',     present:6,  total:6  },
];

const PERFORMANCE = [
  { label:'Excellent',       pct:22, color:'#10b981' },
  { label:'Good',            pct:38, color:'#3b82f6' },
  { label:'Average',         pct:30, color:'#f59e0b' },
  { label:'Needs Improvement', pct:9, color:'#ef4444' },
];

const TOP_PERFORMERS = [
  { rank:1, name:'Rahul Verma',  dept:'Front Office', score:4.8 },
  { rank:2, name:'Priya Sharma', dept:'Housekeeping', score:4.7 },
  { rank:3, name:'Amit Singh',   dept:'F&B Service',  score:4.6 },
];

const TABS = ['Daily Summary','Weekly Summary','Monthly Summary','Attendance Exceptions'];
const PER_PAGE = 8;

// ── Helpers ───────────────────────────────────────────────────
const statusClass = (s) => {
  const m = { 'Present':'badge-present','Absent':'badge-absent','On Leave':'badge-onleave','Half Day':'badge-halfday','Late':'badge-late' };
  return `badge ${m[s]||''}`;
};
const leaveBadgeClass = (s) => {
  const m = { 'Pending':'lr-pending','Approved':'lr-approved','Rejected':'lr-rejected' };
  return `lr-badge ${m[s]||''}`;
};

// ── Donut Chart Helper ───────────────────────────────────────
const DonutChart = ({ segments, size=110, stroke=18, centerLabel, centerSub }) => {
  const R=((size-stroke)/2), CX=size/2, circ=2*Math.PI*R;
  const total=segments.reduce((s,sg)=>s+sg.pct,0);
  let offset=0;
  return (
    <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={CX} cy={CX} r={R} fill="none" stroke="#f1f4f9" strokeWidth={stroke}/>
        {segments.map((sg,i)=>{
          const dash=(sg.pct/total)*circ;
          const el=<circle key={i} cx={CX} cy={CX} r={R} fill="none" stroke={sg.color} strokeWidth={stroke} strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-offset} transform={`rotate(-90 ${CX} ${CX})`}/>;
          offset+=dash; return el;
        })}
      </svg>
      {centerLabel && (
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:18,fontWeight:800,color:'#1a1f36',lineHeight:1}}>{centerLabel}</span>
          {centerSub && <span style={{fontSize:9,color:'#6b7280',marginTop:2}}>{centerSub}</span>}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Attendance() {
  const [attendance, setAttendance]   = useState(INITIAL_ATTENDANCE);
  const [activeTab, setActiveTab]     = useState('Daily Summary');
  const [search, setSearch]           = useState('');
  const [filterDept, setFilterDept]   = useState('All Departments');
  const [page, setPage]               = useState(1);
  const [showEdit, setShowEdit]       = useState(false);
  const [showView, setShowView]       = useState(false);
  const [selected, setSelected]       = useState(null);
  const [form, setForm]               = useState({ checkIn:'', checkOut:'', status:'Present' });

  // ── Filter ──
  const filtered = attendance.filter(a => {
    const ms = a.name.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase());
    const md = filterDept === 'All Departments' || a.dept === filterDept;
    return ms && md;
  });
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  // ── Handlers ──
  const openView = (a) => { setSelected(a); setShowView(true); };
  const openEdit = (a) => { setSelected(a); setForm({ checkIn:a.checkIn, checkOut:a.checkOut, status:a.status }); setShowEdit(true); };
  const handleEdit = () => {
    setAttendance(prev => prev.map(a => a.id===selected.id ? { ...a, ...form } : a));
    setShowEdit(false);
  };
  const handleFormChange = (e) => { const{name,value}=e.target; setForm(prev=>({...prev,[name]:value})); };

// ── Export handler ──
const handleExport = () => {
  const headers = ['Staff ID','Name','Department','Check-in','Check-out','Working Hours','Status'];
  const rows = filtered.map(a => [a.id, a.name, a.dept, a.checkIn, a.checkOut, a.hours, a.status]);
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
  const maxDept = Math.max(...DEPT_PRESENT.map(d=>d.total));

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>Attendance Overview</h2>
          <p>Track daily attendance and working hours</p>
        </div>
        <div className="page-header-right">
          <div className="date-badge"><IcoCalendar/> 22 May 2024</div>
          <select className="dept-select" value={filterDept} onChange={e=>{setFilterDept(e.target.value);setPage(1);}}>
            <option>All Departments</option>
            {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
          </select>
          <button className="btn-filter-main"><IcoFilter/> Filter</button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="attend-stats">
        <div className="astat-card">
          <div className="astat-icon blue"><IcoUsers/></div>
          <div><div className="astat-label">Total Staff</div><div className="astat-value">86</div><div className="astat-sub">↑ 6.2% from last month</div></div>
        </div>
        <div className="astat-card">
          <div className="astat-icon green"><IcoPresent/></div>
          <div><div className="astat-label">Present Today</div><div className="astat-value">64</div><div className="astat-sub">74.4% of total staff</div></div>
        </div>
        <div className="astat-card">
          <div className="astat-icon orange"><IcoLeave/></div>
          <div><div className="astat-label">On Leave</div><div className="astat-value">7</div><div className="astat-sub muted">8.1% of total staff</div></div>
        </div>
        <div className="astat-card">
          <div className="astat-icon red"><IcoAbsent/></div>
          <div><div className="astat-label">Absent Today</div><div className="astat-value">12</div><div className="astat-sub muted">14.0% of total staff</div></div>
        </div>
        <div className="astat-card">
          <div className="astat-icon purple"><IcoClock/></div>
          <div><div className="astat-label">Avg Working Hours</div><div className="astat-value">8h 15m</div><div className="astat-sub muted">0.4h from last week</div></div>
        </div>
      </div>

      {/* ── Main 2-col layout ── */}
      <div className="attend-layout">

        {/* ── LEFT: Tabs + Table ── */}
        <div>
          <div className="attend-tabs">
            <div className="attend-tab-group">
              {TABS.map(tab=>(
                <button key={tab} className={`attend-tab ${activeTab===tab?'active':''}`} onClick={()=>setActiveTab(tab)}>{tab}</button>
              ))}
            </div>
            <div className="attend-search">
              <div className="search-rel">
                <IcoSearch/>
                <input className="attend-search-input" placeholder="Search by name or staff ID..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
              </div>
              <button className="btn-export" onClick={handleExport}><IcoExport/> Export</button>
            </div>
          </div>

          {/* Table */}
          <div className="attend-card">
            <table className="attend-table">
              <thead>
                <tr>
                  <th>Staff ID</th><th>Name</th><th>Department</th>
                  <th>Check-in</th><th>Check-out</th><th>Working Hours</th>
                  <th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length===0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'#9ca3af'}}>No records found.</td></tr>
                ) : paginated.map((a,idx)=>(
                  <tr key={a.id}>
                    <td style={{fontWeight:600}}>{a.id}</td>
                    <td>
                      <div className="staff-avatar-cell">
                        <div className="staff-avatar" style={{background:AVATAR_COLORS[idx%AVATAR_COLORS.length]}}>{initials(a.name)}</div>
                        {a.name}
                      </div>
                    </td>
                    <td>{a.dept}</td>
                    <td>{a.checkIn}</td>
                    <td>{a.checkOut}</td>
                    <td>{a.hours}</td>
                    <td><span className={statusClass(a.status)}>{a.status}</span></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon btn-icon-view" title="View" onClick={()=>openView(a)}><IcoEye/></button>
                        <button className="btn-icon btn-icon-edit" title="Edit" onClick={()=>openEdit(a)}><IcoEdit/></button>
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
        <div className="attend-sidebar">

          {/* Attendance Summary */}
          <div className="summary-card">
            <div className="summary-title">Attendance Summary (May 2024)</div>
            <div className="summary-donut-wrap">
              <DonutChart segments={ATTEND_SUMMARY.map(a=>({pct:a.count,color:a.color}))} size={100} stroke={16} centerLabel="86" centerSub="Total Staff"/>
              <div className="summary-legend">
                {ATTEND_SUMMARY.map(a=>(
                  <div className="summary-leg-item" key={a.label}>
                    <span className="summary-dot" style={{background:a.color}}/>
                    <span>{a.label}</span>
                    <span className="summary-count">{a.count}</span>
                    <span className="summary-pct">({a.pct})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Leave Requests */}
          <div className="leave-req-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">Leave Requests</span>
              <span className="view-all-link">View All</span>
            </div>
            {LEAVE_REQUESTS.map((lr,i)=>(
              <div className="leave-req-item" key={i}>
                <div className="lr-avatar" style={{background:lr.color}}>{initials(lr.name)}</div>
                <div className="lr-info">
                  <div className="lr-name">{lr.name}</div>
                  <div className="lr-dept">{lr.dept}</div>
                  <div className="lr-type">{lr.type}</div>
                  <div className="lr-dates">{lr.dates}</div>
                </div>
                <span className={leaveBadgeClass(lr.status)}>{lr.status}</span>
              </div>
            ))}
          </div>

          {/* Upcoming Birthdays */}
          <div className="birthday-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">Upcoming Birthdays</span>
              <span className="view-all-link">View All</span>
            </div>
            {BIRTHDAYS.map((b,i)=>(
              <div className="birthday-item" key={i}>
                <div className="bday-icon"><IcoBirthday/></div>
                <div className="bday-info">
                  <div className="bday-name">{b.name}</div>
                  <div className="bday-dept">{b.dept}</div>
                </div>
                <div className="bday-date">{b.date}</div>
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div className="alerts-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">Alerts</span>
              <span className="view-all-link">View All Alerts</span>
            </div>
            {ALERTS.map((a,i)=>(
              <div className="alert-item" key={i}>
                <span className={`alert-dot ${a.color}`}/>
                {a.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom 3-col ── */}
      <div className="attend-bottom">

        {/* Department wise present bar chart */}
        <div className="dept-bar-card">
          <div className="dept-bar-title">Department Wise Present</div>
          {DEPT_PRESENT.map(d=>(
            <div className="dept-bar-item" key={d.dept}>
              <span className="dept-bar-label">{d.dept}</span>
              <div className="dept-bar-track">
                <div className="dept-bar-fill" style={{width:`${(d.present/maxDept)*100}%`}}/>
              </div>
              <span className="dept-bar-count">{d.present} ({Math.round((d.present/d.total)*100)}%)</span>
            </div>
          ))}
        </div>

        {/* Performance Overview donut */}
        <div className="perf-card">
          <div className="perf-title">Performance Overview</div>
          <div className="perf-wrap">
            <DonutChart segments={PERFORMANCE} size={100} stroke={16} centerLabel="86" centerSub="Total Staff"/>
            <div className="perf-legend">
              {PERFORMANCE.map(p=>(
                <div className="perf-leg-item" key={p.label}>
                  <span className="perf-dot" style={{background:p.color}}/>
                  <span>{p.label}</span>
                  <span className="perf-pct">{p.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="top-perf-card">
          <div className="top-perf-title"><IcoStar/> Top Performers</div>
          {TOP_PERFORMERS.map((tp,i)=>(
            <div className="top-perf-item" key={i}>
              <div className={`tp-rank ${i===0?'gold':i===1?'silver':'bronze'}`}>{tp.rank}</div>
              <div className="tp-avatar" style={{background:AVATAR_COLORS[i%AVATAR_COLORS.length]}}>{initials(tp.name)}</div>
              <div className="tp-info"><div className="tp-name">{tp.name}</div><div className="tp-dept">{tp.dept}</div></div>
              <div className="tp-score"><IcoStar/> {tp.score}</div>
            </div>
          ))}
          <div className="view-all-perf">View All Performance</div>
        </div>
      </div>

      {/* ══════════ MODALS ══════════ */}

      {/* Edit Modal */}
      {showEdit && selected && (
        <div className="modal-overlay" onClick={()=>setShowEdit(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>Edit Attendance — {selected.name}</h3><button className="modal-close" onClick={()=>setShowEdit(false)}>×</button></div>
            <div className="modal-body">
              <div className="modal-grid">
                <div className="form-group"><label className="form-label">Check-in Time</label><input className="form-input" name="checkIn" value={form.checkIn} onChange={handleFormChange} placeholder="e.g. 09:00 AM"/></div>
                <div className="form-group"><label className="form-label">Check-out Time</label><input className="form-input" name="checkOut" value={form.checkOut} onChange={handleFormChange} placeholder="e.g. 05:00 PM"/></div>
                <div className="form-group full">
                  <label className="form-label">Status</label>
                  <select className="form-select" name="status" value={form.status} onChange={handleFormChange}>
                    <option>Present</option><option>Absent</option><option>On Leave</option><option>Half Day</option><option>Late</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer"><button className="btn-cancel" onClick={()=>setShowEdit(false)}>Cancel</button><button className="btn-save" onClick={handleEdit}>Save Changes</button></div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showView && selected && (
        <div className="modal-overlay" onClick={()=>setShowView(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>Attendance Details — {selected.id}</h3><button className="modal-close" onClick={()=>setShowView(false)}>×</button></div>
            <div className="modal-body">
              {[['Staff ID',selected.id],['Name',selected.name],['Department',selected.dept],['Check-in',selected.checkIn],['Check-out',selected.checkOut],['Working Hours',selected.hours],['Status',selected.status]].map(([k,v])=>(
                <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-value">{v}</span></div>
              ))}
            </div>
            <div className="modal-footer"><button className="btn-save" onClick={()=>setShowView(false)}>Close</button></div>
          </div>
        </div>
      )}
    </>
  );
}

export default Attendance;
