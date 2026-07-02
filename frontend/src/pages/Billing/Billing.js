// ============================================================
//  Billing.js — Billing & Invoice Management (logic + JSX only)
//  - Full width invoice table
//  - Invoice appears ONLY when Print icon clicked
//  - Invoice modal has Print + Download PDF options
//  Icons  → ../../utils/icons/BillingIcons.js
//  Styles → ../../styles/Billing.css
// ============================================================

import React, { useState } from 'react';
import '../../styles/Billing.css';
import {
  IcoPlus, IcoSearch, IcoFilter, IcoEye, IcoEdit,
  IcoDownload, IcoChevL, IcoChevR, IcoBill, IcoRevenue,
  IcoPaid, IcoOutstand, IcoPrint, IcoCalendar,
} from '../../utils/icons/Billingicons';

// ── Constants ─────────────────────────────────────────────────
const AVATAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1'];
const initials = (name) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

// ── Sample Data ───────────────────────────────────────────────
const INITIAL_INVOICES = [
  { id:'INV-1250', bookingId:'BK-1250', guest:'John Doe',      room:'101', checkIn:'20 May 2024', checkOut:'22 May 2024', nights:2, amount:14000, paid:14000, due:0,    status:'Paid',    method:'Card', items:[{desc:'Room Charges (Deluxe Room)',qty:2,rate:4000,amount:8000},{desc:'Room Service',qty:1,rate:1200,amount:1200},{desc:'Food & Beverages',qty:1,rate:1800,amount:1800},{desc:'Laundry',qty:1,rate:500,amount:500},{desc:'Taxes (GST 12%)',qty:1,rate:2500,amount:2500}] },
  { id:'INV-1249', bookingId:'BK-1249', guest:'Emily Smith',   room:'205', checkIn:'20 May 2024', checkOut:'23 May 2024', nights:3, amount:15000, paid:10000, due:5000,  status:'Partial', method:'Cash', items:[{desc:'Room Charges (Suite)',qty:3,rate:3500,amount:10500},{desc:'Beverages',qty:1,rate:800,amount:800},{desc:'Taxes (GST 12%)',qty:1,rate:1344,amount:1344}] },
  { id:'INV-1248', bookingId:'BK-1248', guest:'Michael Brown', room:'302', checkIn:'20 May 2024', checkOut:'24 May 2024', nights:4, amount:18000, paid:18000, due:0,    status:'Paid',    method:'UPI',  items:[{desc:'Room Charges (Standard)',qty:4,rate:3000,amount:12000},{desc:'Room Service',qty:2,rate:1200,amount:2400},{desc:'Taxes (GST 12%)',qty:1,rate:1728,amount:1728}] },
  { id:'INV-1247', bookingId:'BK-1247', guest:'Sarah Wilson',  room:'103', checkIn:'20 May 2024', checkOut:'21 May 2024', nights:1, amount:8000,  paid:0,     due:8000,  status:'Unpaid',  method:'',     items:[{desc:'Room Charges (Deluxe)',qty:1,rate:6000,amount:6000},{desc:'Taxes (GST 12%)',qty:1,rate:720,amount:720}] },
  { id:'INV-1246', bookingId:'BK-1246', guest:'David Lee',     room:'401', checkIn:'21 May 2024', checkOut:'24 May 2024', nights:3, amount:16000, paid:16000, due:0,    status:'Paid',    method:'Card', items:[{desc:'Room Charges (Suite)',qty:3,rate:4500,amount:13500},{desc:'Food & Beverages',qty:1,rate:1024,amount:1024}] },
  { id:'INV-1245', bookingId:'BK-1245', guest:'Priya Sharma',  room:'204', checkIn:'21 May 2024', checkOut:'22 May 2024', nights:1, amount:11000, paid:5000,  due:6000,  status:'Partial', method:'Cash', items:[{desc:'Room Charges (Deluxe)',qty:1,rate:8000,amount:8000},{desc:'Room Service',qty:2,rate:800,amount:1600}] },
];

