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

import PageBreadcrumbs from "../../shared/components/navigation/PageBreadcrumbs/PageBreadcrumbs";

import "./AdminLayout.css";


const MOBILE_BREAKPOINT = 1024;


/* ============================================================
   ADMIN LAYOUT
============================================================ */

function AdminLayout({
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
    "admin-layout",

    isCollapsed
      ? "admin-layout--collapsed"
      : "",

    isMobileOpen
      ? "admin-layout--mobile-open"
      : "",
  ]
    .filter(Boolean)
    .join(" ");


  /* ==========================================================
     BREADCRUMBS

     Preferred:
     <AdminLayout breadcrumbs={[...]} />

     Compatibility:
     AdminTopbar may temporarily receive breadcrumbs during
     migration. If so, move them below the Topbar here.
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

     Breadcrumbs are rendered globally below the Topbar.
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
        href="#admin-main-content"
        className="admin-layout__skip-link"
      >
        Skip to main content
      </a>


      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside
        className="admin-layout__sidebar"
        aria-label="Hotel Admin navigation"
      >
        {renderedSidebar}
      </aside>


      {/* ======================================================
          MOBILE OVERLAY
      ====================================================== */}

      <button
        type="button"
        className="admin-layout__overlay"
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

      <div className="admin-layout__workspace">

        {/* ====================================================
            TOPBAR
        ==================================================== */}

        <header
          className="admin-layout__topbar"
          aria-label="Hotel Admin header"
        >
          {renderedTopbar}
        </header>


        {/* ====================================================
            MAIN CONTENT
        ==================================================== */}

        <main
          id="admin-main-content"
          className="admin-layout__main"
          tabIndex="-1"
        >
          <div className="admin-layout__content">

            {/* ================================================
                GLOBAL PAGE PATH
            ================================================ */}

            {resolvedBreadcrumbs.length >
              0 && (
              <div className="admin-layout__breadcrumbs">

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


export default AdminLayout;