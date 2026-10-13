import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useOutletContext } from "react-router-dom";

import superAdminOperationsService from "../../services/superAdminOperationsService";

import "./HotelOperations.css";

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function readable(value) {
  return String(value || "Not specified")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="hotel-operations__metric">
      <p className="hotel-operations__metric-label">{label}</p>

      <strong className="hotel-operations__metric-value">
        {number(value).toLocaleString("en-IN")}
      </strong>

      <span className="hotel-operations__metric-detail">
        {detail}
      </span>
    </article>
  );
}

function StatusPanel({ title, summary, statuses }) {
  return (
    <article className="hotel-operations__panel">
      <div className="hotel-operations__panel-head">
        <h2>{title}</h2>
        <span className="hotel-operations__total">
          {number(summary?.total)} total
        </span>
      </div>

      <div className="hotel-operations__status-list">
        {statuses.map((status) => (
          <div
            className="hotel-operations__status-row"
            key={status}
          >
            <span>{readable(status)}</span>

            <strong>
              {number(summary?.[status])}
            </strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function RecordList({ title, rows, renderRow }) {
  return (
    <section className="hotel-operations__panel">
      <div className="hotel-operations__panel-head">
        <h2>{title}</h2>

        <span className="hotel-operations__total">
          Latest {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="hotel-operations__empty">
          No records to display.
        </p>
      ) : (
        <div className="hotel-operations__records">
          {rows.map((record, index) => {
            const item = renderRow(record);

            return (
              <div
                key={`${record.id ?? "record"}-${index}`}
                className="hotel-operations__record"
              >
                <div className="hotel-operations__record-main">
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>

                <div className="hotel-operations__record-side">
                  <span className="hotel-operations__status-pill">
                    {readable(record.status)}
                  </span>
                  <small>{item.detail}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HotelOperations() {
  const { selectedHotel, workspaceRefreshKey = 0 } = useOutletContext();

  const hotelDisplayId = selectedHotel?.displayId;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const requestSequence = useRef(0);
  const previousHotelId = useRef(null);

  const loadOverview = useCallback(
    async ({ initial = false } = {}) => {
      const requestId = ++requestSequence.current;

      if (initial) {
        setLoading(true);
        setData(null);
      } else {
        setRefreshing(true);
      }

      setError("");

      try {
        const result =
          await superAdminOperationsService.getOperationsOverview(
            hotelDisplayId
          );

        if (requestId === requestSequence.current) {
          setData(result);
        }
      } catch (err) {
        if (requestId === requestSequence.current) {
          setError(
            err?.message ||
              "Unable to load hotel operations."
          );
        }
      } finally {
        if (requestId === requestSequence.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [hotelDisplayId]
  );

    useEffect(() => {
    const isNewHotel =
      previousHotelId.current !== hotelDisplayId;

    previousHotelId.current = hotelDisplayId;

    void loadOverview({
      initial: isNewHotel,
    });

    return () => {
      requestSequence.current += 1;
    };
  }, [
    loadOverview,
    hotelDisplayId,
    workspaceRefreshKey,
  ]);

  const metrics = useMemo(() => {
    if (!data) return [];

    return [
      {
        label: "Total Rooms",
        value: data.rooms.total,
        detail:
          `${number(data.rooms.available)} available · ` +
          `${number(data.rooms.occupied)} occupied`,
      },
      {
        label: "Total Bookings",
        value: data.bookings.total,
        detail: "All-time booking records",
      },
      {
        label: "Open Housekeeping",
        value:
          number(data.housekeeping.pending) +
          number(data.housekeeping.in_progress),
        detail: "Pending and in progress",
      },
      {
        label: "Open Maintenance",
        value:
          number(data.maintenance.pending) +
          number(data.maintenance.in_progress),
        detail: "Pending and in progress",
      },
      {
        label: "Pending Guest Requests",
        value: data.customerRequests.pending,
        detail: "Booking enquiries awaiting action",
      },
      {
        label: "Open Service Requests",
        value:
          number(data.serviceRequests.pending) +
          number(data.serviceRequests.in_progress),
        detail: "Pending and in progress",
      },
    ];
  }, [data]);

  const statusPanels = data
    ? [
        {
          title: "Room Readiness",
          summary: data.rooms,
          statuses: [
            "available",
            "occupied",
            "cleaning",
            "maintenance",
          ],
        },
        {
          title: "Booking Status",
          summary: data.bookings,
          statuses: [
            "pending",
            "confirmed",
            "checked_in",
            "checked_out",
            "cancelled",
            "no_show",
            "expired",
          ],
        },
        {
          title: "Housekeeping",
          summary: data.housekeeping,
          statuses: [
            "pending",
            "in_progress",
            "completed",
            "cancelled",
          ],
        },
        {
          title: "Maintenance",
          summary: data.maintenance,
          statuses: [
            "pending",
            "in_progress",
            "completed",
            "cancelled",
          ],
        },
        {
          title: "Guest Booking Requests",
          summary: data.customerRequests,
          statuses: [
            "pending",
            "approved",
            "declined",
          ],
        },
        {
          title: "Service Requests",
          summary: data.serviceRequests,
          statuses: [
            "pending",
            "in_progress",
            "completed",
            "cancelled",
          ],
        },
      ]
    : [];

  return (
    <main className="hotel-operations">
      <header className="hotel-operations__header">
        <div>
          <span className="hotel-operations__eyebrow">
            SELECTED HOTEL / LIVE OPERATIONS
          </span>

          <h1>Operations Overview</h1>

          <p>
            Operational visibility for{" "}
            <strong>
              {selectedHotel?.name || hotelDisplayId}
            </strong>
            . Information is read-only.
          </p>
        </div>

      </header>

      {error && (
        <div
          className="hotel-operations__alert"
          role="alert"
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={loading || refreshing}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div
          className="hotel-operations__loading"
          role="status"
        >
          Loading hotel operations...
        </div>
      ) : data ? (
        <>
          <div className="hotel-operations__snapshot">
            <span>
              Property: <strong>{data.hotel.displayId}</strong>
            </span>

            <span>
              Last loaded: {formatDate(data.generatedAt)}
            </span>

            <span>Read-only operational snapshot</span>
          </div>

          <section
            className="hotel-operations__metrics"
            aria-label="Operations summary"
          >
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                {...metric}
              />
            ))}
          </section>

          <section
            className="hotel-operations__section"
            aria-label="Detailed operational status"
          >
            <div className="hotel-operations__section-heading">
              <h2>Operational Breakdown</h2>
              <p>
                Current room states and all-time workflow counts.
              </p>
            </div>

            <div className="hotel-operations__panel-grid">
              {statusPanels.map((panel) => (
                <StatusPanel
                  key={panel.title}
                  {...panel}
                />
              ))}
            </div>
          </section>

          <section
            className="hotel-operations__section"
            aria-label="Recent operational records"
          >
            <div className="hotel-operations__section-heading">
              <h2>Recent Activity</h2>
              <p>
                Latest bookings and currently open work queues.
              </p>
            </div>

            <div className="hotel-operations__activity">
              <RecordList
                title="Recent Bookings"
                rows={data.recentBookings}
                renderRow={(item) => ({
                  title: item.code || `Booking #${item.id}`,
                  subtitle:
                    `Room ${item.roomNumber || "Unassigned"} · ` +
                    readable(item.stayType),
                  detail: `Check-in: ${formatDate(item.checkIn)}`,
                })}
              />

              <RecordList
                title="Open Housekeeping"
                rows={data.openHousekeeping}
                renderRow={(item) => ({
                  title: `Room ${item.roomNumber || "Unassigned"}`,
                  subtitle: readable(item.type),
                  detail: formatDate(item.createdAt),
                })}
              />

              <RecordList
                title="Open Maintenance"
                rows={data.openMaintenance}
                renderRow={(item) => ({
                  title: item.title || `Maintenance #${item.id}`,
                  subtitle:
                    `Room ${item.roomNumber || "Unassigned"} · ` +
                    `${readable(item.priority)} priority`,
                  detail: formatDate(item.createdAt),
                })}
              />
            </div>
          </section>
        </>
      ) : (
        <div className="hotel-operations__loading" role="status">
          No operational data available.
        </div>
      )}
    </main>
  );
}

export default HotelOperations;