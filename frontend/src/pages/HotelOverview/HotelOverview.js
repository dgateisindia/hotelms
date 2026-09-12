import React, {
  useMemo,
} from "react";

import {
  useOutletContext,
} from "react-router-dom";

import "./HotelOverview.css";


/* ============================================================
   ICON BASE
============================================================ */

function IconBase({
  children,
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}


function HotelIcon() {
  return (
    <IconBase>
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <path d="M3 21h18" />
      <path d="M9 7h1" />
      <path d="M14 7h1" />
      <path d="M9 11h1" />
      <path d="M14 11h1" />
      <path d="M10 21v-4h4v4" />
    </IconBase>
  );
}


function BookingIcon() {
  return (
    <IconBase>
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
      />

      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 9h16" />
      <path d="M8 13h3" />
      <path d="M8 16h5" />
    </IconBase>
  );
}


function RevenueIcon() {
  return (
    <IconBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="M8 8h8" />
      <path d="M8 11h8" />
      <path d="M9 8c4 0 5 1.5 5 3s-1 3-5 3" />
      <path d="m9 14 5 5" />
    </IconBase>
  );
}


function RoomIcon() {
  return (
    <IconBase>
      <path d="M4 19V9" />
      <path d="M20 19V7" />
      <path d="M4 14h16" />
      <path d="M7 14v-3h5a3 3 0 0 1 3 3" />
      <path d="M4 19h16" />
    </IconBase>
  );
}


function AdminIcon() {
  return (
    <IconBase>
      <circle
        cx="9"
        cy="8"
        r="3"
      />

      <path d="M3 20c0-4 2.5-6 6-6s6 2 6 6" />

      <path d="M17 8h4" />
      <path d="M19 6v4" />
    </IconBase>
  );
}


function RequestIcon() {
  return (
    <IconBase>
      <path d="M12 3 2.8 19h18.4L12 3z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </IconBase>
  );
}


/* ============================================================
   HELPERS
============================================================ */

function numberValue(
  value
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return parsed;
}


function formatCurrency(
  value
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(
    numberValue(value)
  );
}


function valueOrDash(
  value
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return "—";
  }

  return value;
}


function formatStatus(
  status
) {
  const normalized =
    String(status || "")
      .trim()
      .toLowerCase();

  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}


function getStatusClass(
  status
) {
  const normalized =
    String(status || "")
      .trim()
      .toLowerCase();

  switch (normalized) {
    case "active":
      return "hotel-overview-status--active";

    case "pending":
      return "hotel-overview-status--pending";

    case "inactive":
      return "hotel-overview-status--inactive";

    case "rejected":
      return "hotel-overview-status--rejected";

    default:
      return "hotel-overview-status--neutral";
  }
}


/* ============================================================
   HOTEL OVERVIEW
============================================================ */

