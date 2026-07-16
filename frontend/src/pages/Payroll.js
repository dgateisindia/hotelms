// ============================================================
//  Payroll.js — Payroll Management Page (logic + JSX only)
//  Columns: Payroll ID, Employee, Department, Basic Salary,
//           Allowances, Deductions, Net Pay, Pay Date,
//           Status, Action
//  Icons  → ../../utils/icons/PayrollIcons.js
//  Styles → ../../styles/Payroll.css
// ============================================================

import React, { useState } from 'react';
import '../styles/Payroll.css';
import {
  IcoCalendar, IcoFilter, IcoExport, IcoPlus, IcoSearch,
  IcoEye, IcoDownload, IcoChevL, IcoChevR,
  IcoEmployees, IcoPayroll, IcoDeduction, IcoNetPay, IcoPending,
} from '../utils/icons/PayrollIcons';

// ── Constants ─────────────────────────────────────────────────
const AVATAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1','#ec4899','#14b8a6'];
const DEPARTMENTS   = ['Front Office','Housekeeping','Maintenance','Accounting','Security','Food & Beverage'];
const initials      = (name) => name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

// ── Sample Data ───────────────────────────────────────────────
const INITIAL_PAYROLL = [
  { id:'PAY001', name:'Rahul Sharma',   dept:'Front Office',   basic:35000, allowances:5000, deductions:4500, netPay:35500, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY002', name:'Priya Patel',    dept:'Housekeeping',   basic:25000, allowances:3000, deductions:3000, netPay:25000, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY003', name:'Amit Verma',     dept:'Maintenance',    basic:22000, allowances:2500, deductions:2200, netPay:22300, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY004', name:'Neha Singh',     dept:'Accounting',     basic:30000, allowances:4000, deductions:3800, netPay:30200, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY005', name:'Sandeep Rao',    dept:'Front Office',   basic:28000, allowances:3500, deductions:2800, netPay:28700, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY006', name:'Vikram Joshi',   dept:'Housekeeping',   basic:20000, allowances:2500, deductions:2000, netPay:20500, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY007', name:'Pooja Mehta',    dept:'Food & Beverage',basic:18000, allowances:2000, deductions:1800, netPay:18200, payDate:'31 May 2024', status:'Pending' },
  { id:'PAY008', name:'Karan Malhotra', dept:'Security',       basic:22000, allowances:2500, deductions:2100, netPay:22400, payDate:'31 May 2024', status:'Pending' },
  { id:'PAY009', name:'Anjali Gupta',   dept:'Front Office',   basic:17000, allowances:1500, deductions:1700, netPay:16800, payDate:'31 May 2024', status:'Pending' },
  { id:'PAY010', name:'Rohit Kumar',    dept:'Maintenance',    basic:21000, allowances:2500, deductions:1900, netPay:21600, payDate:'31 May 2024', status:'Pending' },
  { id:'PAY011', name:'Sunita Devi',    dept:'Housekeeping',   basic:16000, allowances:1800, deductions:1600, netPay:16200, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY012', name:'Ravi Shankar',   dept:'Security',       basic:19000, allowances:2000, deductions:1900, netPay:19100, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY013', name:'Meera Kapoor',   dept:'Accounting',     basic:32000, allowances:4200, deductions:3200, netPay:33000, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY014', name:'Deepak Shah',    dept:'Food & Beverage',basic:17500, allowances:1900, deductions:1750, netPay:17650, payDate:'31 May 2024', status:'Pending' },
  { id:'PAY015', name:'Kavitha Nair',   dept:'Front Office',   basic:26000, allowances:3000, deductions:2600, netPay:26400, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY016', name:'Arjun Menon',    dept:'Maintenance',    basic:23000, allowances:2700, deductions:2300, netPay:23400, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY017', name:'Divya Reddy',    dept:'Housekeeping',   basic:15000, allowances:1600, deductions:1500, netPay:15100, payDate:'31 May 2024', status:'Pending' },
  { id:'PAY018', name:'Suresh Babu',    dept:'Security',       basic:20000, allowances:2200, deductions:2000, netPay:20200, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY019', name:'Lalitha Rao',    dept:'Accounting',     basic:29000, allowances:3500, deductions:2900, netPay:29600, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY020', name:'Prakash Kumar',  dept:'Food & Beverage',basic:16000, allowances:1700, deductions:1600, netPay:16100, payDate:'31 May 2024', status:'Pending' },
  { id:'PAY021', name:'Nandita Roy',    dept:'Front Office',   basic:27000, allowances:3200, deductions:2700, netPay:27500, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY022', name:'Ganesh Pillai',  dept:'Maintenance',    basic:21500, allowances:2400, deductions:2150, netPay:21750, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY023', name:'Rekha Iyer',     dept:'Housekeeping',   basic:15500, allowances:1650, deductions:1550, netPay:15600, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY024', name:'Mohan Das',      dept:'Security',       basic:19500, allowances:2100, deductions:1950, netPay:19650, payDate:'31 May 2024', status:'Pending' },
  { id:'PAY025', name:'Sarita Mishra',  dept:'Accounting',     basic:31000, allowances:3800, deductions:3100, netPay:31700, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY026', name:'Tejpal Singh',   dept:'Food & Beverage',basic:17000, allowances:1800, deductions:1700, netPay:17100, payDate:'31 May 2024', status:'Paid'    },
  { id:'PAY027', name:'Uma Devi',       dept:'Housekeeping',   basic:14500, allowances:1500, deductions:1450, netPay:14550, payDate:'31 May 2024', status:'Pending' },
  { id:'PAY028', name:'Venkat Rao',     dept:'Maintenance',    basic:22500, allowances:2600, deductions:2250, netPay:22850, payDate:'31 May 2024', status:'Paid'    },
];

const PER_PAGE = 10;
const fmt = (n) => `₹ ${n.toLocaleString('en-IN')}`;

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Payroll() {
  const [search, setSearch]         = useState('');
  const [filterDept, setFilterDept] = useState('All Departments');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [page, setPage]             = useState(1);
  const [showSlip, setShowSlip]     = useState(false);
  const [selected, setSelected]     = useState(null);

  // ── Filter ──
  const filtered = INITIAL_PAYROLL.filter(p => {
    const ms  = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
    const md  = filterDept   === 'All Departments' || p.dept   === filterDept;
    const mst = filterStatus === 'All Status'       || p.status === filterStatus;
    return ms && md && mst;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  // ── Stats ──
  const totalPayroll   = INITIAL_PAYROLL.reduce((s,p)=>s+p.basic+p.allowances,0);
  const totalDeduct    = INITIAL_PAYROLL.reduce((s,p)=>s+p.deductions,0);
  const netPayroll     = INITIAL_PAYROLL.reduce((s,p)=>s+p.netPay,0);
  const pendingCount   = INITIAL_PAYROLL.filter(p=>p.status==='Pending').length;
  const pendingAmount  = INITIAL_PAYROLL.filter(p=>p.status==='Pending').reduce((s,p)=>s+p.netPay,0);

  // ── Handlers ──
  const openSlip = (p) => { setSelected(p); setShowSlip(true); };

  const handleExport = () => {
    const headers = ['Payroll ID','Employee','Department','Basic Salary','Allowances','Deductions','Net Pay','Pay Date','Status'];
    const rows = filtered.map(p=>[p.id,p.name,p.dept,p.basic,p.allowances,p.deductions,p.netPay,p.payDate,p.status]);
    const csv  = [headers,...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download=`payroll-${new Date().toISOString().slice(0,10)}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  const handleProcess = () => {
    alert(`Processing payroll for ${pendingCount} pending employees totaling ${fmt(pendingAmount)}.`);
  };

  // ── Payslip modal ──
  const PayslipModal = () => {
    const p = selected;
    const tax     = Math.round(p.basic * 0.08);
    const pf      = Math.round(p.basic * 0.04);
    const gross   = p.basic + p.allowances;

    const handleDownload = () => {
      const content = document.getElementById('payslip-content').innerHTML;
      const win = window.open('','_blank','width=700,height=800');
      win.document.write(`<html><head><title>Payslip ${p.id}</title>
        <style>body{font-family:Arial,sans-serif;padding:32px;max-width:600px;margin:0 auto;color:#1a1f36;}.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f4f9;font-size:13px;}.key{color:#6b7280;}.val{font-weight:600;}.total{background:#f0fdf4;padding:12px;border-radius:8px;display:flex;justify-content:space-between;font-size:15px;font-weight:800;margin-top:12px;}.hdr{background:#0d1b4b;color:#fff;padding:16px;border-radius:8px;margin-bottom:16px;}.title{font-size:12px;font-weight:700;color:#1a2a5e;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 6px;}</style>
        </head><body>${content}</body></html>`);
      win.document.close();
      setTimeout(()=>{win.print();win.close();},400);
    };

    return (
      <div className="modal-overlay" onClick={()=>setShowSlip(false)}>
        <div className="modal-box" onClick={e=>e.stopPropagation()}>
          <div className="modal-header">
            <h3>Payslip — {p.id}</h3>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',background:'#1a2a5e',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',color:'#fff',fontFamily:'Inter,sans-serif'}} onClick={handleDownload}>
                <IcoDownload/> Download
              </button>
              <button className="modal-close" onClick={()=>setShowSlip(false)}>×</button>
            </div>
          </div>
          <div className="modal-body" id="payslip-content">
            {/* Header */}
            <div className="slip-header">
              <div>
                <div className="slip-hotel">Royal Palace Hotel &amp; Resort</div>
                <div className="slip-period">Pay Period: May 2024</div>
              </div>
              <div className="slip-id">{p.id}</div>
            </div>

            {/* Employee info */}
            <div className="slip-emp-row">
              <div className="slip-emp-avatar" style={{background:AVATAR_COLORS[INITIAL_PAYROLL.indexOf(p)%AVATAR_COLORS.length]}}>{initials(p.name)}</div>
              <div>
                <div className="slip-emp-name">{p.name}</div>
                <div className="slip-emp-dept">{p.dept}</div>
              </div>
            </div>

            {/* Earnings */}
            <div className="slip-section-title">Earnings</div>
            {[['Basic Salary',fmt(p.basic)],['Allowances',fmt(p.allowances)],['Gross Pay',fmt(gross)]].map(([k,v])=>(
              <div className="slip-row" key={k}><span className="slip-key">{k}</span><span className="slip-val">{v}</span></div>
            ))}

            {/* Deductions */}
            <div className="slip-section-title">Deductions</div>
            {[['Income Tax',fmt(tax)],['Provident Fund (PF)',fmt(pf)],['Other Deductions',fmt(p.deductions-tax-pf>0?p.deductions-tax-pf:0)],['Total Deductions',fmt(p.deductions)]].map(([k,v])=>(
              <div className="slip-row" key={k}><span className="slip-key">{k}</span><span className={`slip-val ${k==='Total Deductions'?'red':''}`}>{v}</span></div>
            ))}

            {/* Net */}
            <div className="slip-total"><span>Net Pay</span><span style={{color:'#10b981'}}>{fmt(p.netPay)}</span></div>

            {/* Meta */}
            <div className="slip-section-title" style={{marginTop:14}}>Payment Info</div>
            {[['Pay Date',p.payDate],['Payment Status',p.status],['Payment Method','Bank Transfer']].map(([k,v])=>(
              <div className="slip-row" key={k}><span className="slip-key">{k}</span><span className={`slip-val ${v==='Paid'?'green':v==='Pending'?'':''}`}>{v}</span></div>
            ))}
          </div>
          <div className="modal-footer">
            <button className="btn-modal-outline" onClick={()=>setShowSlip(false)}>Close</button>
            <button className="btn-modal-close" onClick={handleDownload}><IcoDownload/> Download Payslip</button>
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
      {/* ── Top Filter Bar ── */}
      <div className="payroll-topbar">
        <button className="payroll-date-btn"><IcoCalendar/> 01 May 2024 – 31 May 2024 ▾</button>

        <select className="payroll-select" value={filterDept} onChange={e=>{setFilterDept(e.target.value);setPage(1);}}>
          <option>All Departments</option>
          {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
        </select>

        <select className="payroll-select" value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setPage(1);}}>
          <option>All Status</option>
          <option>Paid</option>
          <option>Pending</option>
          <option>Failed</option>
        </select>

        <div className="payroll-search-wrap">
          <IcoSearch/>
          <input className="payroll-search-input" placeholder="Search by employee name or ID..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
        </div>
        <button className="btn-export-payroll" onClick={handleExport}><IcoExport/> Export</button>
        <button className="btn-process-payroll" onClick={handleProcess}><IcoPlus/> Process Payroll</button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="payroll-stats">
        <div className="payroll-stat-card">
          <div className="payroll-stat-icon blue"><IcoEmployees/></div>
          <div>
            <div className="payroll-stat-label">Total Employees</div>
            <div className="payroll-stat-value">{INITIAL_PAYROLL.length}</div>
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
            <div className="payroll-stat-sub">{pendingCount} Employees</div>
          </div>
        </div>
      </div>

      {/* ── Payroll Table ── */}
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
              <th>Pay Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={10} style={{textAlign:'center',padding:40,color:'#9ca3af'}}>No payroll records found.</td></tr>
            ) : paginated.map((p, idx) => {
              const colorIdx = INITIAL_PAYROLL.indexOf(p) % AVATAR_COLORS.length;
              return (
                <tr key={p.id}>
                  <td style={{fontWeight:600,color:'#6b7280'}}>{p.id}</td>
                  <td>
                    <div className="emp-cell">
                      <div className="emp-avatar" style={{background:AVATAR_COLORS[colorIdx]}}>{initials(p.name)}</div>
                      <span className="emp-name">{p.name}</span>
                    </div>
                  </td>
                  <td>{p.dept}</td>
                  <td className="amt-normal">{fmt(p.basic)}</td>
                  <td className="amt-normal">{fmt(p.allowances)}</td>
                  <td className="amt-deduct">{fmt(p.deductions)}</td>
                  <td className="amt-net">{fmt(p.netPay)}</td>
                  <td style={{color:'#6b7280'}}>{p.payDate}</td>
                  <td>
                    <span className={p.status==='Paid'?'badge-paid':p.status==='Pending'?'badge-pending':'badge-failed'}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <div className="payroll-actions">
                      <button className="payroll-act-btn view"     title="View Payslip" onClick={()=>openSlip(p)}><IcoEye/></button>
                      <button className="payroll-act-btn download" title="Download"     onClick={()=>openSlip(p)}><IcoDownload/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="payroll-pagination">
          <span className="pagination-info">
            Showing {filtered.length===0?0:(page-1)*PER_PAGE+1} to {Math.min(page*PER_PAGE,filtered.length)} of {filtered.length} entries
          </span>
          <div className="pagination-btns">
            <button className="pg-btn" onClick={()=>setPage(p=>p-1)} disabled={page===1}><IcoChevL/></button>
            {Array.from({length:totalPages},(_,i)=>i+1).map(n=>(
              <button key={n} className={`pg-btn ${page===n?'active':''}`} onClick={()=>setPage(n)}>{n}</button>
            ))}
            <button className="pg-btn" onClick={()=>setPage(p=>p+1)} disabled={page===totalPages||totalPages===0}><IcoChevR/></button>
          </div>
        </div>
      </div>

      {/* Payslip Modal */}
      {showSlip && selected && <PayslipModal/>}
    </>
  );
}

export default Payroll;