import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { useOutletContext } from "react-router-dom";

import { fetchPortfolioReports } from "../../services/superAdminReportsService";

import "./HotelFinance.css";

const PERIODS = ["daily", "weekly", "monthly", "custom"];

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function money(value) {
  return moneyFormatter.format(Number(value) || 0);
}

function quantity(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("en-IN");
}

function percentage(value) {
  const number = Number(value);
  return `${Number.isFinite(number) ? number.toFixed(1) : "0.0"}%`;
}

function changePercentage(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(1)}%`;
}

function isoLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function Metric({ label, value, detail }) {
  return (
    <article className="hotel-finance__metric">
      <span className="hotel-finance__metric-label">
        {label}
      </span>

      <strong className="hotel-finance__metric-value">
        {value}
      </strong>

      <span className="hotel-finance__metric-detail">
        {detail}
      </span>
    </article>
  );
}

function CollectionsTrend({ rows }) {
  const values = rows.map(
    (item) => Number(item.thisPeriod) || 0
  );

  const maximum = Math.max(
    1,
    ...values.map((value) => Math.abs(value))
  );

  return (
    <article className="hotel-finance__panel">
      <div className="hotel-finance__panel-heading">
        <h2>Net Collections Trend</h2>
        <p>Successful payments minus refunds</p>
      </div>

      {rows.length === 0 ? (
        <p className="hotel-finance__empty">
          No collection data available.
        </p>
      ) : (
        <div className="hotel-finance__trend">
          {rows.map((item, index) => {
            const value = values[index];

            const width = Math.min(
              100,
              Math.abs(value) / maximum * 100
            );

            return (
              <div
                className="hotel-finance__trend-row"
                key={`${item.start || item.label}-${index}`}
              >
                <span className="hotel-finance__trend-label">
                  {item.label || `Period ${index + 1}`}
                </span>

                <div className="hotel-finance__track">
                  <div
                    className={
                      value < 0
                        ? "hotel-finance__bar hotel-finance__bar--negative"
                        : "hotel-finance__bar"
                    }
                    style={{ width: `${width}%` }}
                  />
                </div>

                <strong>{money(value)}</strong>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function BookingStatus({ rows }) {
  return (
    <article className="hotel-finance__panel">
      <div className="hotel-finance__panel-heading">
        <h2>Booking Status</h2>
        <p>Bookings within the selected reporting period</p>
      </div>

      {rows.length === 0 ? (
        <p className="hotel-finance__empty">
          No booking status records available.
        </p>
      ) : (
        <div className="hotel-finance__status-list">
          {rows.map((item, index) => {
            const label = String(
              item.status || item.bookingStatus || "Unknown"
            ).replace(/_/g, " ");

            const count =
              item.count ??
              item.total ??
              item.totalBookings ??
              item.bookings ??
              item.value ??
              0;

            return (
              <div
                key={`${label}-${index}`}
                className="hotel-finance__status-row"
              >
                <span>{label}</span>
                <strong>{quantity(count)}</strong>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function MonthlyHistory({ rows }) {
  return (
    <section className="hotel-finance__panel">
      <div className="hotel-finance__panel-heading">
        <h2>Six-Month Financial History</h2>
        <p>Existing SA4 reporting history for this hotel</p>
      </div>

      {rows.length === 0 ? (
        <p className="hotel-finance__empty">
          No monthly history available.
        </p>
      ) : (
        <div className="hotel-finance__table-scroll">
          <table className="hotel-finance__table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Net Collections</th>
                <th>Bookings</th>
                <th>Occupancy</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((item, index) => (
                <tr key={`${item.start || item.month}-${index}`}>
                  <td data-label="Month">{item.month || item.start || "—"}</td>
                  <td data-label="Net Collections">{money(item.netCollections)}</td>
                  <td data-label="Bookings">{quantity(item.bookings)}</td>
                  <td data-label="Occupancy">{percentage(item.occupancyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HotelFinance() {
  const {
    selectedHotel,
    workspaceRefreshKey = 0,
  } = useOutletContext();

  const hotelId = selectedHotel?.displayId;

  const today = useRef(new Date()).current;

  const [period, setPeriod] = useState("monthly");

  const [from, setFrom] = useState(
    isoLocal(new Date(today.getFullYear(), today.getMonth(), 1))
  );

  const [to, setTo] = useState(isoLocal(today));

  const [applied, setApplied] = useState({
    period: "monthly",
  });

  const [loaded, setLoaded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const requestSequence = useRef(0);
  const previousQuery = useRef("");

  const appliedKey = [
    hotelId,
    applied.period,
    applied.from || "",
    applied.to || "",
  ].join("|");

  useEffect(() => {
    if (!hotelId) return undefined;

    const requestId = ++requestSequence.current;

    const isNewQuery =
      previousQuery.current !== appliedKey;

    previousQuery.current = appliedKey;

    if (isNewQuery) {
      setLoading(true);
      setLoaded(null);
    } else {
      setRefreshing(true);
    }

    setError("");

    async function load() {
      try {
        const report = await fetchPortfolioReports({
          hotel: hotelId,
          ...applied,
        });

        // Do not display another hotel's finance records.
        const performance = report?.hotelPerformance;

        if (
          !Array.isArray(performance) ||
          performance.length !== 1 ||
          performance[0]?.displayId !== hotelId ||
          !report?.stats
        ) {
          throw new Error(
            "Selected hotel financial scope could not be verified."
          );
        }

        if (requestId === requestSequence.current) {
          setLoaded({
            key: appliedKey,
            report,
          });
        }
      } catch (loadError) {
        if (requestId === requestSequence.current) {
          setError(
            loadError?.message ||
              "Hotel finance could not be loaded."
          );
        }
      } finally {
        if (requestId === requestSequence.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();

    return () => {
      requestSequence.current += 1;
    };
  }, [
    hotelId,
    applied,
    appliedKey,
    workspaceRefreshKey,
  ]);

  function choosePeriod(nextPeriod) {
    if (!PERIODS.includes(nextPeriod)) {
      return;
    }

    setPeriod(nextPeriod);
    setError("");

    // Preset periods apply immediately.
    // Custom stays pending until dates are submitted.
    if (nextPeriod !== "custom") {
      setApplied({ period: nextPeriod });
    }
  }
  function applyFilters(event) {
    event.preventDefault();

    if (period === "custom") {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
        from > to
      ) {
        setError("Select a valid custom date range.");
        return;
      }
    }

    setApplied(
      period === "custom"
        ? { period, from, to }
        : { period }
    );
  }

  const report =
    loaded?.key === appliedKey
      ? loaded.report
      : null;

  const stats = report?.stats;
  const selectedPerformance = report?.hotelPerformance?.[0];

  return (
    <main className="hotel-finance">
      <header className="hotel-finance__header">
        <span className="hotel-finance__eyebrow">
          SELECTED HOTEL / FINANCIAL INTELLIGENCE
        </span>

        <h1>Hotel Finance</h1>

        <p>
          Financial performance for{" "}
          <strong>{selectedHotel?.name || hotelId}</strong>.
          Read-only figures from the verified Reports API.
        </p>
      </header>

      <form
        className="hotel-finance__filters"
        onSubmit={applyFilters}
      >
        <div className="hotel-finance__filter-header">
          <div>
            <strong>Reporting Period</strong>
            <span>Property: {hotelId}</span>
          </div>

          <div
            className="hotel-finance__periods"
            role="group"
            aria-label="Reporting period"
          >
            {PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                className={
                  period === option
                    ? "hotel-finance__period hotel-finance__period--active"
                    : "hotel-finance__period"
                }
                aria-pressed={period === option}
                onClick={() => choosePeriod(option)}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {period === "custom" && (
          <div className="hotel-finance__dates">
            <label>
              From date
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                required
              />
            </label>

            <label>
              To date
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
              />
            </label>
          </div>
        )}


        {period === "custom" && (
          <div className="hotel-finance__filter-footer">
            <span>
              Choose both dates to apply a custom reporting range.
            </span>

            <button
              type="submit"
              className="hotel-finance__apply"
              disabled={loading || refreshing}
            >
              Apply Date Range
            </button>
          </div>
        )}

</form>

      {error && (
        <div className="hotel-finance__error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="hotel-finance__loading" role="status">
          Loading financial information...
        </div>
      ) : report ? (
        <>
          <div className="hotel-finance__scope">
            <span>
              Hotel: <strong>{hotelId}</strong>
            </span>

            <span>
              {report.rangeLabel || "Selected reporting period"}
            </span>

            <span>
              {refreshing ? "Refreshing..." : "Read-only finance"}
            </span>
          </div>

          <section
            className="hotel-finance__metrics"
            aria-label="Financial summary"
          >
            <Metric
              label="Net Collections"
              value={money(stats.netCollections)}
              detail={
                `Previous: ${money(stats.netCollectionsPrev)} · ` +
                changePercentage(stats.netCollectionsChangePct)
              }
            />

            <Metric
              label="Total Bookings"
              value={quantity(stats.totalBookings)}
              detail="Bookings in the selected period"
            />

            <Metric
              label="Overnight Occupancy"
              value={percentage(stats.occupancyRate)}
              detail={
                `${quantity(stats.soldRoomNights)} / ` +
                `${quantity(stats.availableRoomNights)} room-nights`
              }
            />

            <Metric
              label="Cancellation Rate"
              value={percentage(stats.cancellationRate)}
              detail={`${quantity(stats.cancelledBookings)} cancelled bookings`}
            />

            <Metric
              label="Collections / Sold Room-Night"
              value={money(stats.collectionsPerSoldRoomNight)}
              detail="Net collections divided by sold room-nights"
            />

            <Metric
              label="Collections / Available Room-Night"
              value={money(stats.collectionsPerAvailableRoomNight)}
              detail={
                `${quantity(selectedPerformance?.totalRooms)} ` +
                "current inventory rooms"
              }
            />
          </section>

          <section
            className="hotel-finance__analysis"
            aria-label="Finance analysis"
          >
            <CollectionsTrend rows={report.revenueTrend || []} />

            <BookingStatus
              rows={report.bookingStatusBreakdown || []}
            />
          </section>

          <MonthlyHistory rows={report.monthlySummary || []} />

          <p className="hotel-finance__note">
            Financial totals are calculated by the existing
            Super Admin Reports service. No payment or refund
            actions are available on this page.
          </p>
        </>
      ) : (
        <div className="hotel-finance__loading" role="status">
          Financial information unavailable. Use the topbar
          refresh control to retry.
        </div>
      )}
    </main>
  );
}

export default HotelFinance;