// ============================================================
//  Attendance.js — Staff Attendance & Performance (logic + JSX)
//  Sections: Stat cards, Tabs, Attendance table, Summary donut,
//            Leave requests, Birthdays, Dept bar, Performance
//            donut, Top performers, Alerts
//  Icons  → ../../utils/icons/AttendanceIcons.js
//  Styles → ../../styles/Attendance.css
//
//  Backend contract (matches the `attendance` table):
//    attendance_id INT PK, staff_id INT FK -> staff.staff_id,
//    attendance_date DATE, check_in_time TIME, check_out_time TIME,
//    status ENUM('present','absent','half_day','leave')
//
//  GET  /api/attendance?date=YYYY-MM-DD
//    -> [{ staff_id, staffCode, name, dept, check_in_time, check_out_time, status }]
//    (controller should JOIN staff to include staffCode/name/dept —
//     attendance table alone doesn't carry those)
//
//  PUT  /api/attendance/:staff_id
//    body: { attendance_date, check_in_time, check_out_time, status }
//    (status must be one of the 4 enum values, lowercase)
// ============================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import '../../styles/Attendance.css';
import {
  IcoFilter, IcoSearch, IcoExport, IcoEye, IcoEdit,
  IcoChevL, IcoChevR, IcoUsers, IcoPresent, IcoLeave,
  IcoAbsent, IcoClock, IcoCalendar, IcoBell, IcoBirthday,
  IcoStar, IcoAlert,
} from '../../utils/icons/AttendanceIcons';

// ── Config ────────────────────────────────────────────────────
const API_BASE        = 'http://localhost:5000/api/attendance';
const LEAVE_API       = 'http://localhost:5000/api/leave-requests';
const BIRTHDAY_API    = 'http://localhost:5000/api/staff/birthdays';
const PERFORMANCE_API = 'http://localhost:5000/api/performance/top';

// ── Constants (form options / display config only — NOT data) ──
const AVATAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1'];
const DEPARTMENTS   = ['Front Office','Housekeeping','F&B Service','Maintenance','Security','Accounts'];

// DB enum <-> display label. The `status` column only supports these 4 values —
// there is no "Late" state in the schema, so it has been removed from the UI.
const STATUS_LABEL = { present:'Present', absent:'Absent', half_day:'Half Day', leave:'On Leave' };
const STATUS_ENUM  = { Present:'present', Absent:'absent', 'Half Day':'half_day', 'On Leave':'leave' };
const STATUS_COLORS = { Present:'#10b981', Absent:'#ef4444', 'On Leave':'#f59e0b', 'Half Day':'#3b82f6' };

const TABS     = ['Daily Summary','Weekly Summary','Monthly Summary','Attendance Exceptions'];
const PER_PAGE = 8;

// ── Helpers ───────────────────────────────────────────────────
const initials = (name='') => name.split(' ').filter(Boolean).map(n=>n[0]).join('').slice(0,2).toUpperCase();

const statusClass = (label) => {
  const m = { 'Present':'badge-present','Absent':'badge-absent','On Leave':'badge-onleave','Half Day':'badge-halfday' };
  return `badge ${m[label]||''}`;
};
const leaveBadgeClass = (s) => {
  const m = { 'Pending':'lr-pending','Approved':'lr-approved','Rejected':'lr-rejected' };
  return `lr-badge ${m[s]||''}`;
};

// TIME column comes back as "HH:MM:SS" (or null). Display as "09:00 AM".
const formatTime = (t) => {
  if (!t) return '-';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2,'0')}:${mStr} ${suffix}`;
};
// For <input type="time">, which needs "HH:MM".
const toTimeInputValue = (t) => (t ? t.slice(0,5) : '');

const timeToMinutes = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const minutesToHoursLabel = (mins) => {
  if (mins == null || mins <= 0) return '-';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${String(m).padStart(2,'0')}m`;
};
// Working hours are computed client-side from check_in_time/check_out_time —
// the schema has no stored "hours" column.
const workedMinutes = (checkIn, checkOut) => {
  const inM = timeToMinutes(checkIn);
  const outM = timeToMinutes(checkOut);
  if (inM == null || outM == null) return 0;
  return Math.max(0, outM - inM);
};

const todayISO = () => new Date().toISOString().slice(0,10);
const formatDateLabel = (iso) => new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

