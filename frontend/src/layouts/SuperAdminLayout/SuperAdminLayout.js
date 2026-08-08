import React, {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
} from "react-router-dom";

import PageBreadcrumbs from "../../components/navigation/PageBreadcrumbs/PageBreadcrumbs";

import "./SuperAdminLayout.css";


const MOBILE_BREAKPOINT = 1024;


/* ============================================================
   SUPER ADMIN LAYOUT
============================================================ */

function SuperAdminLayout({
  sidebar,
  topbar,
  breadcrumbs,
  children,
  defaultCollapsed = false,
}) {
  const location =
    useLocation();


  const [
    isCollapsed,
    setIsCollapsed,
  ] = useState(
    defaultCollapsed
  );


  const [
    isMobileOpen,
    setIsMobileOpen,
  ] = useState(false);


  /* ==========================================================
     VIEWPORT
  ========================================================== */

  const isMobileViewport = () =>
    window.innerWidth <=
    MOBILE_BREAKPOINT;


  /* ==========================================================
     MOBILE SIDEBAR
  ========================================================== */

  const closeMobileSidebar = () => {
    setIsMobileOpen(false);
  };


  const openMobileSidebar = () => {
    setIsMobileOpen(true);
  };


  const toggleSidebar = () => {
    if (
      isMobileViewport()
    ) {
      setIsMobileOpen(
        (currentValue) =>
          !currentValue
      );

      return;
    }


    setIsCollapsed(
      (currentValue) =>
        !currentValue
    );
  };


  /* ==========================================================
     CLOSE MOBILE SIDEBAR AFTER ROUTE CHANGE
  ========================================================== */

  useEffect(() => {
    setIsMobileOpen(false);
  }, [
    location.pathname,
  ]);


  /* ==========================================================
     ESCAPE KEY
  ========================================================== */

  useEffect(() => {
    const handleEscapeKey = (
      event
    ) => {
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
  }, [
    isMobileOpen,
  ]);


  /* ==========================================================
     BODY SCROLL LOCK
  ========================================================== */

  useEffect(() => {
    const previousOverflow =
      document.body.style
        .overflow;


    if (isMobileOpen) {
      document.body.style
        .overflow =
        "hidden";
    }


    return () => {
      document.body.style
        .overflow =
        previousOverflow;
    };
  }, [
    isMobileOpen,
  ]);


  /* ==========================================================
     DESKTOP RESIZE RESET
  ========================================================== */

  useEffect(() => {
    const handleResize = () => {
      if (
        !isMobileViewport()
      ) {
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


  /* ==========================================================
     LAYOUT CLASS
  ========================================================== */

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


  /* ==========================================================
     BREADCRUMBS

     Preferred:
     <SuperAdminLayout breadcrumbs={[...]} />

     Compatibility:
     Existing pages currently send breadcrumbs into
     SuperAdminTopbar. During migration we automatically read
     those breadcrumbs here and move them below the topbar.
  ========================================================== */

  const resolvedBreadcrumbs =
    useMemo(() => {
      if (
        Array.isArray(
          breadcrumbs
        )
      ) {
        return breadcrumbs;
      }


      if (
        isValidElement(
          topbar
        ) &&
        Array.isArray(
          topbar.props
            ?.breadcrumbs
        )
      ) {
        return topbar.props
          .breadcrumbs;
      }


      return [];
    }, [
      breadcrumbs,
      topbar,
    ]);


  /* ==========================================================
     SIDEBAR
  ========================================================== */

  const renderedSidebar =
    isValidElement(sidebar)
      ? cloneElement(
          sidebar,
          {
            isCollapsed,

            isMobileOpen,

            onToggleCollapse:
              toggleSidebar,

            onCloseMobile:
              closeMobileSidebar,
          }
        )
      : sidebar;


  /* ==========================================================
     TOPBAR

     Breadcrumbs are intentionally removed from the Topbar.

     They are rendered below the Topbar through PageBreadcrumbs.
  ========================================================== */

  const renderedTopbar =
    isValidElement(topbar)
      ? cloneElement(
          topbar,
          {
            isSidebarCollapsed:
              isCollapsed,

            isMobileSidebarOpen:
              isMobileOpen,

            onToggleSidebar:
              toggleSidebar,

            onOpenMobileSidebar:
              openMobileSidebar,

            breadcrumbs: [],
          }
        )
      : topbar;


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div
      className={
        layoutClassName
      }
    >
      {/* ======================================================
          ACCESSIBILITY
      ====================================================== */}

      <a
        href="#super-admin-main-content"
        className="super-admin-layout__skip-link"
      >
        Skip to main content
      </a>


      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside
        className="super-admin-layout__sidebar"
        aria-label="Super Admin navigation"
      >
        {renderedSidebar}
      </aside>


      {/* ======================================================
          MOBILE OVERLAY
      ====================================================== */}

      <button
        type="button"
        className="super-admin-layout__overlay"
        onClick={
          closeMobileSidebar
        }
        aria-label="Close navigation menu"
        aria-hidden={
          !isMobileOpen
        }
        tabIndex={
          isMobileOpen
            ? 0
            : -1
        }
      />


      {/* ======================================================
          RIGHT WORKSPACE
      ====================================================== */}

      <div className="super-admin-layout__workspace">

        {/* ====================================================
            TOPBAR
        ==================================================== */}

        <header
          className="super-admin-layout__topbar"
          aria-label="Dashboard header"
        >
          {renderedTopbar}
        </header>


        {/* ====================================================
            MAIN CONTENT
        ==================================================== */}

        <main
          id="super-admin-main-content"
          className="super-admin-layout__main"
          tabIndex="-1"
        >
          <div className="super-admin-layout__content">

            {/* ================================================
                GLOBAL PAGE PATH
            ================================================ */}

            {resolvedBreadcrumbs.length >
              0 && (
              <div className="super-admin-layout__breadcrumbs">
                <PageBreadcrumbs
                  items={
                    resolvedBreadcrumbs
                  }
                />
              </div>
            )}


            {/* ================================================
                PAGE CONTENT
            ================================================ */}

            {children}

          </div>
        </main>

      </div>
    </div>
  );
}


export default SuperAdminLayout;