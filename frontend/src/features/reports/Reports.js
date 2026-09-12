// ============================================================
//  Reports.js — Reports & Analytics Page (logic + JSX only)
//  Data is fetched from GET /api/reports/overview?period=...
//  A "view" dropdown (Revenue / Bookings / Rooms / Staff) controls
//  which detail cards render below the always-visible stat row.
//  Defaults to Revenue when nothing is selected.
//  Icons  → ../../utils/icons/ReportsIcons.js
//  Styles → ../../styles/Reports.css
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient, { getApiErrorMessage } from '../../shared/api/apiClient';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './Reports.css';
import {
  IcoCalendar, IcoExport, IcoRevenue, IcoOccupancy, IcoBookings,
  IcoCancel, IcoUsers, IcoArrowUp, IcoArrowRight, IcoChevron,
  IcoLightning, IcoTarget, IcoBolt,
} from '../../utils/icons/ReportsIcons';

// Not exported from ReportsIcons — defined locally instead of touching that file.
const IcoArrowDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const PERIOD_TITLE = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

const VIEWS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'rooms', label: 'Rooms' },
  { value: 'staff', label: 'Staff' },
];

const VIEW_HEADER = {
  revenue: { title: 'Reports & Analytics', subtitle: 'Data-driven insights for better decisions and higher performance' },
  bookings: { title: 'Booking Reports & Analytics', subtitle: 'Track booking trends, status, and occupancy performance' },
  rooms: { title: 'Room Reports & Analytics', subtitle: 'Monitor room occupancy and revenue by room type' },
  staff: { title: 'Staff Reports & Analytics', subtitle: 'Review staff headcount, attendance, and department distribution' },
};

