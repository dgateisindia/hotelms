import React, {
  cloneElement,
  isValidElement,
  useEffect,
  useState,
} from "react";

import { useLocation } from "react-router-dom";

import "./SuperAdminLayout.css";

const MOBILE_BREAKPOINT = 1024;

function SuperAdminLayout({
  sidebar,
  topbar,
  children,
  defaultCollapsed = false,
}) {
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] =
    useState(defaultCollapsed);

  const [isMobileOpen, setIsMobileOpen] =
    useState(false);

  const isMobileViewport = () =>
    window.innerWidth <= MOBILE_BREAKPOINT;

  const closeMobileSidebar = () => {
    setIsMobileOpen(false);
  };

  const openMobileSidebar = () => {
    setIsMobileOpen(true);
  };

  const toggleSidebar = () => {
    if (isMobileViewport()) {
      setIsMobileOpen(
        (currentValue) => !currentValue
      );

      return;
    }

    setIsCollapsed(
      (currentValue) => !currentValue
    );
  };

  /*
   * Close the mobile sidebar whenever the route changes.
   * This prevents the drawer from covering the newly opened page.
   */
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  /*
   * Close the mobile drawer through the Escape key.
   */
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (
        event.key === "Escape" &&
        isMobileOpen
      ) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener(
      "keydown",
      handleEscapeKey
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscapeKey
      );
    };
  }, [isMobileOpen]);

  /*
   * Prevent background scrolling while the mobile
   * navigation drawer is open.
   */
  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    if (isMobileOpen) {
      document.body.style.overflow =
        "hidden";
    }

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isMobileOpen]);

  /*
   * Reset mobile drawer state when the browser
   * returns to the desktop layout.
   */
  useEffect(() => {
    const handleResize = () => {
      if (!isMobileViewport()) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, []);

  const layoutClassName = [
    "super-admin-layout",
    isCollapsed
      ? "super-admin-layout--collapsed"
      : "",
    isMobileOpen
      ? "super-admin-layout--mobile-open"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  /*
   * Sidebar receives layout controls automatically.
   * The actual sidebar component will be created next.
   */
  const renderedSidebar =
    isValidElement(sidebar)
      ? cloneElement(sidebar, {
          isCollapsed,
          isMobileOpen,
          onToggleCollapse:
            toggleSidebar,
          onCloseMobile:
            closeMobileSidebar,
        })
      : sidebar;

  /*
   * Topbar receives the sidebar toggle action.
   * On mobile it opens the drawer; on desktop it
   * collapses or expands the sidebar.
   */
  const renderedTopbar =
    isValidElement(topbar)
      ? cloneElement(topbar, {
          isSidebarCollapsed:
            isCollapsed,
          isMobileSidebarOpen:
            isMobileOpen,
          onToggleSidebar:
            toggleSidebar,
          onOpenMobileSidebar:
            openMobileSidebar,
        })
      : topbar;

  return (
    <div className={layoutClassName}>
      <a
        href="#super-admin-main-content"
        className="super-admin-layout__skip-link"
      >
        Skip to main content
      </a>

      <aside
        className="super-admin-layout__sidebar"
        aria-label="Super Admin navigation"
      >
        {renderedSidebar}
      </aside>

      <button
        type="button"
        className="super-admin-layout__overlay"
        onClick={closeMobileSidebar}
        aria-label="Close navigation menu"
        aria-hidden={!isMobileOpen}
        tabIndex={
          isMobileOpen ? 0 : -1
        }
      />

      <div className="super-admin-layout__workspace">
        <header
          className="super-admin-layout__topbar"
          aria-label="Dashboard header"
        >
          {renderedTopbar}
        </header>

        <main
          id="super-admin-main-content"
          className="super-admin-layout__main"
          tabIndex="-1"
        >
          <div className="super-admin-layout__content">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default SuperAdminLayout;