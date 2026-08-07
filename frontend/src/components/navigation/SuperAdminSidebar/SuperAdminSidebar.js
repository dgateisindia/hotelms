import React from "react";

import { useUser } from "@clerk/clerk-react";

import {
  NavLink,
} from "react-router-dom";

import {
  HotelierCrown,
} from "../../../utils/icons/LoginIcons";

import "./SuperAdminSidebar.css";

/* ============================================================
   SIDEBAR ICONS

   Icons are kept locally for now so no additional icon package
   is required.
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

function OverviewIcon() {
  return (
    <IconBase>
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1"
      />

      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1"
      />

      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1"
      />

      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1"
      />
    </IconBase>
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

function AdminIcon() {
  return (
    <IconBase>
      <circle
        cx="9"
        cy="7"
        r="4"
      />

      <path d="M3 21v-2a6 6 0 0 1 6-6h1" />
      <path d="M16 11l1.2 2.4 2.8.4-2 2 .5 2.8L16 17.3l-2.5 1.3.5-2.8-2-2 2.8-.4L16 11z" />
    </IconBase>
  );
}

function AnalyticsIcon() {
  return (
    <IconBase>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </IconBase>
  );
}

function OperationsIcon() {
  return (
    <IconBase>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
      <circle
        cx="7"
        cy="7"
        r="1"
      />

      <circle
        cx="17"
        cy="12"
        r="1"
      />

      <circle
        cx="10"
        cy="17"
        r="1"
      />
    </IconBase>
  );
}

function FinanceIcon() {
  return (
    <IconBase>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />

      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </IconBase>
  );
}

function TeamIcon() {
  return (
    <IconBase>
      <circle
        cx="9"
        cy="7"
        r="4"
      />

      <path d="M2 21v-2a7 7 0 0 1 7-7" />
      <circle
        cx="17"
        cy="9"
        r="3"
      />

      <path d="M14 21v-1a5 5 0 0 1 5-5" />
    </IconBase>
  );
}

function SettingsIcon() {
  return (
    <IconBase>
      <circle
        cx="12"
        cy="12"
        r="3"
      />

      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z" />
    </IconBase>
  );
}

function ProfileIcon() {
  return (
    <IconBase>
      <circle
        cx="12"
        cy="8"
        r="4"
      />

      <path d="M4 21a8 8 0 0 1 16 0" />
    </IconBase>
  );
}

function CloseIcon() {
  return (
    <IconBase>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}

/* ============================================================
   NAVIGATION CONFIGURATION
============================================================ */

const PORTFOLIO_NAVIGATION = [
  {
    key: "overview",
    label: "Overview",
    to: "/superadmin-dashboard",
    icon: OverviewIcon,
    end: true,
  },
  {
    key: "hotels",
    label: "Hotels",
    to: "/superadmin/hotels",
    icon: HotelIcon,
    end: true,
  },
  {
    key: "admins",
    label: "Admins",
    to: "/superadmin/admins",
    icon: AdminIcon,
    end: true,
  },
  {
    key: "analytics",
    label: "Reports & Analytics",
    to: "/superadmin/reports",
    icon: AnalyticsIcon,
    end: true,
  },
];

const HOTEL_NAVIGATION = [
  {
    key: "hotel-overview",
    label: "Hotel Overview",
    path: "overview",
    icon: OverviewIcon,
  },
  {
    key: "operations",
    label: "Operations",
    path: "operations",
    icon: OperationsIcon,
    showPendingBadge: true,
  },
  {
    key: "finance",
    label: "Finance",
    path: "finance",
    icon: FinanceIcon,
  },
  {
    key: "team",
    label: "Team",
    path: "team",
    icon: TeamIcon,
  },
  {
    key: "hotel-settings",
    label: "QR & Settings",
    path: "settings",
    icon: SettingsIcon,
  },
];

const ACCOUNT_NAVIGATION = [
  {
    key: "profile-security",
    label: "Profile & Security",
    to: "/superadmin/profile-security",
    icon: ProfileIcon,
    end: true,
  },
];

/* ============================================================
   HELPERS
============================================================ */

