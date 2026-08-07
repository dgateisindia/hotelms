import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import SuperAdminLayout from "../layouts/SuperAdminLayout/SuperAdminLayout";

import SuperAdminSidebar from "../components/navigation/SuperAdminSidebar/SuperAdminSidebar";

import SuperAdminTopbar from "../components/navigation/SuperAdminTopbar/SuperAdminTopbar";

import dashboardService from "../services/dashboardService";

import "./SuperAdminDashboard.css";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const EMPTY_STATS = {
  totalBookings: 0,
  occupiedRooms: 0,
  availableRooms: 0,
  todaysRevenue: 0,
  monthlyRevenue: [],
};

function normalizeNumber(value) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function normalizeDashboardStats(data) {
  const stats = data || {};

  return {
    totalBookings: normalizeNumber(
      stats.totalBookings
    ),

    occupiedRooms: normalizeNumber(
      stats.occupiedRooms
    ),

    availableRooms: normalizeNumber(
      stats.availableRooms
    ),

    todaysRevenue: normalizeNumber(
      stats.todaysRevenue
    ),

    monthlyRevenue: Array.isArray(
      stats.monthlyRevenue
    )
      ? stats.monthlyRevenue
      : [],
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(normalizeNumber(value));
}

function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatStatus(status) {
  const normalizedStatus = String(
    status || ""
  )
    .trim()
    .toLowerCase();

  if (!normalizedStatus) {
    return "Unknown";
  }

  return normalizedStatus
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function SuperAdminDashboard() {
  const [stats, setStats] =
    useState(EMPTY_STATS);

  const [admins, setAdmins] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [warning, setWarning] =
    useState("");

  const loadDashboardData = useCallback(
    async ({
      initialLoad = false,
    } = {}) => {
      if (initialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");
      setWarning("");

      try {
        const [
          statsResult,
          adminsResult,
        ] = await Promise.allSettled([
          dashboardService.getSuperAdminStats(),
          dashboardService.getAdminsStatus(),
        ]);

        if (
          statsResult.status ===
          "fulfilled"
        ) {
          setStats(
            normalizeDashboardStats(
              statsResult.value?.stats
            )
          );
        } else {
          setError(
            statsResult.reason?.message ||
              "Portfolio statistics could not be loaded."
          );
        }

        if (
          adminsResult.status ===
          "fulfilled"
        ) {
          setAdmins(
            Array.isArray(
              adminsResult.value?.admins
            )
              ? adminsResult.value.admins
              : []
          );
        } else {
          setAdmins([]);

          setWarning(
            adminsResult.reason?.message ||
              "Admin account information could not be loaded."
          );
        }

        if (
          statsResult.status ===
            "rejected" &&
          adminsResult.status ===
            "rejected"
        ) {
          throw new Error(
            "The Super Admin dashboard could not be loaded. Check the backend connection and retry."
          );
        }
      } catch (dashboardError) {
        setError(
          dashboardError?.message ||
            "Dashboard data could not be loaded."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDashboardData({
      initialLoad: true,
    });
  }, [loadDashboardData]);

  const revenueChartData =
    useMemo(() => {
      return stats.monthlyRevenue.map(
        (record) => {
          const monthNumber =
            normalizeNumber(
              record.month
            );

          const year =
            normalizeNumber(
              record.year
            );

          const monthName =
            MONTH_NAMES[
              monthNumber - 1
            ] || "Unknown";

          return {
            label: year
              ? `${monthName} ${year}`
              : monthName,

            revenue:
              normalizeNumber(
                record.total
              ),
          };
        }
      );
    }, [stats.monthlyRevenue]);

  const occupancyTotal =
    stats.occupiedRooms +
    stats.availableRooms;

  const occupancyPercent =
    occupancyTotal > 0
      ? Math.round(
          (stats.occupiedRooms /
            occupancyTotal) *
            100
        )
      : 0;

  const occupancyData =
    occupancyTotal > 0
      ? [
          {
            name: "Occupied",
            value:
              stats.occupiedRooms,
          },
          {
            name: "Available",
            value:
              stats.availableRooms,
          },
        ]
      : [
          {
            name: "No room data",
            value: 1,
          },
        ];

  const occupancyColors =
    occupancyTotal > 0
      ? [
          "var(--color-info-accent)",
          "var(--color-border)",
        ]
      : [
          "var(--color-border)",
        ];

  const activeAdminCount =
    admins.filter(
      (admin) =>
        String(admin.status)
          .toLowerCase() ===
        "active"
    ).length;

  if (loading) {
    return (
      <SuperAdminLayout
        sidebar={
          <SuperAdminSidebar />
        }
        topbar={
          <SuperAdminTopbar
            title="Portfolio Overview"
            breadcrumbs={[
              {
                label: "Portfolio",
              },
              {
                label: "Overview",
              },
            ]}
          />
        }
      >
        <div className="super-admin-layout__loading">
          <div className="super-admin-layout__loading-card">
            <h2 className="super-admin-layout__loading-title">
              Loading Portfolio
            </h2>

            <p className="super-admin-layout__loading-description">
              Your hotels, Admin accounts
              and business statistics are
              being loaded.
            </p>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout
      sidebar={
        <SuperAdminSidebar
          selectedHotel={null}
          hotelCount={0}
          adminCount={admins.length}
          pendingRequests={0}
        />
      }
      topbar={
        <SuperAdminTopbar
          title="Portfolio Overview"
          breadcrumbs={[
            {
              label: "Portfolio",
            },
            {
              label: "Overview",
            },
          ]}
          selectedHotel={null}
          pendingRequests={0}
          onRefresh={() =>
            loadDashboardData({
              initialLoad: false,
            })
          }
          isRefreshing={refreshing}
        />
      }
    >
      <div className="sa-dashboard">
        {error && (
          <div
            className="alert alert-error"
            role="alert"
          >
            <div>
              <strong>
                Dashboard data could not
                be loaded.
              </strong>

              <div>{error}</div>
            </div>
          </div>
        )}

        {warning && (
          <div
            className="alert alert-warning"
            role="alert"
          >
            {warning}
          </div>
        )}

        <div className="sa-dashboard-intro">
          <div>
            <h2>
              Business Portfolio
            </h2>

            <p>
              View combined operational
              performance across all hotels
              owned by this Super Admin
              account.
            </p>
          </div>
        </div>

        <div className="sa-stats-grid">
          <StatCard
            icon="📅"
            label="Total Bookings"
            value={
              stats.totalBookings
            }
            accent="blue"
          />

          <StatCard
            icon="🛏️"
            label="Occupied Rooms"
            value={
              stats.occupiedRooms
            }
            accent="green"
          />

          <StatCard
            icon="🏠"
            label="Available Rooms"
            value={
              stats.availableRooms
            }
            accent="purple"
          />

          <StatCard
            icon="🧾"
            label="Today's Revenue"
            value={formatCurrency(
              stats.todaysRevenue
            )}
            accent="orange"
          />
        </div>

        <div className="sa-charts-grid">
          <section className="sa-card sa-chart-card">
            <div className="sa-section-header">
              <div>
                <h3>
                  Portfolio Revenue
                </h3>

                <p>
                  Successful payments across
                  all owned hotels.
                </p>
              </div>
            </div>

            {revenueChartData.length >
            0 ? (
              <ResponsiveContainer
                width="100%"
                height={300}
              >
                <LineChart
                  data={
                    revenueChartData
                  }
                >
                  <CartesianGrid
                    stroke="var(--color-divider)"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    stroke="var(--color-text-muted)"
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    stroke="var(--color-text-muted)"
                    tickFormatter={(
                      value
                    ) =>
                      `₹${Math.round(
                        value / 1000
                      )}k`
                    }
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      formatCurrency(
                        value
                      ),
                      "Revenue",
                    ]}
                  />

                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-info-accent)"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill:
                        "var(--color-info-accent)",
                    }}
                    activeDot={{
                      r: 6,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="state-container">
                <h4 className="state-title">
                  No revenue data yet
                </h4>

                <p className="state-description">
                  Revenue trends will appear
                  after successful hotel
                  payments are recorded.
                </p>
              </div>
            )}
          </section>

          <section className="sa-card sa-occupancy-card">
            <div className="sa-section-header">
              <div>
                <h3>
                  Portfolio Occupancy
                </h3>

                <p>
                  Current occupied and
                  available rooms.
                </p>
              </div>
            </div>

            <div className="sa-donut-wrap">
              <ResponsiveContainer
                width={200}
                height={200}
              >
                <PieChart>
                  <Pie
                    data={occupancyData}
                    dataKey="value"
                    innerRadius={65}
                    outerRadius={90}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {occupancyData.map(
                      (
                        entry,
                        index
                      ) => (
                        <Cell
                          key={
                            entry.name
                          }
                          fill={
                            occupancyColors[
                              index
                            ]
                          }
                          stroke="none"
                        />
                      )
                    )}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="sa-donut-center">
                <span className="sa-donut-percent">
                  {occupancyPercent}%
                </span>

                <span className="sa-donut-label">
                  Occupied
                </span>
              </div>
            </div>

            <div className="sa-occupancy-legend">
              <div className="sa-legend-row">
                <span>
                  <span className="sa-dot sa-dot-blue" />
                  Occupied
                </span>

                <strong>
                  {stats.occupiedRooms}
                </strong>
              </div>

              <div className="sa-legend-row">
                <span>
                  <span className="sa-dot sa-dot-gray" />
                  Available
                </span>

                <strong>
                  {stats.availableRooms}
                </strong>
              </div>
            </div>
          </section>
        </div>

        <section className="sa-card sa-admins-card">
          <div className="sa-admins-header">
            <div>
              <h3>
                Admin Accounts
              </h3>

              <p>
                {activeAdminCount} active
                out of {admins.length} Admin
                accounts.
              </p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Admin ID</th>
                  <th>Name</th>
                  <th>Hotel</th>
                  <th>Email</th>
                  <th>Last Login</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {admins.length === 0 && (
                  <tr>
                    <td
                      colSpan="6"
                      className="sa-empty-row"
                    >
                      No Admin accounts found.
                      Admins will be created
                      inside a selected hotel's
                      Team section.
                    </td>
                  </tr>
                )}

                {admins.map(
                  (admin) => {
                    const isActive =
                      String(
                        admin.status
                      ).toLowerCase() ===
                      "active";

                    return (
                      <tr
                        key={admin.id}
                      >
                        <td>
                          {admin.display_id ||
                            `ADM-${String(
                              admin.id
                            ).padStart(
                              4,
                              "0"
                            )}`}
                        </td>

                        <td>
                          {admin.name ||
                            "Unnamed Admin"}
                        </td>

                        <td>
                          <div>
                            <strong>
                              {admin.hotel_name ||
                                "Hotel unavailable"}
                            </strong>

                            <div className="text-muted">
                              {admin.hotel_display_id ||
                                "HT unavailable"}
                            </div>
                          </div>
                        </td>

                        <td>
                          {admin.email ||
                            "Email unavailable"}
                        </td>

                        <td>
                          {formatDateTime(
                            admin.last_login
                          )}
                        </td>

                        <td>
                          <span
                            className={[
                              "sa-status-badge",
                              isActive
                                ? "sa-status-active"
                                : "sa-status-inactive",
                            ].join(" ")}
                          >
                            {formatStatus(
                              admin.status
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SuperAdminLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}) {
  return (
    <article className="sa-card sa-stat-card">
      <div
        className={`sa-stat-icon sa-icon-${accent}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className="sa-stat-text">
        <span className="sa-stat-label">
          {label}
        </span>

        <strong className="sa-stat-value">
          {value}
        </strong>
      </div>
    </article>
  );
}

export default SuperAdminDashboard;