import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import "./HotelCard.css";

/* ============================================================
   ICONS
============================================================ */

function IconBase({ children }) {
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
      <path d="M9 15h1" />
      <path d="M14 15h1" />
      <path d="M10 21v-3h4v3" />
    </IconBase>
  );
}

function ArrowIcon() {
  return (
    <IconBase>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  );
}

function AlertIcon() {
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

function normalizeStatus(status) {
  const normalizedStatus = String(
    status || ""
  )
    .trim()
    .toLowerCase();

  if (
    [
      "active",
      "pending",
      "inactive",
      "rejected",
    ].includes(normalizedStatus)
  ) {
    return normalizedStatus;
  }

  return "pending";
}

function formatStatus(status) {
  switch (normalizeStatus(status)) {
    case "active":
      return "Active";

    case "inactive":
      return "Inactive";

    case "rejected":
      return "Rejected";

    default:
      return "Setup Pending";
  }
}

function formatCurrency(value) {
  const amount = Number(value);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(
    Number.isFinite(amount)
      ? amount
      : 0
  );
}

function formatUpdatedDate(value) {
  if (!value) {
    return "Recently created";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Update time unavailable";
  }

  return `Updated ${date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  )}`;
}

function normalizeCount(value) {
  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0
  ) {
    return 0;
  }

  return parsedValue;
}

function getHotelPath(displayId) {
  const normalizedDisplayId =
    String(displayId || "")
      .trim()
      .toUpperCase();

  if (!normalizedDisplayId) {
    return "/superadmin/hotels";
  }

  return `/superadmin/hotels/${encodeURIComponent(
    normalizedDisplayId
  )}/overview`;
}

/* ============================================================
   HOTEL LOGO
============================================================ */

function HotelLogo({
  logo,
  hotelName,
}) {
  const [showImage, setShowImage] =
    useState(Boolean(logo));

  useEffect(() => {
    setShowImage(Boolean(logo));
  }, [logo]);

  return (
    <div className="hotel-card__logo">
      {showImage ? (
        <img
          src={logo}
          alt={`${hotelName} logo`}
          onError={() => {
            setShowImage(false);
          }}
        />
      ) : (
        <HotelIcon />
      )}
    </div>
  );
}

/* ============================================================
   ADMIN CHIPS
============================================================ */

function HotelAdmins({
  admins,
}) {
  const adminNames = Array.isArray(
    admins?.names
  )
    ? admins.names
        .map((name) =>
          String(name || "").trim()
        )
        .filter(Boolean)
    : [];

  const adminCount =
    normalizeCount(
      admins?.count
    );

  const visibleAdmins =
    adminNames.slice(0, 3);

  const remainingCount =
    Math.max(
      adminCount -
        visibleAdmins.length,
      0
    );

  return (
    <div className="hotel-card__admins">
      <div className="hotel-card__section-header">
        <span className="hotel-card__section-label">
          Hotel Admins
        </span>

        <span className="hotel-card__admin-count">
          {adminCount}{" "}
          {adminCount === 1
            ? "Admin"
            : "Admins"}
        </span>
      </div>

      {visibleAdmins.length > 0 ? (
        <div className="hotel-card__admin-list">
          {visibleAdmins.map(
            (adminName) => (
              <span
                key={adminName}
                className="hotel-card__admin-chip"
                title={adminName}
              >
                <span className="hotel-card__admin-chip-name">
                  {adminName}
                </span>
              </span>
            )
          )}

          {remainingCount > 0 && (
            <span className="hotel-card__admin-chip hotel-card__admin-chip--more">
              +{remainingCount} more
            </span>
          )}
        </div>
      ) : (
        <p className="hotel-card__admin-empty">
          No Admin assigned yet. Add an
          Admin from the hotel Team
          section.
        </p>
      )}
    </div>
  );
}

/* ============================================================
   HOTEL CARD
============================================================ */