function getUserDisplayName(user) {
  if (!user) {
    return "Super Admin";
  }

  if (user.fullName) {
    return user.fullName;
  }

  const combinedName = [
    user.firstName,
    user.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return combinedName || "Super Admin";
}

function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "SA";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    words[0][0] +
    words[words.length - 1][0]
  ).toUpperCase();
}

function getHotelStatusLabel(status) {
  switch (
    String(status || "")
      .trim()
      .toLowerCase()
  ) {
    case "active":
      return "Active hotel";

    case "inactive":
      return "Inactive hotel";

    case "pending":
      return "Setup pending";

    case "rejected":
      return "Hotel access rejected";

    default:
      return "Status unavailable";
  }
}

function getHotelStatusColor(status) {
  switch (
    String(status || "")
      .trim()
      .toLowerCase()
  ) {
    case "active":
      return "var(--color-success-accent)";

    case "pending":
      return "var(--color-warning-accent)";

    case "inactive":
    case "rejected":
      return "var(--color-danger-accent)";

    default:
      return "var(--color-placeholder)";
  }
}

function formatBadgeCount(value) {
  const count = Number(value);

  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }

  if (count > 99) {
    return "99+";
  }

  return String(count);
}

/* ============================================================
   REUSABLE NAVIGATION ITEM
============================================================ */

function SidebarNavigationItem({
  item,
  badge,
  isCollapsed,
  onNavigate,
}) {
  const ItemIcon = item.icon;

  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        title={
          isCollapsed
            ? item.label
            : undefined
        }
        className={({
          isActive,
        }) =>
          [
            "super-admin-sidebar__nav-link",
            isActive
              ? "super-admin-sidebar__nav-link--active"
              : "",
          ]
            .filter(Boolean)
            .join(" ")
        }
      >
        <span className="super-admin-sidebar__nav-icon">
          <ItemIcon />
        </span>

        <span className="super-admin-sidebar__nav-label">
          {item.label}
        </span>

        {badge && (
          <span className="super-admin-sidebar__nav-badge">
            {badge}
          </span>
        )}
      </NavLink>
    </li>
  );
}

/* ============================================================
   SIDEBAR COMPONENT

   selectedHotel expected structure:

   {
     displayId: "HT-0001",
     name: "Grand Plaza Hotel",
     status: "active"
   }
============================================================ */

