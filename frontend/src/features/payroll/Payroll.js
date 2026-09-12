// ============================================================
//  Staff/Payroll.js — Payroll Management Page (backend-connected)
//  Columns: Payroll ID, Employee, Department, Basic Salary,
//           Allowances, Deductions, Net Pay, Pay Date,
//           Status, Action
//  Icons  → ../../utils/icons/PayrollIcons.js   (one level deeper
//           than before, now that this file lives in Staff/)
//  Styles → ../../styles/Payroll.css
//  API    → /api/payroll  (see payrollRoutes.js / payrollController.js)
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient, { getApiErrorMessage } from '../../shared/api/apiClient';
import './Payroll.css';
import {
  IcoCalendar, IcoExport, IcoPlus, IcoSearch,
  IcoEye, IcoDownload, IcoChevL, IcoChevR,
  IcoEmployees, IcoPayroll, IcoDeduction, IcoNetPay, IcoPending,
} from '../../utils/icons/PayrollIcons';

// ── Constants ─────────────────────────────────────────────────
const AVATAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1','#ec4899','#14b8a6'];
const DEPARTMENTS   = ['Front Office','Housekeeping','Maintenance','Accounting','Security','Food & Beverage'];
const PER_PAGE = 8;

const initials = (name='') => name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
const fmt = (n) => `₹ ${Number(n||0).toLocaleString('en-IN')}`;
const monthYearValue = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
const monthYearLabel = (d) => d.toLocaleString('en-US', { month:'long', year:'numeric' });
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth()+n, 1);

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Payroll() {
  // ── Period (month/year) — lazy init so a fresh page load always
  //    starts on the real current month, same pattern used in
  //    Attendance.js / Billing.js for date handling. ──
  const [periodDate, setPeriodDate] = useState(() => new Date());
  const userPickedPeriodRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (userPickedPeriodRef.current) return;
      const now = new Date();
      setPeriodDate(prev => (monthYearValue(prev) === monthYearValue(now) ? prev : now));
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const monthYear = monthYearValue(periodDate);
  const monthLabel = monthYearLabel(periodDate);

  // ── Data ──
  const [payrollRows, setPayrollRows] = useState([]);
  const [activeStaffCount, setActiveStaffCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Filters ──
  const [search, setSearch]             = useState('');
  const [filterDept, setFilterDept]     = useState('All Departments');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [page, setPage]                 = useState(1);

  // ── Modals ──
  const [showSlip, setShowSlip]       = useState(false);
  const [selected, setSelected]       = useState(null);
  const [editMode, setEditMode]       = useState(false);
  const [editDraft, setEditDraft]     = useState({ basic_salary: 0, bonus: 0, deductions: 0 });
  const [processing, setProcessing]   = useState(false);

  // ── Fetch payroll rows for the current period + filters ──
  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month_year: monthYear });
      if (filterDept !== 'All Departments') params.set('department', filterDept);
      if (filterStatus !== 'All Status') params.set('status', filterStatus);
      if (search) params.set('search', search);

      const res = await apiClient.get('/payroll', { params: Object.fromEntries(params.entries()) });
      setPayrollRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err));
      setPayrollRows([]);
    } finally {
      setLoading(false);
    }
  }, [monthYear, filterDept, filterStatus, search]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  // Active staff count for the "Total Employees" stat — independent of
  // whether payroll has been generated yet for everyone this period.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiClient.get('/staff', { params: { status: 'Active' } });
        if (!cancelled) setActiveStaffCount(Array.isArray(res.data) ? res.data.length : null);
      } catch (err) {
        console.error(err);
        if (!cancelled) setActiveStaffCount(null);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Pagination ──
  useEffect(() => { setPage(1); }, [filterDept, filterStatus, search, monthYear]);
  const totalPages = Math.max(1, Math.ceil(payrollRows.length / PER_PAGE));
  const paginated  = payrollRows.slice((page-1)*PER_PAGE, page*PER_PAGE);

  // ── Stats (derived from the fetched rows for this period) ──
  const totalPayroll  = payrollRows.reduce((s,p)=>s+Number(p.basic_salary)+Number(p.bonus),0);
  const totalDeduct   = payrollRows.reduce((s,p)=>s+Number(p.deductions),0);
  const netPayroll    = payrollRows.reduce((s,p)=>s+Number(p.net_salary),0);
  const pending       = payrollRows.filter(p=>p.payment_status==='pending');
  const pendingAmount = pending.reduce((s,p)=>s+Number(p.net_salary),0);

  // ── Period navigation ──
  const goToMonth = (delta) => {
    userPickedPeriodRef.current = true;
    setPeriodDate(prev => addMonths(prev, delta));
  };
  const useCurrentPeriod = () => {
    userPickedPeriodRef.current = false;
    setPeriodDate(new Date());
  };

  // ── Process Payroll (bulk-generate for this period) ──
  const handleProcess = async () => {
    setProcessing(true);
    try {
      const { data } = await apiClient.post('/payroll/generate', { month_year: monthYear });
      if (data.generated > 0) {
        await fetchPayroll();
      }
      alert(data.generated > 0
        ? `Generated payroll for ${data.generated} employee(s) for ${monthLabel}.`
        : (data.message || 'Nothing to generate.'));
    } catch (err) {
      console.error(err);
      alert(getApiErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  // ── Export CSV (client-side, same as before, now over live data) ──
  const handleExport = () => {
    const headers = ['Payroll ID','Employee','Department','Basic Salary','Allowances','Deductions','Net Pay','Period','Status'];
    const rows = payrollRows.map(p=>[
      p.payroll_id, p.employee_name, p.department, p.basic_salary,
      p.bonus, p.deductions, p.net_salary, p.month_year, p.payment_status,
    ]);
    const csv  = [headers,...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `payroll-${monthYear.replace(' ','-')}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  // ── Payslip / edit modal ──
  const openSlip = (p) => {
    setSelected(p);
    setEditMode(false);
    setEditDraft({ basic_salary: p.basic_salary, bonus: p.bonus, deductions: p.deductions });
    setShowSlip(true);
  };

  const saveEdit = async () => {
    try {
      const { data } = await apiClient.put(`/payroll/${selected.payroll_id}`, editDraft);
      setSelected(prev => ({ ...prev, ...data }));
      setEditMode(false);
      fetchPayroll();
    } catch (err) {
      alert(getApiErrorMessage(err));
    }
  };

  const markPaid = async (p) => {
    try {
      await apiClient.put(`/payroll/${p.payroll_id}`, { payment_status: 'paid' });
      fetchPayroll();
    } catch (err) {
      alert(getApiErrorMessage(err));
    }
  };

  const PayslipModal = () => {
    const p = selected;
    const tax   = Math.round(p.basic_salary * 0.08);
    const pf    = Math.round(p.basic_salary * 0.04);
    const gross = Number(p.basic_salary) + Number(p.bonus);
    const other = Math.max(Number(p.deductions) - tax - pf, 0);

    const handleDownload = () => {
      const content = document.getElementById('payslip-content').innerHTML;
      const win = window.open('','_blank','width=700,height=800');
      win.document.write(`<html><head><title>Payslip ${p.payroll_id}</title>
        <style>body{font-family:Arial,sans-serif;padding:32px;max-width:600px;margin:0 auto;color:#1a1f36;}.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f4f9;font-size:13px;}.key{color:#6b7280;}.val{font-weight:600;}.total{background:#f0fdf4;padding:12px;border-radius:8px;display:flex;justify-content:space-between;font-size:15px;font-weight:800;margin-top:12px;}.hdr{background:#0d1b4b;color:#fff;padding:16px;border-radius:8px;margin-bottom:16px;}.title{font-size:12px;font-weight:700;color:#1a2a5e;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 6px;}</style>
        </head><body>${content}</body></html>`);
      win.document.close();
      setTimeout(()=>{win.print();win.close();},400);
    };

    return (
      <div className="modal-overlay" onClick={()=>setShowSlip(false)}>
        <div className="modal-box" onClick={e=>e.stopPropagation()}>
          <div className="modal-header">
            <h3>Payslip — PAY{String(p.payroll_id).padStart(3,'0')}</h3>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {!editMode && p.payment_status==='pending' && (
                <button
                  style={{padding:'7px 14px',background:'#f3f4f6',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',color:'#1a2a5e',fontFamily:'Inter,sans-serif'}}
                  onClick={()=>setEditMode(true)}
                >
                  Edit
                </button>
              )}
              <button style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',background:'#1a2a5e',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',color:'#fff',fontFamily:'Inter,sans-serif'}} onClick={handleDownload}>
                <IcoDownload/> Download
              </button>
              <button className="modal-close" onClick={()=>setShowSlip(false)}>×</button>
            </div>
          </div>

          <div className="modal-body" id="payslip-content">
            <div className="slip-header">
              <div>
                <div className="slip-hotel">Royal Palace Hotel &amp; Resort</div>
                <div className="slip-period">Pay Period: {p.month_year}</div>
              </div>
              <div className="slip-id">PAY{String(p.payroll_id).padStart(3,'0')}</div>
            </div>

            <div className="slip-emp-row">
              <div className="slip-emp-avatar" style={{background:AVATAR_COLORS[p.staff_id % AVATAR_COLORS.length]}}>{initials(p.employee_name)}</div>
              <div>
                <div className="slip-emp-name">{p.employee_name}</div>
                <div className="slip-emp-dept">{p.department}</div>
              </div>
            </div>

            {editMode ? (
              <>
                <div className="slip-section-title">Edit This Period</div>
                <div className="slip-row"><span className="slip-key">Basic Salary</span>
                  <input type="number" value={editDraft.basic_salary}
                    onChange={e=>setEditDraft(d=>({...d, basic_salary: e.target.value}))}
                    style={{width:120,textAlign:'right'}} />
                </div>
                <div className="slip-row"><span className="slip-key">Bonus / Allowances</span>
                  <input type="number" value={editDraft.bonus}
                    onChange={e=>setEditDraft(d=>({...d, bonus: e.target.value}))}
                    style={{width:120,textAlign:'right'}} />
                </div>
                <div className="slip-row"><span className="slip-key">Deductions</span>
                  <input type="number" value={editDraft.deductions}
                    onChange={e=>setEditDraft(d=>({...d, deductions: e.target.value}))}
                    style={{width:120,textAlign:'right'}} />
                </div>
              </>
            ) : (
              <>
                <div className="slip-section-title">Earnings</div>
                {[['Basic Salary',fmt(p.basic_salary)],['Allowances',fmt(p.bonus)],['Gross Pay',fmt(gross)]].map(([k,v])=>(
                  <div className="slip-row" key={k}><span className="slip-key">{k}</span><span className="slip-val">{v}</span></div>
                ))}

                <div className="slip-section-title">Deductions</div>
                {[['Income Tax',fmt(tax)],['Provident Fund (PF)',fmt(pf)],['Other Deductions',fmt(other)],['Total Deductions',fmt(p.deductions)]].map(([k,v])=>(
                  <div className="slip-row" key={k}><span className="slip-key">{k}</span><span className={`slip-val ${k==='Total Deductions'?'red':''}`}>{v}</span></div>
                ))}

                <div className="slip-total"><span>Net Pay</span><span style={{color:'#10b981'}}>{fmt(p.net_salary)}</span></div>

                <div className="slip-section-title" style={{marginTop:14}}>Payment Info</div>
                {[['Pay Period',p.month_year],['Payment Status', p.payment_status==='paid'?'Paid':'Pending'],['Payment Method','Bank Transfer']].map(([k,v])=>(
                  <div className="slip-row" key={k}><span className="slip-key">{k}</span><span className={`slip-val ${v==='Paid'?'green':''}`}>{v}</span></div>
                ))}
              </>
            )}
          </div>

          <div className="modal-footer">
            {editMode ? (
              <>
                <button className="btn-modal-outline" onClick={()=>setEditMode(false)}>Cancel</button>
                <button className="btn-modal-close" onClick={saveEdit}>Save Changes</button>
              </>
            ) : (
              <>
                <button className="btn-modal-outline" onClick={()=>setShowSlip(false)}>Close</button>
                {p.payment_status==='pending' && (
                  <button className="btn-modal-close" onClick={()=>{ markPaid(p); setShowSlip(false); }}>Mark as Paid</button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <>
      <div className="payroll-topbar">
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <button className="pg-btn" onClick={()=>goToMonth(-1)}><IcoChevL/></button>
          <button className="payroll-date-btn"><IcoCalendar/> {monthLabel}</button>
          <button className="pg-btn" onClick={()=>goToMonth(1)}><IcoChevR/></button>
          {userPickedPeriodRef.current && (
            <button className="payroll-date-btn" onClick={useCurrentPeriod} style={{fontSize:12}}>
              Use current month
            </button>
          )}
        </div>

        <select className="payroll-select" value={filterDept} onChange={e=>setFilterDept(e.target.value)}>
          <option>All Departments</option>
          {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
        </select>

        <select className="payroll-select" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option>All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>

        <div className="payroll-search-wrap">
          <IcoSearch/>
          <input className="payroll-search-input" placeholder="Search by employee name or ID..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <button className="btn-export-payroll" onClick={handleExport} disabled={payrollRows.length===0}><IcoExport/> Export</button>
        <button className="btn-process-payroll" onClick={handleProcess} disabled={processing}>
          <IcoPlus/> {processing ? 'Processing…' : 'Process Payroll'}
        </button>
      </div>

      {error && <div style={{color:'#dc2626',padding:'8px 4px'}}>{error}</div>}

      <div className="payroll-stats">
        <div className="payroll-stat-card">
          <div className="payroll-stat-icon blue"><IcoEmployees/></div>
          <div>
            <div className="payroll-stat-label">Total Employees</div>
            <div className="payroll-stat-value">{activeStaffCount ?? payrollRows.length}</div>
            <div className="payroll-stat-sub">All Departments</div>
          </div>
        </div>
        <div className="payroll-stat-card">
          <div className="payroll-stat-icon green"><IcoPayroll/></div>
          <div>
            <div className="payroll-stat-label">Total Payroll</div>
            <div className="payroll-stat-value" style={{fontSize:15}}>₹ {(totalPayroll/100000).toFixed(2)}L</div>
            <div className="payroll-stat-sub">This Period</div>
          </div>
        </div>
        <div className="payroll-stat-card">
          <div className="payroll-stat-icon orange"><IcoDeduction/></div>
          <div>
            <div className="payroll-stat-label">Total Deductions</div>
            <div className="payroll-stat-value" style={{fontSize:15}}>₹ {(totalDeduct/100000).toFixed(2)}L</div>
            <div className="payroll-stat-sub">This Period</div>
          </div>
        </div>
        <div className="payroll-stat-card">
          <div className="payroll-stat-icon purple"><IcoNetPay/></div>
          <div>
            <div className="payroll-stat-label">Net Payroll</div>
            <div className="payroll-stat-value" style={{fontSize:15}}>₹ {(netPayroll/100000).toFixed(2)}L</div>
            <div className="payroll-stat-sub">This Period</div>
          </div>
        </div>
        <div className="payroll-stat-card">
          <div className="payroll-stat-icon red"><IcoPending/></div>
          <div>
            <div className="payroll-stat-label">Pending Payments</div>
            <div className="payroll-stat-value" style={{fontSize:15}}>₹ {(pendingAmount/100000).toFixed(2)}L</div>
            <div className="payroll-stat-sub">{pending.length} Employees</div>
          </div>
        </div>
      </div>

      <div className="payroll-card">
        <table className="payroll-table">
          <thead>
            <tr>
              <th>Payroll ID</th>
              <th>Employee</th>
              <th>Department</th>
              <th>Basic Salary</th>
              <th>Allowances</th>
              <th>Deductions</th>
              <th>Net Pay</th>
              <th>Pay Period</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{textAlign:'center',padding:40,color:'#9ca3af'}}>Loading payroll…</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={10} style={{textAlign:'center',padding:40,color:'#9ca3af'}}>
                No payroll records for {monthLabel}. Click "Process Payroll" to generate them.
              </td></tr>
            ) : paginated.map((p) => (
              <tr key={p.payroll_id}>
                <td style={{fontWeight:600,color:'#6b7280'}}>PAY{String(p.payroll_id).padStart(3,'0')}</td>
                <td>
                  <div className="emp-cell">
                    <div className="emp-avatar" style={{background:AVATAR_COLORS[p.staff_id % AVATAR_COLORS.length]}}>{initials(p.employee_name)}</div>
                    <span className="emp-name">{p.employee_name}</span>
                  </div>
                </td>
                <td>{p.department}</td>
                <td className="amt-normal">{fmt(p.basic_salary)}</td>
                <td className="amt-normal">{fmt(p.bonus)}</td>
                <td className="amt-deduct">{fmt(p.deductions)}</td>
                <td className="amt-net">{fmt(p.net_salary)}</td>
                <td style={{color:'#6b7280'}}>{p.month_year}</td>
                <td>
                  <span className={p.payment_status==='paid' ? 'badge-paid' : 'badge-pending'}>
                    {p.payment_status==='paid' ? 'Paid' : 'Pending'}
                  </span>
                </td>
                <td>
                  <div className="payroll-actions">
                    <button className="payroll-act-btn view" title="View Payslip" onClick={()=>openSlip(p)}><IcoEye/></button>
                    <button className="payroll-act-btn download" title="Download" onClick={()=>openSlip(p)}><IcoDownload/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="payroll-pagination">
          <span className="pagination-info">
            Showing {payrollRows.length===0?0:(page-1)*PER_PAGE+1} to {Math.min(page*PER_PAGE,payrollRows.length)} of {payrollRows.length} entries
          </span>
          <div className="pagination-btns">
            <button className="pg-btn" onClick={()=>setPage(p=>p-1)} disabled={page===1}><IcoChevL/></button>
            {Array.from({length:totalPages},(_,i)=>i+1).map(n=>(
              <button key={n} className={`pg-btn ${page===n?'active':''}`} onClick={()=>setPage(n)}>{n}</button>
            ))}
            <button className="pg-btn" onClick={()=>setPage(p=>p+1)} disabled={page===totalPages}><IcoChevR/></button>
          </div>
        </div>
      </div>

      {showSlip && selected && PayslipModal()}
    </>
  );
}

export default Payroll;