// ============================================================
//  Dashboard.js — Admin Dashboard (matches reference design)
//  Layout  → Sidebar + Header + Body
//  Sections→ Stat Cards, Line Chart, Donut Chart, Bookings Table
// ============================================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/Dashboard.css';
import Bookings from '../Bookings/Bookings';
import Rooms from '../Rooms/Rooms';
import {
  IcoDashboard, IcoBookings, IcoRooms, IcoCustomers,
  IcoRoomService, IcoBilling, IcoStaff, IcoAttendance,
  IcoPayroll, IcoHousekeeping, IcoReports, IcoSettings,
  IcoTrendUp, IcoArrowRight, IcoLogout,
  IcoCalendar, IcoBed, IcoDoor, IcoRupee,
} from '../../utils/icons/DashboardIcons';
import { clearTokens } from '../../utils/icons/tokenManager';
import Swal from "sweetalert2";

// ── Static Data ──────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard',       icon: <IcoDashboard />,    path: '/dashboard' },
  { label: 'Bookings',        icon: <IcoBookings />,     path: '/bookings' },
  { label: 'Rooms',           icon: <IcoRooms />,        path: '/rooms' },
  { label: 'Customers',       icon: <IcoCustomers />,    path: '/customers' },
  { label: 'Room Service',    icon: <IcoRoomService />,  path: '/room-service' },
  { label: 'Billing & Invoice', icon: <IcoBilling />,   path: '/billing' },
  { label: 'Staff',           icon: <IcoStaff />,        path: '/staff' },
  { label: 'Attendance',      icon: <IcoAttendance />,   path: '/attendance' },
  { label: 'Payroll',         icon: <IcoPayroll />,      path: '/payroll' },
  { label: 'Reports',         icon: <IcoReports />,      path: '/reports' },
  { label: 'Notifications',   icon: <IcoAttendance />,   path: '/notifications', badge: 6 },
  { label: 'Settings',        icon: <IcoSettings />,     path: '/settings' },
  { label: 'Manage Staff',     icon: <IcoStaff />,       path: '/manage-staff', roles: ['super_admin'] },

];

const STAT_CARDS = [
  {
    label: 'Total Bookings',
    value: '245',
    change: '12% from last month',
    trend: 'up',
    icon: <IcoCalendar />,
    color: 'blue',
  },
  {
    label: 'Occupied Rooms',
    value: '32',
    change: '8% from last month',
    trend: 'up',
    icon: <IcoBed />,
    color: 'green',
  },
  {
    label: 'Available Rooms',
    value: '18',
    change: '40% from last month',
    trend: 'down',
    icon: <IcoDoor />,
    color: 'purple',
  },
  {
    label: "Today's Revenue",
    value: '₹ 45,230',
    change: '15% from last month',
    trend: 'up',
    icon: <IcoRupee />,
    color: 'gold',
  },
];

const RECENT_BOOKINGS = [
  { id: 'BK001', customer: 'Rahul Sharma',  room: '101', checkIn: '20 May 2024', checkOut: '22 May 2024', status: 'Confirmed' },
  { id: 'BK002', customer: 'Priya Patel',   room: '102', checkIn: '21 May 2024', checkOut: '23 May 2024', status: 'Pending' },
  { id: 'BK003', customer: 'Amit Verma',    room: '103', checkIn: '19 May 2024', checkOut: '21 May 2024', status: 'Checked-in' },
  { id: 'BK004', customer: 'Neha Singh',    room: '104', checkIn: '18 May 2024', checkOut: '20 May 2024', status: 'Confirmed' },
  { id: 'BK005', customer: 'Sandeep Rao',   room: '105', checkIn: '22 May 2024', checkOut: '24 May 2024', status: 'Cancelled' },
];

