// ============================================================
//  Dashboard.js — Admin / Super Admin Dashboard (shared shell)
//  Layout  → Sidebar + Header + Body
//  Sections→ Stat Cards, Trend Chart (metric + type selectable), Donut Chart, Table
// ============================================================
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useEffect } from "react";
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import '../../styles/Dashboard.css';
import Billing from '../Billing/Billing';
import Bookings from '../Bookings/Bookings';
import Rooms from '../Rooms/Rooms';
import Customers from '../Customers/Customers';
import Staff from '../Staff/Staff';
import Reports from '../Reports/Reports';
import Attendance from '../Attendance/Attendance';
import Payroll from "../Payroll";
import Notifications from "../Notifications";
import Settings from "../Settings";
import ProfileModal from './ProfileModal';
import { useUserRole } from '../../hooks/useUserRole';
import dashboardService from '../../services/dashboardService';
import {
  IcoDashboard, IcoBookings, IcoRooms, IcoCustomers,
  IcoRoomService, IcoBilling, IcoStaff, IcoAttendance,
  IcoPayroll, IcoHousekeeping, IcoReports, IcoSettings,
  IcoTrendUp, IcoArrowRight, IcoLogout,
  IcoCalendar, IcoBed, IcoDoor, IcoRupee,
} from '../../utils/icons/DashboardIcons';

// ── Static Data ─────────────────────────────────────────────

// NOTE: "Settings" nav item removed per request (not needed right now).
// The /settings route + <Settings /> page below are left intact in case
// something still links to it directly — just no longer shown in the
// sidebar. Re-add the entry below to bring it back:
//   { label: 'Settings', icon: <IcoSettings />, path: '/settings' },
const NAV_ITEMS = [
  { label: 'Dashboard',       icon: <IcoDashboard />,    path: '/dashboard' },
  { label: 'Bookings',        icon: <IcoBookings />,     path: '/bookings' },
  { label: 'Rooms',           icon: <IcoRooms />,        path: '/rooms' },
  { label: 'Customers',       icon: <IcoCustomers />,    path: '/customers' },
  { label: 'Billing', icon: <IcoBilling />,   path: '/billing' },
  { label: 'Staff',           icon: <IcoStaff />,        path: '/staff' },
  { label: 'Attendance',      icon: <IcoAttendance />,   path: '/attendance' },
  { label: 'Payroll',         icon: <IcoPayroll />,      path: '/payroll' },
  { label: 'Reports',         icon: <IcoReports />,      path: '/reports' },
{ label: 'Customer Requests', icon: <IcoAttendance />, path: '/notifications', badge: 6 },];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Trend metric definitions — each maps to a field the backend is expected
// to return on saStats / adminStats as `monthly<Field>`: [{ month, total }]
const METRIC_OPTIONS = [
  {
    key: 'revenue',
    label: 'Revenue',
    field: 'monthlyRevenue',
    title: 'Monthly Revenue',
    formatTick: (v) => (v === 0 ? '0' : `${v / 1000}k`),
    formatValue: (v) => `₹ ${Number(v).toLocaleString('en-IN')}`,
  },
  {
    key: 'bookings',
    label: 'Bookings',
    field: 'monthlyBookings',
    title: 'Monthly Bookings',
    formatTick: (v) => `${v}`,
    formatValue: (v) => `${v}`,
  },
  {
    key: 'occupancy',
    label: 'Occupancy',
    field: 'monthlyOccupancy',
    title: 'Monthly Occupancy',
    formatTick: (v) => `${v}%`,
    formatValue: (v) => `${v}%`,
  },
];

// ── Helpers ──────────────────────────────────────────────────

const statusClass = (status) => {
  switch (status) {
    case 'Confirmed':   return 'badge badge-confirmed';
    case 'Pending':     return 'badge badge-pending';
    case 'Checked-in':  return 'badge badge-checkedin';
    case 'Cancelled':   return 'badge badge-cancelled';
    case 'Checked-out': return 'badge badge-checkedout';
    default:            return 'badge';
  }
};

const todayStr = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
};

