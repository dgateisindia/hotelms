// ============================================================
//  Reports.js — Reports & Analytics Page (logic + JSX only)
//  Sections: Stat cards, Revenue overview, Revenue by room type,
//            Occupancy overview, Occupancy by room type,
//            Daily booking trend, Top booking channels,
//            Monthly performance table, Revenue forecast, Insights
//  Icons  → ../../utils/icons/ReportsIcons.js
//  Styles → ../../styles/Reports.css
// ============================================================

import React, { useState } from 'react';
import '../../styles/Reports.css';
import {
  IcoCalendar, IcoExport, IcoRevenue, IcoOccupancy, IcoBookings,
  IcoCancel, IcoUsers, IcoArrowUp, IcoArrowRight, IcoChevron,
  IcoLightning, IcoTarget, IcoBolt,
} from '../../utils/icons/ReportsIcons';

// ── Sample Data ───────────────────────────────────────────────
const REVENUE_DATA = [
  { date:'01 May', thisPeriod:14000, lastPeriod:12000 },
  { date:'08 May', thisPeriod:18000, lastPeriod:15000 },
  { date:'15 May', thisPeriod:16000, lastPeriod:17000 },
  { date:'22 May', thisPeriod:24000, lastPeriod:19000 },
  { date:'31 May', thisPeriod:28000, lastPeriod:22000 },
];

const REVENUE_BY_ROOM = [
  { label:'Deluxe Room',       pct:35.0, color:'#3b82f6' },
  { label:'Premium Room',      pct:28.0, color:'#10b981' },
  { label:'Suite Room',        pct:20.0, color:'#f59e0b' },
  { label:'Executive Room',    pct:10.0, color:'#8b5cf6' },
  { label:'Presidential Suite',pct:7.0,  color:'#ef4444' },
];

const OCCUPANCY_BY_ROOM = [
  { label:'Deluxe Room',        pct:72 },
  { label:'Premium Room',       pct:65 },
  { label:'Suite Room',         pct:58 },
  { label:'Executive Room',     pct:55 },
  { label:'Presidential Suite', pct:48 },
];

const DAILY_BOOKINGS = [38, 52, 44, 60, 48, 70, 55, 62, 58, 75, 50, 68, 42, 80, 65, 58, 72, 48, 90, 55, 62, 70, 48, 65, 58, 72, 50, 80, 60, 95, 70];

const TOP_CHANNELS = [
  { label:'Direct Booking', pct:42, color:'#3b82f6' },
  { label:'Booking.com',    pct:28, color:'#10b981' },
  { label:'MakeMyTrip',     pct:15, color:'#f59e0b' },
  { label:'Expedia',        pct:10, color:'#8b5cf6' },
  { label:'Others',         pct:5,  color:'#9ca3af' },
];

const MONTHLY_SUMMARY = [
  { month:'May 2024', revenue:'24,50,000', occ:'62.5%', adr:'6,600', revpar:'4,125', bookings:'1,248' },
  { month:'Apr 2024', revenue:'21,25,000', occ:'57.6%', adr:'6,300', revpar:'3,629', bookings:'1,127' },
  { month:'Mar 2024', revenue:'19,80,000', occ:'55.2%', adr:'6,100', revpar:'3,366', bookings:'1,043' },
  { month:'Feb 2024', revenue:'18,30,000', occ:'52.3%', adr:'5,900', revpar:'3,086', bookings:'982'   },
  { month:'Jan 2024', revenue:'16,75,000', occ:'50.1%', adr:'5,700', revpar:'2,854', bookings:'915'   },
];

const FORECAST_DATA = [
  { day:'01 Jun', actual:18000, forecast:18000 },
  { day:'08 Jun', actual:20000, forecast:21000 },
  { day:'15 Jun', actual:null,  forecast:24000 },
  { day:'22 Jun', actual:null,  forecast:27000 },
  { day:'30 Jun', actual:null,  forecast:30000 },
];

const INSIGHTS = [
  { icon:<IcoArrowUp/>, color:'green',  text:'Revenue is up by 15.2% compared to last month.' },
  { icon:<IcoArrowUp/>, color:'blue',   text:'Occupancy rate improved by 8.7% compared to last month.' },
  { icon:<IcoBolt/>,    color:'gold',   text:'Deluxe Rooms are generating the highest revenue.' },
  { icon:<IcoTarget/>,  color:'purple', text:'Direct bookings contribute 42% of total bookings.' },
];