// ── Dual-series chart (line / area / bar) ──────────────────────
const DualSeriesChart = ({ data, aKey, bKey, type = 'line', aColor = '#3b82f6', bColor = '#9ca3af', gradId }) => {
  const W = 600, H = 180, PAD = { top: 14, right: 16, bottom: 28, left: 48 };
  const iW = W - PAD.left - PAD.right, iH = H - PAD.top - PAD.bottom;
  const n = data.length;
  const allVals = data.flatMap(d => [d[aKey], d[bKey]]).filter(v => v != null);
  const max = Math.max(1, ...allVals);
  const x = (i) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * iW);
  const y = (v) => PAD.top + iH - ((v / max) * iH);
  const ticks = [0, Math.round(max * 0.25), Math.round(max * 0.5), Math.round(max * 0.75), max];

  const axisEls = (
    <>
      {ticks.map(t => (
        <g key={t}>
          <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke="#f1f4f9" strokeWidth="1" />
          <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{t === 0 ? '0' : `${Math.round(t / 1000)}k`}</text>
        </g>
      ))}
      {data.map((d, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">{d.label}</text>)}
    </>
  );

  if (type === 'bar') {
    const groupW = n > 0 ? iW / n : iW;
    const barW = Math.min(18, groupW * 0.32);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {axisEls}
        {data.map((d, i) => {
          const cx = x(i);
          return (
            <g key={i}>
              {d[bKey] != null && (
                <rect x={cx - barW - 2} y={y(d[bKey])} width={barW} height={Math.max(0, (PAD.top + iH) - y(d[bKey]))} fill={bColor} opacity={0.55} rx={2} />
              )}
              {d[aKey] != null && (
                <rect x={cx + 2} y={y(d[aKey])} width={barW} height={Math.max(0, (PAD.top + iH) - y(d[aKey]))} fill={aColor} rx={2} />
              )}
            </g>
          );
        })}
      </svg>
    );
  }

  const buildPath = (key) => {
    let path = ''; let started = false;
    data.forEach((d, i) => {
      const v = d[key];
      if (v == null) { started = false; return; }
      path += `${started ? 'L' : 'M'}${x(i)},${y(v)} `;
      started = true;
    });
    return path.trim();
  };

  const hasNullA = data.some(d => d[aKey] == null);
  const lineA = buildPath(aKey);
  const lineB = buildPath(bKey);
  const areaKey = hasNullA ? bKey : aKey;
  const areaColor = areaKey === aKey ? aColor : bColor;
  const areaLine = buildPath(areaKey);
  const areaPath = areaLine ? `${areaLine} L${x(n - 1)},${PAD.top + iH} L${x(0)},${PAD.top + iH} Z` : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={areaColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={areaColor} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {axisEls}
      {areaPath && (type === 'area' || !hasNullA) && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path d={lineB} fill="none" stroke={bColor} strokeWidth="2" strokeDasharray="5,4" strokeLinejoin="round" strokeLinecap="round" />
      <path d={lineA} fill="none" stroke={aColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => d[aKey] != null && <circle key={i} cx={x(i)} cy={y(d[aKey])} r="4" fill="#fff" stroke={aColor} strokeWidth="2.5" />)}
    </svg>
  );
};

// ── Single-series chart (bar / line) ─
const SingleSeriesChart = ({ data, valueKey, type = 'bar', color = '#3b82f6' }) => {
  const W = 600, H = 150, PAD = { top: 10, right: 10, bottom: 22, left: 30 };
  const iW = W - PAD.left - PAD.right, iH = H - PAD.top - PAD.bottom;
  const n = data.length;
  const max = Math.max(1, ...data.map(d => d[valueKey] || 0));
  const x = (i) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * iW);
  const y = (v) => PAD.top + iH - ((v / max) * iH);

  if (type === 'line') {
    const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d[valueKey] || 0)}`).join(' ');
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d[valueKey] || 0)} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />)}
        {data.map((d, i) => <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">{d.label}</text>)}
      </svg>
    );
  }

  const groupW = n > 0 ? iW / n : iW;
  const barW = Math.min(24, groupW * 0.6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {data.map((d, i) => (
        <rect key={i} x={x(i) - barW / 2} y={y(d[valueKey] || 0)} width={barW} height={Math.max(0, (PAD.top + iH) - y(d[valueKey] || 0))} fill={color} rx={2} />
      ))}
      {data.map((d, i) => <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">{d.label}</text>)}
    </svg>
  );
};

// ── Donut Chart ───────────────────────────────────────────────
const DonutChart = ({ segments, size = 110, stroke = 18, centerContent }) => {
  const R = ((size - stroke) / 2), CX = size / 2, circ = 2 * Math.PI * R;
  const total = segments.reduce((s, sg) => s + sg.pct, 0) || 1;
  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={CX} cy={CX} r={R} fill="none" stroke="#f1f4f9" strokeWidth={stroke} />
        {segments.map((sg, i) => {
          const dash = (sg.pct / total) * circ;
          const el = <circle key={i} cx={CX} cy={CX} r={R} fill="none" stroke={sg.color} strokeWidth={stroke} strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-offset} transform={`rotate(-90 ${CX} ${CX})`} />;
          offset += dash; return el;
        })}
      </svg>
      {centerContent}
    </div>
  );
};

// ── Horizontal bar list ──
const HBarList = ({ items, axisMax = 100 }) => (
  <>
    {items.map(item => (
      <div className="hbar-item" key={item.label}>
        <div className="hbar-top"><span className="hbar-label">{item.label}</span><span className="hbar-pct">{item.pct}%</span></div>
        <div className="hbar-track"><div className="hbar-fill" style={{ width: `${item.pct}%`, background: item.color }} /></div>
      </div>
    ))}
    <div className="hbar-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
  </>
);

// ── Small chart-type picker ────────────────
const ChartTypePicker = ({ value, onChange, options }) => (
  <select
    className="chart-type-picker"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{ fontSize: 12, border: '1px solid #e4e8f0', borderRadius: 6, padding: '2px 6px', color: '#6b7280', background: '#fff' }}
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const CardHeader = ({ title, chartType, onChartTypeChange, options }) => (
  <div className="rep-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span>{title}</span>
    {options && <ChartTypePicker value={chartType} onChange={onChartTypeChange} options={options} />}
  </div>
);

const formatINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

const escapeCsv = (val) => {
  const s = String(val ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function buildReportCsv(data, anchorDate, view) {
  const {
    period, rangeLabel, stats, revenueTrend, revenueByRoom, occupancyByRoom,
    bookingTrend, bookingStatusBreakdown, monthlySummary, forecast, insights,
    staffOverview,
  } = data;
  const lines = [];

  lines.push('Hotel Management System - Reports Export');
  lines.push(`View,${view}`);
  lines.push(`Period,${period}`);
  lines.push(`Anchor Date,${anchorDate}`);
  lines.push(`Range,${rangeLabel}`);
  lines.push('');

  lines.push('Summary Stats');
  lines.push('Metric,Value,Change vs Previous Period');
  if (view === 'bookings') {
    lines.push(`Rooms Occupied,${stats.occupiedRooms} / ${stats.totalRoomsCount},`);
  } else {
    lines.push(`Total Revenue,${stats.totalRevenue},${stats.totalRevenueChangePct}%`);
  }
  lines.push(`Occupancy Rate,${stats.occupancyRate}%,${stats.occupancyRateChangePct}%`);
  lines.push(`Total Bookings,${stats.totalBookings},${stats.totalBookingsChangePct}%`);
  lines.push(`Cancellation Rate,${stats.cancellationRate}%,${stats.cancellationRateChangePp} pts`);
  lines.push(`RevPAR,${stats.revpar},`);
  lines.push('');

  if (view === 'revenue') {
    lines.push('Revenue Trend');
    lines.push('Label,This Period,Last Period');
    revenueTrend.forEach(r => lines.push(`${escapeCsv(r.label)},${r.thisPeriod},${r.lastPeriod}`));
    lines.push('');

    lines.push('Revenue by Room Type');
    lines.push('Room Type,Percent of Revenue');
    revenueByRoom.forEach(r => lines.push(`${escapeCsv(r.label)},${r.pct}%`));
    lines.push('');

    lines.push('Monthly Performance Summary (last 6 calendar months)');
    lines.push('Month,Total Revenue,Occupancy Rate,Average Daily Rate,RevPAR,Total Bookings');
    monthlySummary.forEach(m => lines.push(`${escapeCsv(m.month)},${m.revenue},${m.occ}%,${m.adr},${m.revpar},${m.bookings}`));
    lines.push('');

    lines.push('Revenue Forecast');
    lines.push('Label,Actual,Forecast');
    forecast.forEach(f => lines.push(`${escapeCsv(f.label)},${f.actual ?? ''},${f.forecast}`));
    lines.push('');

    lines.push('Insights');
    insights.forEach(i => lines.push(escapeCsv(i.text)));
  } else if (view === 'bookings') {
    lines.push(`${period.charAt(0).toUpperCase() + period.slice(1)} Booking Trend`);
    lines.push('Label,Bookings');
    bookingTrend.forEach(r => lines.push(`${escapeCsv(r.label)},${r.count}`));
    lines.push('');

    lines.push('Booking Status Breakdown');
    lines.push('Status,Percent');
    bookingStatusBreakdown.forEach(r => lines.push(`${escapeCsv(r.label)},${r.pct}%`));
    lines.push('');

    lines.push('Monthly Performance Summary (last 6 calendar months)');
    lines.push('Month,Total Bookings,Occupancy Rate');
    monthlySummary.forEach(m => lines.push(`${escapeCsv(m.month)},${m.bookings},${m.occ}%`));
    lines.push('');

    lines.push('Insights');
    insights.forEach(i => lines.push(escapeCsv(i.text)));
  } else if (view === 'rooms') {
    lines.push('Occupancy by Room Type');
    lines.push('Room Type,Occupancy %');
    occupancyByRoom.forEach(r => lines.push(`${escapeCsv(r.label)},${r.pct}%`));
    lines.push('');

    lines.push('Revenue by Room Type');
    lines.push('Room Type,Percent of Revenue');
    revenueByRoom.forEach(r => lines.push(`${escapeCsv(r.label)},${r.pct}%`));
    lines.push('');

    lines.push('Monthly Performance Summary (last 6 calendar months)');
    lines.push('Month,Occupancy Rate,RevPAR');
    monthlySummary.forEach(m => lines.push(`${escapeCsv(m.month)},${m.occ}%,${m.revpar}`));
    lines.push('');

    lines.push('Insights');
    insights.forEach(i => lines.push(escapeCsv(i.text)));
  } else if (view === 'staff' && staffOverview) {
    lines.push('Staff Summary');
    lines.push('Metric,Value');
    lines.push(`Total Staff,${staffOverview.totalStaff}`);
    lines.push(`Active,${staffOverview.activeStaff}`);
    lines.push(`On Leave,${staffOverview.onLeaveStaff}`);
    lines.push(`Attendance Rate (selected range),${staffOverview.attendanceRate}%`);
    lines.push('');

    lines.push('Staff by Department');
    lines.push('Department,Percent of Staff');
    staffOverview.staffByDept.forEach(d => lines.push(`${escapeCsv(d.label)},${d.pct}%`));
    lines.push('');

    lines.push(`${period.charAt(0).toUpperCase() + period.slice(1)} Attendance Rate`);
    lines.push('Label,Attendance %');
    staffOverview.attendanceTrend.forEach(r => lines.push(`${escapeCsv(r.label)},${r.count}%`));
    lines.push('');

    lines.push('Attendance Status Breakdown');
    lines.push('Status,Percent');
    staffOverview.attendanceStatusBreakdown.forEach(r => lines.push(`${escapeCsv(r.label)},${r.pct}%`));
    lines.push('');

    lines.push('Staff Monthly Summary (last 6 calendar months)');
    lines.push('Month,Total Staff,Attendance Rate');
    staffOverview.staffMonthlySummary.forEach(m => lines.push(`${escapeCsv(m.month)},${m.totalStaff},${m.attendanceRate}%`));
    lines.push('');

    lines.push('Insights');
    staffOverview.insights.forEach(i => lines.push(escapeCsv(i.text)));
  }

  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
const todayStr = () => new Date().toISOString().slice(0, 10);

function Reports() {
  const [period, setPeriod] = useState('monthly');
  const [anchorDate, setAnchorDate] = useState(todayStr());
  const [view, setView] = useState('revenue'); // revenue | bookings | rooms | staff — defaults to revenue
  const dateInputRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const statsRef = useRef(null);
  const row1Ref = useRef(null);
  const row2Ref = useRef(null);
  const row3Ref = useRef(null);

  const [chartTypes, setChartTypes] = useState({
    revenue: 'line',        // line | area | bar
    bookingTrend: 'bar',    // bar | line
    revenueByRoom: 'donut', // donut | bar
    occupancyByRoom: 'bar', // bar | donut
    statusBreakdown: 'bar', // bar | donut
    forecast: 'line',       // line | bar
    attendanceTrend: 'bar', // bar | line
  });

  const setChartType = (key, value) => setChartTypes(prev => ({ ...prev, [key]: value }));

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/reports/overview', { params: { period, date: anchorDate } });
      setData(res.data.data);
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, 'Could not load report data. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [period, anchorDate]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleExport = () => {
    if (!data) return;
    const csvContent = buildReportCsv(data, anchorDate, view);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hotel-report-${view}-${data.period}-${anchorDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!data || exportingPdf) return;
    setExportingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;
      let cursorY = margin;

      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text(VIEW_HEADER[view].title, margin, cursorY + 10);
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(110);
      pdf.text(
        `${VIEWS.find(v => v.value === view)?.label} view  |  ${PERIOD_TITLE[data.period]}  |  Range: ${data.rangeLabel}  |  Generated ${new Date().toLocaleString('en-IN')}`,
        margin, cursorY + 26
      );
      pdf.setTextColor(0);
      cursorY += 46;

      const captureOpts = {
        scale: 2,
        backgroundColor: '#ffffff',
        ignoreElements: (el) => el.tagName === 'SELECT',
      };

      const sections = [statsRef, row1Ref, row2Ref, row3Ref];
      for (const ref of sections) {
        if (!ref.current) continue;
        const canvas = await html2canvas(ref.current, captureOpts);
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (cursorY + imgHeight > pageHeight - margin && cursorY > margin) {
          pdf.addPage();
          cursorY = margin;
        }
        pdf.addImage(imgData, 'PNG', margin, cursorY, imgWidth, imgHeight);
        cursorY += imgHeight + 14;
      }

      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 60, pageHeight - 14);
      }

      pdf.save(`hotel-report-${view}-${data.period}-${anchorDate}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate the PDF — check the browser console for details.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading && !data) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading reports…</div>;
  }
  if (error) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error}</div>;
  }
  if (!data) return null;

  const {
    stats, revenueTrend, revenueByRoom, occupancyByRoom, bookingTrend,
    bookingStatusBreakdown, monthlySummary, forecast, insights, staffOverview,
  } = data;

  const changeBadge = (pct) => (
    <div className={`repstat-change ${pct < 0 ? 'neg' : ''}`}>
      {pct >= 0 ? <IcoArrowUp /> : <IcoArrowDown />} {Math.abs(pct)}% from previous period
    </div>
  );

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>{VIEW_HEADER[view].title}</h2>
          <p>{VIEW_HEADER[view].subtitle}</p>
        </div>
        <div className="page-header-right">
          <select
            value={view}
            onChange={(e) => setView(e.target.value)}
            title="Choose what to report on — defaults to Revenue"
            style={{ fontSize: 13, border: '1px solid #e4e8f0', borderRadius: 6, padding: '6px 10px', color: '#374151', background: '#fff', cursor: 'pointer' }}
          >
            {VIEWS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
          <div className="date-range-badge" style={{ display: 'flex', gap: 4, padding: 4, alignItems: 'center', position: 'relative' }}>
            <button
              type="button"
              title="Choose a date"
              onClick={() => {
                const el = dateInputRef.current;
                if (!el) return;
                if (typeof el.showPicker === 'function') el.showPicker();
                else el.focus();
              }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px' }}
            >
              <IcoCalendar />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={anchorDate}
              max={todayStr()}
              onChange={(e) => e.target.value && setAnchorDate(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: 13, color: '#374151', cursor: 'pointer', width: 118 }}
            />
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  border: 'none', cursor: 'pointer', borderRadius: 6, padding: '4px 10px', fontSize: 13,
                  background: period === p.value ? '#3b82f6' : 'transparent',
                  color: period === p.value ? '#fff' : '#374151',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button className="btn-export-report" onClick={handleExport} disabled={!data} style={!data ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            <IcoExport /> Export CSV
          </button>
          <button
            className="btn-export-report"
            onClick={handleExportPdf}
            disabled={!data || exportingPdf}
            style={(!data || exportingPdf) ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            <IcoExport /> {exportingPdf ? 'Generating PDF…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Stat Cards — fully customized per view ── */}
      <div className="rep-stats" ref={statsRef}>
        {view === 'staff' && staffOverview ? (
          <>
            <div className="repstat-card">
              <div className="repstat-icon teal"><IcoUsers /></div>
              <div><div className="repstat-label">Total Staff</div><div className="repstat-value">{staffOverview.totalStaff}</div></div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon green"><IcoOccupancy /></div>
              <div><div className="repstat-label">Active Staff</div><div className="repstat-value">{staffOverview.activeStaff}</div></div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon red"><IcoCancel /></div>
              <div><div className="repstat-label">On Leave</div><div className="repstat-value">{staffOverview.onLeaveStaff}</div></div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon blue"><IcoBookings /></div>
              <div><div className="repstat-label">Attendance Rate</div><div className="repstat-value">{staffOverview.attendanceRate}%</div></div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon purple"><IcoRevenue /></div>
              <div><div className="repstat-label">Departments</div><div className="repstat-value">{staffOverview.staffByDept.length}</div></div>
            </div>
          </>
        ) : view === 'rooms' ? (
          <>
            <div className="repstat-card">
              <div className="repstat-icon blue"><IcoOccupancy /></div>
              <div><div className="repstat-label">Occupancy Rate</div><div className="repstat-value">{stats.occupancyRate}%</div>{changeBadge(stats.occupancyRateChangePct)}</div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon purple"><IcoBookings /></div>
              <div><div className="repstat-label">Rooms Occupied</div><div className="repstat-value">{stats.occupiedRooms} / {stats.totalRoomsCount}</div></div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon teal"><IcoUsers /></div>
              <div><div className="repstat-label">RevPAR</div><div className="repstat-value">{formatINR(stats.revpar)}</div></div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon green"><IcoRevenue /></div>
              <div><div className="repstat-label">Room Revenue</div><div className="repstat-value">{formatINR(stats.totalRevenue)}</div>{changeBadge(stats.totalRevenueChangePct)}</div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon red"><IcoCancel /></div>
              <div><div className="repstat-label">Cancellation Rate</div><div className="repstat-value">{stats.cancellationRate}%</div>
                <div className={`repstat-change ${stats.cancellationRateChangePp > 0 ? 'neg' : ''}`}>
                  {stats.cancellationRateChangePp >= 0 ? <IcoArrowUp /> : <IcoArrowDown />} {Math.abs(stats.cancellationRateChangePp)} pts from previous period
                </div>
              </div>
            </div>
          </>
        ) : view === 'bookings' ? (
          <>
            <div className="repstat-card">
              <div className="repstat-icon purple"><IcoBookings /></div>
              <div>
                <div className="repstat-label">Rooms Occupied</div>
                <div className="repstat-value">{stats.occupiedRooms} / {stats.totalRoomsCount}</div>
                <div className="repstat-change">{stats.occupancyRate}% of rooms occupied</div>
              </div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon blue"><IcoOccupancy /></div>
              <div><div className="repstat-label">Occupancy Rate</div><div className="repstat-value">{stats.occupancyRate}%</div>{changeBadge(stats.occupancyRateChangePct)}</div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon purple"><IcoBookings /></div>
              <div><div className="repstat-label">Total Bookings</div><div className="repstat-value">{stats.totalBookings}</div>{changeBadge(stats.totalBookingsChangePct)}</div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon red"><IcoCancel /></div>
              <div><div className="repstat-label">Cancellation Rate</div><div className="repstat-value">{stats.cancellationRate}%</div>
                <div className={`repstat-change ${stats.cancellationRateChangePp > 0 ? 'neg' : ''}`}>
                  {stats.cancellationRateChangePp >= 0 ? <IcoArrowUp /> : <IcoArrowDown />} {Math.abs(stats.cancellationRateChangePp)} pts from previous period
                </div>
              </div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon teal"><IcoUsers /></div>
              <div><div className="repstat-label">RevPAR</div><div className="repstat-value">{formatINR(stats.revpar)}</div></div>
            </div>
          </>
        ) : (
          <>
            <div className="repstat-card">
              <div className="repstat-icon green"><IcoRevenue /></div>
              <div><div className="repstat-label">Total Revenue</div><div className="repstat-value">{formatINR(stats.totalRevenue)}</div>{changeBadge(stats.totalRevenueChangePct)}</div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon blue"><IcoOccupancy /></div>
              <div><div className="repstat-label">Occupancy Rate</div><div className="repstat-value">{stats.occupancyRate}%</div>{changeBadge(stats.occupancyRateChangePct)}</div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon purple"><IcoBookings /></div>
              <div><div className="repstat-label">Total Bookings</div><div className="repstat-value">{stats.totalBookings}</div>{changeBadge(stats.totalBookingsChangePct)}</div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon red"><IcoCancel /></div>
              <div><div className="repstat-label">Cancellation Rate</div><div className="repstat-value">{stats.cancellationRate}%</div>
                <div className={`repstat-change ${stats.cancellationRateChangePp > 0 ? 'neg' : ''}`}>
                  {stats.cancellationRateChangePp >= 0 ? <IcoArrowUp /> : <IcoArrowDown />} {Math.abs(stats.cancellationRateChangePp)} pts from previous period
                </div>
              </div>
            </div>
            <div className="repstat-card">
              <div className="repstat-icon teal"><IcoUsers /></div>
              <div><div className="repstat-label">RevPAR</div><div className="repstat-value">{formatINR(stats.revpar)}</div></div>
            </div>
          </>
        )}
      </div>

      {/* ── Row 1: view-dependent (3 cards) ── */}
      <div className="rep-row-1" ref={row1Ref}>

        {view === 'revenue' && (
          <>
            {/* Revenue Overview */}
            <div className="rep-card">
              <CardHeader
                title="Revenue Overview"
                chartType={chartTypes.revenue}
                onChartTypeChange={(v) => setChartType('revenue', v)}
                options={[{ value: 'line', label: 'Line' }, { value: 'area', label: 'Area' }, { value: 'bar', label: 'Bar' }]}
              />
              <DualSeriesChart data={revenueTrend} aKey="thisPeriod" bKey="lastPeriod" type={chartTypes.revenue} gradId="revLineGrad" />
              <div className="rep-legend-inline">
                <div className="rep-legend-item"><span className="rep-legend-dash solid" /> This Period</div>
                <div className="rep-legend-item"><span className="rep-legend-dash dashed" /> Last Period</div>
              </div>
            </div>

            {/* Revenue by Room Type */}
            <div className="rep-card">
              <CardHeader
                title="Revenue by Room Type"
                chartType={chartTypes.revenueByRoom}
                onChartTypeChange={(v) => setChartType('revenueByRoom', v)}
                options={[{ value: 'donut', label: 'Donut' }, { value: 'bar', label: 'Bar' }]}
              />
              {chartTypes.revenueByRoom === 'donut' ? (
                <div className="donut-wrap-rep">
                  <DonutChart
                    segments={revenueByRoom}
                    size={110} stroke={20}
                    centerContent={
                      <div className="donut-center-rep">
                        <span className="donut-amt-rep">{formatINR(stats.totalRevenue)}</span>
                        <span className="donut-sub-rep">Total Revenue</span>
                      </div>
                    }
                  />
                  <div className="donut-legend-rep">
                    {revenueByRoom.map(r => (
                      <div className="donut-leg-item-rep" key={r.label}>
                        <span className="donut-dot-rep" style={{ background: r.color }} />
                        <span>{r.label}</span>
                        <span className="donut-pct-rep">{r.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <HBarList items={revenueByRoom} />
              )}
            </div>

            {/* Occupancy Overview */}
            <div className="rep-card">
              <div className="rep-card-title">Occupancy Overview</div>
              <div className="occ-donut-wrap">
                <DonutChart
                  segments={[{ pct: stats.occupancyRate, color: '#10b981' }, { pct: Math.max(0, 100 - stats.occupancyRate), color: '#f1f4f9' }]}
                  size={120} stroke={16}
                  centerContent={
                    <div className="occ-center">
                      <span className="occ-pct">{stats.occupancyRate}%</span>
                      <span className="occ-label">Occupancy Rate</span>
                    </div>
                  }
                />
                <div className={`occ-change ${stats.occupancyRateChangePct < 0 ? 'neg' : ''}`}>
                  {stats.occupancyRateChangePct >= 0 ? <IcoArrowUp /> : <IcoArrowDown />} {Math.abs(stats.occupancyRateChangePct)}% from previous period
                </div>
              </div>
            </div>
          </>
        )}

        {view === 'bookings' && (
          <>
            {/* Booking Trend */}
            <div className="rep-card">
              <CardHeader
                title={`${PERIOD_TITLE[period]} Booking Trend`}
                chartType={chartTypes.bookingTrend}
                onChartTypeChange={(v) => setChartType('bookingTrend', v)}
                options={[{ value: 'bar', label: 'Bar' }, { value: 'line', label: 'Line' }]}
              />
              <SingleSeriesChart data={bookingTrend} valueKey="count" type={chartTypes.bookingTrend} />
              <div className="vbar-legend"><span className="vbar-legend-dot" /> Bookings</div>
            </div>

            {/* Booking Status Breakdown */}
            <div className="rep-card">
              <CardHeader
                title="Booking Status Breakdown"
                chartType={chartTypes.statusBreakdown}
                onChartTypeChange={(v) => setChartType('statusBreakdown', v)}
                options={[{ value: 'bar', label: 'Bar' }, { value: 'donut', label: 'Donut' }]}
              />
              {chartTypes.statusBreakdown === 'bar' ? (
                <HBarList items={bookingStatusBreakdown} />
              ) : (
                <div className="donut-wrap-rep">
                  <DonutChart segments={bookingStatusBreakdown} size={110} stroke={20} />
                  <div className="donut-legend-rep">
                    {bookingStatusBreakdown.map(r => (
                      <div className="donut-leg-item-rep" key={r.label}>
                        <span className="donut-dot-rep" style={{ background: r.color }} />
                        <span>{r.label}</span>
                        <span className="donut-pct-rep">{r.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Occupancy Overview */}
            <div className="rep-card">
              <div className="rep-card-title">Occupancy Overview</div>
              <div className="occ-donut-wrap">
                <DonutChart
                  segments={[{ pct: stats.occupancyRate, color: '#10b981' }, { pct: Math.max(0, 100 - stats.occupancyRate), color: '#f1f4f9' }]}
                  size={120} stroke={16}
                  centerContent={
                    <div className="occ-center">
                      <span className="occ-pct">{stats.occupancyRate}%</span>
                      <span className="occ-label">Occupancy Rate</span>
                    </div>
                  }
                />
                <div className={`occ-change ${stats.occupancyRateChangePct < 0 ? 'neg' : ''}`}>
                  {stats.occupancyRateChangePct >= 0 ? <IcoArrowUp /> : <IcoArrowDown />} {Math.abs(stats.occupancyRateChangePct)}% from previous period
                </div>
              </div>
            </div>
          </>
        )}

        {view === 'rooms' && (
          <>
            {/* Occupancy Overview */}
            <div className="rep-card">
              <div className="rep-card-title">Occupancy Overview</div>
              <div className="occ-donut-wrap">
                <DonutChart
                  segments={[{ pct: stats.occupancyRate, color: '#10b981' }, { pct: Math.max(0, 100 - stats.occupancyRate), color: '#f1f4f9' }]}
                  size={120} stroke={16}
                  centerContent={
                    <div className="occ-center">
                      <span className="occ-pct">{stats.occupancyRate}%</span>
                      <span className="occ-label">Occupancy Rate</span>
                    </div>
                  }
                />
                <div className={`occ-change ${stats.occupancyRateChangePct < 0 ? 'neg' : ''}`}>
                  {stats.occupancyRateChangePct >= 0 ? <IcoArrowUp /> : <IcoArrowDown />} {Math.abs(stats.occupancyRateChangePct)}% from previous period
                </div>
              </div>
            </div>

            {/* Occupancy by Room Type */}
            <div className="rep-card">
              <CardHeader
                title="Occupancy by Room Type"
                chartType={chartTypes.occupancyByRoom}
                onChartTypeChange={(v) => setChartType('occupancyByRoom', v)}
                options={[{ value: 'bar', label: 'Bar' }, { value: 'donut', label: 'Donut' }]}
              />
              {chartTypes.occupancyByRoom === 'bar' ? (
                <HBarList items={occupancyByRoom.map(r => ({ ...r, color: '#3b82f6' }))} />
              ) : (
                <div className="donut-wrap-rep">
                  <DonutChart segments={occupancyByRoom.map((r, i) => ({ ...r, color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][i % 5] }))} size={110} stroke={20} />
                  <div className="donut-legend-rep">
                    {occupancyByRoom.map((r, i) => (
                      <div className="donut-leg-item-rep" key={r.label}>
                        <span className="donut-dot-rep" style={{ background: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][i % 5] }} />
                        <span>{r.label}</span>
                        <span className="donut-pct-rep">{r.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Revenue by Room Type */}
            <div className="rep-card">
              <CardHeader
                title="Revenue by Room Type"
                chartType={chartTypes.revenueByRoom}
                onChartTypeChange={(v) => setChartType('revenueByRoom', v)}
                options={[{ value: 'donut', label: 'Donut' }, { value: 'bar', label: 'Bar' }]}
              />
              {chartTypes.revenueByRoom === 'donut' ? (
                <div className="donut-wrap-rep">
                  <DonutChart
                    segments={revenueByRoom}
                    size={110} stroke={20}
                    centerContent={
                      <div className="donut-center-rep">
                        <span className="donut-amt-rep">{formatINR(stats.totalRevenue)}</span>
                        <span className="donut-sub-rep">Total Revenue</span>
                      </div>
                    }
                  />
                  <div className="donut-legend-rep">
                    {revenueByRoom.map(r => (
                      <div className="donut-leg-item-rep" key={r.label}>
                        <span className="donut-dot-rep" style={{ background: r.color }} />
                        <span>{r.label}</span>
                        <span className="donut-pct-rep">{r.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <HBarList items={revenueByRoom} />
              )}
            </div>
          </>
        )}

        {view === 'staff' && staffOverview && (
          <>
            {/* Staff by Department */}
            <div className="rep-card">
              <div className="rep-card-title">Staff by Department</div>
              <div className="donut-wrap-rep">
                <DonutChart
                  segments={staffOverview.staffByDept}
                  size={110} stroke={20}
                  centerContent={
                    <div className="donut-center-rep">
                      <span className="donut-amt-rep">{staffOverview.totalStaff}</span>
                      <span className="donut-sub-rep">Total Staff</span>
                    </div>
                  }
                />
                <div className="donut-legend-rep">
                  {staffOverview.staffByDept.map(d => (
                    <div className="donut-leg-item-rep" key={d.label}>
                      <span className="donut-dot-rep" style={{ background: d.color }} />
                      <span>{d.label}</span>
                      <span className="donut-pct-rep">{d.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Attendance Trend */}
            <div className="rep-card">
              <CardHeader
                title={`${PERIOD_TITLE[period]} Attendance Rate`}
                chartType={chartTypes.attendanceTrend}
                onChartTypeChange={(v) => setChartType('attendanceTrend', v)}
                options={[{ value: 'bar', label: 'Bar' }, { value: 'line', label: 'Line' }]}
              />
              <SingleSeriesChart data={staffOverview.attendanceTrend} valueKey="count" type={chartTypes.attendanceTrend} color="#10b981" />
              <div className="vbar-legend"><span className="vbar-legend-dot" /> Attendance %</div>
            </div>

            {/* Attendance Status Breakdown */}
            <div className="rep-card">
              <div className="rep-card-title">Attendance Status Breakdown</div>
              <HBarList items={staffOverview.attendanceStatusBreakdown} />
            </div>
          </>
        )}
      </div>

      {/* ── Row 2: bonus detail cards — only shown for the Revenue view ── */}
      {view === 'revenue' && (
        <div className="rep-row-2" ref={row2Ref}>

          {/* Occupancy by Room Type */}
          <div className="rep-card">
            <CardHeader
              title="Occupancy by Room Type"
              chartType={chartTypes.occupancyByRoom}
              onChartTypeChange={(v) => setChartType('occupancyByRoom', v)}
              options={[{ value: 'bar', label: 'Bar' }, { value: 'donut', label: 'Donut' }]}
            />
            {chartTypes.occupancyByRoom === 'bar' ? (
              <HBarList items={occupancyByRoom.map(r => ({ ...r, color: '#3b82f6' }))} />
            ) : (
              <div className="donut-wrap-rep">
                <DonutChart segments={occupancyByRoom.map((r, i) => ({ ...r, color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][i % 5] }))} size={110} stroke={20} />
                <div className="donut-legend-rep">
                  {occupancyByRoom.map((r, i) => (
                    <div className="donut-leg-item-rep" key={r.label}>
                      <span className="donut-dot-rep" style={{ background: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][i % 5] }} />
                      <span>{r.label}</span>
                      <span className="donut-pct-rep">{r.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Booking Trend */}
          <div className="rep-card">
            <CardHeader
              title={`${PERIOD_TITLE[period]} Booking Trend`}
              chartType={chartTypes.bookingTrend}
              onChartTypeChange={(v) => setChartType('bookingTrend', v)}
              options={[{ value: 'bar', label: 'Bar' }, { value: 'line', label: 'Line' }]}
            />
            <SingleSeriesChart data={bookingTrend} valueKey="count" type={chartTypes.bookingTrend} />
            <div className="vbar-legend"><span className="vbar-legend-dot" /> Bookings</div>
          </div>

          {/* Booking Status Breakdown */}
          <div className="rep-card">
            <CardHeader
              title="Booking Status Breakdown"
              chartType={chartTypes.statusBreakdown}
              onChartTypeChange={(v) => setChartType('statusBreakdown', v)}
              options={[{ value: 'bar', label: 'Bar' }, { value: 'donut', label: 'Donut' }]}
            />
            {chartTypes.statusBreakdown === 'bar' ? (
              <HBarList items={bookingStatusBreakdown} />
            ) : (
              <div className="donut-wrap-rep">
                <DonutChart segments={bookingStatusBreakdown} size={110} stroke={20} />
                <div className="donut-legend-rep">
                  {bookingStatusBreakdown.map(r => (
                    <div className="donut-leg-item-rep" key={r.label}>
                      <span className="donut-dot-rep" style={{ background: r.color }} />
                      <span>{r.label}</span>
                      <span className="donut-pct-rep">{r.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Row 3: view-dependent summary table + insights (+ forecast for Revenue) ── */}
      <div className="rep-row-3" ref={row3Ref}>

        {view === 'revenue' && (
          <>
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
                  {monthlySummary.map(m => (
                    <tr key={m.month}>
                      <td style={{ fontWeight: 600 }}>{m.month}</td>
                      <td>{m.revenue.toLocaleString('en-IN')}</td>
                      <td>{m.occ}%</td>
                      <td>{m.adr.toLocaleString('en-IN')}</td>
                      <td>{m.revpar.toLocaleString('en-IN')}</td>
                      <td>{m.bookings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rep-card">
              <CardHeader
                title={`Revenue Forecast (Next ${forecast.length - revenueTrend.length} ${period === 'daily' ? 'Days' : period === 'weekly' ? 'Weeks' : 'Months'})`}
                chartType={chartTypes.forecast}
                onChartTypeChange={(v) => setChartType('forecast', v)}
                options={[{ value: 'line', label: 'Line' }, { value: 'bar', label: 'Bar' }]}
              />
              <DualSeriesChart data={forecast} aKey="actual" bKey="forecast" type={chartTypes.forecast} aColor="#10b981" bColor="#9ca3af" gradId="forecastGrad" />
              <div className="forecast-legend">
                <div className="rep-legend-item"><span className="rep-legend-dash solid" style={{ background: '#10b981' }} /> Actual</div>
                <div className="rep-legend-item"><span className="rep-legend-dash dashed" /> Forecast</div>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                Simple growth-rate projection based on recent trend — a rough estimate, not a financial forecast.
              </div>
            </div>

            <div className="rep-card">
              <div className="rep-card-title">Insights</div>
              {insights.map((ins, i) => (
                <div className="insight-item" key={i}>
                  <div className={`insight-icon ${ins.type === 'up' ? 'green' : ins.type === 'down' ? 'red' : ins.type === 'top' ? 'gold' : 'purple'}`}>
                    {ins.type === 'up' ? <IcoArrowUp /> : ins.type === 'down' ? <IcoArrowDown /> : ins.type === 'top' ? <IcoBolt /> : <IcoTarget />}
                  </div>
                  <span>{ins.text}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'bookings' && (
          <>
            <div className="rep-card">
              <div className="rep-card-title">Monthly Performance Summary</div>
              <table className="perf-table">
                <thead>
                  <tr><th>Month</th><th>Total Bookings</th><th>Occupancy Rate</th></tr>
                </thead>
                <tbody>
                  {monthlySummary.map(m => (
                    <tr key={m.month}>
                      <td style={{ fontWeight: 600 }}>{m.month}</td>
                      <td>{m.bookings}</td>
                      <td>{m.occ}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rep-card">
              <div className="rep-card-title">Insights</div>
              {insights.map((ins, i) => (
                <div className="insight-item" key={i}>
                  <div className={`insight-icon ${ins.type === 'up' ? 'green' : ins.type === 'down' ? 'red' : ins.type === 'top' ? 'gold' : 'purple'}`}>
                    {ins.type === 'up' ? <IcoArrowUp /> : ins.type === 'down' ? <IcoArrowDown /> : ins.type === 'top' ? <IcoBolt /> : <IcoTarget />}
                  </div>
                  <span>{ins.text}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'rooms' && (
          <>
            <div className="rep-card">
              <div className="rep-card-title">Monthly Performance Summary</div>
              <table className="perf-table">
                <thead>
                  <tr><th>Month</th><th>Occupancy Rate</th><th>RevPAR (₹)</th></tr>
                </thead>
                <tbody>
                  {monthlySummary.map(m => (
                    <tr key={m.month}>
                      <td style={{ fontWeight: 600 }}>{m.month}</td>
                      <td>{m.occ}%</td>
                      <td>{m.revpar.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rep-card">
              <div className="rep-card-title">Insights</div>
              {insights.map((ins, i) => (
                <div className="insight-item" key={i}>
                  <div className={`insight-icon ${ins.type === 'up' ? 'green' : ins.type === 'down' ? 'red' : ins.type === 'top' ? 'gold' : 'purple'}`}>
                    {ins.type === 'up' ? <IcoArrowUp /> : ins.type === 'down' ? <IcoArrowDown /> : ins.type === 'top' ? <IcoBolt /> : <IcoTarget />}
                  </div>
                  <span>{ins.text}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'staff' && staffOverview && (
          <>
            <div className="rep-card">
              <div className="rep-card-title">Staff Monthly Summary</div>
              <table className="perf-table">
                <thead>
                  <tr><th>Month</th><th>Total Staff</th><th>Attendance Rate</th></tr>
                </thead>
                <tbody>
                  {staffOverview.staffMonthlySummary.map(m => (
                    <tr key={m.month}>
                      <td style={{ fontWeight: 600 }}>{m.month}</td>
                      <td>{m.totalStaff}</td>
                      <td>{m.attendanceRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rep-card">
              <div className="rep-card-title">Insights</div>
              {staffOverview.insights.map((ins, i) => (
                <div className="insight-item" key={i}>
                  <div className={`insight-icon ${ins.type === 'up' ? 'green' : ins.type === 'down' ? 'red' : ins.type === 'top' ? 'gold' : 'purple'}`}>
                    {ins.type === 'up' ? <IcoArrowUp /> : ins.type === 'down' ? <IcoArrowDown /> : ins.type === 'top' ? <IcoBolt /> : <IcoTarget />}
                  </div>
                  <span>{ins.text}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default Reports;