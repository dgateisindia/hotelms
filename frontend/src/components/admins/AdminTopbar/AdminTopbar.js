import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useClerk,
  useUser,
} from "@clerk/clerk-react";

import {
  useNavigate,
} from "react-router-dom";

import "./AdminTopbar.css";


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

function MenuIcon() {
  return (
    <IconBase>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconBase>
  );
}


function RefreshIcon() {
  return (
    <IconBase>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M18.5 9A7 7 0 0 0 6 6.5L4 9" />
      <path d="M5.5 15A7 7 0 0 0 18 17.5l2-2.5" />
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

      <path d="M9 15h1" />
      <path d="M14 15h1" />

      <path d="M10 21v-3h4v3" />
    </IconBase>
  );
}


function ChevronIcon() {
  return (
    <IconBase>
      <path d="m7 10 5 5 5-5" />
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

function getClerkUserName(
  user
) {
  if (!user) {
    return "";
  }


  if (user.fullName) {
    return user.fullName;
  }


  return [
    user.firstName,
    user.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}


function getPrimaryEmail(
  user
) {
  return (
    user?.primaryEmailAddress
      ?.emailAddress ||
    user?.emailAddresses?.[0]
      ?.emailAddress ||
    ""
  );
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


  return count > 99
    ? "99+"
    : String(count);
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
   ADMIN TOPBAR
============================================================ */

function AdminTopbar({
  title = "Dashboard",
  selectedHotel = null,
  adminProfile = null,
  pendingRequests = 0,
  refreshing = false,
  onRefresh,
  onToggleSidebar,
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


  const [
    isProfileOpen,
    setIsProfileOpen,
  ] = useState(false);


  const [
    actionError,
    setActionError,
  ] = useState("");


  const profileWrapperRef =
    useRef(null);


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


  const adminEmail =
    String(
      adminProfile?.email ||
      getPrimaryEmail(user) ||
      ""
    ).trim();


  const profileImage =
    adminProfile?.profileImage ||
    user?.imageUrl ||
    null;


  const adminInitials =
    getInitials(
      adminName
    );


  /* ==========================================================
     HOTEL CONTEXT
  ========================================================== */

  const hotelName =
    String(
      selectedHotel?.name ||
      selectedHotel?.hotelName ||
      "Assigned Hotel"
    ).trim();


  const hotelDisplayId =
    String(
      selectedHotel?.displayId ||
      selectedHotel?.hotelDisplayId ||
      ""
    )
      .trim()
      .toUpperCase();


  const hotelStatusColor =
    getHotelStatusColor(
      selectedHotel?.status
    );


  const notificationBadge =
    formatBadgeCount(
      pendingRequests
    );


  /* ==========================================================
     CLOSE PROFILE MENU ON OUTSIDE CLICK
  ========================================================== */

  useEffect(() => {
    const handlePointerDown = (
      event
    ) => {
      if (
        !isProfileOpen
      ) {
        return;
      }


      if (
        profileWrapperRef.current &&
        !profileWrapperRef.current.contains(
          event.target
        )
      ) {
        setIsProfileOpen(
          false
        );
      }
    };


    document.addEventListener(
      "mousedown",
      handlePointerDown
    );


    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, [
    isProfileOpen,
  ]);


  /* ==========================================================
     ESCAPE
  ========================================================== */

  useEffect(() => {
    const handleEscape = (
      event
    ) => {
      if (
        event.key === "Escape"
      ) {
        setIsProfileOpen(
          false
        );

        setActionError("");
      }
    };


    document.addEventListener(
      "keydown",
      handleEscape
    );


    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);


  /* ==========================================================
     REFRESH
  ========================================================== */

  const handleRefresh =
    async () => {
      if (
        refreshing ||
        typeof onRefresh !==
          "function"
      ) {
        return;
      }


      setActionError("");


      try {
        await onRefresh();
      } catch (
        refreshError
      ) {
        console.error(
          "[ADMIN_TOPBAR:REFRESH]",
          refreshError
        );


        setActionError(
          refreshError?.message ||
          "The page could not be refreshed."
        );
      }
    };


  /* ==========================================================
     CUSTOMER REQUESTS
  ========================================================== */

  const handleNotifications = () => {
    setIsProfileOpen(
      false
    );


    navigate(
      "/notifications"
    );
  };


  /* ==========================================================
     PROFILE
  ========================================================== */

  const handleProfileSecurity = () => {
    setIsProfileOpen(
      false
    );


    navigate(
      "/profile-security"
    );
  };


  /* ==========================================================
     LOGOUT
  ========================================================== */

  const handleLogout =
    async () => {
      setActionError("");


      try {
        setIsProfileOpen(
          false
        );


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
          "[ADMIN_TOPBAR:LOGOUT]",
          logoutError
        );


        setActionError(
          "Logout could not be completed. Please try again."
        );
      }
    };


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="admin-topbar">

      {/* ======================================================
          LEFT
      ====================================================== */}

      <div className="admin-topbar__left">

        <button
          type="button"
          className="admin-topbar__menu-button"
          aria-label="Toggle navigation"
          onClick={
            onToggleSidebar
          }
        >
          <MenuIcon />
        </button>


        <div className="admin-topbar__page-context">

          <div className="admin-topbar__title-row">

            <h1 className="admin-topbar__title">
              {title}
            </h1>


            <div className="admin-topbar__hotel-context">

              <span className="admin-topbar__hotel-icon">
                <HotelIcon />
              </span>


              <span className="admin-topbar__hotel-details">

                <span className="admin-topbar__hotel-name">
                  {hotelName}
                </span>


                {hotelDisplayId && (
                  <span className="admin-topbar__hotel-id">
                    {hotelDisplayId}
                  </span>
                )}

              </span>


              <span
                className="admin-topbar__hotel-status"
                style={{
                  backgroundColor:
                    hotelStatusColor,
                }}
                aria-hidden="true"
              />

            </div>

          </div>

        </div>

      </div>


      {/* ======================================================
          RIGHT
      ====================================================== */}

      <div className="admin-topbar__right">

        {/* ====================================================
            REFRESH
        ==================================================== */}

        <button
          type="button"
          className={[
            "admin-topbar__action",
            "admin-topbar__action--secondary",

            refreshing
              ? "admin-topbar__action--loading"
              : "",
          ]
            .filter(Boolean)
            .join(" ")
          }
          aria-label="Refresh page"
          title="Refresh"
          disabled={
            refreshing ||
            typeof onRefresh !==
              "function"
          }
          onClick={() => {
            void handleRefresh();
          }}
        >
          <RefreshIcon />
        </button>


        {/* ====================================================
            CUSTOMER REQUESTS
        ==================================================== */}

        <button
          type="button"
          className="admin-topbar__action"
          aria-label={
            notificationBadge
              ? `${notificationBadge} pending customer requests`
              : "Customer requests"
          }
          title="Customer Requests"
          onClick={
            handleNotifications
          }
        >
          <BellIcon />


          {notificationBadge && (
            <span className="admin-topbar__notification-badge">
              {notificationBadge}
            </span>
          )}

        </button>


        {/* ====================================================
            PROFILE
        ==================================================== */}

        <div
          ref={
            profileWrapperRef
          }
          className="admin-topbar__profile-wrapper"
        >

          <button
            type="button"
            className={[
              "admin-topbar__profile-button",

              isProfileOpen
                ? "admin-topbar__profile-button--open"
                : "",
            ]
              .filter(Boolean)
              .join(" ")
            }
            aria-haspopup="menu"
            aria-expanded={
              isProfileOpen
            }
            onClick={() => {
              setActionError("");

              setIsProfileOpen(
                (current) =>
                  !current
              );
            }}
          >

            <span className="admin-topbar__profile-avatar">

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

            </span>


            <span className="admin-topbar__profile-details">

              <span className="admin-topbar__profile-name">
                {adminName}
              </span>


              <span className="admin-topbar__profile-role">
                Hotel Admin
              </span>

            </span>


            <span className="admin-topbar__profile-chevron">
              <ChevronIcon />
            </span>

          </button>


          {/* ==================================================
              DROPDOWN
          ================================================== */}

          {isProfileOpen && (
            <div
              className="admin-topbar__dropdown"
              role="menu"
            >

              <div className="admin-topbar__dropdown-header">

                <div className="admin-topbar__dropdown-avatar">

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


                <div className="admin-topbar__dropdown-profile">

                  <span className="admin-topbar__dropdown-name">
                    {adminName}
                  </span>


                  <span className="admin-topbar__dropdown-email">
                    {adminEmail ||
                      "Email unavailable"}
                  </span>

                </div>

              </div>


              <div className="admin-topbar__dropdown-hotel">

                <span className="admin-topbar__dropdown-hotel-label">
                  Assigned Hotel
                </span>


                <span className="admin-topbar__dropdown-hotel-name">
                  {hotelName}
                </span>


                {hotelDisplayId && (
                  <span className="admin-topbar__dropdown-hotel-id">
                    {hotelDisplayId}
                  </span>
                )}

              </div>


              <div className="admin-topbar__dropdown-menu">

                <button
                  type="button"
                  className="admin-topbar__dropdown-item"
                  role="menuitem"
                  onClick={
                    handleProfileSecurity
                  }
                >
                  <ProfileIcon />

                  Profile & Security
                </button>


                <div className="admin-topbar__dropdown-divider" />


                <button
                  type="button"
                  className="admin-topbar__dropdown-item admin-topbar__dropdown-item--danger"
                  role="menuitem"
                  onClick={() => {
                    void handleLogout();
                  }}
                >
                  <LogoutIcon />

                  Logout
                </button>

              </div>

            </div>
          )}


          {/* ==================================================
              ACTION ERROR
          ================================================== */}

          {actionError && (
            <div
              className="admin-topbar__error"
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


export default AdminTopbar;