function SuperAdminSidebar({
  isCollapsed = false,
  onCloseMobile,
  selectedHotel = null,
  hotelCount = 0,
  adminCount = 0,
  pendingRequests = 0,
}) {
  const {
    isLoaded,
    user,
  } = useUser();

  const userName = isLoaded
    ? getUserDisplayName(user)
    : "Loading profile...";

  const userInitials =
    getInitials(userName);

  const hotelDisplayId =
    selectedHotel?.displayId ||
    selectedHotel?.hotelDisplayId ||
    "";

  const hotelName =
    selectedHotel?.name ||
    selectedHotel?.hotelName ||
    "";

  const hasSelectedHotel =
    Boolean(
      hotelDisplayId &&
      hotelName
    );

  const hotelBasePath =
    hasSelectedHotel
      ? `/superadmin/hotels/${encodeURIComponent(
          hotelDisplayId
        )}`
      : "";

  const portfolioBadges = {
    hotels:
      formatBadgeCount(hotelCount),

    admins:
      formatBadgeCount(adminCount),
  };

  const pendingRequestBadge =
    formatBadgeCount(
      pendingRequests
    );

  const handleNavigation = () => {
    if (
      typeof onCloseMobile ===
      "function"
    ) {
      onCloseMobile();
    }
  };

  return (
    <div className="super-admin-sidebar">
      <div className="super-admin-sidebar__header">
        <NavLink
          to="/superadmin-dashboard"
          className="super-admin-sidebar__brand"
          onClick={handleNavigation}
          title={
            isCollapsed
              ? "Hotel Management System"
              : undefined
          }
        >
          <span className="super-admin-sidebar__brand-mark">
            <HotelierCrown />
          </span>

          <span className="super-admin-sidebar__brand-content">
            <span className="super-admin-sidebar__brand-title">
              Hotel Management
            </span>

            <span className="super-admin-sidebar__brand-subtitle">
              Super Admin Portal
            </span>
          </span>
        </NavLink>

        <button
          type="button"
          className="super-admin-sidebar__mobile-close"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
        >
          <CloseIcon />
        </button>
      </div>

      <nav
        className="super-admin-sidebar__navigation"
        aria-label="Super Admin menu"
      >
        <section className="super-admin-sidebar__section">
          <h2 className="super-admin-sidebar__section-title">
            Portfolio
          </h2>

          <ul className="super-admin-sidebar__nav-list">
            {PORTFOLIO_NAVIGATION.map(
              (item) => (
                <SidebarNavigationItem
                  key={item.key}
                  item={item}
                  badge={
                    portfolioBadges[
                      item.key
                    ]
                  }
                  isCollapsed={
                    isCollapsed
                  }
                  onNavigate={
                    handleNavigation
                  }
                />
              )
            )}
          </ul>
        </section>

        <section className="super-admin-sidebar__section">
          <h2 className="super-admin-sidebar__section-title">
            Selected Hotel
          </h2>

          {hasSelectedHotel ? (
            <>
              <div className="super-admin-sidebar__hotel-context">
                <div className="super-admin-sidebar__hotel-context-header">
                  <div className="super-admin-sidebar__hotel-icon">
                    <HotelIcon />
                  </div>

                  <div className="super-admin-sidebar__hotel-details">
                    <div className="super-admin-sidebar__hotel-label">
                      Current Property
                    </div>

                    <div className="super-admin-sidebar__hotel-name">
                      {hotelName}
                    </div>

                    <div className="super-admin-sidebar__hotel-id">
                      {hotelDisplayId}
                    </div>
                  </div>
                </div>

                <div className="super-admin-sidebar__hotel-status">
                  <span
                    className="super-admin-sidebar__hotel-status-dot"
                    style={{
                      backgroundColor:
                        getHotelStatusColor(
                          selectedHotel?.status
                        ),
                    }}
                  />

                  {getHotelStatusLabel(
                    selectedHotel?.status
                  )}
                </div>
              </div>

              <ul className="super-admin-sidebar__nav-list">
                {HOTEL_NAVIGATION.map(
                  (item) => {
                    const navigationItem = {
                      ...item,
                      to: `${hotelBasePath}/${item.path}`,
                      end: true,
                    };

                    return (
                      <SidebarNavigationItem
                        key={item.key}
                        item={
                          navigationItem
                        }
                        badge={
                          item.showPendingBadge
                            ? pendingRequestBadge
                            : null
                        }
                        isCollapsed={
                          isCollapsed
                        }
                        onNavigate={
                          handleNavigation
                        }
                      />
                    );
                  }
                )}
              </ul>
            </>
          ) : (
            <div className="super-admin-sidebar__hotel-empty">
              <div className="super-admin-sidebar__hotel-empty-title">
                No hotel selected
              </div>

              <p className="super-admin-sidebar__hotel-empty-text">
                Open Hotels and select a
                property to view its
                operations.
              </p>
            </div>
          )}
        </section>

        <section className="super-admin-sidebar__section">
          <h2 className="super-admin-sidebar__section-title">
            Account
          </h2>

          <ul className="super-admin-sidebar__nav-list">
            {ACCOUNT_NAVIGATION.map(
              (item) => (
                <SidebarNavigationItem
                  key={item.key}
                  item={item}
                  isCollapsed={
                    isCollapsed
                  }
                  onNavigate={
                    handleNavigation
                  }
                />
              )
            )}
          </ul>
        </section>
      </nav>

      <div className="super-admin-sidebar__footer">
        <div className="super-admin-sidebar__user-card">
          <NavLink
            to="/superadmin/profile-security"
            className="super-admin-sidebar__user-avatar"
            onClick={handleNavigation}
            title={
              isCollapsed
                ? userName
                : undefined
            }
            aria-label="Open profile and security"
          >
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt=""
              />
            ) : (
              userInitials
            )}
          </NavLink>

          <div className="super-admin-sidebar__user-details">
            <div className="super-admin-sidebar__user-name">
              {userName}
            </div>

            <div className="super-admin-sidebar__user-role">
              Business Owner
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default SuperAdminSidebar;