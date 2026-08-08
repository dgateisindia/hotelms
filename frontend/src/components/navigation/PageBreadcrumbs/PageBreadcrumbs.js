import React from "react";

import {
  Link,
} from "react-router-dom";

import "./PageBreadcrumbs.css";


/* ============================================================
   PAGE BREADCRUMBS

   Reusable navigation path for Super Admin pages.

   Example:
   [
     { label: "Portfolio", to: "/superadmin-dashboard" },
     { label: "Hotels", to: "/superadmin/hotels" },
     { label: "Royal Palace Hotel", to: "/.../overview" },
     { label: "Overview" }
   ]
============================================================ */

function PageBreadcrumbs({
  items = [],
}) {
  const breadcrumbs =
    Array.isArray(items)
      ? items.filter(
          (item) =>
            item &&
            String(
              item.label || ""
            ).trim()
        )
      : [];


  if (
    breadcrumbs.length === 0
  ) {
    return null;
  }


  return (
    <nav
      className="page-breadcrumbs"
      aria-label="Breadcrumb"
    >
      {breadcrumbs.map(
        (
          item,
          index
        ) => {
          const label =
            String(
              item.label
            ).trim();

          const isLast =
            index ===
            breadcrumbs.length - 1;

          const key =
            `${label}-${index}`;


          return (
            <React.Fragment
              key={key}
            >
              <span className="page-breadcrumbs__item">

                {item.to &&
                !isLast ? (
                  <Link
                    className="page-breadcrumbs__link"
                    to={item.to}
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    className={
                      isLast
                        ? "page-breadcrumbs__current"
                        : "page-breadcrumbs__link"
                    }
                    {...(
                      isLast
                        ? {
                            "aria-current":
                              "page",
                          }
                        : {}
                    )}
                  >
                    {label}
                  </span>
                )}

              </span>


              {!isLast && (
                <span
                  className="page-breadcrumbs__separator"
                  aria-hidden="true"
                >
                  /
                </span>
              )}
            </React.Fragment>
          );
        }
      )}
    </nav>
  );
}


export default PageBreadcrumbs;