const REVENUE_DATA = [
  {month:'Jan',val:18000},{month:'Feb',val:22000},{month:'Mar',val:28000},
  {month:'Apr',val:32000},{month:'May',val:45000},
];

const PAYMENT_METHODS = [
  {label:'Cash',       pct:45, color:'#10b981'},
  {label:'Card',       pct:30, color:'#3b82f6'},
  {label:'UPI',        pct:15, color:'#f59e0b'},
  {label:'Net Banking',pct:10, color:'#8b5cf6'},
];

const RECENT_PAYMENTS = [
  {guest:'John Doe',      inv:'INV-1250', amount:'₹ 12,000', status:'Paid',    color:'#3b82f6', date:'22 May 2024'},
  {guest:'Emily Smith',   inv:'INV-1249', amount:'₹ 5,000',  status:'Partial', color:'#10b981', date:'21 May 2024'},
  {guest:'Michael Brown', inv:'INV-1248', amount:'₹ 18,000', status:'Paid',    color:'#f59e0b', date:'20 May 2024'},
  {guest:'Sarah Wilson',  inv:'INV-1247', amount:'₹ 0',      status:'Unpaid',  color:'#8b5cf6', date:'19 May 2024'},
];

const emptyItem = () => ({desc:'', qty:1, rate:0, amount:0});
const EMPTY_FORM = {guest:'', bookingId:'', room:'', checkIn:'', checkOut:'', method:'Cash', status:'Unpaid', items:[emptyItem()]};
const PER_PAGE = 8;

// ── Helpers ───────────────────────────────────────────────────
const statusClass = (s) => {
  const m = {'Paid':'badge-paid','Partial':'badge-partial','Unpaid':'badge-unpaid','Cancelled':'badge-cancelled'};
  return `badge ${m[s]||''}`;
};

// ── Revenue Line Chart ────────────────────────────────────────
const RevenueChart = ({data}) => {
  const W=340,H=100,PAD={top:10,right:10,bottom:24,left:40};
  const iW=W-PAD.left-PAD.right, iH=H-PAD.top-PAD.bottom;
  const max=Math.max(...data.map(d=>d.val));
  const x=(i)=>PAD.left+(i/(data.length-1))*iW;
  const y=(v)=>PAD.top+iH-((v/max)*iH);
  const line=data.map((d,i)=>`${i===0?'M':'L'}${x(i)},${y(d.val)}`).join(' ');
  const area=`${line} L${x(data.length-1)},${PAD.top+iH} L${x(0)},${PAD.top+iH} Z`;
  const ticks=[0,10000,20000,30000,40000,50000];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}}>
      <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01"/></linearGradient></defs>
      {ticks.map(t=><g key={t}><line x1={PAD.left} y1={y(t)} x2={W-PAD.right} y2={y(t)} stroke="#f1f4f9" strokeWidth="1"/><text x={PAD.left-4} y={y(t)+4} textAnchor="end" fontSize="9" fill="#9ca3af">{t===0?'0':`${t/1000}k`}</text></g>)}
      <path d={area} fill="url(#revGrad)"/>
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d,i)=><circle key={i} cx={x(i)} cy={y(d.val)} r="4" fill="#fff" stroke="#3b82f6" strokeWidth="2.5"/>)}
      {data.map((d,i)=><text key={i} x={x(i)} y={H-4} textAnchor="middle" fontSize="10" fill="#9ca3af">{d.month}</text>)}
    </svg>
  );
};

