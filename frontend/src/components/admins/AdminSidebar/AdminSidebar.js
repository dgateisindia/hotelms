import React from "react";

import {
  useClerk,
  useUser,
} from "@clerk/clerk-react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import {
  HotelierCrown,
} from "../../../utils/icons/LoginIcons";

import "./AdminSidebar.css";


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


/* ============================================================
   ICONS
============================================================ */

function DashboardIcon() {
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


function BookingDeskIcon() {
  return (
    <IconBase>
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="2"
      />

      <path d="M8 7h8" />
      <path d="M8 11h4" />
      <path d="M15 14v6" />
      <path d="M12 17h6" />
    </IconBase>
  );
}


function BookingsIcon() {
  return (
    <IconBase>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
      />

      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M3 10h18" />

      <path d="m8 15 2 2 5-5" />
    </IconBase>
  );
}


function RoomsIcon() {
  return (
    <IconBase>
      <path d="M3 20V8" />
      <path d="M21 20V8" />

      <path d="M3 16h18" />

      <path d="M6 16v-5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v5" />

      <path d="M13 12h5a3 3 0 0 1 3 3v1" />
    </IconBase>
  );
}


function CustomersIcon() {
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


function BillingIcon() {
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
      <path d="M7 15h4" />
    </IconBase>
  );
}


function ReportsIcon() {
  return (
    <IconBase>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </IconBase>
  );
}


function StaffIcon() {
  return (
    <IconBase>
      <circle
        cx="9"
        cy="8"
        r="3"
      />

      <path d="M3 20c0-4 2.5-6 6-6s6 2 6 6" />

      <circle
        cx="17"
        cy="9"
        r="2"
      />

      <path d="M15 15c3.5 0 6 1.5 6 5" />
    </IconBase>
  );
}


function AttendanceIcon() {
  return (
    <IconBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="M12 7v5l3 2" />
      <path d="m8 13 2 2 4-4" />
    </IconBase>
  );
}


function PayrollIcon() {
  return (
    <IconBase>
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="2"
      />

      <path d="M7 10h10" />
      <path d="M8 14h4" />
      <path d="M16 13v3" />
    </IconBase>
  );
}


function RequestsIcon() {
  return (
    <IconBase>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />

      <path d="M10 21h4" />
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


function LogoutIcon() {
  return (
    <IconBase>
      <path d="M10 17l5-5-5-5" />

      <path d="M15 12H3" />

      <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
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


/* ============================================================
   NAVIGATION CONFIGURATION
============================================================ */

const NAVIGATION_SECTIONS = [
  {
    key: "hotel-operations",

    label: "Hotel Operations",

    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        to: "/admin-dashboard",
        icon: DashboardIcon,
        end: true,
      },
    ],
  },

  {
    key: "front-desk",

    label: "Front Desk",

    items: [
      {
        key: "booking-desk",
        label: "Booking Desk",
        to: "/booking-desk",
        icon: BookingDeskIcon,
        end: true,
      },

      {
        key: "bookings",
        label: "Bookings",
        to: "/bookings",
        icon: BookingsIcon,
        end: true,
      },

      {
        key: "rooms",
        label: "Rooms",
        to: "/rooms",
        icon: RoomsIcon,
        end: true,
      },

      {
        key: "customers",
        label: "Customers",
        to: "/customers",
        icon: CustomersIcon,
        end: true,
      },
    ],
  },

  {
    key: "finance",

    label: "Finance",

    items: [
      {
        key: "billing",
        label: "Billing",
        to: "/billing",
        icon: BillingIcon,
        end: true,
      },

      {
        key: "reports",
        label: "Reports",
        to: "/reports",
        icon: ReportsIcon,
        end: true,
      },
    ],
  },

  {
    key: "team",

    label: "Team",

    items: [
      {
        key: "staff",
        label: "Staff",
        to: "/staff",
        icon: StaffIcon,
        end: true,
      },

      {
        key: "attendance",
        label: "Attendance",
        to: "/attendance",
        icon: AttendanceIcon,
        end: true,
      },

      {
        key: "payroll",
        label: "Payroll",
        to: "/payroll",
        icon: PayrollIcon,
        end: true,
      },
    ],
  },

  {
    key: "requests",

    label: "Requests",

    items: [
      {
        key: "customer-requests",
        label: "Customer Requests",
        to: "/notifications",
        icon: RequestsIcon,
        end: true,
        showPendingBadge: true,
      },
    ],
  },

  {
    key: "account",

    label: "Account",

    items: [
      {
        key: "profile-security",
        label: "Profile & Security",
        to: "/profile-security",
        icon: ProfileIcon,
        end: true,
      },
    ],
  },
];


/* ============================================================
   HELPERS
============================================================ */

function getClerkUserName(
  user
) {
  if (!user) {
    return "";
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


  return combinedName;
}


function getInitials(
  name
) {
  const words =
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);


  if (
    words.length === 0
  ) {
    return "A";
  }


  if (
    words.length === 1
  ) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }


  return (
    words[0][0] +
    words[
      words.length - 1
    ][0]
  ).toUpperCase();
}


function formatBadgeCount(
  value
) {
  const count =
    Number(value);


  if (
    !Number.isFinite(count) ||
    count <= 0
  ) {
    return null;
  }


  if (
    count > 99
  ) {
    return "99+";
  }


  return String(count);
}


function getHotelStatusLabel(
  status
) {
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
      return "Hotel unavailable";

    default:
      return "Hotel status unavailable";
  }
}


function getHotelStatusColor(
  status
) {
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


/* ============================================================
   NAVIGATION ITEM
============================================================ */

function NavigationItem({
  item,
  badge,
  isCollapsed,
  onNavigate,
}) {
  const ItemIcon =
    item.icon;


  return (
    <NavLink
      to={
        item.to
      }
      end={
        item.end
      }
      onClick={
        onNavigate
      }
      title={
        isCollapsed
          ? item.label
          : undefined
      }
      className={({
        isActive,
      }) =>
        [
          "admin-sidebar__item",

          isActive
            ? "admin-sidebar__item--active"
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      <span className="admin-sidebar__item-icon">
        <ItemIcon />
      </span>


      <span className="admin-sidebar__item-label">
        {item.label}
      </span>


      {badge && (
        <span className="admin-sidebar__badge">
          {badge}
        </span>
      )}
    </NavLink>
  );
}


/* ============================================================
   ADMIN SIDEBAR

   selectedHotel:
   {
     displayId: "HT-0001",
     name: "Royal Palace Hotel & Resort",
     status: "active"
   }

   adminProfile:
   {
     fullName: "Admin 1",
     profileImage: null
   }
============================================================ */

function AdminSidebar({
  isCollapsed = false,
  onCloseMobile,
  selectedHotel = null,
  adminProfile = null,
  pendingRequests = 0,
}) {
  const {
    isLoaded,
    user,
  } = useUser();


  const {
    signOut,
  } = useClerk();


  const navigate =
    useNavigate();


  /* ==========================================================
     ADMIN IDENTITY
  ========================================================== */

  const clerkName =
    isLoaded
      ? getClerkUserName(
          user
        )
      : "";


  const adminName =
    String(
      adminProfile?.fullName ||
      clerkName ||
      "Hotel Admin"
    ).trim();


  const adminInitials =
    getInitials(
      adminName
    );


  const profileImage =
    adminProfile?.profileImage ||
    user?.imageUrl ||
    null;


  /* ==========================================================
     HOTEL IDENTITY
  ========================================================== */

  const hotelName =
    String(
      selectedHotel?.name ||
      selectedHotel?.hotelName ||
      "Hotel information loading"
    ).trim();


  const hotelDisplayId =
    String(
      selectedHotel?.displayId ||
      selectedHotel?.hotelDisplayId ||
      ""
    )
      .trim()
      .toUpperCase();


  const hotelStatus =
    selectedHotel?.status;


  const pendingRequestBadge =
    formatBadgeCount(
      pendingRequests
    );


  /* ==========================================================
     NAVIGATION
  ========================================================== */

  const handleNavigation = () => {
    if (
      typeof onCloseMobile ===
      "function"
    ) {
      onCloseMobile();
    }
  };


  /* ==========================================================
     LOGOUT
  ========================================================== */

  const handleLogout =
    async () => {
      try {
        await signOut();

        navigate(
          "/login",
          {
            replace: true,
          }
        );
      } catch (
        logoutError
      ) {
        console.error(
          "[ADMIN_SIDEBAR:LOGOUT]",
          logoutError
        );
      }
    };


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="admin-sidebar">

      {/* ======================================================
          BRAND
      ====================================================== */}

      <NavLink
        to="/admin-dashboard"
        className="admin-sidebar__brand"
        onClick={
          handleNavigation
        }
        title={
          isCollapsed
            ? "Hotel Management System"
            : undefined
        }
      >

        <span className="admin-sidebar__brand-icon">
          <HotelierCrown />
        </span>


        <span className="admin-sidebar__brand-copy">

          <span className="admin-sidebar__brand-title">
            Hotel Management
          </span>


          <span className="admin-sidebar__brand-subtitle">
            Admin Portal
          </span>

        </span>

      </NavLink>


      {/* ======================================================
          ASSIGNED HOTEL

          Important:
          This is identity/context only.
          Admin cannot switch hotels.
      ====================================================== */}

      <section className="admin-sidebar__hotel">

        <span className="admin-sidebar__hotel-label">
          Assigned Hotel
        </span>


        <div className="admin-sidebar__hotel-main">

          <div className="admin-sidebar__hotel-icon">
            <HotelIcon />
          </div>


          <div className="admin-sidebar__hotel-copy">

            <span className="admin-sidebar__hotel-name">
              {hotelName}
            </span>


            <span className="admin-sidebar__hotel-id">
              {hotelDisplayId ||
                "Hotel ID loading"}
            </span>

          </div>

        </div>


        <div className="admin-sidebar__hotel-status">

          <span
            className="admin-sidebar__hotel-status-dot"
            style={{
              backgroundColor:
                getHotelStatusColor(
                  hotelStatus
                ),
            }}
          />


          {getHotelStatusLabel(
            hotelStatus
          )}

        </div>

      </section>


      {/* ======================================================
          NAVIGATION
      ====================================================== */}

      <nav
        className="admin-sidebar__nav"
        aria-label="Hotel Admin menu"
      >

        {NAVIGATION_SECTIONS.map(
          (section) => (
            <section
              key={
                section.key
              }
              className="admin-sidebar__section"
            >

              <span className="admin-sidebar__section-title">
                {section.label}
              </span>


              {section.items.map(
                (item) => (
                  <NavigationItem
                    key={
                      item.key
                    }
                    item={
                      item
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
                )
              )}

            </section>
          )
        )}


        {/* ====================================================
            LOGOUT
        ==================================================== */}

        <section className="admin-sidebar__section">

          <button
            type="button"
            className="admin-sidebar__item"
            onClick={
              handleLogout
            }
            title={
              isCollapsed
                ? "Logout"
                : undefined
            }
          >

            <span className="admin-sidebar__item-icon">
              <LogoutIcon />
            </span>


            <span className="admin-sidebar__item-label">
              Logout
            </span>

          </button>

        </section>

      </nav>


      {/* ======================================================
          ADMIN PROFILE
      ====================================================== */}

      <footer className="admin-sidebar__footer">

        <div className="admin-sidebar__profile">

          <div
            className="admin-sidebar__avatar"
            title={
              isCollapsed
                ? adminName
                : undefined
            }
          >

            {profileImage ? (
              <img
                src={
                  profileImage
                }
                alt=""
              />
            ) : (
              adminInitials
            )}

          </div>


          <div className="admin-sidebar__profile-copy">

            <span className="admin-sidebar__profile-name">
              {adminName}
            </span>


            <span className="admin-sidebar__profile-role">
              Hotel Admin
            </span>

          </div>

        </div>

      </footer>

    </div>
  );
}


export default AdminSidebar;