function HotelOverview() {
  const context =
    useOutletContext();

  const selectedHotel =
    context?.selectedHotel;


  const metrics =
    useMemo(() => {
      const rooms =
        selectedHotel?.rooms || {};

      const today =
        selectedHotel?.today || {};

      const totalRooms =
        numberValue(
          rooms.total
        );

      const occupiedRooms =
        numberValue(
          rooms.occupied
        );

      const availableRooms =
        numberValue(
          rooms.available
        );

      const occupancy =
        totalRooms > 0
          ? Math.round(
              (
                occupiedRooms /
                totalRooms
              ) *
                100
            )
          : null;

      return {
        totalRooms,
        occupiedRooms,
        availableRooms,

        occupancy,

        bookings:
          numberValue(
            today.bookings
          ),

        revenue:
          numberValue(
            today.revenue
          ),

        adminCount:
          numberValue(
            selectedHotel
              ?.admins
              ?.count
          ),

        pendingRequests:
          numberValue(
            selectedHotel
              ?.pendingRequests
          ),
      };
    }, [selectedHotel]);


  if (!selectedHotel) {
    return null;
  }


  return (
    <div className="hotel-overview">

      {/* ======================================================
          HOTEL HEADER
      ====================================================== */}

      <section className="hotel-overview-header">
        <div className="hotel-overview-header__identity">

          <div className="hotel-overview-header__logo">
            {selectedHotel.logo ? (
              <img
                src={selectedHotel.logo}
                alt={`${selectedHotel.name} logo`}
              />
            ) : (
              <HotelIcon />
            )}
          </div>


          <div className="hotel-overview-header__text">
            <div className="hotel-overview-header__title-row">
              <h1>
                {selectedHotel.name}
              </h1>

              <span
                className={`hotel-overview-status ${getStatusClass(
                  selectedHotel.status
                )}`}
              >
                {formatStatus(
                  selectedHotel.status
                )}
              </span>
            </div>


            <div className="hotel-overview-header__meta">
              <span>
                {selectedHotel.displayId}
              </span>

              <span
                className="hotel-overview-header__separator"
                aria-hidden="true"
              >
                •
              </span>

              <span>
                {valueOrDash(
                  selectedHotel.type
                )}
              </span>
            </div>
          </div>

        </div>
      </section>


      {/* ======================================================
          TODAY / HOTEL METRICS
      ====================================================== */}

      <section className="hotel-overview-metrics">

        <MetricCard
          icon={<BookingIcon />}
          label="Today's Bookings"
          value={metrics.bookings}
          hint="Bookings for today"
          tone="info"
        />


        <MetricCard
          icon={<RevenueIcon />}
          label="Today's Revenue"
          value={formatCurrency(
            metrics.revenue
          )}
          hint="Today's hotel revenue"
          tone="success"
        />


        <MetricCard
          icon={<RoomIcon />}
          label="Occupancy"
          value={
            metrics.occupancy ===
            null
              ? "—"
              : `${metrics.occupancy}%`
          }
          hint={
            metrics.totalRooms === 0
              ? "No rooms configured"
              : `${metrics.occupiedRooms} of ${metrics.totalRooms} rooms occupied`
          }
          tone="primary"
        />


        <MetricCard
          icon={<AdminIcon />}
          label="Hotel Admins"
          value={
            metrics.adminCount
          }
          hint="Assigned to this hotel"
          tone="neutral"
        />


        <MetricCard
          icon={<RequestIcon />}
          label="Pending Requests"
          value={
            metrics.pendingRequests
          }
          hint={
            metrics.pendingRequests ===
            0
              ? "No pending requests"
              : "Requires attention"
          }
          tone="warning"
        />

      </section>


      {/* ======================================================
          DETAILS GRID
      ====================================================== */}

      <section className="hotel-overview-content">

        {/* ----------------------------------------------------
            ROOM STATUS
        ---------------------------------------------------- */}

        <article className="hotel-overview-card">
          <div className="hotel-overview-card__header">
            <div>
              <h2>
                Room Overview
              </h2>

              <p>
                Current room status for
                this property.
              </p>
            </div>
          </div>


          <div className="hotel-overview-room-grid">

            <RoomStat
              label="Total Rooms"
              value={
                metrics.totalRooms
              }
            />

            <RoomStat
              label="Available"
              value={
                metrics.availableRooms
              }
              status="available"
            />

            <RoomStat
              label="Occupied"
              value={
                metrics.occupiedRooms
              }
              status="occupied"
            />

          </div>


          {metrics.totalRooms === 0 && (
            <div className="hotel-overview-empty-note">
              Rooms have not been
              configured for this hotel
              yet.
            </div>
          )}
        </article>


        {/* ----------------------------------------------------
            HOTEL INFORMATION
        ---------------------------------------------------- */}

        <article className="hotel-overview-card">
          <div className="hotel-overview-card__header">
            <div>
              <h2>
                Hotel Information
              </h2>

              <p>
                Registered property
                information.
              </p>
            </div>
          </div>


          <div className="hotel-overview-details">

            <DetailRow
              label="Hotel ID"
              value={
                selectedHotel.displayId
              }
            />

            <DetailRow
              label="Hotel Type"
              value={
                valueOrDash(
                  selectedHotel.type
                )
              }
            />

            <DetailRow
              label="Star Rating"
              value={
                selectedHotel.starRating
                  ? `${selectedHotel.starRating} Star`
                  : "—"
              }
            />

            <DetailRow
              label="Established Year"
              value={
                valueOrDash(
                  selectedHotel.yearEstablished
                )
              }
            />

            <DetailRow
              label="GST Number"
              value={
                valueOrDash(
                  selectedHotel.gstNumber
                )
              }
            />

            <DetailRow
              label="PAN Number"
              value={
                valueOrDash(
                  selectedHotel.panNumber
                )
              }
            />

            <DetailRow
              label="Business Registration"
              value={
                valueOrDash(
                  selectedHotel.businessRegistrationNumber
                )
              }
            />

            <DetailRow
              label="Status"
              value={
                formatStatus(
                  selectedHotel.status
                )
              }
            />

          </div>
        </article>

      </section>


      {/* ======================================================
          DESCRIPTION
      ====================================================== */}

      {selectedHotel.description && (
        <section className="hotel-overview-card hotel-overview-description">
          <div className="hotel-overview-card__header">
            <div>
              <h2>
                About This Hotel
              </h2>

              <p>
                Property description.
              </p>
            </div>
          </div>

          <p className="hotel-overview-description__text">
            {
              selectedHotel.description
            }
          </p>
        </section>
      )}

    </div>
  );
}


/* ============================================================
   METRIC CARD
============================================================ */

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone,
}) {
  return (
    <article className="hotel-overview-metric">

      <div
        className={`hotel-overview-metric__icon hotel-overview-metric__icon--${tone}`}
      >
        {icon}
      </div>


      <div className="hotel-overview-metric__content">
        <span className="hotel-overview-metric__label">
          {label}
        </span>

        <strong className="hotel-overview-metric__value">
          {value}
        </strong>

        <span className="hotel-overview-metric__hint">
          {hint}
        </span>
      </div>

    </article>
  );
}


/* ============================================================
   ROOM STAT
============================================================ */

function RoomStat({
  label,
  value,
  status = "",
}) {
  return (
    <div
      className={`hotel-overview-room-stat ${
        status
          ? `hotel-overview-room-stat--${status}`
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}


/* ============================================================
   DETAIL ROW
============================================================ */

function DetailRow({
  label,
  value,
}) {
  return (
    <div className="hotel-overview-detail-row">
      <span className="hotel-overview-detail-row__label">
        {label}
      </span>

      <strong className="hotel-overview-detail-row__value">
        {value}
      </strong>
    </div>
  );
}


export default HotelOverview;