// ── Donut Chart Helper ───────────────────────────────────────
const DonutChart = ({ segments, size=110, stroke=18, centerLabel, centerSub }) => {
  const R=((size-stroke)/2), CX=size/2, circ=2*Math.PI*R;
  const total=segments.reduce((s,sg)=>s+sg.pct,0) || 1;
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
  // ── Core attendance data (from backend, raw DB shape) ──
  const [attendance, setAttendance]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState('');
  // Lazy initializer: evaluated once per mount, so a fresh login/page load
  // always starts on the real current date rather than a stale closure.
  const [date, setDate]               = useState(() => todayISO());
  // Tracks whether the user manually picked a date, so the midnight
  // auto-advance below never overrides an explicit choice.
  const userPickedDateRef             = useRef(false);

  // ── Sidebar / bottom-row data (separate backend modules) ──
  const [leaveRequests, setLeaveRequests]       = useState([]);
  const [leaveError, setLeaveError]             = useState(false);
  const [birthdays, setBirthdays]               = useState([]);
  const [birthdayError, setBirthdayError]       = useState(false);
  const [topPerformers, setTopPerformers]       = useState([]);
  const [performanceError, setPerformanceError] = useState(false);

  const [activeTab, setActiveTab]     = useState('Daily Summary');
  const [search, setSearch]           = useState('');
  const [filterDept, setFilterDept]   = useState('All Departments');
  const [page, setPage]               = useState(1);
  const [submitting, setSubmitting]   = useState(false);

  const [showEdit, setShowEdit]       = useState(false);
  const [showView, setShowView]       = useState(false);
  const [selected, setSelected]       = useState(null);
  const [form, setForm]               = useState({ check_in_time:'', check_out_time:'', status:'Present' });

  // ── Fetch attendance for the selected date ──
  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await axios.get(API_BASE, { params: { date } });
      const rows = Array.isArray(res.data) ? res.data : [];
      // Normalize once here so the rest of the component works with a
      // consistent shape regardless of exact backend key casing.
      const normalized = rows.map(r => ({
        staff_id: r.staff_id,
        staffCode: r.staffCode || r.staff_code || `STF-${r.staff_id}`,
        name: r.name,
        dept: r.dept,
        check_in_time: r.check_in_time,
        check_out_time: r.check_out_time,
        status: STATUS_LABEL[r.status] || r.status,
      }));
      setAttendance(normalized);
    } catch (err) {
      console.error(err);
      setAttendance([]);
      setLoadError('Could not load attendance. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  // If this tab is left open across midnight, roll the date field forward
  // to the new "today" automatically — but only while the user hasn't
  // manually picked a specific date to look at.
  useEffect(() => {
    const interval = setInterval(() => {
      if (userPickedDateRef.current) return;
      const currentToday = todayISO();
      setDate(prev => (prev !== currentToday ? currentToday : prev));
    }, 60 * 1000); // check once a minute
    return () => clearInterval(interval);
  }, []);

  // ── Fetch supporting sidebar data (each fails independently/silently) ──
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(LEAVE_API, { params: { limit: 5 } });
        setLeaveRequests(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setLeaveError(true);
      }
    })();
    (async () => {
      try {
        const res = await axios.get(BIRTHDAY_API, { params: { upcoming: 5 } });
        setBirthdays(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setBirthdayError(true);
      }
    })();
    (async () => {
      try {
        const res = await axios.get(PERFORMANCE_API, { params: { limit: 3 } });
        setTopPerformers(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setPerformanceError(true);
      }
    })();
  }, []);

  // ── Filter (table) ──
  const filtered = attendance.filter(a => {
    const ms = (a.name||'').toLowerCase().includes(search.toLowerCase()) || (a.staffCode||'').toLowerCase().includes(search.toLowerCase());
    const md = filterDept === 'All Departments' || a.dept === filterDept;
    return ms && md;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  // ════════════════════════════════════════════════════════
  //  LIVE STATISTICS — derived from the real `attendance` rows.
  // ════════════════════════════════════════════════════════
  const stats = useMemo(() => {
    const totalStaff = attendance.length;
    const present     = attendance.filter(a => a.status === 'Present').length;
    const onLeave     = attendance.filter(a => a.status === 'On Leave').length;
    const absent      = attendance.filter(a => a.status === 'Absent').length;
    const halfDay     = attendance.filter(a => a.status === 'Half Day').length;

    const workingMinutesList = attendance
      .filter(a => a.status === 'Present' || a.status === 'Half Day')
      .map(a => workedMinutes(a.check_in_time, a.check_out_time))
      .filter(m => m > 0);
    const avgMinutes = workingMinutesList.length
      ? workingMinutesList.reduce((s,m)=>s+m,0) / workingMinutesList.length
      : 0;

    const pct = (n) => totalStaff ? ((n/totalStaff)*100).toFixed(1) : '0.0';

    const summary = [
      { label:'Present',  count:present, pct:`${pct(present)}%`, color:STATUS_COLORS.Present },
      { label:'Absent',   count:absent,  pct:`${pct(absent)}%`,  color:STATUS_COLORS.Absent },
      { label:'On Leave', count:onLeave, pct:`${pct(onLeave)}%`, color:STATUS_COLORS['On Leave'] },
      { label:'Half Day', count:halfDay, pct:`${pct(halfDay)}%`, color:STATUS_COLORS['Half Day'] },
    ];

    const deptPresent = DEPARTMENTS.map(dept => {
      const deptRecords = attendance.filter(a => a.dept === dept);
      const deptPresentCount = deptRecords.filter(a => a.status === 'Present' || a.status === 'Half Day').length;
      return { dept, present: deptPresentCount, total: deptRecords.length };
    }).filter(d => d.total > 0);

    return { totalStaff, present, onLeave, absent, halfDay, avgMinutes, summary, deptPresent };
  }, [attendance]);

  const maxDept = Math.max(1, ...stats.deptPresent.map(d => d.total));

  // Alerts derived from real stats/leave data — no "late check-in" alert
  // since the status enum has no "late" value to detect it from.
  const alerts = useMemo(() => {
    const list = [];
    if (stats.absent > 0) list.push({ text:`${stats.absent} staff member${stats.absent>1?'s are':' is'} absent today`, color:'red' });
    const pendingLeave = leaveRequests.filter(lr => lr.status === 'Pending').length;
    if (pendingLeave > 0) list.push({ text:`${pendingLeave} leave request${pendingLeave>1?'s are':' is'} pending approval`, color:'orange' });
    return list;
  }, [stats, leaveRequests]);

  // ── Handlers ──
  const openView = (a) => { setSelected(a); setShowView(true); };
  const openEdit = (a) => {
    setSelected(a);
    setForm({
      check_in_time: toTimeInputValue(a.check_in_time),
      check_out_time: toTimeInputValue(a.check_out_time),
      status: a.status,
    });
    setShowEdit(true);
  };
  const handleFormChange = (e) => { const{name,value}=e.target; setForm(prev=>({...prev,[name]:value})); };

  const handleEdit = async () => {
    if (submitting || !selected) return;
    setSubmitting(true);
    try {
      await axios.put(`${API_BASE}/${selected.staff_id}`, {
        attendance_date: date,
        check_in_time: form.check_in_time || null,
        check_out_time: form.check_out_time || null,
        status: STATUS_ENUM[form.status],
      });
      await fetchAttendance();
      setShowEdit(false);
      setSelected(null);
    } catch (err) {
      console.error(err);
      alert('Failed to update attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Export handler (exports the real fetched data) ──
  const handleExport = () => {
    const headers = ['Staff ID','Name','Department','Check-in','Check-out','Working Hours','Status'];
    const rows = filtered.map(a => [
      a.staffCode, a.name, a.dept,
      formatTime(a.check_in_time), formatTime(a.check_out_time),
      minutesToHoursLabel(workedMinutes(a.check_in_time, a.check_out_time)),
      a.status,
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
          <div className="date-badge" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <IcoCalendar/>
            <input
              type="date"
              value={date}
              onChange={e => { userPickedDateRef.current = true; setDate(e.target.value); setPage(1); }}
              style={{ border:'none', background:'transparent', font:'inherit', color:'inherit' }}
            />
          </div>
          <select className="dept-select" value={filterDept} onChange={e=>{setFilterDept(e.target.value);setPage(1);}}>
            <option>All Departments</option>
            {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
          </select>
          <button className="btn-filter-main"><IcoFilter/> Filter</button>
        </div>
      </div>

      {loadError && (
        <div style={{ background:'#fef2f2', color:'#b91c1c', padding:'10px 16px', borderRadius:8, marginBottom:16, fontSize:13 }}>
          {loadError}
        </div>
      )}

      {/* ── Stat Cards (all live, derived from fetched attendance) ── */}
      <div className="attend-stats">
        <div className="astat-card">
          <div className="astat-icon blue"><IcoUsers/></div>
          <div><div className="astat-label">Total Staff</div><div className="astat-value">{stats.totalStaff}</div><div className="astat-sub">Marked for {formatDateLabel(date)}</div></div>
        </div>
        <div className="astat-card">
          <div className="astat-icon green"><IcoPresent/></div>
          <div><div className="astat-label">Present Today</div><div className="astat-value">{stats.present}</div><div className="astat-sub">{stats.totalStaff ? ((stats.present/stats.totalStaff)*100).toFixed(1) : '0.0'}% of total staff</div></div>
        </div>
        <div className="astat-card">
          <div className="astat-icon orange"><IcoLeave/></div>
          <div><div className="astat-label">On Leave</div><div className="astat-value">{stats.onLeave}</div><div className="astat-sub muted">{stats.totalStaff ? ((stats.onLeave/stats.totalStaff)*100).toFixed(1) : '0.0'}% of total staff</div></div>
        </div>
        <div className="astat-card">
          <div className="astat-icon red"><IcoAbsent/></div>
          <div><div className="astat-label">Absent Today</div><div className="astat-value">{stats.absent}</div><div className="astat-sub muted">{stats.totalStaff ? ((stats.absent/stats.totalStaff)*100).toFixed(1) : '0.0'}% of total staff</div></div>
        </div>
        <div className="astat-card">
          <div className="astat-icon purple"><IcoClock/></div>
          <div><div className="astat-label">Avg Working Hours</div><div className="astat-value">{minutesToHoursLabel(stats.avgMinutes)}</div><div className="astat-sub muted">Based on present staff today</div></div>
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
                {loading ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'#9ca3af'}}>Loading attendance...</td></tr>
                ) : paginated.length===0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'#9ca3af'}}>No records found.</td></tr>
                ) : paginated.map((a,idx)=>(
                  <tr key={a.staff_id}>
                    <td style={{fontWeight:600}}>{a.staffCode}</td>
                    <td>
                      <div className="staff-avatar-cell">
                        <div className="staff-avatar" style={{background:AVATAR_COLORS[idx%AVATAR_COLORS.length]}}>{initials(a.name)}</div>
                        {a.name}
                      </div>
                    </td>
                    <td>{a.dept}</td>
                    <td>{formatTime(a.check_in_time)}</td>
                    <td>{formatTime(a.check_out_time)}</td>
                    <td>{minutesToHoursLabel(workedMinutes(a.check_in_time, a.check_out_time))}</td>
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

          {/* Attendance Summary — real, derived from fetched attendance */}
          <div className="summary-card">
            <div className="summary-title">Attendance Summary ({formatDateLabel(date)})</div>
            <div className="summary-donut-wrap">
              <DonutChart segments={stats.summary.map(a=>({pct:a.count,color:a.color}))} size={100} stroke={16} centerLabel={stats.totalStaff} centerSub="Total Staff"/>
              <div className="summary-legend">
                {stats.summary.map(a=>(
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

          {/* Leave Requests — from backend */}
          <div className="leave-req-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">Leave Requests</span>
              <span className="view-all-link">View All</span>
            </div>
            {leaveError ? (
              <div style={{fontSize:11,color:'#9ca3af'}}>Leave Requests module unavailable.</div>
            ) : leaveRequests.length === 0 ? (
              <div style={{fontSize:12,color:'#9ca3af',padding:'8px 0'}}>No leave requests.</div>
            ) : leaveRequests.map((lr,i)=>(
              <div className="leave-req-item" key={lr.id ?? i}>
                <div className="lr-avatar" style={{background:AVATAR_COLORS[i%AVATAR_COLORS.length]}}>{initials(lr.name)}</div>
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

          {/* Upcoming Birthdays — from backend */}
          <div className="birthday-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">Upcoming Birthdays</span>
              <span className="view-all-link">View All</span>
            </div>
            {birthdayError ? (
              <div style={{fontSize:11,color:'#9ca3af'}}>Birthdays module unavailable.</div>
            ) : birthdays.length === 0 ? (
              <div style={{fontSize:12,color:'#9ca3af',padding:'8px 0'}}>No upcoming birthdays.</div>
            ) : birthdays.map((b,i)=>(
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

          {/* Alerts — derived from real stats + leave data */}
          <div className="alerts-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">Alerts</span>
              <span className="view-all-link">View All Alerts</span>
            </div>
            {alerts.length === 0 ? (
              <div style={{fontSize:12,color:'#9ca3af',padding:'8px 0'}}>No alerts today.</div>
            ) : alerts.map((a,i)=>(
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

        {/* Department wise present bar chart — real, derived from fetched attendance */}
        <div className="dept-bar-card">
          <div className="dept-bar-title">Department Wise Present</div>
          {stats.deptPresent.length === 0 ? (
            <div style={{color:'#9ca3af',fontSize:13,padding:'12px 0'}}>No attendance data yet.</div>
          ) : stats.deptPresent.map(d=>(
            <div className="dept-bar-item" key={d.dept}>
              <span className="dept-bar-label">{d.dept}</span>
              <div className="dept-bar-track">
                <div className="dept-bar-fill" style={{width:`${(d.present/maxDept)*100}%`}}/>
              </div>
              <span className="dept-bar-count">{d.present} ({d.total ? Math.round((d.present/d.total)*100) : 0}%)</span>
            </div>
          ))}
        </div>

        {/* Performance Overview — requires the Performance module (not attendance data) */}
        <div className="perf-card">
          <div className="perf-title">Performance Overview</div>
          {performanceError || topPerformers.length === 0 ? (
            <div style={{color:'#9ca3af',fontSize:13,padding:'12px 0'}}>Performance ratings require the Performance module.</div>
          ) : (
            <div className="perf-wrap">
              <DonutChart
                segments={topPerformers.map((p,i)=>({ pct:1, color:AVATAR_COLORS[i%AVATAR_COLORS.length] }))}
                size={100} stroke={16} centerLabel={stats.totalStaff} centerSub="Total Staff"
              />
            </div>
          )}
        </div>

        {/* Top Performers — from backend */}
        <div className="top-perf-card">
          <div className="top-perf-title"><IcoStar/> Top Performers</div>
          {performanceError ? (
            <div style={{fontSize:12,color:'#9ca3af',padding:'8px 0'}}>Performance module unavailable.</div>
          ) : topPerformers.length === 0 ? (
            <div style={{fontSize:12,color:'#9ca3af',padding:'8px 0'}}>No performance data yet.</div>
          ) : topPerformers.map((tp,i)=>(
            <div className="top-perf-item" key={tp.id ?? i}>
              <div className={`tp-rank ${i===0?'gold':i===1?'silver':'bronze'}`}>{i+1}</div>
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
                <div className="form-group"><label className="form-label">Check-in Time</label><input className="form-input" type="time" name="check_in_time" value={form.check_in_time} onChange={handleFormChange}/></div>
                <div className="form-group"><label className="form-label">Check-out Time</label><input className="form-input" type="time" name="check_out_time" value={form.check_out_time} onChange={handleFormChange}/></div>
                <div className="form-group full">
                  <label className="form-label">Status</label>
                  <select className="form-select" name="status" value={form.status} onChange={handleFormChange}>
                    <option>Present</option><option>Absent</option><option>On Leave</option><option>Half Day</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={()=>setShowEdit(false)} disabled={submitting}>Cancel</button>
              <button className="btn-save" onClick={handleEdit} disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showView && selected && (
        <div className="modal-overlay" onClick={()=>setShowView(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>Attendance Details — {selected.staffCode}</h3><button className="modal-close" onClick={()=>setShowView(false)}>×</button></div>
            <div className="modal-body">
              {[
                ['Staff ID',selected.staffCode],
                ['Name',selected.name],
                ['Department',selected.dept],
                ['Check-in',formatTime(selected.check_in_time)],
                ['Check-out',formatTime(selected.check_out_time)],
                ['Working Hours',minutesToHoursLabel(workedMinutes(selected.check_in_time, selected.check_out_time))],
                ['Status',selected.status],
              ].map(([k,v])=>(
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