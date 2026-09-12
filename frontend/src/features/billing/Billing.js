import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient, { getApiErrorMessage } from '../../shared/api/apiClient';
import './Billing.css';
import {
  IcoPlus, IcoSearch, IcoFilter, IcoEye, IcoEdit,
  IcoDownload, IcoChevL, IcoChevR, IcoBill, IcoRevenue,
  IcoPaid, IcoOutstand, IcoPrint, IcoCalendar,
} from '../../utils/icons/Billingicons';

// ── Constants ─────────────────────────────────────────────────
const AVATAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#6366f1'];
const initials = (name) => (name || '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

const emptyItem = () => ({desc:'', qty:1, rate:'', amount:0});
const EMPTY_FORM = {guest:'', bookingId:'', room:'', checkIn:'', checkOut:'', items:[emptyItem()]};

const invoiceDetailToItems = (invoice = {}) => {
  const items = [
    ['Room Charges', invoice.roomCharges],
    ['Food Charges', invoice.foodCharges],
    ['Laundry Charges', invoice.laundryCharges],
    ['Extra Service Charges', invoice.serviceCharges],
  ]
    .filter(([, value]) => Number(value) > 0)
    .map(([desc, value]) => {
      const amount = Number(value);
      return { desc, qty:1, rate:amount, amount };
    });

  if (items.length === 0 && Number(invoice.total) > 0) {
    const amount = Number(invoice.total);
    return [{ desc:'Invoice Charges', qty:1, rate:amount, amount }];
  }

  return items;
};

const getInvoiceNights = (invoice = {}) => {
  if (!invoice.checkIn || !invoice.checkOut) return '';
  const [y1,m1,d1] = invoice.checkIn.split('-').map(Number);
  const [y2,m2,d2] = invoice.checkOut.split('-').map(Number);
  if (![y1,m1,d1,y2,m2,d2].every(Number.isFinite)) return '';
  return Math.max(1, Math.round((Date.UTC(y2,m2-1,d2)-Date.UTC(y1,m1-1,d1))/86400000));
};
const PER_PAGE = 8;
const TABS = ['All Bills','Paid','Partial','Unpaid','Cancelled'];

// ── Date range helpers ──────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);
const firstOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const fmtDateBadge = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(`${isoStr}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Helpers ───────────────────────────────────────────────────
const statusClass = (s) => {
  const m = {'Paid':'badge-paid','Partial':'badge-partial','Unpaid':'badge-unpaid','Cancelled':'badge-cancelled'};
  return `badge ${m[s]||''}`;
};

const inputErrorStyle = { borderColor: '#ef4444', boxShadow: '0 0 0 1px rgba(239,68,68,0.25)' };
const errorTextStyle = { color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block' };
const fmtCurrency = (n) => `₹ ${Number(n||0).toLocaleString('en-IN')}`;
const calcTotal = (items) => items.reduce((s,i)=>s+(parseFloat(i.rate)||0)*(parseFloat(i.qty)||0),0);

// ── Revenue Line Chart ────────────────────────────────────────
const RevenueChart = ({data}) => {
  if (!data || data.length === 0) {
    return <div style={{padding:'24px 0',textAlign:'center',color:'#9ca3af',fontSize:13}}>No revenue data yet.</div>;
  }
  const W=340,H=100,PAD={top:10,right:10,bottom:24,left:40};
  const iW=W-PAD.left-PAD.right, iH=H-PAD.top-PAD.bottom;
  const max=Math.max(...data.map(d=>d.val), 1);
  const x=(i)=>PAD.left+(data.length>1?(i/(data.length-1))*iW:iW/2);
  const y=(v)=>PAD.top+iH-((v/max)*iH);
  const line=data.map((d,i)=>`${i===0?'M':'L'}${x(i)},${y(d.val)}`).join(' ');
  const area=`${line} L${x(data.length-1)},${PAD.top+iH} L${x(0)},${PAD.top+iH} Z`;
  const ticks=[0,max*0.25,max*0.5,max*0.75,max].map(v=>Math.round(v));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}}>
      <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01"/></linearGradient></defs>
      {ticks.map(t=><g key={t}><line x1={PAD.left} y1={y(t)} x2={W-PAD.right} y2={y(t)} stroke="#f1f4f9" strokeWidth="1"/><text x={PAD.left-4} y={y(t)+4} textAnchor="end" fontSize="9" fill="#9ca3af">{t===0?'0':`${Math.round(t/1000)}k`}</text></g>)}
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
  const total=segments.reduce((s,sg)=>s+sg.pct,0) || 1;
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
  const items = invoice.items?.length ? invoice.items : invoiceDetailToItems(invoice);
  const subtotal = items.reduce((s,i)=>s+Number(i.amount||0),0);
  const tax = Number(invoice.tax ?? 0);
  const total = Number(invoice.total ?? (subtotal + tax));
  const discount = Math.max(0, subtotal + tax - total);
  const nights = invoice.nights ?? getInvoiceNights(invoice);

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

        <div id="invoice-print-area" style={{padding:'24px 28px'}}>

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

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div className="invoice-title">INVOICE</div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12,color:'#6b7280'}}>Invoice No. : <strong style={{color:'#1a1f36'}}>{invoice.id}</strong></div>
              <div style={{fontSize:12,color:'#6b7280',marginTop:3}}>Booking ID &nbsp;: <strong style={{color:'#1a1f36'}}>{invoice.bookingId}</strong></div>
              <div style={{fontSize:12,color:'#6b7280',marginTop:3}}>Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <strong style={{color:'#1a1f36'}}>{invoice.checkOut}</strong></div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:14}}>
            <div>
              <div className="invoice-bill-label">Bill To.</div>
              <div className="invoice-bill-name">{invoice.guest}</div>
              <div className="invoice-bill-detail">Room No. {invoice.room}</div>
              <div className="invoice-bill-detail">Booking ID: {invoice.bookingId}</div>
            </div>
            <div className="invoice-stay">
              <div className="invoice-stay-title">Stay Details</div>
              {[['Check-in',invoice.checkIn],['Check-out',invoice.checkOut],['Nights',nights]].map(([k,v])=>(
                <div className="invoice-stay-row" key={k}><span>{k}</span><span style={{fontWeight:600,color:'#1a1f36'}}>{v}</span></div>
              ))}
            </div>
          </div>

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
              {items.map((item,i)=>(
                <tr key={i}>
                  <td>{item.desc}</td>
                  <td style={{textAlign:'center'}}>{item.qty}</td>
                  <td style={{textAlign:'right'}}>{item.rate.toLocaleString('en-IN')}</td>
                  <td style={{textAlign:'right',fontWeight:600}}>{item.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{marginTop:12,borderTop:'1px solid #e4e8f0',paddingTop:10}}>
            <div className="invoice-total-row"><span>Subtotal</span><span>₹ {subtotal.toLocaleString('en-IN')}</span></div>
            <div className="invoice-total-row"><span>Tax (12%)</span><span>₹ {tax.toLocaleString('en-IN')}</span></div>
            <div className="invoice-total-row"><span style={{color:'#10b981'}}>Discount</span><span style={{color:'#10b981'}}>- ₹ {discount.toLocaleString('en-IN')}</span></div>
            <div className="invoice-total-row total"><span>Total Amount</span><span>₹ {total.toLocaleString('en-IN')}</span></div>
          </div>

          <div className="invoice-payment-info" style={{marginTop:14}}>
            <div className="invoice-payment-title">Payment Information</div>
            {[['Payment Method',invoice.method||invoice.paymentMethod||'—'],['Applied to Invoice',fmtCurrency(invoice.paid)],['Net Paid',fmtCurrency(invoice.netPaid||0)],['Refund Due',fmtCurrency(invoice.refundDue||0)],['Payment Status',invoice.status]].map(([k,v])=>(
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

// ── Bill Form Modal (Generate / Edit) ──────────────────────────
const BillFormModal = ({
  title, form, formErrors, formError, bookings, saving,
  onFormChange, onItemChange, onBookingChange, onAddItem, onRemoveItem,
  onSave, onClose, taxOverride = null, submitLabel = 'Generate Bill',
}) => {
  const total = calcTotal(form.items);
  const tax = taxOverride === null || taxOverride === undefined ? Math.round(total * 0.12) : Number(taxOverride);
  const grand = total + tax;
  const errs = formErrors;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>{title}</h3><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          {formError && <div className="form-error" style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{formError}</div>}
          <div className="modal-section-title">Guest &amp; Booking Info</div>
          <div className="modal-grid">

            <div className="form-group">
              <label className="form-label">Select Booking *</label>
              <select
                className="form-select"
                value={form.bookingId}
                onChange={onBookingChange}
                style={errs.bookingId ? inputErrorStyle : undefined}
              >
                <option value="">Select Booking</option>
                {bookings.map((booking) => (
                  <option key={booking.booking_id} value={booking.booking_id}>
                    {booking.booking_code} - {booking.full_name}
                  </option>
                ))}
              </select>
              {errs.bookingId && <span style={errorTextStyle}>{errs.bookingId}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Guest Name</label>
              <input
                className="form-input"
                value={form.guest}
                readOnly
                placeholder="Auto-filled from booking"
                style={errs.guest ? inputErrorStyle : undefined}
              />
              {errs.guest && <span style={errorTextStyle}>{errs.guest}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Room No.</label>
              <input
                className="form-input"
                value={form.room}
                readOnly
                placeholder="Auto-filled from booking"
                style={errs.room ? inputErrorStyle : undefined}
              />
              {errs.room && <span style={errorTextStyle}>{errs.room}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Check-in</label>
              <input className="form-input" type="date" name="checkIn" value={form.checkIn || ''} onChange={onFormChange} style={errs.checkIn ? inputErrorStyle : undefined} />
              {errs.checkIn && <span style={errorTextStyle}>{errs.checkIn}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Check-out</label>
              <input className="form-input" type="date" name="checkOut" value={form.checkOut || ''} onChange={onFormChange} style={errs.checkOut ? inputErrorStyle : undefined} />
              {errs.checkOut && <span style={errorTextStyle}>{errs.checkOut}</span>}
            </div>

          </div>
          <div className="modal-section-title">Bill Items</div>
          <div className="bill-items-list">
            <div className="bill-item-row bill-item-header"><span className="bill-item-col-label">Description</span><span className="bill-item-col-label">Qty</span><span className="bill-item-col-label">Rate (₹)</span><span className="bill-item-col-label">Amount</span><span /></div>
            {form.items.map((item, idx) => {
              const ie = errs.itemErrors?.[idx] || {};
              return (
                <div className="bill-item-row" key={idx}>
                  <div>
                    <input className="form-input" value={item.desc} onChange={e => onItemChange(idx, 'desc', e.target.value)} placeholder="e.g. Room Charges" style={{ fontSize: 12, ...(ie.desc ? inputErrorStyle : {}) }} />
                    {ie.desc && <span style={errorTextStyle}>{ie.desc}</span>}
                  </div>
                  <div>
                    <input className="form-input" type="number" value={item.qty} onChange={e => onItemChange(idx, 'qty', e.target.value)} min={1} style={{ textAlign: 'center', ...(ie.qty ? inputErrorStyle : {}) }} />
                    {ie.qty && <span style={errorTextStyle}>{ie.qty}</span>}
                  </div>
                  <div>
                    <input className="form-input" type="number" value={item.rate} onChange={e => onItemChange(idx, 'rate', e.target.value)} placeholder="Enter rate" style={{ textAlign: 'right', ...(ie.rate ? inputErrorStyle : {}) }} />
                    {ie.rate && <span style={errorTextStyle}>{ie.rate}</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2a5e' }}>{fmtCurrency(item.amount)}</span>
                  {form.items.length > 1 && <button className="btn-remove-bill-item" onClick={() => onRemoveItem(idx)}>×</button>}
                </div>
              );
            })}
            <button className="btn-add-bill-item" onClick={onAddItem}>Add Item</button>
            {errs.items && <div style={{ ...errorTextStyle, marginTop: 6 }}>{errs.items}</div>}
          </div>
          <div className="bill-total-box">
            <div className="bill-total-row"><span>Subtotal</span><span>{fmtCurrency(total)}</span></div>
            <div className="bill-total-row"><span>Tax (GST 12%)</span><span>{fmtCurrency(tax)}</span></div>
            <div className="bill-total-row bill-grand-total"><span>Total Amount</span><span>{fmtCurrency(grand)}</span></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-save" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════
function Billing() {
  // Table + pagination (server-driven)
  const [invoices, setInvoices]       = useState([]);
  const [bookings, setBookings] = useState([]);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [loadingTable, setLoadingTable] = useState(true);
  const [tableError, setTableError]   = useState(null);

  // Dashboard widgets
  const [stats, setStats] = useState({ totalBills:0, totalRevenue:0, paidAmount:0, outstanding:0, changes:{} });
  const [revenueData, setRevenueData]         = useState([]);
  const [paymentMethods, setPaymentMethods]   = useState([]);
  const [recentPayments, setRecentPayments]   = useState([]);
  const [loadingWidgets, setLoadingWidgets]   = useState(true);

  const [search, setSearch]           = useState('');
  const [activeTab, setActiveTab]     = useState('All Bills');
  const [page, setPage]               = useState(1);

  // Date range — defaults to current month start → today.
  // Lazy initializers so a fresh mount (new login/page load) always
  // starts from the real current date, not a stale closure.
  const [dateRange, setDateRange]     = useState(() => ({ from: firstOfMonthISO(), to: todayISO() }));
  const [draftRange, setDraftRange]   = useState(() => ({ from: firstOfMonthISO(), to: todayISO() }));
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Tracks whether the user manually applied a custom range, so the
  // midnight/month-rollover effect below never overrides an explicit choice.
  const userPickedRangeRef = useRef(false);

  const [showAdd, setShowAdd]         = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [showView, setShowView]       = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [selected, setSelected]       = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState(null);
  const [formErrors, setFormErrors]   = useState({}); // field-level validation errors

  // If this tab is left open across midnight (or across a month
  // boundary), roll the default "current month → today" range forward
  // automatically — but only while the user hasn't manually applied a
  // custom range via the date picker.
  useEffect(() => {
    const interval = setInterval(() => {
      if (userPickedRangeRef.current || showDatePicker) return;
      const freshFrom = firstOfMonthISO();
      const freshTo = todayISO();
      setDateRange(prev => (prev.from !== freshFrom || prev.to !== freshTo) ? { from: freshFrom, to: freshTo } : prev);
      setDraftRange(prev => (prev.from !== freshFrom || prev.to !== freshTo) ? { from: freshFrom, to: freshTo } : prev);
    }, 60 * 1000); // check once a minute
    return () => clearInterval(interval);
  }, [showDatePicker]);

  // ── Fetch bookings (for the Generate/Edit Bill dropdown) ──
  const fetchBookings = async () => {
    try {
      const res = await apiClient.get("/bookings");
      setBookings(res.data);
    }
    catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // ── Fetch invoice table (server search / filter / pagination / date range) ──
  const fetchInvoices = useCallback(async () => {
    setLoadingTable(true);
    setTableError(null);
    try {
      const { data } = await apiClient.get('/billing/invoices', {
        params: {
          search,
          status: activeTab === 'All Bills' ? undefined : activeTab,
          page,
          limit: PER_PAGE,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
        },
      });
      setInvoices(data.invoices || []);
      setTotalInvoices(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setTableError(getApiErrorMessage(err, 'Could not load invoices. Please try again.'));
      setInvoices([]);
    } finally {
      setLoadingTable(false);
    }
  }, [search, activeTab, page, dateRange]);

  // debounce search so we don't fire a request per keystroke
  useEffect(() => {
    const t = setTimeout(fetchInvoices, 300);
    return () => clearTimeout(t);
  }, [fetchInvoices]);

  // ── Fetch dashboard widgets (stats, chart, breakdown, recent) — same date range ──
  const fetchWidgets = useCallback(async () => {
    setLoadingWidgets(true);
    try {
      const rangeParams = { dateFrom: dateRange.from, dateTo: dateRange.to };
      const [statsRes, revenueRes, methodsRes, recentRes] = await Promise.all([
        apiClient.get('/billing/stats', { params: rangeParams }),
        apiClient.get('/billing/revenue-chart', { params: rangeParams }),
        apiClient.get('/billing/payment-methods', { params: rangeParams }),
        apiClient.get('/billing/recent-payments', { params: { ...rangeParams, limit: 4 } }),
      ]);
      const rawStats = statsRes.data?.stats ?? statsRes.data ?? {};
      setStats({
        totalBills: 0,
        totalRevenue: 0,
        paidAmount: 0,
        outstanding: 0,
        changes: {},
        ...rawStats,
      });
      setRevenueData(revenueRes.data || []);
      setPaymentMethods(methodsRes.data || []);
      setRecentPayments(recentRes.data || []);
    } catch (err) {
      console.error('Failed to load billing widgets:', err);
    } finally {
      setLoadingWidgets(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchWidgets(); }, [fetchWidgets]);

  const refreshAll = () => { fetchInvoices(); fetchWidgets(); };

  // ── Date range handlers ──
  const openDatePicker = () => { setDraftRange(dateRange); setShowDatePicker(v => !v); };
  const applyDateRange = () => {
    userPickedRangeRef.current = true;
    setDateRange(draftRange);
    setPage(1);
    setShowDatePicker(false);
  };
  const cancelDateRange = () => setShowDatePicker(false);
  // Lets the user opt back into the auto-updating "current month → today"
  // default instead of a manually pinned range.
  const resetToCurrentRange = () => {
    userPickedRangeRef.current = false;
    const fresh = { from: firstOfMonthISO(), to: todayISO() };
    setDateRange(fresh);
    setDraftRange(fresh);
    setPage(1);
    setShowDatePicker(false);
  };

  // ── Handlers ──
  const openAdd     = () => { setForm(EMPTY_FORM); setFormError(null); setFormErrors({}); setShowAdd(true); };
  const openEdit = async (inv) => {
    setFormError(null);
    setFormErrors({});

    try {
      const { data } = await apiClient.get(`/billing/invoices/${inv.invoice_id}`);
      setSelected(data);
      setForm({
        guest:data.guest,
        bookingId:data.bookingId,
        room:data.room,
        checkIn:data.checkIn,
        checkOut:data.checkOut,
        items:invoiceDetailToItems(data),
      });
      setShowEdit(true);
    } catch (err) {
      console.error('Failed to load invoice for editing:', err);
      setTableError(getApiErrorMessage(err, 'Unable to load invoice for editing.'));
    }
  };
  const openView    = (inv) => { setSelected(inv); setShowView(true); };

  const openInvoice = async (inv) => {
    setSelected(inv);
    setShowInvoice(true);
    setInvoiceLoading(true);
    try {
      const { data } = await apiClient.get(`/billing/invoices/${inv.invoice_id}`)
      setSelected(data);
    } catch (err) {
      console.error('Failed to load invoice detail:', err);
    } finally {
      setInvoiceLoading(false);
    }
  };

  // ── Validation ──
  const validateForm = (f) => {
    const errors = { itemErrors: f.items.map(() => ({})) };

    if (!f.bookingId) errors.bookingId = 'Please select a booking';
    if (!f.guest || !f.guest.trim()) errors.guest = 'Guest name is required';
    if (!f.room || !String(f.room).trim()) errors.room = 'Room number is required';
    if (!f.checkIn) errors.checkIn = 'Check-in date is required';
    if (!f.checkOut) errors.checkOut = 'Check-out date is required';
    if (f.checkIn && f.checkOut && new Date(f.checkOut) <= new Date(f.checkIn)) {
      errors.checkOut = 'Check-out must be after check-in';
    }

    let hasValidItem = false;
    f.items.forEach((item, idx) => {
      const itemErr = {};
      if (!item.desc || !item.desc.trim()) itemErr.desc = 'Required';
      if (item.qty === '' || item.qty === null || Number(item.qty) <= 0) itemErr.qty = 'Must be > 0';
      if (item.rate === '' || item.rate === null || Number(item.rate) <= 0) itemErr.rate = 'Enter a rate';
      if (Object.keys(itemErr).length === 0) hasValidItem = true;
      errors.itemErrors[idx] = itemErr;
    });
    if (!hasValidItem) errors.items = 'Add at least one bill item with a description, quantity and rate';

    return errors;
  };

  const hasBlockingErrors = (errors) =>
    Object.entries(errors).some(([k, v]) => k !== 'itemErrors' && v) ||
    errors.itemErrors.some((ie) => Object.keys(ie).length > 0);

  const handleAdd = async () => {

    const errs = validateForm(form);
    setFormErrors(errs);
    if (hasBlockingErrors(errs)) {
        setFormError('Please fix the highlighted fields before generating the bill.');
        return;
    }

    setSaving(true);
    setFormError(null);

    try {
        const subtotal = form.items.reduce(
            (sum, item) => sum + Number(item.qty) * Number(item.rate),
            0
        );

        const tax = subtotal * 0.12;

        const payload = {
            booking_id: form.bookingId,

            room_charges:
                form.items.find(i => i.desc === "Room Charges")?.amount || 0,

            food_charges:
                form.items.find(i => i.desc === "Food Charges")?.amount || 0,

            laundry_charges:
                form.items.find(i => i.desc === "Laundry Charges")?.amount || 0,

            extra_service_charges:
                form.items
                    .filter(
                        i =>
                            i.desc !== "Room Charges" &&
                            i.desc !== "Food Charges" &&
                            i.desc !== "Laundry Charges"
                    )
                    .reduce((s, i) => s + Number(i.amount), 0),

            tax_amount: tax,
        };

        await apiClient.post("/billing/invoices", payload);

        setShowAdd(false);
        refreshAll();

    } catch (err) {
        console.log(err);
        setFormError(
            getApiErrorMessage(err, "Unable to generate invoice")
        );
    } finally {
        setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selected) return;

    const errs = validateForm(form);
    setFormErrors(errs);
    if (hasBlockingErrors(errs)) {
      setFormError('Please fix the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const subtotal = form.items.reduce(
        (sum, item) => sum + Number(item.qty) * Number(item.rate),
        0
      );
      const tax = selected?.tax === null || selected?.tax === undefined
        ? subtotal * 0.12
        : Number(selected.tax);

      const payload = {
        booking_id: form.bookingId,

        room_charges:
          form.items.find(i => i.desc === "Room Charges")?.amount || 0,

        food_charges:
          form.items.find(i => i.desc === "Food Charges")?.amount || 0,

        laundry_charges:
          form.items.find(i => i.desc === "Laundry Charges")?.amount || 0,

        extra_service_charges:
          form.items
            .filter(i => !["Room Charges", "Food Charges", "Laundry Charges"].includes(i.desc))
            .reduce((s, i) => s + Number(i.amount), 0),

        tax_amount: tax,
      };

      await apiClient.put(`/billing/invoices/${selected.invoice_id}`, payload);
      setShowEdit(false);
      refreshAll();
    } catch (err) {
      console.error('Failed to update invoice:', err);
      setFormError(getApiErrorMessage(err, 'Failed to update invoice. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));
    setFormError(null);
  };
  const handleItemChange = (idx,field,val) => {
    setForm(prev=>{
      const items=prev.items.map((it,i)=>{ if(i!==idx) return it; const u={...it,[field]:val}; u.amount=(parseFloat(u.rate)||0)*(parseFloat(u.qty)||0); return u; });
      return {...prev,items};
    });
    setFormErrors(prev => {
      if (!prev.itemErrors || !prev.itemErrors[idx] || !prev.itemErrors[idx][field]) return prev;
      const itemErrors = prev.itemErrors.map((ie, i) => i === idx ? { ...ie, [field]: undefined } : ie);
      return { ...prev, itemErrors, items: undefined };
    });
    setFormError(null);
  };
  const addItem    = () => setForm(prev=>({...prev,items:[...prev.items,emptyItem()]}));
  const removeItem = (idx) => {
    setForm(prev=>({...prev,items:prev.items.filter((_,i)=>i!==idx)}));
    setFormErrors(prev => {
      if (!prev.itemErrors) return prev;
      return { ...prev, itemErrors: prev.itemErrors.filter((_, i) => i !== idx) };
    });
  };

  const fmtChange = (pct) => {
    if (pct === undefined || pct === null) return null;
    const up = pct >= 0;
    return <span className={up ? '' : 'neg'}>{up ? '↑' : '↓'} {Math.abs(pct)}% from last month</span>;
  };

  const handleBookingChange = async (e) => {
    const bookingId = e.target.value;
    setFormError(null);
    setFormErrors(prev => ({ ...prev, bookingId: undefined }));

    if (!bookingId) {
        setForm(EMPTY_FORM);
        return;
    }

    try {
        const { data } = await apiClient.get(`/bookings/${bookingId}`);
        const checkIn = new Date(data.check_in);
        const checkOut = new Date(data.check_out);

        const nights = Math.max(
            1,
            Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
        );

        setForm({
            guest: data.full_name,
            bookingId: data.booking_id,
            room: data.room_number,
            checkIn: data.check_in.substring(0, 10),
            checkOut: data.check_out.substring(0, 10),
            items: [
                {
                    desc: "Room Charges",
                    qty: nights,
                    rate: '',
                    amount: 0,
                },
            ],
        });
        setFormError(null);
        setFormErrors({});
    } catch (err) {
        console.error(err);
        setFormError(getApiErrorMessage(err, "Unable to load booking details"));
        setFormErrors(prev => ({ ...prev, bookingId: 'Booking not found' }));
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left"><h2>Billing &amp; Invoices</h2><p>Manage bills, payments and invoices</p></div>
        <div className="page-header-right">

          {/* Date range badge — clickable, opens a from/to picker */}
          <div style={{ position: 'relative' }}>
            <button
              className="date-range-badge"
              style={{ cursor: 'pointer', border: 'none' }}
              onClick={openDatePicker}
            >
              <IcoCalendar/> {fmtDateBadge(dateRange.from)} – {fmtDateBadge(dateRange.to)}
            </button>

            {showDatePicker && (
              <div
                style={{
                  position: 'absolute', top: '110%', right: 0, zIndex: 20,
                  background: '#fff', border: '1px solid #e4e8f0', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: 16, width: 260,
                }}
              >
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">From</label>
                  <input
                    className="form-input"
                    type="date"
                    value={draftRange.from}
                    max={draftRange.to}
                    onChange={e => setDraftRange(prev => ({ ...prev, from: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">To</label>
                  <input
                    className="form-input"
                    type="date"
                    value={draftRange.to}
                    min={draftRange.from}
                    max={todayISO()}
                    onChange={e => setDraftRange(prev => ({ ...prev, to: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  {userPickedRangeRef.current && (
                    <button className="btn-cancel" onClick={resetToCurrentRange} title="Back to current month → today, auto-updating">
                      Use current range
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button className="btn-cancel" onClick={cancelDateRange}>Cancel</button>
                    <button className="btn-save" onClick={applyDateRange}>Apply</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button className="btn-generate" onClick={openAdd}><IcoPlus/>Generate New Bill</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="bill-stats">
        <div className="bstat-card"><div className="bstat-icon blue"><IcoBill/></div><div className="bstat-info"><div className="bstat-label">Total Bills</div><div className="bstat-value">{loadingWidgets ? '—' : Number(stats.totalBills||0).toLocaleString('en-IN')}</div><div className="bstat-change">{loadingWidgets ? '' : fmtChange(stats.changes?.totalBills)}</div></div></div>
        <div className="bstat-card"><div className="bstat-icon green"><IcoRevenue/></div><div className="bstat-info"><div className="bstat-label">Total Revenue</div><div className="bstat-value" style={{fontSize:17}}>{loadingWidgets ? '—' : fmtCurrency(stats.totalRevenue)}</div><div className="bstat-change">{loadingWidgets ? '' : fmtChange(stats.changes?.totalRevenue)}</div></div></div>
        <div className="bstat-card"><div className="bstat-icon teal"><IcoPaid/></div><div className="bstat-info"><div className="bstat-label">Paid Amount</div><div className="bstat-value" style={{fontSize:17}}>{loadingWidgets ? '—' : fmtCurrency(stats.paidAmount)}</div><div className="bstat-change">{loadingWidgets ? '' : fmtChange(stats.changes?.paidAmount)}</div></div></div>
        <div className="bstat-card"><div className="bstat-icon red"><IcoOutstand/></div><div className="bstat-info"><div className="bstat-label">Outstanding</div><div className="bstat-value" style={{fontSize:17}}>{loadingWidgets ? '—' : fmtCurrency(stats.outstanding)}</div><div className="bstat-change neg">{loadingWidgets ? '' : fmtChange(stats.changes?.outstanding)}</div></div></div>
      </div>

      {/* Tabs */}
      <div className="bill-tabs">
        {TABS.map(tab=>(
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
            {loadingTable ? (
              <tr><td colSpan={9} style={{textAlign:'center',padding:32,color:'#9ca3af'}}>Loading invoices…</td></tr>
            ) : tableError ? (
              <tr><td colSpan={9} style={{textAlign:'center',padding:32,color:'#ef4444'}}>{tableError}</td></tr>
            ) : invoices.length===0 ? (
              <tr><td colSpan={9} style={{textAlign:'center',padding:32,color:'#9ca3af'}}>No invoices found.</td></tr>
            ) : invoices.map((inv,idx)=>(
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
                <td style={{fontWeight:600}}>{fmtCurrency(inv.amount)}</td>
                <td style={{fontWeight:600,color:'#10b981'}}>{fmtCurrency(inv.paid)}</td>
                <td style={{fontWeight:600,color:inv.due>0?'#ef4444':'#1a1f36'}}>{fmtCurrency(inv.due)}</td>
                <td><span className={statusClass(inv.status)}>{inv.status}</span></td>
                <td>
                  <div className="action-btns">
                    <button className="btn-icon btn-icon-view"  title="View Details" onClick={()=>openView(inv)}><IcoEye/></button>
                    <button className="btn-icon btn-icon-edit"  title="Edit"         onClick={()=>openEdit(inv)}><IcoEdit/></button>
                    <button className="btn-icon btn-icon-print" title="Print / Download Invoice" onClick={()=>openInvoice(inv)}><IcoPrint/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">Showing {totalInvoices===0?0:(page-1)*PER_PAGE+1} to {Math.min(page*PER_PAGE,totalInvoices)} of {totalInvoices} invoices</span>
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
        <div className="revenue-card"><div className="revenue-title">Revenue Overview</div><RevenueChart data={revenueData}/></div>
        <div className="payment-methods-card">
          <div className="pm-title">Payment Methods</div>
          {paymentMethods.length===0 ? (
            <div style={{padding:'16px 0',textAlign:'center',color:'#9ca3af',fontSize:13}}>No payment data yet.</div>
          ) : (
            <div className="pm-donut-wrap">
              <DonutChart segments={paymentMethods} size={100} stroke={16} centerLabel="100%" centerSub="Total"/>
              <div className="pm-legend">{paymentMethods.map(p=><div className="pm-leg-item" key={p.label}><span className="pm-dot" style={{background:p.color}}/><span>{p.label}</span><span className="pm-pct">{p.pct}%</span></div>)}</div>
            </div>
          )}
        </div>
        <div className="recent-pay-card">
          <div className="rp-title">Recent Payments</div>
          {recentPayments.length===0 ? (
            <div style={{padding:'16px 0',textAlign:'center',color:'#9ca3af',fontSize:13}}>No recent payments.</div>
          ) : recentPayments.map((rp,i)=>(
            <div className="rp-item" key={i}>
              <div className="rp-avatar" style={{background:AVATAR_COLORS[i%AVATAR_COLORS.length]}}>{initials(rp.guest)}</div>
              <div className="rp-info"><div className="rp-name">{rp.guest}</div><div className="rp-inv">{rp.inv} · {rp.date}</div></div>
              <div className="rp-right"><div className="rp-amount">{rp.amount}</div><span className={statusClass(rp.status)} style={{fontSize:10,padding:'2px 7px'}}>{rp.status}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ MODALS ══ */}
      {showAdd  && (
        <BillFormModal
          title="Generate New Bill"
          form={form}
          formErrors={formErrors}
          formError={formError}
          bookings={bookings}
          saving={saving}
          onFormChange={handleFormChange}
          onItemChange={handleItemChange}
          onBookingChange={handleBookingChange}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showEdit && (
        <BillFormModal
          title="Edit Invoice"
          form={form}
          formErrors={formErrors}
          formError={formError}
          bookings={bookings}
          saving={saving}
          taxOverride={selected?.tax}
          submitLabel="Update Invoice"
          onFormChange={handleFormChange}
          onItemChange={handleItemChange}
          onBookingChange={handleBookingChange}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onSave={handleEdit}
          onClose={() => setShowEdit(false)}
        />
      )}

      {showInvoice && selected && (
        invoiceLoading
          ? <div className="modal-overlay" onClick={()=>setShowInvoice(false)}><div className="modal-box" onClick={e=>e.stopPropagation()} style={{padding:40,textAlign:'center',color:'#9ca3af'}}>Loading invoice…</div></div>
          : <InvoiceModal invoice={selected} onClose={()=>setShowInvoice(false)}/>
      )}
      {showView && selected && (
        <div className="modal-overlay" onClick={()=>setShowView(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>Invoice Details — {selected.id}</h3><button className="modal-close" onClick={()=>setShowView(false)}>×</button></div>
            <div className="modal-body">
              {[['Invoice No.',selected.id],['Booking ID',selected.bookingId],['Guest Name',selected.guest],['Room No.',selected.room],['Check-in',selected.checkIn],['Check-out',selected.checkOut],['Total Amount',fmtCurrency(selected.amount)],['Applied to Invoice',fmtCurrency(selected.paid)],['Net Paid',fmtCurrency(selected.netPaid||0)],['Refund Due',fmtCurrency(selected.refundDue||0)],['Due Amount',fmtCurrency(selected.due)],['Status',selected.status],['Payment Method',selected.method||'—']].map(([k,v])=>(
                <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-value">{v}</span></div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" style={{display:'flex',alignItems:'center',gap:6}} onClick={()=>{setShowView(false);openInvoice(selected);}}><IcoPrint/> Print Invoice</button>
              <button className="btn-save" onClick={()=>setShowView(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Billing;