// ── Line Chart (Revenue Overview, dual line) ───────────────────
const RevenueLineChart = ({ data }) => {
  const W=600, H=180, PAD={top:14,right:16,bottom:28,left:48};
  const iW=W-PAD.left-PAD.right, iH=H-PAD.top-PAD.bottom;
  const max=Math.max(...data.map(d=>Math.max(d.thisPeriod,d.lastPeriod)));
  const x=(i)=>PAD.left+(i/(data.length-1))*iW;
  const y=(v)=>PAD.top+iH-((v/max)*iH);
  const line1=data.map((d,i)=>`${i===0?'M':'L'}${x(i)},${y(d.thisPeriod)}`).join(' ');
  const line2=data.map((d,i)=>`${i===0?'M':'L'}${x(i)},${y(d.lastPeriod)}`).join(' ');
  const area1=`${line1} L${x(data.length-1)},${PAD.top+iH} L${x(0)},${PAD.top+iH} Z`;
  const ticks=[0,Math.round(max*0.25),Math.round(max*0.5),Math.round(max*0.75),max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}}>
      <defs>
        <linearGradient id="revLineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      {ticks.map(t=>(
        <g key={t}>
          <line x1={PAD.left} y1={y(t)} x2={W-PAD.right} y2={y(t)} stroke="#f1f4f9" strokeWidth="1"/>
          <text x={PAD.left-6} y={y(t)+4} textAnchor="end" fontSize="10" fill="#9ca3af">{t===0?'0':`${Math.round(t/1000)}k`}</text>
        </g>
      ))}
      <path d={area1} fill="url(#revLineGrad)"/>
      {/* Last period dashed */}
      <path d={line2} fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="5,4" strokeLinejoin="round" strokeLinecap="round"/>
      {/* This period solid */}
      <path d={line1} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d,i)=><circle key={i} cx={x(i)} cy={y(d.thisPeriod)} r="4" fill="#fff" stroke="#3b82f6" strokeWidth="2.5"/>)}
      {data.map((d,i)=><text key={i} x={x(i)} y={H-8} textAnchor="middle" fontSize="10" fill="#9ca3af">{d.date}</text>)}
    </svg>
  );
};

// ── Donut Chart ───────────────────────────────────────────────
const DonutChart = ({ segments, size=110, stroke=18, centerContent }) => {
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
      {centerContent}
    </div>
  );
};