const MONTHLY_REVENUE = [
  { month: 'Jan', value: 42000 },
  { month: 'Feb', value: 38000 },
  { month: 'Mar', value: 55000 },
  { month: 'Apr', value: 48000 },
  { month: 'May', value: 62000 },
  { month: 'Jun', value: 58000 },
  { month: 'Jul', value: 80000 },
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

// ── Line Chart SVG ────────────────────────────────────────────
const LineChart = ({ data }) => {
  const W = 560, H = 160, PAD = { top: 10, right: 10, bottom: 30, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = 0;

  const x = (i) => PAD.left + (i / (data.length - 1)) * innerW;
  const y = (v) => PAD.top + innerH - ((v - minVal) / (maxVal - minVal)) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.value)}`).join(' ');
  const areaPath = `${linePath} L${x(data.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`;

  const yTicks = [0, 20000, 40000, 60000, 80000, 100000];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Y grid lines + labels */}
      {yTicks.map(tick => (
        <g key={tick}>
          <line
            x1={PAD.left} y1={y(tick)} x2={W - PAD.right} y2={y(tick)}
            stroke="#e4e8f0" strokeWidth="1"
          />
          <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
            {tick === 0 ? '0' : `${tick / 1000}k`}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots */}
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r="4" fill="#fff" stroke="#3b82f6" strokeWidth="2.5" />
      ))}

      {/* X labels */}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#9ca3af">
          {d.month}
        </text>
      ))}
    </svg>
  );
};

// ── Donut Chart SVG ───────────────────────────────────────────
const DonutChart = ({ occupied, available }) => {
  const total = occupied + available;
  const pct = Math.round((occupied / total) * 100);
  const R = 60, CX = 80, CY = 80;
  const circumference = 2 * Math.PI * R;
  const occupiedDash = (occupied / total) * circumference;

  return (
    <div className="donut-wrap">
      <div className="donut-svg-wrap" style={{ width: 160, height: 160 }}>
        <svg viewBox="0 0 160 160" width="160" height="160">
          {/* Background circle */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e4e8f0" strokeWidth="20" />
          {/* Occupied arc */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="20"
            strokeDasharray={`${occupiedDash} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        </svg>
        <div className="donut-center-label">
          <span className="donut-pct">{pct}%</span>
          <span className="donut-sub">Occupied</span>
        </div>
      </div>

      <div className="donut-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#3b82f6' }} />
          <span>Occupied</span>
          <span>{occupied}</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#e4e8f0' }} />
          <span>Available</span>
          <span>{available}</span>
        </div>
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

// ════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════
function Dashboard({ page = 'dashboard' }) {

  const navigate = useNavigate();
  const [activePath, setActivePath] = useState('/' + page);



  const handleLogout = async () => {
  const result = await Swal.fire({
    title: "Confirm Logout",
    text: "You will need to sign in again to access the dashboard.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#1e3a8a",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Logout",
    cancelButtonText: "Stay Logged In",
  });
  

  if (result.isConfirmed) {
    clearTokens();

    await Swal.fire({
      icon: "success",
      title: "See You Again!",
      text: "You have been logged out successfully.",
      confirmButtonText: "OK",
    });

    navigate("/login");
  }
};

  return (
    <div className="dash-layout">

      {/* ══════════ SIDEBAR ══════════ */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><CrownLogo /></div>
          <div className="sidebar-logo-text">
            <span>Hotel Management</span>
            <small>System</small>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${activePath === item.path ? 'active' : ''}`}
              onClick={() => {
                setActivePath(item.path);
                navigate(item.path);
              }}
            >
              {item.icon}
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {item.badge && (
                <span style={{
                  background: '#ef4444', color: '#fff',
                  borderRadius: '10px', fontSize: '10px',
                  fontWeight: 700, padding: '1px 6px', minWidth: 18,
                  textAlign: 'center'
                }}>{item.badge}</span>
              )}
            </button>
          ))}

          {/* Logout */}
          <button className="nav-item" onClick={handleLogout} style={{ marginTop: 12, color: '#f87171' }}>
            <IcoLogout />
            Logout
          </button>
        </nav>
      </aside>

      {/* ══════════ MAIN ══════════ */}
      <div className="dash-main">

        {/* Header */}
        <header className="dash-header">
          <h1 className="dash-header-title">{page.charAt(0).toUpperCase() + page.slice(1)}</h1>
          <div className="dash-header-right">
            <div className="header-user">
              <span className="header-user-name">Admin</span>
              <div className="header-avatar">A</div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="dash-body">

          {/* ── Render page content ── */}
          {page === 'bookings' ? <Bookings /> :
          page === 'rooms' ? <Rooms /> : (
          <>

          {/* ── Stat Cards ── */}
          <div className="stats-grid">
            {STAT_CARDS.map((card) => (
              <div className="stat-card" key={card.label}>
                <div className={`stat-icon ${card.color}`}>{card.icon}</div>
                <div className="stat-info">
                  <div className="stat-label">{card.label}</div>
                  <div className="stat-value">{card.value}</div>
                  <div className={`stat-change ${card.trend}`}>
                    <IcoTrendUp />
                    {card.change}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Charts Row ── */}
          <div className="charts-row">
            {/* Line Chart */}
            <div className="chart-card">
              <div className="chart-card-title">Monthly Revenue</div>
              <div className="line-chart-wrap">
                <LineChart data={MONTHLY_REVENUE} />
              </div>
            </div>

            {/* Donut Chart */}
            <div className="chart-card">
              <div className="chart-card-title">Room Occupancy</div>
              <DonutChart occupied={32} available={18} />
            </div>
          </div>

          {/* ── Recent Bookings Table ── */}
          <div className="table-card">
            <div className="table-card-header">
              <span className="table-card-title">Recent Bookings</span>
              <Link to="/bookings" className="view-all-link">
                View All Bookings <IcoArrowRight />
              </Link>
            </div>

            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Room</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_BOOKINGS.map((b) => (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td>{b.customer}</td>
                    <td>{b.room}</td>
                    <td>{b.checkIn}</td>
                    <td>{b.checkOut}</td>
                    <td><span className={statusClass(b.status)}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          </>
          )}
        </div>{/* end dash-body */}
      </div>{/* end dash-main */}
    </div>
  );
}

export default Dashboard;