const formatDateLabel = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// "Nice" y-axis ticks for an arbitrary max value (works for ₹, counts, %)
const getYTicks = (maxVal) => {
  if (!maxVal || maxVal <= 0) return [0, 1];
  const rawStep = maxVal / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let niceStep;
  if (residual > 5) niceStep = 10 * magnitude;
  else if (residual > 2) niceStep = 5 * magnitude;
  else if (residual > 1) niceStep = 2 * magnitude;
  else niceStep = magnitude;

  const ticks = [];
  let t = 0;
  while (t < maxVal + niceStep) {
    ticks.push(Math.round(t * 100) / 100);
    t += niceStep;
  }
  return ticks;
};

// ── Trend Chart SVG — line or bar, driven by `type` ─────────────
const TrendChart = ({ data, type, formatTick }) => {
  const W = 560, H = 160, PAD = { top: 10, right: 10, bottom: 30, left: 52 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const yTicks = getYTicks(maxVal);
  const axisMax = yTicks[yTicks.length - 1];

  const x = (i) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v) => PAD.top + innerH - (v / axisMax) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.value)}`).join(' ');
  const areaPath = data.length
    ? `${linePath} L${x(data.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`
    : '';

  const barSlot = data.length ? innerW / data.length : innerW;
  const barWidth = Math.min(barSlot * 0.5, 32);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {yTicks.map(tick => (
        <g key={tick}>
          <line x1={PAD.left} y1={y(tick)} x2={W - PAD.right} y2={y(tick)} stroke="#e4e8f0" strokeWidth="1" />
          <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
            {formatTick(tick)}
          </text>
        </g>
      ))}

      {type === 'bar' ? (
        data.map((d, i) => {
          const barX = PAD.left + (i + 0.5) * barSlot - barWidth / 2;
          const barY = y(d.value);
          return (
            <rect
              key={i}
              x={barX}
              y={barY}
              width={barWidth}
              height={Math.max(PAD.top + innerH - barY, 0)}
              rx={4}
              fill="#3b82f6"
            />
          );
        })
      ) : (
        <>
          {data.length > 0 && <path d={areaPath} fill="url(#areaGrad)" />}
          {data.length > 0 && (
            <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {data.map((d, i) => (
            <circle key={i} cx={x(i)} cy={y(d.value)} r="4" fill="#fff" stroke="#3b82f6" strokeWidth="2.5" />
          ))}
        </>
      )}

      {data.map((d, i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#9ca3af">
          {d.month}
        </text>
      ))}
    </svg>
  );
};

// ── Donut Chart SVG — supports 2..n slices ─────────────────────
const DonutChart = ({ slices }) => {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const R = 60, CX = 80, CY = 80;
  const circumference = 2 * Math.PI * R;
  const occupied = slices.find(s => s.label === 'Occupied')?.value || 0;
  const pct = total ? Math.round((occupied / total) * 100) : 0;

  let offset = 0;
  const arcs = slices.map((s) => {
    const dash = total ? (s.value / total) * circumference : 0;
    const arc = { ...s, dash, offset };
    offset += dash;
    return arc;
  });

  return (
    <div className="donut-wrap">
      <div className="donut-svg-wrap" style={{ width: 160, height: 160 }}>
        <svg viewBox="0 0 160 160" width="160" height="160">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e4e8f0" strokeWidth="20" />
          {arcs.filter(a => a.dash > 0).map((a) => (
            <circle
              key={a.label}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={a.color}
              strokeWidth="20"
              strokeDasharray={`${a.dash} ${circumference}`}
              strokeDashoffset={-a.offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          ))}
        </svg>
        <div className="donut-center-label">
          <span className="donut-pct">{pct}%</span>
          <span className="donut-sub">Occupied</span>
        </div>
      </div>

      <div className="donut-legend">
        {slices.map((s) => (
          <div className="legend-item" key={s.label}>
            <span className="legend-dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Crown Logo SVG ────────────────────────────────────────────
const CrownLogo = () => (
  <svg width="22" height="22" viewBox="0 0 42 42" fill="none">
    <rect width="42" height="42" rx="7" fill="rgba(201,162,39,0.15)" stroke="#c9a227" strokeWidth="1.5" />
    <path d="M10 28 L14 18 L21 23 L28 18 L32 28 Z" fill="#c9a227" opacity="0.2" stroke="#c9a227" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="10" cy="18" r="2" fill="#c9a227" />
    <circle cx="21" cy="14" r="2" fill="#c9a227" />
    <circle cx="32" cy="18" r="2" fill="#c9a227" />
    <text x="21" y="33" textAnchor="middle" fill="#c9a227" fontSize="11" fontWeight="800" fontFamily="Inter,sans-serif">H</text>
  </svg>
);

// Small inline-styled controls (no CSS file access — swap for real classes
// in Dashboard.css whenever convenient, e.g. .chart-metric-select / .chart-type-toggle)
const selectStyle = {
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 8,
  border: '1px solid #e4e8f0',
  color: '#374151',
  background: '#fff',
  cursor: 'pointer',
};

const toggleWrapStyle = {
  display: 'flex',
  border: '1px solid #e4e8f0',
  borderRadius: 8,
  overflow: 'hidden',
};

const toggleBtnStyle = (active) => ({
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 600,
  border: 'none',
  background: active ? '#3b82f6' : '#fff',
  color: active ? '#fff' : '#6b7280',
  cursor: 'pointer',
});

// ════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════
function Dashboard({ page = "dashboard" }) {
  const navigate = useNavigate();

  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { role } = useUserRole();
  const isSuperAdmin = role === 'super_admin';
  const [activePath, setActivePath] = useState("/" + page);

  const TODAY = todayStr();
  const [selectedDate, setSelectedDate] = useState(TODAY);

  // ── Trend chart controls ──
  const [chartMetric, setChartMetric] = useState('revenue'); // 'revenue' | 'bookings' | 'occupancy'
  const [chartType, setChartType] = useState('line');        // 'line' | 'bar'

  // ── Profile modal (opened from the header avatar) ──
  const [showProfile, setShowProfile] = useState(false);

  // ── Super admin dashboard data ──
  const [saStats, setSaStats] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [saLoading, setSaLoading] = useState(false);

  // ── Admin daily dashboard data ──
  const [adminStats, setAdminStats] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin || page !== "dashboard") return;

    let cancelled = false;

    const loadSuperAdminData = async () => {
      setSaLoading(true);
      try {
        const [statsRes, adminsRes] = await Promise.all([
          dashboardService.getSuperAdminStats(),
          dashboardService.getAdminsStatus(),
        ]);
        if (!cancelled) {
          setSaStats(statsRes.stats);
          setAdmins(adminsRes.admins);
        }
      } catch (err) {
        console.error('Super admin dashboard fetch error:', err);
      } finally {
        if (!cancelled) setSaLoading(false);
      }
    };

    loadSuperAdminData();
    const interval = setInterval(loadSuperAdminData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isSuperAdmin, page]);

  useEffect(() => {
    if (isSuperAdmin || page !== "dashboard") return;

    let cancelled = false;

    const loadAdminDaily = async () => {
      setAdminLoading(true);
      try {
        const res = await dashboardService.getAdminDailyStats(selectedDate);
        if (!cancelled) setAdminStats(res.stats);
      } catch (err) {
        console.error('Admin daily dashboard fetch error:', err);
      } finally {
        if (!cancelled) setAdminLoading(false);
      }
    };

    loadAdminDaily();
    return () => { cancelled = true; };
  }, [isSuperAdmin, page, selectedDate]);

  const handleLogout = async () => {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Log out?',
      text: 'Do you want to log out of your account?',
      showCancelButton: true,
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0d1b4b',
      cancelButtonColor: '#9ca3af',
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      await signOut();

      Swal.fire({
        icon: 'success',
        title: 'Logged out',
        text: 'You have been successfully logged out.',
        timer: 1800,
        timerProgressBar: true,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });

      navigate("/login");
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      if (!isLoaded) return;

      if (!isSignedIn) {
        navigate("/login");
        return;
      }

      try {
        const token = await getToken();
        const response = await fetch(
          "http://localhost:5000/api/users/me",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await response.json();
      } catch (err) {
        console.error(err);
      }
    };

    loadUser();
  }, [isLoaded, isSignedIn, getToken, navigate]);

  // ── Derived data ──────────────────────────────────────────

  const statCards = isSuperAdmin
    ? (saStats ? [
        { label: 'Total Bookings', value: saStats.totalBookings, icon: <IcoCalendar />, color: 'blue' },
        { label: 'Occupied Rooms', value: saStats.occupiedRooms, icon: <IcoBed />, color: 'green' },
        { label: 'Available Rooms', value: saStats.availableRooms, icon: <IcoDoor />, color: 'purple' },
        { label: "Today's Revenue", value: `₹ ${Number(saStats.todaysRevenue).toLocaleString('en-IN')}`, icon: <IcoRupee />, color: 'gold' },
      ] : [])
    : (adminStats ? [
        { label: 'Total Bookings', value: adminStats.totalBookings, icon: <IcoCalendar />, color: 'blue' },
        { label: 'Occupied Rooms', value: adminStats.occupiedRooms, icon: <IcoBed />, color: 'green' },
        { label: 'Available Rooms', value: adminStats.availableRooms, icon: <IcoDoor />, color: 'purple' },
        { label: selectedDate === TODAY ? "Today's Revenue" : 'Revenue', value: `₹ ${Number(adminStats.todaysRevenue).toLocaleString('en-IN')}`, icon: <IcoRupee />, color: 'gold' },
      ] : []);

  const activeStats = isSuperAdmin ? saStats : adminStats;
  const activeMetric = METRIC_OPTIONS.find(m => m.key === chartMetric);

  // Expects activeStats[metric.field] shaped as [{ month: 1-12, total: number }]
  // monthlyBookings / monthlyOccupancy need to be added on the backend —
  // until then those two options render an empty-state chart.
  const trendSeries = activeStats?.[activeMetric.field] || [];
  const trendData = trendSeries.map((r) => ({
    month: MONTH_NAMES[r.month - 1],
    value: Number(r.total ?? r.value ?? 0),
  }));

  const donutSlices = isSuperAdmin
    ? (saStats ? [
        { label: 'Occupied', value: saStats.occupiedRooms, color: '#3b82f6' },
        { label: 'Available', value: saStats.availableRooms, color: '#e4e8f0' },
      ] : [])
    : (adminStats ? [
        { label: 'Occupied', value: adminStats.occupiedRooms, color: '#3b82f6' },
        { label: 'Available', value: adminStats.availableRooms, color: '#22c55e' },
        { label: 'Maintenance', value: adminStats.maintenanceRooms, color: '#f59e0b' },
        { label: 'Cleaning', value: adminStats.cleaningRooms, color: '#a855f7' },
        { label: 'Reserved', value: adminStats.reservedRooms, color: '#ec4899' },
      ] : []);

  const isLoadingDashboardData = isSuperAdmin ? saLoading : adminLoading;

  return (
    <div className="dash-layout">

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <CrownLogo />
          </div>
          <div className="sidebar-logo-text">
            <span>Hotel Management</span>
            <small>System</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${activePath === item.path ? "active" : ""}`}
              onClick={() => {
                setActivePath(item.path);
                navigate(item.path);
              }}
            >
              {item.icon}
              <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
              {item.badge && (
                <span style={{
                  background: "#ef4444", color: "#fff", borderRadius: "10px",
                  fontSize: "10px", fontWeight: 700, padding: "1px 6px",
                  minWidth: 18, textAlign: "center",
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}

          <button className="nav-item" onClick={handleLogout} style={{ marginTop: 12, color: "#f87171" }}>
            <IcoLogout />
            Logout
          </button>
        </nav>
      </aside>

      <div className="dash-main">

        <header className="dash-header">
          <h1 className="dash-header-title">
            {page.charAt(0).toUpperCase() + page.slice(1)}
          </h1>

          <div className="dash-header-right">
            {page === "dashboard" && !isSuperAdmin && (
              <input
                type="date"
                className="dash-date-picker"
                value={selectedDate}
                max={TODAY}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            )}

            <div className="header-user">
              <span className="header-user-name">{isSuperAdmin ? 'Super Admin' : 'Admin'}</span>
              <div
                className="header-avatar"
                style={{ cursor: 'pointer' }}
                title="Edit profile"
                onClick={() => setShowProfile(true)}
              >
                {isSuperAdmin ? 'S' : 'A'}
              </div>
            </div>
          </div>
        </header>

        <div className="dash-body">

          {page === "dashboard" ? (
            <>
              {!isSuperAdmin && (
                <div className="dash-date-label">
                  Showing data for {selectedDate === TODAY ? 'Today' : formatDateLabel(selectedDate)}
                </div>
              )}

              {isLoadingDashboardData && !isSuperAdmin && !adminStats ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading dashboard…</div>
              ) : isLoadingDashboardData && isSuperAdmin && !saStats ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading dashboard…</div>
              ) : (
                <>
                  <div className="stats-grid">
                    {statCards.map((card) => (
                      <div className="stat-card" key={card.label}>
                        <div className={`stat-icon ${card.color}`}>{card.icon}</div>
                        <div className="stat-info">
                          <div className="stat-label">{card.label}</div>
                          <div className="stat-value">{card.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="charts-row">
                    <div className="chart-card">
                      <div
                        className="chart-card-header"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}
                      >
                        <div className="chart-card-title">{activeMetric.title}</div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <select
                            className="chart-metric-select"
                            value={chartMetric}
                            onChange={(e) => setChartMetric(e.target.value)}
                            style={selectStyle}
                          >
                            {METRIC_OPTIONS.map((m) => (
                              <option key={m.key} value={m.key}>{m.label}</option>
                            ))}
                          </select>

                          <div className="chart-type-toggle" style={toggleWrapStyle}>
                            <button
                              type="button"
                              onClick={() => setChartType('line')}
                              style={toggleBtnStyle(chartType === 'line')}
                            >
                              Line
                            </button>
                            <button
                              type="button"
                              onClick={() => setChartType('bar')}
                              style={toggleBtnStyle(chartType === 'bar')}
                            >
                              Bar
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="line-chart-wrap">
                        {trendData.length > 0 ? (
                          <TrendChart data={trendData} type={chartType} formatTick={activeMetric.formatTick} />
                        ) : (
                          <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                            No {activeMetric.label.toLowerCase()} trend data available yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="chart-card">
                      <div className="chart-card-title">Room Occupancy</div>
                      <DonutChart slices={donutSlices} />
                    </div>
                  </div>

                  {isSuperAdmin ? (
                    <div className="table-card">
                      <div className="table-card-header">
                        <span className="table-card-title">Admin Accounts</span>
                      </div>
                      <table className="bookings-table">
                        <thead>
                          <tr>
                            <th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {admins.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No admin accounts found.</td></tr>
                          ) : admins.map((a) => (
                            <tr key={a.id}>
                              <td>{a.name || '—'}</td>
                              <td>{a.email}</td>
                              <td>{a.role}</td>
                              <td>{a.last_login ? new Date(a.last_login).toLocaleString('en-IN') : 'Never'}</td>
                              <td>
                                <span className={statusClass(a.status === 'active' ? 'Confirmed' : 'Cancelled')}>
                                  {a.status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="table-card">
                      <div className="table-card-header">
                        <span className="table-card-title">
                          {selectedDate === TODAY ? "Today's Bookings" : `Bookings — ${formatDateLabel(selectedDate)}`}
                        </span>
                        <Link to="/bookings" className="view-all-link">
                          View All Bookings
                          <IcoArrowRight />
                        </Link>
                      </div>
                      <table className="bookings-table">
                        <thead>
                          <tr>
                            <th>Booking ID</th><th>Customer</th><th>Room</th>
                            <th>Check In</th><th>Check Out</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!adminStats || adminStats.recentBookings.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No bookings for this date.</td></tr>
                          ) : adminStats.recentBookings.map((b) => (
                            <tr key={b.booking_id}>
                              <td>{b.booking_code}</td>
                              <td>{b.customer_name}</td>
                              <td>{b.room_number}</td>
                              <td>{new Date(b.check_in).toLocaleDateString('en-IN')}</td>
                              <td>{new Date(b.check_out).toLocaleDateString('en-IN')}</td>
                              <td>
                                <span className={statusClass(
                                  b.booking_status.charAt(0).toUpperCase() + b.booking_status.slice(1)
                                )}>
                                  {b.booking_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          ) : page === "bookings" ? (
            <Bookings readOnly={isSuperAdmin} />
          ) : page === "rooms" ? (
            <Rooms readOnly={isSuperAdmin} />
          ) : page === "customers" ? (
            <Customers readOnly={isSuperAdmin} />
          ) : page === "billing" ? (
            <Billing readOnly={isSuperAdmin} />
          ) : page === "staff" ? (
            <Staff readOnly={isSuperAdmin} />
          ) : page === "attendance" ? (
            <Attendance readOnly={isSuperAdmin} />
          ) : page === "payroll" ? (
            <Payroll readOnly={isSuperAdmin} />
          ) : page === "reports" ? (
            <Reports readOnly={isSuperAdmin} />
          ) : page === "notifications" ? (
            <Notifications />
          ) : page === "settings" ? (
            <Settings />
          ) : (
            <div>Page Not Found</div>
          )}

        </div>
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
export default Dashboard;