import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useAuth,
  useUser,
} from "@clerk/clerk-react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import "./SuperAdminTopbar.css";

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

function MenuIcon() {
  return (
    <IconBase>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </IconBase>
  );
}

function SearchIcon() {
  return (
    <IconBase>
      <circle
        cx="11"
        cy="11"
        r="7"
      />

      <path d="m20 20-4-4" />
    </IconBase>
  );
}

function RefreshIcon() {
  return (
    <IconBase>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M6.1 9A7 7 0 0 1 18 6l2 5" />
      <path d="M17.9 15A7 7 0 0 1 6 18l-2-5" />
    </IconBase>
  );
}

function BellIcon() {
  return (
    <IconBase>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
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
      <path d="M10 21v-4h4v4" />
    </IconBase>
  );
}

function ChevronDownIcon() {
  return (
    <IconBase>
      <path d="m6 9 6 6 6-6" />
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

function getUserEmail(user) {
  return (
    user?.primaryEmailAddress
      ?.emailAddress ||
    "Email unavailable"
  );
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

function formatBadgeCount(value) {
  const count = Number(value);

  if (
    !Number.isFinite(count) ||
    count <= 0
  ) {
    return null;
  }

  if (count > 99) {
    return "99+";
  }

  return String(count);
}

function getHotelDisplayId(hotel) {
  return (
    hotel?.displayId ||
    hotel?.hotelDisplayId ||
    ""
  );
}

function getHotelName(hotel) {
  return (
    hotel?.name ||
    hotel?.hotelName ||
    ""
  );
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

/* ============================================================
   BREADCRUMB
============================================================ */

function Breadcrumbs({
  items,
}) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return null;
  }

  return (
    <nav
      className="super-admin-topbar__breadcrumb"
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => {
        const isLast =
          index === items.length - 1;

        return (
          <span
            className="super-admin-topbar__breadcrumb-item"
            key={`${item.label}-${index}`}
          >
            {index > 0 && (
              <span
                className="super-admin-topbar__breadcrumb-separator"
                aria-hidden="true"
              >
                /
              </span>
            )}

            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="super-admin-topbar__breadcrumb-link"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  isLast
                    ? "super-admin-topbar__breadcrumb-current"
                    : ""
                }
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* ============================================================
   TOPBAR COMPONENT

   selectedHotel expected structure:

   {
     displayId: "HT-0001",
     name: "Grand Plaza Hotel",
     status: "active"
   }
============================================================ */

function SuperAdminTopbar({
  title = "Portfolio Overview",
  breadcrumbs = [
    {
      label: "Portfolio",
    },
    {
      label: "Overview",
    },
  ],
  selectedHotel = null,
  pendingRequests = 0,
  showSearch = false,
  showActionCenter = false,
  searchPlaceholder =
    "Search hotels, admins or bookings",
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
  onRefresh,
  isRefreshing = false,
  onToggleSidebar,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    signOut,
  } = useAuth();

  const {
    isLoaded,
    user,
  } = useUser();

  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const [
    isProfileOpen,
    setIsProfileOpen,
  ] = useState(false);

  const [
    localSearchValue,
    setLocalSearchValue,
  ] = useState(searchValue);

  const [
    signingOut,
    setSigningOut,
  ] = useState(false);

  const [
    actionError,
    setActionError,
  ] = useState("");

  const userName = isLoaded
    ? getUserDisplayName(user)
    : "Loading profile...";

  const userEmail =
    getUserEmail(user);

  const userInitials =
    getInitials(userName);

  const hotelDisplayId =
    getHotelDisplayId(
      selectedHotel
    );

  const hotelName =
    getHotelName(
      selectedHotel
    );

  const hasSelectedHotel =
    Boolean(
      hotelDisplayId &&
      hotelName
    );

  const pendingBadge =
    formatBadgeCount(
      pendingRequests
    );

  useEffect(() => {
    setLocalSearchValue(
      searchValue
    );
  }, [searchValue]);

  /*
   * Close the profile dropdown after route navigation.
   */
  useEffect(() => {
    setIsProfileOpen(false);
    setActionError("");
  }, [location.pathname]);

  /*
   * Close dropdown when clicking outside.
   */
  useEffect(() => {
    const handleOutsideClick = (
      event
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target
        )
      ) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  /*
   * Escape closes dropdown.
   * Forward slash focuses dashboard search.
   */
  useEffect(() => {
    const handleKeyDown = (
      event
    ) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }

      const targetTag =
        event.target?.tagName
          ?.toLowerCase();

      const isTyping =
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select";

      if (
        event.key === "/" &&
        !isTyping &&
        searchInputRef.current
      ) {
        event.preventDefault();

        searchInputRef.current.focus();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  const handleSearchChange = (
    event
  ) => {
    const value =
      event.target.value;

    setLocalSearchValue(value);

    if (
      typeof onSearchChange ===
      "function"
    ) {
      onSearchChange(value);
    }
  };

  const handleSearchSubmit = (
    event
  ) => {
    event.preventDefault();

    const value =
      localSearchValue.trim();

    if (!value) {
      return;
    }

    if (
      typeof onSearchSubmit ===
      "function"
    ) {
      onSearchSubmit(value);
    }
  };

  const handleRefresh = async () => {
    if (
      typeof onRefresh !==
        "function" ||
      isRefreshing
    ) {
      return;
    }

    setActionError("");

    try {
      await onRefresh();
    } catch (refreshError) {
      setActionError(
        refreshError?.message ||
          "Dashboard data could not be refreshed."
      );
    }
  };

  const handlePendingRequests = () => {
    if (hasSelectedHotel) {
      navigate(
        `/superadmin/hotels/${encodeURIComponent(
          hotelDisplayId
        )}/operations`
      );

      return;
    }

    navigate(
      "/superadmin/hotels"
    );
  };

  const handleProfile = () => {
    setIsProfileOpen(false);

    navigate(
      "/superadmin/profile-security"
    );
  };

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setActionError("");

    try {
      await signOut();

      navigate("/login", {
        replace: true,
      });
    } catch (signOutError) {
      setActionError(
        signOutError?.message ||
          "Your session could not be closed. Please try again."
      );
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="super-admin-topbar">
      <div className="super-admin-topbar__left">
        <button
          type="button"
          className="super-admin-topbar__menu-button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          title="Toggle navigation menu"
        >
          <MenuIcon />
        </button>

        <div className="super-admin-topbar__page-context">
          <Breadcrumbs
            items={breadcrumbs}
          />

          <div className="super-admin-topbar__title-row">
            <h1 className="super-admin-topbar__title">
              {title}
            </h1>

            {hasSelectedHotel && (
              <div
                className="super-admin-topbar__hotel-context"
                title={`${hotelName} · ${hotelDisplayId}`}
              >
                <span className="super-admin-topbar__hotel-icon">
                  <HotelIcon />
                </span>

                <span className="super-admin-topbar__hotel-details">
                  <span className="super-admin-topbar__hotel-name">
                    {hotelName}
                  </span>

                  <span className="super-admin-topbar__hotel-id">
                    {hotelDisplayId}
                  </span>
                </span>

                <span
                  className="super-admin-topbar__hotel-status-dot"
                  style={{
                    backgroundColor:
                      getHotelStatusColor(
                        selectedHotel?.status
                      ),
                  }}
                  aria-label={`Hotel status: ${
                    selectedHotel?.status ||
                    "unknown"
                  }`}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="super-admin-topbar__right">

        {showSearch &&
          (typeof onSearchChange === "function" ||
            typeof onSearchSubmit === "function") && (
            <form
              className="super-admin-topbar__search"
              onSubmit={handleSearchSubmit}
              role="search"
            >
              <span className="super-admin-topbar__search-icon">
                <SearchIcon />
              </span>

              <input
                ref={searchInputRef}
                type="search"
                className="super-admin-topbar__search-input"
                placeholder={searchPlaceholder}
                value={localSearchValue}
                onChange={handleSearchChange}
                aria-label={searchPlaceholder}
              />

              <span className="super-admin-topbar__search-shortcut">
                /
              </span>
            </form>
          )
        }

        <button
          type="button"
          className={[
            "super-admin-topbar__action",
            "super-admin-topbar__action--secondary",
            isRefreshing
              ? "super-admin-topbar__action--loading"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={handleRefresh}
          disabled={
            isRefreshing ||
            typeof onRefresh !==
              "function"
          }
          aria-label="Refresh dashboard data"
          title="Refresh dashboard data"
        >
          <RefreshIcon />
        </button>

        {showActionCenter && (
          <button
            type="button"
            className="super-admin-topbar__action"
            onClick={handlePendingRequests}
            aria-label={
              pendingBadge
                ? `${pendingBadge} actions require attention`
                : "Open Action Center"
            }
            title="Action Center"
          >
            <BellIcon />

            {pendingBadge && (
              <span className="super-admin-topbar__notification-badge">
                {pendingBadge}
              </span>
            )}
          </button>
        )}

        <div
          className="super-admin-topbar__profile-wrapper"
          ref={dropdownRef}
        >
          <button
            type="button"
            className={[
              "super-admin-topbar__profile-button",
              isProfileOpen
                ? "super-admin-topbar__profile-button--open"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              setIsProfileOpen(
                (currentValue) =>
                  !currentValue
              );

              setActionError("");
            }}
            aria-haspopup="menu"
            aria-expanded={
              isProfileOpen
            }
          >
            <span className="super-admin-topbar__profile-avatar">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt=""
                />
              ) : (
                userInitials
              )}
            </span>

            <span className="super-admin-topbar__profile-details">
              <span className="super-admin-topbar__profile-name">
                {userName}
              </span>

              <span className="super-admin-topbar__profile-role">
                Business Owner
              </span>
            </span>

            <span className="super-admin-topbar__profile-chevron">
              <ChevronDownIcon />
            </span>
          </button>

          {isProfileOpen && (
            <div
              className="super-admin-topbar__dropdown"
              role="menu"
            >
              <div className="super-admin-topbar__dropdown-header">
                <div className="super-admin-topbar__dropdown-avatar">
                  {user?.imageUrl ? (
                    <img
                      src={
                        user.imageUrl
                      }
                      alt=""
                    />
                  ) : (
                    userInitials
                  )}
                </div>

                <div className="super-admin-topbar__dropdown-user">
                  <div className="super-admin-topbar__dropdown-name">
                    {userName}
                  </div>

                  <div className="super-admin-topbar__dropdown-email">
                    {userEmail}
                  </div>
                </div>
              </div>

              <div className="super-admin-topbar__dropdown-menu">
                <button
                  type="button"
                  className="super-admin-topbar__dropdown-item"
                  onClick={
                    handleProfile
                  }
                  role="menuitem"
                >
                  <ProfileIcon />
                  Profile &amp; Security
                </button>

                <div className="super-admin-topbar__dropdown-divider" />

                <button
                  type="button"
                  className="super-admin-topbar__dropdown-item super-admin-topbar__dropdown-item--danger"
                  onClick={
                    handleSignOut
                  }
                  disabled={
                    signingOut
                  }
                  role="menuitem"
                >
                  <LogoutIcon />

                  {signingOut
                    ? "Signing Out..."
                    : "Logout"}
                </button>
              </div>
            </div>
          )}

          {actionError && (
            <div
              className="super-admin-topbar__error"
              role="alert"
            >
              {actionError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SuperAdminTopbar;