// ── Mini Forecast Line Chart ───────────────────────────────────
const ForecastChart = ({ data }) => {
  const W=300, H=120, PAD={top:10,right:10,bottom:20,left:36};
  const iW=W-PAD.left-PAD.right, iH=H-PAD.top-PAD.bottom;
  const allVals = data.flatMap(d=>[d.actual,d.forecast]).filter(v=>v!=null);
  const max=Math.max(...allVals);
  const x=(i)=>PAD.left+(i/(data.length-1))*iW;
  const y=(v)=>PAD.top+iH-((v/max)*iH);

  const actualPts = data.map((d,i)=>d.actual!=null?[x(i),y(d.actual)]:null).filter(Boolean);
  const forecastPts = data.map((d,i)=>[x(i),y(d.forecast)]);

  const actualLine = actualPts.map((p,i)=>`${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ');
  const forecastLine = forecastPts.map((p,i)=>`${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ');
  const area = `${forecastLine} L${x(data.length-1)},${PAD.top+iH} L${x(0)},${PAD.top+iH} Z`;
  const ticks=[0,Math.round(max*0.5),max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}}>
      <defs>
        <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      {ticks.map(t=>(
        <g key={t}>
          <line x1={PAD.left} y1={y(t)} x2={W-PAD.right} y2={y(t)} stroke="#f1f4f9" strokeWidth="1"/>
          <text x={PAD.left-4} y={y(t)+4} textAnchor="end" fontSize="9" fill="#9ca3af">{t===0?'0':`${Math.round(t/1000)}k`}</text>
        </g>
      ))}
      <path d={area} fill="url(#forecastGrad)"/>
      <path d={forecastLine} fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4,3" strokeLinejoin="round" strokeLinecap="round"/>
      <path d={actualLine} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d,i)=><text key={i} x={x(i)} y={H-2} textAnchor="middle" fontSize="8" fill="#9ca3af">{d.day}</text>)}
    </svg>
  );
};

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Reports() {
  const [dateRange] = useState('01 May 2024 - 31 May 2024');

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>Reports &amp; Analytics</h2>
          <p>Data-driven insights for better decisions and higher performance</p>
        </div>
        <div className="page-header-right">
          <div className="date-range-badge"><IcoCalendar/> {dateRange} <IcoChevron/></div>
          <button className="btn-export-report"><IcoExport/> Export Report</button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="rep-stats">
        <div className="repstat-card">
          <div className="repstat-icon green"><IcoRevenue/></div>
          <div><div className="repstat-label">Total Revenue</div><div className="repstat-value">₹ 24,50,000</div><div className="repstat-change"><IcoArrowUp/> 15.2% from Apr 2024</div></div>
        </div>
        <div className="repstat-card">
          <div className="repstat-icon blue"><IcoOccupancy/></div>
          <div><div className="repstat-label">Occupancy Rate</div><div className="repstat-value">62.5%</div><div className="repstat-change"><IcoArrowUp/> 8.7% from Apr 2024</div></div>
        </div>
        <div className="repstat-card">
          <div className="repstat-icon purple"><IcoBookings/></div>
          <div><div className="repstat-label">Total Bookings</div><div className="repstat-value">1,248</div><div className="repstat-change"><IcoArrowUp/> 10.8% from Apr 2024</div></div>
        </div>
        <div className="repstat-card">
          <div className="repstat-icon red"><IcoCancel/></div>
          <div><div className="repstat-label">Cancellation Rate</div><div className="repstat-value">6.2%</div><div className="repstat-change neg"><IcoArrowUp/> 1.3% from Apr 2024</div></div>
        </div>
        <div className="repstat-card">
          <div className="repstat-icon teal"><IcoUsers/></div>
          <div><div className="repstat-label">RevPAR</div><div className="repstat-value">₹ 4,125</div><div className="repstat-change"><IcoArrowUp/> 12.5% from Apr 2024</div></div>
        </div>
      </div>

      {/* ── Row 1: Revenue Overview | Revenue by Room Type | Occupancy Overview ── */}
      <div className="rep-row-1">

        {/* Revenue Overview */}
        <div className="rep-card">
          <div className="rep-card-title">Revenue Overview</div>
          <RevenueLineChart data={REVENUE_DATA}/>
          <div className="rep-legend-inline">
            <div className="rep-legend-item"><span className="rep-legend-dash solid"/> This Period</div>
            <div className="rep-legend-item"><span className="rep-legend-dash dashed"/> Last Period</div>
          </div>
        </div>

        {/* Revenue by Room Type */}
        <div className="rep-card">
          <div className="rep-card-title">Revenue by Room Type</div>
          <div className="donut-wrap-rep">
            <div style={{position:'relative'}}>
              <DonutChart
                segments={REVENUE_BY_ROOM}
                size={110} stroke={20}
                centerContent={
                  <div className="donut-center-rep">
                    <span className="donut-amt-rep">₹ 24,50,000</span>
                    <span className="donut-sub-rep">Total Revenue</span>
                  </div>
                }
              />
            </div>
            <div className="donut-legend-rep">
              {REVENUE_BY_ROOM.map(r=>(
                <div className="donut-leg-item-rep" key={r.label}>
                  <span className="donut-dot-rep" style={{background:r.color}}/>
                  <span>{r.label}</span>
                  <span className="donut-pct-rep">{r.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Occupancy Overview */}
        <div className="rep-card">
          <div className="rep-card-title">Occupancy Overview</div>
          <div className="occ-donut-wrap">
            <div style={{position:'relative'}}>
              <DonutChart
                segments={[{pct:62.5,color:'#10b981'},{pct:37.5,color:'#f1f4f9'}]}
                size={120} stroke={16}
                centerContent={
                  <div className="occ-center">
                    <span className="occ-pct">62.5%</span>
                    <span className="occ-label">Occupancy Rate</span>
                  </div>
                }
              />
            </div>
            <div className="occ-change"><IcoArrowUp/> 8.7% from Apr 2024</div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Occupancy by Room Type | Daily Booking Trend | Top Booking Channels ── */}
      <div className="rep-row-2">

        {/* Occupancy by Room Type — horizontal bars */}
        <div className="rep-card">
          <div className="rep-card-title">Occupancy by Room Type</div>
          {OCCUPANCY_BY_ROOM.map(r=>(
            <div className="hbar-item" key={r.label}>
              <div className="hbar-top"><span className="hbar-label">{r.label}</span><span className="hbar-pct">{r.pct}%</span></div>
              <div className="hbar-track"><div className="hbar-fill" style={{width:`${r.pct}%`}}/></div>
            </div>
          ))}
          <div className="hbar-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
        </div>

        {/* Daily Booking Trend — vertical bars */}
        <div className="rep-card">
          <div className="rep-card-title">Daily Booking Trend</div>
          <div className="vbar-wrap">
            {DAILY_BOOKINGS.map((v,i)=>(
              <div className="vbar-col" key={i}>
                <div className="vbar-bar" style={{height:`${(v/Math.max(...DAILY_BOOKINGS))*100}%`}}/>
              </div>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#9ca3af',marginTop:4}}>
            <span>01 May</span><span>08 May</span><span>15 May</span><span>22 May</span><span>31 May</span>
          </div>
          <div className="vbar-legend"><span className="vbar-legend-dot"/> Bookings</div>
        </div>

        {/* Top Booking Channels */}
        <div className="rep-card">
          <div className="rep-card-title">Top Booking Channels</div>
          {TOP_CHANNELS.map(c=>(
            <div className="channel-item" key={c.label}>
              <div className="channel-top"><span className="channel-label">{c.label}</span><span className="channel-pct">{c.pct}%</span></div>
              <div className="channel-track"><div className="channel-fill" style={{width:`${c.pct}%`,background:c.color}}/></div>
            </div>
          ))}
          <div className="channel-axis"><span>0%</span><span>20%</span><span>40%</span><span>60%</span><span>80%</span><span>100%</span></div>
        </div>
      </div>

      {/* ── Row 3: Monthly Performance | Revenue Forecast | Insights ── */}
      <div className="rep-row-3">

        {/* Monthly Performance Summary table */}
        <div className="rep-card">
          <div className="rep-card-title">Monthly Performance Summary</div>
          <table className="perf-table">
            <thead>
              <tr>
                <th>Month</th><th>Total Revenue (₹)</th><th>Occupancy Rate</th>
                <th>Average Daily Rate (₹)</th><th>RevPAR (₹)</th><th>Total Bookings</th>
              </tr>
            </thead>
            <tbody>
              {MONTHLY_SUMMARY.map(m=>(
                <tr key={m.month}>
                  <td style={{fontWeight:600}}>{m.month}</td>
                  <td>{m.revenue}</td>
                  <td>{m.occ}</td>
                  <td>{m.adr}</td>
                  <td>{m.revpar}</td>
                  <td>{m.bookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="view-detail-link">View Detailed Report <IcoArrowRight/></div>
        </div>

        {/* Revenue Forecast */}
        <div className="rep-card">
          <div className="rep-card-title">Revenue Forecast (Next 30 Days)</div>
          <ForecastChart data={FORECAST_DATA}/>
          <div className="forecast-legend">
            <div className="rep-legend-item"><span className="rep-legend-dash solid" style={{background:'#10b981'}}/> Actual</div>
            <div className="rep-legend-item"><span className="rep-legend-dash dashed"/> Forecast</div>
          </div>
        </div>

        {/* Insights */}
        <div className="rep-card">
          <div className="rep-card-title">Insights</div>
          {INSIGHTS.map((ins,i)=>(
            <div className="insight-item" key={i}>
              <div className={`insight-icon ${ins.color}`}>{ins.icon}</div>
              <span>{ins.text}</span>
            </div>
          ))}
          <div className="view-all-insights">View All Insights <IcoArrowRight/></div>
        </div>
      </div>
    </>
  );
}

export default Reports;