function HotelCard({
  hotel,
  to,
}) {
  const safeHotel =
    hotel &&
    typeof hotel === "object"
      ? hotel
      : {};

  const status =
    normalizeStatus(
      safeHotel.status
    );

  const displayId =
    String(
      safeHotel.displayId ||
        ""
    )
      .trim()
      .toUpperCase();

  const hotelName =
    String(
      safeHotel.name ||
        "Unnamed Hotel"
    ).trim();

  const hotelType =
    String(
      safeHotel.type || ""
    ).trim();

  const description =
    String(
      safeHotel.description ||
        ""
    ).trim();

  const totalRooms =
    normalizeCount(
      safeHotel.rooms?.total
    );

  const occupancyRate =
    safeHotel.rooms
      ?.occupancyRate;

  const todayBookings =
    normalizeCount(
      safeHotel.today?.bookings
    );

  const todayRevenue =
    normalizeCount(
      safeHotel.today?.revenue
    );

  const pendingRequests =
    normalizeCount(
      safeHotel.pendingRequests
    );

  const destination =
    to ||
    getHotelPath(displayId);

  const occupancyValue =
    totalRooms === 0 ||
    occupancyRate === null ||
    occupancyRate === undefined
      ? "Not available"
      : `${normalizeCount(
          occupancyRate
        )}%`;

  const occupancySubtext =
    totalRooms === 0
      ? "No rooms configured"
      : `${totalRooms} total rooms`;

  const cardClassName = [
    "hotel-card",
    `hotel-card--${status}`,
  ].join(" ");

  const accessibilityLabel =
    displayId
      ? `Open ${hotelName}, ${displayId}`
      : `Open ${hotelName}`;

  const metrics = useMemo(
    () => [
      {
        label: "Total Rooms",
        value: totalRooms,
        subtext:
          totalRooms === 0
            ? "Setup required"
            : "Configured rooms",
      },
      {
        label: "Occupancy",
        value: occupancyValue,
        subtext: occupancySubtext,
      },
      {
        label: "Today's Bookings",
        value: todayBookings,
        subtext:
          todayBookings === 1
            ? "Booking today"
            : "Bookings today",
      },
      {
        label: "Today's Revenue",
        value:
          formatCurrency(
            todayRevenue
          ),
        subtext:
          "Successful payments",
      },
    ],
    [
      occupancySubtext,
      occupancyValue,
      todayBookings,
      todayRevenue,
      totalRooms,
    ]
  );

  return (
    <Link
      to={destination}
      className={cardClassName}
      aria-label={
        accessibilityLabel
      }
    >
      <div className="hotel-card__header">
        <div className="hotel-card__identity">
          <HotelLogo
            logo={safeHotel.logo}
            hotelName={hotelName}
          />

          <div className="hotel-card__title-group">
            <h3
              className="hotel-card__name"
              title={hotelName}
            >
              {hotelName}
            </h3>

            <div className="hotel-card__identity-row">
              {displayId && (
                <span className="hotel-card__display-id">
                  {displayId}
                </span>
              )}

              {hotelType && (
                <span className="hotel-card__type">
                  {hotelType}
                </span>
              )}
            </div>
          </div>
        </div>

        <span
          className={[
            "hotel-card__status",
            `hotel-card__status--${status}`,
          ].join(" ")}
        >
          <span className="hotel-card__status-dot" />
          {formatStatus(status)}
        </span>
      </div>

      {description && (
        <p className="hotel-card__description">
          {description}
        </p>
      )}

      <HotelAdmins
        admins={safeHotel.admins}
      />

      <div className="hotel-card__metrics">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="hotel-card__metric"
          >
            <span className="hotel-card__metric-label">
              {metric.label}
            </span>

            <strong className="hotel-card__metric-value">
              {metric.value}
            </strong>

            <span className="hotel-card__metric-subtext">
              {metric.subtext}
            </span>
          </div>
        ))}
      </div>

      {pendingRequests > 0 && (
        <div className="hotel-card__attention">
          <span className="hotel-card__attention-icon">
            <AlertIcon />
          </span>

          <span>
            {pendingRequests} pending{" "}
            {pendingRequests === 1
              ? "customer request requires"
              : "customer requests require"}{" "}
            Admin attention.
          </span>
        </div>
      )}

      <div className="hotel-card__footer">
        <span className="hotel-card__updated">
          {formatUpdatedDate(
            safeHotel.updatedAt ||
              safeHotel.createdAt
          )}
        </span>

        <span className="hotel-card__open-button">
          Open Hotel
          <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}

/* ============================================================
   LOADING SKELETON
============================================================ */

export function HotelCardSkeleton() {
  return (
    <div
      className="hotel-card hotel-card--loading"
      aria-hidden="true"
    >
      <div className="hotel-card__header">
        <div className="hotel-card__identity">
          <div className="hotel-card__logo loading-skeleton" />

          <div className="hotel-card__title-group">
            <div className="hotel-card__skeleton-line hotel-card__skeleton-line--title loading-skeleton" />

            <div className="hotel-card__identity-row">
              <div className="hotel-card__skeleton-line hotel-card__skeleton-line--small loading-skeleton" />
            </div>
          </div>
        </div>
      </div>

      <div className="hotel-card__admins">
        <div className="hotel-card__skeleton-line hotel-card__skeleton-line--full loading-skeleton" />
      </div>

      <div className="hotel-card__metrics">
        {[1, 2, 3, 4].map(
          (item) => (
            <div
              key={item}
              className="hotel-card__metric"
            >
              <div className="hotel-card__skeleton-line hotel-card__skeleton-line--small loading-skeleton" />
            </div>
          )
        )}
      </div>

      <div className="hotel-card__footer">
        <div className="hotel-card__skeleton-line hotel-card__skeleton-line--small loading-skeleton" />
      </div>
    </div>
  );
}

export default HotelCard;