import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, BarChart, Bar,
} from "recharts";
import SuperAdminLayout from "../../layouts/SuperAdminLayout/SuperAdminLayout";
import SuperAdminSidebar from "../../components/navigation/SuperAdminSidebar/SuperAdminSidebar";
import SuperAdminTopbar from "../../components/navigation/SuperAdminTopbar/SuperAdminTopbar";
import { fetchPortfolioReports } from "../../services/superAdminReportsService";
import "./SuperAdminReports.css";

/* SUPER ADMIN-SA4B — Portfolio Reports (owned hotels only) */
const currency = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(Number(value) || 0);
const number = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);
const percent = (value) => `${(Number(value) || 0).toFixed(1)}%`;
const formatDay = (day) => day ? new Date(`${day}T12:00:00Z`).toLocaleDateString("en-IN", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
}) : "—";
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const rangeOK = (from, to) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return false;
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  const days = Math.round((b - a) / 86400000) + 1;
  return Number.isFinite(days) && days >= 1 && days <= 366;
};
function downloadCSV(report) {
  const esc = (value) => `"${String(value == null ? "" : value).replace(/"/g, '""')}"`;
  const rows = [
    ["Portfolio Reports & Analytics"],
    ["Period", report.period],
    ["Range Start", report.rangeStart],
    ["Range End", report.rangeEnd],
    ["Selected Hotel", report.hotelFilter],
    ["Owned Hotels", report.totalOwnedHotels],
    [],
    ["Overview", "Value"],
    ["Net Collections (INR)", report.stats.netCollections],
    ["Total Bookings", report.stats.totalBookings],
    ["Cancelled Bookings", report.stats.cancelledBookings],
    ["Cancellation Rate (%)", report.stats.cancellationRate],
    ["Sold Overnight Room-Nights", report.stats.soldRoomNights],
    ["Available Room-Nights", report.stats.availableRoomNights],
    ["Overnight Occupancy (%)", report.stats.occupancyRate],
    ["Collections / Available Room-Night (INR)", report.stats.collectionsPerAvailableRoomNight],
    [],
    ["Hotel ID", "Hotel", "Rooms", "Bookings", "Net Collections (INR)", "Sold Room-Nights", "Available Room-Nights", "Occupancy (%)", "Cancellation (%)"],
    ...(report.hotelPerformance || []).map(h => [h.displayId, h.name, h.totalRooms, h.totalBookings, h.netCollections, h.soldRoomNights, h.availableRoomNights, h.occupancyRate, h.cancellationRate]),
    [],
    ["Revenue Trend Start", "End", "Label", "This Period (INR)", "Previous Period (INR)"],
    ...(report.revenueTrend || []).map(x => [x.start, x.end, x.label, x.thisPeriod, x.lastPeriod]),
    [],
    ["Monthly Summary — previous six calendar months"],
    ["Month", "Start", "End", "Net Collections (INR)", "Bookings", "Sold Room-Nights", "Available Room-Nights", "Occupancy (%)"],
    ...(report.monthlySummary || []).map(m => [m.month, m.start, m.end, m.netCollections, m.bookings, m.soldRoomNights, m.availableRoomNights, m.occupancyRate]),
  ];
  const csv = "\uFEFF" + rows.map(row => row.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `portfolio-reports-${report.hotelFilter}-${report.rangeStart}-to-${report.rangeEnd}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Metric({ label, value, detail, icon, tone }) {
  return <div className="sa4b-metric">
    <div className={`sa4b-metric__icon sa4b-metric__icon--${tone}`}>{icon}</div>
    <div className="sa4b-metric__text">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  </div>;
}

function Card({ title, note, children }) {
  return <section className="sa4b-panel">
    <div className="sa4b-panel__heading"><h2>{title}</h2>{note && <span>{note}</span>}</div>
    {children}
  </section>;
}

export default function SuperAdminReports() {
  const [period, setPeriod] = useState("monthly");
  const [hotel, setHotel] = useState("all");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [applied, setApplied] = useState({ period: "monthly", hotel: "all" });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [inputError, setInputError] = useState("");
  const [revision, setRevision] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");
    if (initial) setReport(null);
    try {
      const data = await fetchPortfolioReports(applied);
      setReport(data);
    } catch (err) {
      setError(err?.message || "Unable to load portfolio report.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applied]);

  useEffect(() => { void load({ initial: true }); }, [load, revision]);

  const hotels = report?.hotels || [];
  const stats = report?.stats;
  const rangeText = report ? `${formatDay(report.rangeStart)} – ${formatDay(report.rangeEnd)}` : "Loading period…";
  const currentHotelName = applied.hotel === "all"
    ? "All owned hotels" : hotels.find(h => h.displayId === applied.hotel)?.name || applied.hotel;
  const trends = report?.revenueTrend || [];
  const bookings = report?.bookingTrend || [];
  const performance = report?.hotelPerformance || [];
  const monthly = report?.monthlySummary || [];
  const financialChange = stats?.netCollectionsChangePct;
  const bookingChange = stats?.totalBookingsChangePct;
  const periodButtons = useMemo(() => [
    ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["custom", "Custom"],
  ], []);

  function selectPeriod(next) {
    setPeriod(next);
    setInputError("");
    if (next !== "custom") setApplied({ period: next, hotel });
  }
  function selectHotel(next) {
    setHotel(next);
    setApplied(previous => ({ ...previous, hotel: next }));
  }
  function applyCustom(event) {
    event.preventDefault();
    if (!rangeOK(from, to)) {
      setInputError("Select valid From/To dates (maximum 366 days).");
      return;
    }
    setInputError("");
    setApplied({ period: "custom", hotel, from, to });
  }
  async function handlePdfExport() {
    if (!report || loading || refreshing || exportingPdf) return;
    setPdfError("");
    setExportingPdf(true);
    try {
      const { downloadPortfolioReportsPdf } = await import("./portfolioReportsPdf");
      downloadPortfolioReportsPdf(report);
    } catch (err) {
      console.error("[SUPER ADMIN REPORTS PDF]", err);
      setPdfError("PDF export failed. Please retry, or use CSV export.");
    } finally {
      setExportingPdf(false);
    }
  }
  const breadcrumbs = [{ label: "Portfolio" }, { label: "Reports & Analytics" }];
  const layout = {
    sidebar: <SuperAdminSidebar selectedHotel={null} hotelCount={report?.totalOwnedHotels || 0} />,
    topbar: <SuperAdminTopbar title="Reports & Analytics" breadcrumbs={breadcrumbs} selectedHotel={null}
      onRefresh={() => setRevision(x => x + 1)} isRefreshing={loading || refreshing} />,
  };

  return <SuperAdminLayout {...layout}>
    <div className="sa4b-reports">
      <header className="sa4b-header">
        <div>
          <div className="sa4b-overline">PORTFOLIO INTELLIGENCE</div>
          <h1>Reports & Analytics</h1>
          <p>Compare financial performance and overnight occupancy across hotels you own.</p>
        </div>
        <div className="sa4b-header__actions">
          <span className="sa4b-portfolio-chip">{number(report?.totalOwnedHotels)} owned hotels</span>
          <button type="button" onClick={() => report && downloadCSV(report)} disabled={!report || loading || refreshing} className="sa4b-btn sa4b-btn--navy">Export CSV</button>
          <button type="button" onClick={handlePdfExport} disabled={!report || loading || refreshing || exportingPdf} className="sa4b-btn sa4b-btn--navy" aria-label="Export portfolio report as PDF">{exportingPdf ? "Generating..." : "Export PDF"}</button>
        </div>
      </header>
      {pdfError && <div role="alert" className="sa4b-pdf-error">{pdfError}</div>}

      <section className="sa4b-filters" aria-label="Report filters">
        <div className="sa4b-filters__first">
          <label className="sa4b-hotel-select"><span>HOTEL SCOPE</span>
            <select aria-label="Select hotel" value={hotel} onChange={e => selectHotel(e.target.value)}>
              <option value="all">All Owned Hotels</option>
              {hotels.map(h => <option key={h.displayId} value={h.displayId}>{h.name} · {h.displayId}</option>)}
            </select>
          </label>
          <div className="sa4b-periods" role="group" aria-label="Report period">
            {periodButtons.map(([key, label]) => <button key={key} type="button"
              className={period === key ? "sa4b-period is-active" : "sa4b-period"} aria-pressed={period === key}
              onClick={() => selectPeriod(key)}>{label}</button>)}
          </div>
        </div>
        {period === "custom" && <form className="sa4b-custom" onSubmit={applyCustom}>
          <label>From date<input aria-label="From date" type="date" value={from} onChange={e => setFrom(e.target.value)} required /></label>
          <label>To date<input aria-label="To date" type="date" value={to} onChange={e => setTo(e.target.value)} required /></label>
          <button type="submit" className="sa4b-btn sa4b-btn--navy">Apply Report</button>
          {inputError && <p role="alert" className="sa4b-input-error">{inputError}</p>}
        </form>}
        {report && <div className="sa4b-range">Showing <strong>{currentHotelName}</strong> · {rangeText}</div>}
      </section>

      {error && <section className="sa4b-alert" role="alert"><span>{error}</span><button type="button" onClick={() => setRevision(v => v + 1)}>Retry</button></section>}
      {loading && !report && <div className="sa4b-loading" role="status">Loading secured portfolio analytics…</div>}
      {!loading && !report && !error && <div className="sa4b-loading">No report has been returned.</div>}

      {report && stats && <>
        {(loading || refreshing) && <p className="sa4b-sync" role="status">Updating report…</p>}
        <div className="sa4b-metrics">
          <Metric icon="₹" tone="green" label="Net Collections" value={currency(stats.netCollections)}
            detail={financialChange == null ? "No comparable prior collections" : `${financialChange > 0 ? "+" : ""}${percent(financialChange)} vs previous period`} />
          <Metric icon="▥" tone="blue" label="Overnight Occupancy" value={percent(stats.occupancyRate)}
            detail={`${number(stats.soldRoomNights)} / ${number(stats.availableRoomNights)} room-nights`} />
          <Metric icon="#" tone="purple" label="Total Bookings" value={number(stats.totalBookings)}
            detail={bookingChange == null ? "No comparable prior bookings" : `${bookingChange > 0 ? "+" : ""}${percent(bookingChange)} vs previous period`} />
          <Metric icon="!" tone="red" label="Cancellation Rate" value={percent(stats.cancellationRate)}
            detail={`${number(stats.cancelledBookings)} cancelled bookings`} />
          <Metric icon="↗" tone="gold" label="Collections / Available Room-Night" value={currency(stats.collectionsPerAvailableRoomNight)}
            detail={`${number(stats.totalRoomsCount)} current inventory rooms`} />
        </div>

        <div className="sa4b-chart-grid">
          <Card title="Net Collections Trend" note="Successful payments minus refunds">
            <div className="sa4b-chart" role="img" aria-label="Net collections compared with equivalent previous period">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 12, right: 14, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#ebeff6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#72809a" }} tickLine={false} axisLine={false} minTickGap={15} />
                  <YAxis tick={{ fontSize: 10, fill: "#72809a" }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
                  <Tooltip formatter={v => currency(v)} />
                  <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: 11 }} />
                  <Area name="Current range" type="monotone" dataKey="thisPeriod" stroke="#132551" fill="#e4ebfc" strokeWidth={2.5} />
                  <Area name="Previous equivalent" type="monotone" dataKey="lastPeriod" stroke="#8398bd" fill="transparent" strokeDasharray="5 4" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Booking Trend" note="Bookings by scheduled check-in">
            <div className="sa4b-chart" role="img" aria-label="Number of bookings during selected period">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bookings} margin={{ top: 12, right: 14, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#ebeff6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#72809a" }} tickLine={false} axisLine={false} minTickGap={15} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#72809a" }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={v => [number(v), "Bookings"]} />
                  <Bar name="Bookings" dataKey="count" fill="#294f98" maxBarSize={38} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card title="Hotel Performance" note={applied.hotel === "all" ? "Compare owned hotels in the selected date range" : "Selected hotel performance"}>
          {performance.length === 0 ? <p className="sa4b-empty">No owned hotels to compare.</p> :
          <div className="sa4b-table-wrap">
            <table className="sa4b-table sa4b-performance">
              <thead><tr><th>HOTEL</th><th>BOOKINGS</th><th>NET COLLECTIONS</th><th>OVERNIGHT OCCUPANCY</th><th>CANCELLATION RATE</th></tr></thead>
              <tbody>{performance.map(h => <tr key={h.displayId}>
                <td data-label="HOTEL"><strong>{h.name}</strong><small>{h.displayId} · {number(h.totalRooms)} rooms</small></td>
                <td data-label="BOOKINGS">{number(h.totalBookings)}</td>
                <td data-label="NET COLLECTIONS"><strong>{currency(h.netCollections)}</strong></td>
                <td data-label="OVERNIGHT OCCUPANCY"><div className="sa4b-occupancy"><b>{percent(h.occupancyRate)}</b><div className="sa4b-progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(h.occupancyRate) || 0))}%` }} /></div><small>{number(h.soldRoomNights)} / {number(h.availableRoomNights)} nights</small></div></td>
                <td data-label="CANCELLATION RATE">{percent(h.cancellationRate)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </Card>

        <div className="sa4b-lower-grid">
          <Card title="Booking Status Breakdown" note="Bookings checked in during range">
            {(report.bookingStatusBreakdown || []).length === 0 ? <p className="sa4b-empty">No bookings in this period.</p> :
              <div className="sa4b-breakdown">{report.bookingStatusBreakdown.map(x => <div key={x.status} className="sa4b-breakdown__row"><div><strong>{String(x.status).replace(/_/g, " ")}</strong><span>{number(x.count)} · {percent(x.pct)}</span></div><div className="sa4b-progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(x.pct) || 0))}%` }} /></div></div>)}</div>}
          </Card>
          <Card title="Selected Range Details" note="Reporting definitions">
            <dl className="sa4b-definitions">
              <div><dt>Period</dt><dd>{rangeText}</dd></div>
              <div><dt>Previous equivalent</dt><dd>{formatDay(report.previousRange?.start)} – {formatDay(report.previousRange?.end)}</dd></div>
              <div><dt>Selected hotels</dt><dd>{number(report.hotelCount)} / {number(report.totalOwnedHotels)}</dd></div>
              <div><dt>Available room-nights</dt><dd>{number(stats.availableRoomNights)}</dd></div>
              <div><dt>Net collections basis</dt><dd>Successful payments − refunds</dd></div>
            </dl>
          </Card>
        </div>
        <Card title="Monthly Performance Summary" note="Last six calendar months (independent of selected range)">
          <div className="sa4b-table-wrap sa4b-monthly-wrap">
            <table className="sa4b-table">
              <thead><tr><th>MONTH</th><th>NET COLLECTIONS</th><th>BOOKINGS</th><th>OCCUPANCY</th><th>COLLECTIONS / SOLD NIGHT</th><th>COLLECTIONS / AVAILABLE NIGHT</th></tr></thead>
              <tbody>{monthly.map(m => <tr key={m.start}><td><strong>{m.month}</strong></td><td>{currency(m.netCollections)}</td><td>{number(m.bookings)}</td><td>{percent(m.occupancyRate)}</td><td>{currency(m.collectionsPerSoldRoomNight)}</td><td>{currency(m.collectionsPerAvailableRoomNight)}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
      </>}
    </div>
  </SuperAdminLayout>;
}
