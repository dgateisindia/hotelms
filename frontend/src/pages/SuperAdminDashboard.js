import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import dashboardService from '../services/dashboardService';
import './SuperAdminDashboard.css';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, adminsRes] = await Promise.all([
          dashboardService.getSuperAdminStats(),
          dashboardService.getAdminsStatus()
        ]);
        setStats(statsRes.stats);
        setAdmins(adminsRes.admins);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s for live status
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="dashboard-loading">Loading dashboard...</div>;
  if (!stats) return <div className="dashboard-loading">Could not load dashboard data.</div>;

  const revenueChartData = stats.monthlyRevenue.map((r) => ({
    month: MONTH_NAMES[r.month - 1],
    revenue: r.total
  }));

  const occupancyTotal = stats.occupiedRooms + stats.availableRooms;
  const occupancyPercent = occupancyTotal ? Math.round((stats.occupiedRooms / occupancyTotal) * 100) : 0;

  const occupancyData = [
    { name: 'Occupied', value: stats.occupiedRooms },
    { name: 'Available', value: stats.availableRooms }
  ];
  const OCCUPANCY_COLORS = ['#3B82F6', '#E5E7EB'];

  return (
    <div className="sa-dashboard">
      <h1 className="sa-title">Dashboard</h1>

      {/* Stat Cards */}
      <div className="sa-stats-grid">
        <StatCard icon="📅" label="Total Bookings" value={stats.totalBookings} accent="blue" />
        <StatCard icon="🛏️" label="Occupied Rooms" value={stats.occupiedRooms} accent="green" />
        <StatCard icon="🏠" label="Available Rooms" value={stats.availableRooms} accent="purple" />
        <StatCard icon="🧾" label="Today's Revenue" value={`₹ ${Number(stats.todaysRevenue).toLocaleString('en-IN')}`} accent="orange" />
      </div>

      {/* Charts row */}
      <div className="sa-charts-grid">
        <div className="sa-card sa-chart-card">
          <h3>Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueChartData}>
              <CartesianGrid stroke="#F1F3F5" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} stroke="#9CA3AF" />
              <YAxis axisLine={false} tickLine={false} stroke="#9CA3AF" tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} dot={{ r: 5, fill: '#3B82F6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="sa-card sa-occupancy-card">
          <h3>Room Occupancy</h3>
          <div className="sa-donut-wrap">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={occupancyData}
                  dataKey="value"
                  innerRadius={65}
                  outerRadius={90}
                  startAngle={90}
                  endAngle={-270}
                >
                  {occupancyData.map((entry, index) => (
                    <Cell key={entry.name} fill={OCCUPANCY_COLORS[index]} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="sa-donut-center">
              <span className="sa-donut-percent">{occupancyPercent}%</span>
              <span className="sa-donut-label">Occupied</span>
            </div>
          </div>
          <div className="sa-occupancy-legend">
            <div className="sa-legend-row">
              <span className="sa-dot sa-dot-blue" /> Occupied <strong>{stats.occupiedRooms}</strong>
            </div>
            <div className="sa-legend-row">
              <span className="sa-dot sa-dot-gray" /> Available <strong>{stats.availableRooms}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Admins table */}
      <div className="sa-card sa-admins-card">
        <div className="sa-admins-header">
          <h3>Admin Accounts</h3>
        </div>
        <table className="sa-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last Login</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 && (
              <tr>
                <td colSpan="5" className="sa-empty-row">No admin accounts found</td>
              </tr>
            )}
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td>{admin.name}</td>
                <td>{admin.email}</td>
                <td className="sa-role-cell">{admin.role}</td>
                <td>{admin.last_login ? new Date(admin.last_login).toLocaleString('en-IN') : 'Never'}</td>
                <td>
                  <span className={`sa-status-badge ${admin.status === 'active' ? 'sa-status-active' : 'sa-status-inactive'}`}>
                    {admin.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, accent }) => (
  <div className="sa-card sa-stat-card">
    <div className={`sa-stat-icon sa-icon-${accent}`}>{icon}</div>
    <div className="sa-stat-text">
      <span className="sa-stat-label">{label}</span>
      <span className="sa-stat-value">{value}</span>
    </div>
  </div>
);

export default SuperAdminDashboard;