// ── Donut Chart ───────────────────────────────────────────────
const DonutChart = ({segments, size=100, stroke=16, centerLabel, centerSub}) => {
  const R=((size-stroke)/2), CX=size/2, circ=2*Math.PI*R;
  const total=segments.reduce((s,sg)=>s+sg.pct,0);
  let offset=0;
  return (
    <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={CX} cy={CX} r={R} fill="none" stroke="#f1f4f9" strokeWidth={stroke}/>
        {segments.map((sg,i)=>{const dash=(sg.pct/total)*circ;const el=<circle key={i} cx={CX} cy={CX} r={R} fill="none" stroke={sg.color} strokeWidth={stroke} strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-offset} transform={`rotate(-90 ${CX} ${CX})`}/>;offset+=dash;return el;})}
      </svg>
      {centerLabel&&<div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:13,fontWeight:800,color:'#1a1f36',lineHeight:1}}>{centerLabel}</span>{centerSub&&<span style={{fontSize:9,color:'#6b7280',marginTop:1}}>{centerSub}</span>}</div>}
    </div>
  );
};

// ── Invoice Modal — shown ONLY on Print button click ──────────
const InvoiceModal = ({invoice, onClose}) => {
  const subtotal = invoice.items.reduce((s,i)=>s+i.amount,0);
  const tax      = Math.round(subtotal*0.12);
  const discount = Math.round(subtotal*0.12);
  const total    = subtotal;

  const handlePrint = () => {
    const content = document.getElementById('invoice-print-area').innerHTML;
    const win = window.open('','_blank','width=800,height=900');
    win.document.write(`<html><head><title>Invoice ${invoice.id}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;padding:36px;color:#1a1f36;max-width:620px;margin:0 auto}
      .ih{display:flex;align-items:flex-start;gap:14px;margin-bottom:14px}
      .ilogo{width:44px;height:44px;background:#c9a227;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;font-weight:900;flex-shrink:0}
      .ihn{font-size:16px;font-weight:800;color:#1a2a5e}
      .iha{font-size:11px;color:#6b7280;line-height:1.6;margin-top:3px}
      .divider{height:1px;background:#e4e8f0;margin:14px 0}
      .ititle{font-size:26px;font-weight:900;color:#1a1f36}
      .imeta{font-size:11px;color:#6b7280}
      .ibt-label{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px}
      .ibt-name{font-size:14px;font-weight:700;color:#1a1f36;margin-top:3px}
      .ibt-detail{font-size:11px;color:#6b7280}
      .istay{background:#f8fafc;border-radius:8px;padding:10px 12px;margin-top:10px}
      .istay-title{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px}
      .istay-row{display:flex;justify-content:space-between;font-size:11px;color:#6b7280;padding:2px 0}
      .istay-val{font-weight:600;color:#1a1f36}
      .igrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;padding:6px 0;border-bottom:1px solid #e4e8f0;text-align:left}
      th:last-child,td:last-child{text-align:right}
      td{font-size:12px;color:#1a1f36;padding:7px 0;border-bottom:1px solid #f1f4f9}
      .trow{display:flex;justify-content:space-between;font-size:12px;color:#6b7280;padding:3px 0}
      .tgrand{font-size:15px;font-weight:800;color:#1a2a5e;border-top:2px solid #e4e8f0;padding-top:8px;margin-top:6px;display:flex;justify-content:space-between}
      .pbox{background:#f8fafc;border-radius:8px;padding:10px 12px;margin-top:12px}
      .prow{display:flex;justify-content:space-between;font-size:11px;color:#6b7280;padding:2px 0}
      .pval{font-weight:600;color:#1a1f36}
      .thankyou{text-align:right;font-size:14px;color:#c9a227;font-weight:700;font-style:italic;margin-top:14px}
    </style></head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(()=>{win.print();win.close();},400);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" style={{maxWidth:660}} onClick={e=>e.stopPropagation()}>

        {/* Modal header with Print + Download */}
        <div className="modal-header">
          <h3>Invoice — {invoice.id}</h3>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={handlePrint} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',background:'#f8fafc',border:'1.5px solid #e4e8f0',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',color:'#1a1f36',fontFamily:'Inter,sans-serif'}}>
              <IcoPrint/> Print
            </button>
            <button onClick={handlePrint} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 16px',background:'#1a2a5e',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',color:'#fff',fontFamily:'Inter,sans-serif'}}>
              <IcoDownload/> Download PDF
            </button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        {/* Invoice content — printable */}
        <div id="invoice-print-area" style={{padding:'24px 28px'}}>

          {/* Hotel header */}
          <div className="ih" style={{display:'flex',alignItems:'flex-start',gap:14,marginBottom:14}}>
            <div className="ilogo" style={{width:44,height:44,background:'#c9a227',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,color:'#fff',fontWeight:900,flexShrink:0}}>H</div>
            <div>
              <div className="ihn" style={{fontSize:15,fontWeight:800,color:'#1a2a5e'}}>Hotel Management</div>
              <div className="iha" style={{fontSize:11,color:'#6b7280',lineHeight:1.6,marginTop:3}}>
                123, Palace Road, City Center, Bangalore - 560019, India<br/>
                Phone: +91 98765 43210 | Email: hotelpro@gmail.com
              </div>
            </div>
          </div>

          <div className="invoice-divider"/>

          {/* Title + meta */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div className="invoice-title">INVOICE</div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12,color:'#6b7280'}}>Invoice No. : <strong style={{color:'#1a1f36'}}>{invoice.id}</strong></div>
              <div style={{fontSize:12,color:'#6b7280',marginTop:3}}>Booking ID &nbsp;: <strong style={{color:'#1a1f36'}}>{invoice.bookingId}</strong></div>
              <div style={{fontSize:12,color:'#6b7280',marginTop:3}}>Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <strong style={{color:'#1a1f36'}}>{invoice.checkOut}</strong></div>
            </div>
          </div>

          {/* Bill To + Stay Details */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:14}}>
            <div>
              <div className="invoice-bill-label">Bill To.</div>
              <div className="invoice-bill-name">{invoice.guest}</div>
              <div className="invoice-bill-detail">Room No. {invoice.room}</div>
              <div className="invoice-bill-detail">Booking ID: {invoice.bookingId}</div>
            </div>
            <div className="invoice-stay">
              <div className="invoice-stay-title">Stay Details</div>
              {[['Check-in',invoice.checkIn],['Check-out',invoice.checkOut],['Nights',invoice.nights]].map(([k,v])=>(
                <div className="invoice-stay-row" key={k}><span>{k}</span><span style={{fontWeight:600,color:'#1a1f36'}}>{v}</span></div>
              ))}
            </div>
          </div>

          {/* Items */}
          <table className="invoice-items-table" style={{marginTop:18}}>
            <thead>
              <tr>
                <th>Description</th>
                <th style={{textAlign:'center'}}>Qty</th>
                <th style={{textAlign:'right'}}>Rate (₹)</th>
                <th style={{textAlign:'right'}}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item,i)=>(
                <tr key={i}>
                  <td>{item.desc}</td>
                  <td style={{textAlign:'center'}}>{item.qty}</td>
                  <td style={{textAlign:'right'}}>{item.rate.toLocaleString('en-IN')}</td>
                  <td style={{textAlign:'right',fontWeight:600}}>{item.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{marginTop:12,borderTop:'1px solid #e4e8f0',paddingTop:10}}>
            <div className="invoice-total-row"><span>Subtotal</span><span>₹ {subtotal.toLocaleString('en-IN')}</span></div>
            <div className="invoice-total-row"><span>Tax (12%)</span><span>₹ {tax.toLocaleString('en-IN')}</span></div>
            <div className="invoice-total-row"><span style={{color:'#10b981'}}>Discount</span><span style={{color:'#10b981'}}>- ₹ {discount.toLocaleString('en-IN')}</span></div>
            <div className="invoice-total-row total"><span>Total Amount</span><span>₹ {total.toLocaleString('en-IN')}</span></div>
          </div>

          {/* Payment info */}
          <div className="invoice-payment-info" style={{marginTop:14}}>
            <div className="invoice-payment-title">Payment Information</div>
            {[['Payment Method',invoice.method||'—'],['Paid Amount',`₹ ${invoice.paid.toLocaleString('en-IN')}`],['Payment Status',invoice.status]].map(([k,v])=>(
              <div className="invoice-payment-row" key={k}><span>{k}</span><span style={{fontWeight:600,color:'#1a1f36'}}>{v}</span></div>
            ))}
          </div>

          <div style={{fontSize:12,color:'#6b7280',marginTop:14,lineHeight:1.6}}>
            Thank you for staying with us! We look forward to serving you again.
          </div>
          <div className="invoice-thank">Thank You!</div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════
function Billing() {
  const [invoices, setInvoices]       = useState(INITIAL_INVOICES);
  const [search, setSearch]           = useState('');
  const [activeTab, setActiveTab]     = useState('All Bills');
  const [page, setPage]               = useState(1);
  const [showAdd, setShowAdd]         = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [showView, setShowView]       = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [selected, setSelected]       = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);

  // ── Filter ──
  const filtered = invoices.filter(inv =>
    (activeTab==='All Bills' || inv.status===activeTab) &&
    (inv.guest.toLowerCase().includes(search.toLowerCase()) ||
     inv.id.toLowerCase().includes(search.toLowerCase()) ||
     inv.bookingId.toLowerCase().includes(search.toLowerCase()))
  );
  const totalPages = Math.ceil(filtered.length/PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  // ── Handlers ──
  const openAdd     = () => { setForm(EMPTY_FORM); setShowAdd(true); };
  const openEdit    = (inv) => { setSelected(inv); setForm({guest:inv.guest,bookingId:inv.bookingId,room:inv.room,checkIn:inv.checkIn,checkOut:inv.checkOut,method:inv.method,status:inv.status,items:inv.items.map(i=>({...i}))}); setShowEdit(true); };
  const openView    = (inv) => { setSelected(inv); setShowView(true); };
  const openInvoice = (inv) => { setSelected(inv); setShowInvoice(true); };

  const calcTotal = (items) => items.reduce((s,i)=>s+(parseFloat(i.rate)||0)*(parseFloat(i.qty)||0),0);

  const handleAdd = () => {
    const total=calcTotal(form.items);
    setInvoices(prev=>[{id:`INV-${1251+invoices.length}`,bookingId:form.bookingId,guest:form.guest,room:form.room,checkIn:form.checkIn,checkOut:form.checkOut,nights:1,amount:total,paid:form.status==='Paid'?total:0,due:form.status==='Paid'?0:total,status:form.status,method:form.method,items:form.items},...prev]);
    setShowAdd(false); setPage(1);
  };
  const handleEdit = () => {
    const total=calcTotal(form.items);
    setInvoices(prev=>prev.map(inv=>inv.id===selected.id?{...inv,...form,amount:total,paid:form.status==='Paid'?total:inv.paid,due:form.status==='Paid'?0:total-inv.paid}:inv));
    setShowEdit(false);
  };
  const handleFormChange = (e) => { const{name,value}=e.target; setForm(prev=>({...prev,[name]:value})); };
  const handleItemChange = (idx,field,val) => {
    setForm(prev=>{
      const items=prev.items.map((it,i)=>{ if(i!==idx) return it; const u={...it,[field]:val}; u.amount=(parseFloat(u.rate)||0)*(parseFloat(u.qty)||0); return u; });
      return {...prev,items};
    });
  };
  const addItem    = () => setForm(prev=>({...prev,items:[...prev.items,emptyItem()]}));
  const removeItem = (idx) => setForm(prev=>({...prev,items:prev.items.filter((_,i)=>i!==idx)}));

  // ── Bill Form Modal ──
  const BillFormModal = ({title, onSave, onClose}) => {
    const total=calcTotal(form.items), tax=Math.round(total*0.12), grand=total+tax;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box modal-box-lg" onClick={e=>e.stopPropagation()}>
          <div className="modal-header"><h3>{title}</h3><button className="modal-close" onClick={onClose}>×</button></div>
          <div className="modal-body">
            <div className="modal-section-title">Guest &amp; Booking Info</div>
            <div className="modal-grid">
              <div className="form-group"><label className="form-label">Guest Name</label><input className="form-input" name="guest" value={form.guest} onChange={handleFormChange} placeholder="Enter guest name"/></div>
              <div className="form-group"><label className="form-label">Booking ID</label><input className="form-input" name="bookingId" value={form.bookingId} onChange={handleFormChange} placeholder="e.g. BK-1250"/></div>
              <div className="form-group"><label className="form-label">Room No.</label><input className="form-input" name="room" value={form.room} onChange={handleFormChange} placeholder="e.g. 101"/></div>
              <div className="form-group"><label className="form-label">Check-in</label><input className="form-input" type="date" name="checkIn" value={form.checkIn} onChange={handleFormChange}/></div>
              <div className="form-group"><label className="form-label">Check-out</label><input className="form-input" type="date" name="checkOut" value={form.checkOut} onChange={handleFormChange}/></div>
              <div className="form-group"><label className="form-label">Payment Method</label><select className="form-select" name="method" value={form.method} onChange={handleFormChange}><option>Cash</option><option>Card</option><option>UPI</option><option>Net Banking</option></select></div>
              <div className="form-group"><label className="form-label">Payment Status</label><select className="form-select" name="status" value={form.status} onChange={handleFormChange}><option>Paid</option><option>Partial</option><option>Unpaid</option></select></div>
            </div>
            <div className="modal-section-title">Bill Items</div>
            <div className="bill-items-list">
              <div className="bill-item-row bill-item-header"><span className="bill-item-col-label">Description</span><span className="bill-item-col-label">Qty</span><span className="bill-item-col-label">Rate (₹)</span><span className="bill-item-col-label">Amount</span><span/></div>
              {form.items.map((item,idx)=>(
                <div className="bill-item-row" key={idx}>
                  <input className="form-input" value={item.desc} onChange={e=>handleItemChange(idx,'desc',e.target.value)} placeholder="e.g. Room Charges" style={{fontSize:12}}/>
                  <input className="form-input" type="number" value={item.qty} onChange={e=>handleItemChange(idx,'qty',e.target.value)} min={1} style={{textAlign:'center'}}/>
                  <input className="form-input" type="number" value={item.rate} onChange={e=>handleItemChange(idx,'rate',e.target.value)} placeholder="0" style={{textAlign:'right'}}/>
                  <span style={{fontSize:13,fontWeight:600,color:'#1a2a5e'}}>₹ {(item.amount||0).toLocaleString('en-IN')}</span>
                  {form.items.length>1 && <button className="btn-remove-bill-item" onClick={()=>removeItem(idx)}>×</button>}
                </div>
              ))}
              <button className="btn-add-bill-item" onClick={addItem}>Add Item</button>
            </div>
            <div className="bill-total-box">
              <div className="bill-total-row"><span>Subtotal</span><span>₹ {total.toLocaleString('en-IN')}</span></div>
              <div className="bill-total-row"><span>Tax (GST 12%)</span><span>₹ {tax.toLocaleString('en-IN')}</span></div>
              <div className="bill-total-row bill-grand-total"><span>Total Amount</span><span>₹ {grand.toLocaleString('en-IN')}</span></div>
            </div>
          </div>
          <div className="modal-footer"><button className="btn-cancel" onClick={onClose}>Cancel</button><button className="btn-save" onClick={onSave}>Generate Bill</button></div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left"><h2>Billing &amp; Invoices</h2><p>Manage bills, payments and invoices</p></div>
        <div className="page-header-right">
          <div className="date-range-badge"><IcoCalendar/> 01 May 2024 – 31 May 2024</div>
          <button className="btn-generate" onClick={openAdd}><IcoPlus/>Generate New Bill</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="bill-stats">
        <div className="bstat-card"><div className="bstat-icon blue"><IcoBill/></div><div className="bstat-info"><div className="bstat-label">Total Bills</div><div className="bstat-value">1,248</div><div className="bstat-change">↑ 10.8% from last month</div></div></div>
        <div className="bstat-card"><div className="bstat-icon green"><IcoRevenue/></div><div className="bstat-info"><div className="bstat-label">Total Revenue</div><div className="bstat-value" style={{fontSize:17}}>₹ 24,50,000</div><div className="bstat-change">↑ 15.2% from last month</div></div></div>
        <div className="bstat-card"><div className="bstat-icon teal"><IcoPaid/></div><div className="bstat-info"><div className="bstat-label">Paid Amount</div><div className="bstat-value" style={{fontSize:17}}>₹ 20,15,000</div><div className="bstat-change">↑ 14.7% from last month</div></div></div>
        <div className="bstat-card"><div className="bstat-icon red"><IcoOutstand/></div><div className="bstat-info"><div className="bstat-label">Outstanding</div><div className="bstat-value" style={{fontSize:17}}>₹ 4,35,000</div><div className="bstat-change neg">↑ 6.3% from last month</div></div></div>
      </div>

      {/* Tabs */}
      <div className="bill-tabs">
        {['All Bills','Paid','Partial','Unpaid','Cancelled'].map(tab=>(
          <button key={tab} className={`bill-tab ${activeTab===tab?'active':''}`} onClick={()=>{setActiveTab(tab);setPage(1);}}>{tab}</button>
        ))}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <div className="search-wrap">
          <IcoSearch/>
          <input className="search-input" placeholder="Search by Invoice No., Guest or Booking ID..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
        </div>
        <button className="btn-filter"><IcoFilter/> Filter</button>
      </div>

      {/* Invoice Table — full width */}
      <div className="bill-card">
        <table className="bill-table">
          <thead>
            <tr>
              <th>Invoice No.</th><th>Booking ID</th><th>Guest Name</th>
              <th>Check-out Date</th><th>Amount (₹)</th><th>Paid (₹)</th>
              <th>Due (₹)</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length===0 ? (
              <tr><td colSpan={9} style={{textAlign:'center',padding:32,color:'#9ca3af'}}>No invoices found.</td></tr>
            ) : paginated.map((inv,idx)=>(
              <tr key={inv.id}>
                <td style={{fontWeight:700,color:'#1a2a5e'}}>{inv.id}</td>
                <td style={{color:'#6b7280'}}>{inv.bookingId}</td>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:AVATAR_COLORS[idx%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',flexShrink:0}}>{initials(inv.guest)}</div>
                    {inv.guest}
                  </div>
                </td>
                <td>{inv.checkOut}</td>
                <td style={{fontWeight:600}}>₹ {inv.amount.toLocaleString('en-IN')}</td>
                <td style={{fontWeight:600,color:'#10b981'}}>₹ {inv.paid.toLocaleString('en-IN')}</td>
                <td style={{fontWeight:600,color:inv.due>0?'#ef4444':'#1a1f36'}}>₹ {inv.due.toLocaleString('en-IN')}</td>
                <td><span className={statusClass(inv.status)}>{inv.status}</span></td>
                <td>
                  <div className="action-btns">
                    <button className="btn-icon btn-icon-view"  title="View Details" onClick={()=>openView(inv)}><IcoEye/></button>
                    <button className="btn-icon btn-icon-edit"  title="Edit"         onClick={()=>openEdit(inv)}><IcoEdit/></button>
                    {/* Print icon — opens invoice modal */}
                    <button className="btn-icon btn-icon-print" title="Print / Download Invoice" onClick={()=>openInvoice(inv)}><IcoPrint/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">Showing {filtered.length===0?0:(page-1)*PER_PAGE+1} to {Math.min(page*PER_PAGE,filtered.length)} of {filtered.length} invoices</span>
          <div className="pagination-btns">
            <button className="pg-btn" onClick={()=>setPage(p=>p-1)} disabled={page===1}><IcoChevL/></button>
            {Array.from({length:Math.min(totalPages,3)},(_,i)=>i+1).map(n=>(
              <button key={n} className={`pg-btn ${page===n?'active':''}`} onClick={()=>setPage(n)}>{n}</button>
            ))}
            {totalPages>3&&<><button className="pg-btn dots">…</button><button className={`pg-btn ${page===totalPages?'active':''}`} onClick={()=>setPage(totalPages)}>{totalPages}</button></>}
            <button className="pg-btn" onClick={()=>setPage(p=>p+1)} disabled={page===totalPages||totalPages===0}><IcoChevR/></button>
          </div>
        </div>
      </div>

      {/* Bottom 3-col */}
      <div className="bill-bottom">
        <div className="revenue-card"><div className="revenue-title">Revenue Overview</div><RevenueChart data={REVENUE_DATA}/></div>
        <div className="payment-methods-card">
          <div className="pm-title">Payment Methods</div>
          <div className="pm-donut-wrap">
            <DonutChart segments={PAYMENT_METHODS} size={100} stroke={16} centerLabel="100%" centerSub="Total"/>
            <div className="pm-legend">{PAYMENT_METHODS.map(p=><div className="pm-leg-item" key={p.label}><span className="pm-dot" style={{background:p.color}}/><span>{p.label}</span><span className="pm-pct">{p.pct}%</span></div>)}</div>
          </div>
        </div>
        <div className="recent-pay-card">
          <div className="rp-title">Recent Payments</div>
          {RECENT_PAYMENTS.map((rp,i)=>(
            <div className="rp-item" key={i}>
              <div className="rp-avatar" style={{background:AVATAR_COLORS[i%AVATAR_COLORS.length]}}>{initials(rp.guest)}</div>
              <div className="rp-info"><div className="rp-name">{rp.guest}</div><div className="rp-inv">{rp.inv} · {rp.date}</div></div>
              <div className="rp-right"><div className="rp-amount">{rp.amount}</div><span className={statusClass(rp.status)} style={{fontSize:10,padding:'2px 7px'}}>{rp.status}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ MODALS ══ */}
      {showAdd  && <BillFormModal title="Generate New Bill" onSave={handleAdd}  onClose={()=>setShowAdd(false)}/>}
      {showEdit && <BillFormModal title="Edit Invoice"        onSave={handleEdit} onClose={()=>setShowEdit(false)}/>}

      {/* Invoice modal — only opens on Print button click */}
      {showInvoice && selected && <InvoiceModal invoice={selected} onClose={()=>setShowInvoice(false)}/>}
      {/* View Details modal */}
      {showView && selected && (
        <div className="modal-overlay" onClick={()=>setShowView(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>Invoice Details — {selected.id}</h3><button className="modal-close" onClick={()=>setShowView(false)}>×</button></div>
            <div className="modal-body">
              {[['Invoice No.',selected.id],['Booking ID',selected.bookingId],['Guest Name',selected.guest],['Room No.',selected.room],['Check-in',selected.checkIn],['Check-out',selected.checkOut],['Total Amount',`₹ ${selected.amount.toLocaleString('en-IN')}`],['Paid Amount',`₹ ${selected.paid.toLocaleString('en-IN')}`],['Due Amount',`₹ ${selected.due.toLocaleString('en-IN')}`],['Status',selected.status],['Payment Method',selected.method||'—']].map(([k,v])=>(
                <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-value">{v}</span></div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" style={{display:'flex',alignItems:'center',gap:6}} onClick={()=>{setShowView(false);setShowInvoice(true);}}><IcoPrint/> Print Invoice</button>
              <button className="btn-save" onClick={()=>setShowView(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Billing;