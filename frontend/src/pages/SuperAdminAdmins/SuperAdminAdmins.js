import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import { Link } from "react-router-dom";

import SuperAdminLayout from "../../layouts/SuperAdminLayout/SuperAdminLayout";
import SuperAdminSidebar from "../../components/navigation/SuperAdminSidebar/SuperAdminSidebar";
import SuperAdminTopbar from "../../components/navigation/SuperAdminTopbar/SuperAdminTopbar";
import superAdminAdminService from "../../services/superAdminAdminService";

import "./SuperAdminAdmins.css";
import SuperAdminAdminActionDialog from "./SuperAdminAdminActionDialog";

// SUPER ADMIN-SA3A — Portfolio Admin Management

const PAGE_SIZE = 10;

const normalize = value =>
  String(value ?? "").trim().toLowerCase();

const display = value => {
  const text = String(value ?? "").trim();
  return text || "—";
};

const getInitials = value => {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    words.slice(0, 2).map(word => word[0]).join("") || "A"
  ).toUpperCase();
};

function StatusBadge({ value }) {
  const status = normalize(value);
  const tone = status === "active"
    ? "active"
    : status === "inactive"
      ? "inactive"
      : "other";

  return (
    <span className={`sa-admins-status sa-admins-status--${tone}`}>
      {display(value)}
    </span>
  );
}

function SummaryCard({ label, value, variant, note }) {
  return (
    <article className={`sa-admins-stat sa-admins-stat--${variant}`}>
      <span className="sa-admins-stat__symbol" aria-hidden="true">
        {variant === "total" ? "▣"
          : variant === "active" ? "✓"
            : variant === "inactive" ? "×" : "⌂"}
      </span>

      <div className="sa-admins-stat__body">
        <span className="sa-admins-stat__label">{label}</span>
        <strong className="sa-admins-stat__value">{value}</strong>
        <span className="sa-admins-stat__note">{note}</span>
      </div>
    </article>
  );
}

function AdminDetails({ admin, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const onKeyDown = event => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (!admin) return null;

  const hotelUrl = admin.hotel_display_id
    ? `/superadmin/hotels/${encodeURIComponent(admin.hotel_display_id)}/team`
    : "/superadmin/hotels";

  return createPortal(
    <div
      className="sa-admins-modal-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="sa-admins-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sa-admins-modal-title"
      >
        <header className="sa-admins-modal__header">
          <div>
            <span className="sa-admins-eyebrow">
              HOTEL ADMIN ACCOUNT
            </span>
            <h2 id="sa-admins-modal-title">Admin Details</h2>
          </div>

          <button
            type="button"
            className="sa-admins-modal__close"
            onClick={onClose}
            aria-label="Close details"
          >
            ×
          </button>
        </header>

        <div className="sa-admins-modal__body">
          <div className="sa-admins-modal__identity">
            <span className="sa-admins-avatar">
              {getInitials(admin.name)}
            </span>

            <div>
              <strong>{display(admin.name)}</strong>
              <span>{display(admin.display_id)}</span>
            </div>

            <StatusBadge value={admin.status} />
          </div>

          <dl className="sa-admins-modal__details">
            {[
              ["Admin ID", admin.display_id],
              ["Full Name", admin.name],
              ["Email", admin.email],
              ["Role", "Hotel Admin"],
              ["Hotel", admin.hotel_name],
              ["Hotel ID", admin.hotel_display_id],
              ["Account Status", admin.status],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{display(value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="sa-admins-modal__footer">
          <button
            type="button"
            className="sa-admins-button sa-admins-button--light"
            onClick={onClose}
          >
            Close
          </button>

          <Link
            to={hotelUrl}
            className="sa-admins-button sa-admins-button--primary"
          >
            Open Hotel Team
          </Link>
        </footer>
      </section>
    </div>,
    document.body
  );
}

function SuperAdminAdmins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [hotelFilter, setHotelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [manageAction, setManageAction] = useState(null);

  const closeDetails = useCallback(() => {
    setSelectedAdmin(null);
  }, []);

  const loadAdmins = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);

    setError("");

    try {
      const result =
        await superAdminAdminService.getPortfolioAdmins();

      if (result?.success !== true) {
        throw new Error("Admin portfolio could not be loaded.");
      }

      setAdmins(result.admins);
    } catch (loadError) {
      setError(
        loadError?.response?.data?.message ||
        loadError?.message ||
        "Unable to load Hotel Admin accounts."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmins(true);
  }, [loadAdmins]);

  const summary = useMemo(() => ({
    total: admins.length,
    active: admins.filter(
      admin => normalize(admin.status) === "active"
    ).length,
    inactive: admins.filter(
      admin => normalize(admin.status) === "inactive"
    ).length,
    hotels: new Set(
      admins.map(admin => admin.hotel_display_id).filter(Boolean)
    ).size,
  }), [admins]);

  const hotels = useMemo(() => {
    const map = new Map();

    admins.forEach(admin => {
      if (admin.hotel_display_id) {
        map.set(
          admin.hotel_display_id,
          admin.hotel_name || admin.hotel_display_id
        );
      }
    });

    return [...map].sort((a, b) =>
      String(a[1]).localeCompare(String(b[1]))
    );
  }, [admins]);

  const filtered = useMemo(() => {
    const needle = normalize(search);

    return admins.filter(admin => {
      if (
        hotelFilter !== "all" &&
        admin.hotel_display_id !== hotelFilter
      ) return false;

      if (
        statusFilter !== "all" &&
        normalize(admin.status) !== statusFilter
      ) return false;

      if (!needle) return true;

      return [
        admin.name,
        admin.email,
        admin.display_id,
        admin.hotel_name,
        admin.hotel_display_id,
      ].some(value => normalize(value).includes(needle));
    });
  }, [admins, hotelFilter, statusFilter, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);

  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const updateFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const sidebar = (
    <SuperAdminSidebar adminCount={summary.total} />
  );

  const topbar = (
    <SuperAdminTopbar
      title="Hotel Admins"
      breadcrumbs={[
        { label: "Portfolio" },
        { label: "Admins" },
      ]}
      onRefresh={() => void loadAdmins(false)}
      isRefreshing={refreshing}
    />
  );

  return (
    <SuperAdminLayout sidebar={sidebar} topbar={topbar}>
      <div className="sa-admins-page">
        <div className="sa-admins-heading">
          <div>
            <span className="sa-admins-eyebrow">
              PORTFOLIO MANAGEMENT
            </span>
            <h1>Hotel Admin Management</h1>
            <p>
              Manage Hotel Admin accounts across hotels
              in your portfolio.
            </p>
          </div>

          <Link
            to="/superadmin/hotels"
            className="sa-admins-button sa-admins-button--primary"
          >
            + Add Hotel Admin
          </Link>
        </div>

        <div className="sa-admins-stats">
          <SummaryCard
            label="Total Admins"
            value={summary.total}
            variant="total"
            note="Across owned hotels"
          />
          <SummaryCard
            label="Active Admins"
            value={summary.active}
            variant="active"
            note="Active accounts"
          />
          <SummaryCard
            label="Inactive Admins"
            value={summary.inactive}
            variant="inactive"
            note="Inactive accounts"
          />
          <SummaryCard
            label="Hotels Represented"
            value={summary.hotels}
            variant="hotels"
            note="Hotels with Admin accounts"
          />
        </div>

        <section className="sa-admins-filters">
          <div className="sa-admins-section-heading">
            <strong>Admin Directory</strong>
            <span>
              Search by Admin, email, Admin ID or hotel.
            </span>
          </div>

          <div className="sa-admins-controls">
            <label>
              <span className="sa-admins-sr-only">Search Admins</span>
              <input
                type="search"
                placeholder="Search Admin or hotel..."
                value={search}
                onChange={event =>
                  updateFilter(setSearch, event.target.value)
                }
              />
            </label>

            <label>
              <span className="sa-admins-sr-only">Hotel filter</span>
              <select
                value={hotelFilter}
                onChange={event =>
                  updateFilter(setHotelFilter, event.target.value)
                }
              >
                <option value="all">All Hotels</option>
                {hotels.map(([id, name]) => (
                  <option value={id} key={id}>
                    {name} ({id})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="sa-admins-sr-only">Status filter</span>
              <select
                value={statusFilter}
                onChange={event =>
                  updateFilter(setStatusFilter, event.target.value)
                }
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <button
              type="button"
              className="sa-admins-button sa-admins-button--light"
              onClick={() => void loadAdmins(false)}
              disabled={refreshing || loading}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" className="sa-admins-error">
            <strong>Could not refresh Admin directory.</strong>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadAdmins(false)}
            >
              Retry
            </button>
          </div>
        )}

        <section className="sa-admins-register">
          <header className="sa-admins-register__header">
            <div>
              <h2>Hotel Admin Accounts</h2>
              <p>
                {filtered.length} of {admins.length} Admin accounts
              </p>
            </div>
            <span className="sa-admins-count">
              {filtered.length} Results
            </span>
          </header>

          {loading ? (
            <div className="sa-admins-empty" role="status">
              Loading Admin accounts...
            </div>
          ) : filtered.length === 0 ? (
            <div className="sa-admins-empty">
              <strong>
                {admins.length === 0
                  ? "No Hotel Admin accounts found"
                  : "No matching Admin accounts"}
              </strong>
              <p>
                {admins.length === 0
                  ? "Choose a hotel and open its Team page to add an Admin."
                  : "Try changing the search or filters."}
              </p>
              {admins.length === 0 && (
                <Link to="/superadmin/hotels">
                  Open Hotels
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="sa-admins-table-shell">
                <table className="sa-admins-table">
                  <thead>
                    <tr>
                      <th>Admin</th>
                      <th>Email</th>
                      <th>Assigned Hotel</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visible.map(admin => {
                      const teamUrl = admin.hotel_display_id
                        ? `/superadmin/hotels/${encodeURIComponent(
                            admin.hotel_display_id
                          )}/team`
                        : "/superadmin/hotels";

                      return (
                        <tr key={admin.id || admin.display_id}>
                          <td data-label="Admin">
                            <div className="sa-admins-person">
                              <span className="sa-admins-avatar">
                                {getInitials(admin.name)}
                              </span>
                              <span>
                                <strong>{display(admin.name)}</strong>
                                <small>
                                  {display(admin.display_id)}
                                </small>
                              </span>
                            </div>
                          </td>

                          <td data-label="Email">
                            <span className="sa-admins-email">
                              {display(admin.email)}
                            </span>
                          </td>

                          <td data-label="Hotel">
                            <div className="sa-admins-hotel">
                              <strong>{display(admin.hotel_name)}</strong>
                              <small>
                                {display(admin.hotel_display_id)}
                              </small>
                            </div>
                          </td>

                          <td data-label="Status">
                            <StatusBadge value={admin.status} />
                          </td>

                          <td data-label="Actions">
                            <div className="sa-admins-row-actions">
                              <button
                                type="button"
                                className="sa-admins-button sa-admins-button--light"
                                onClick={() => setManageAction({ mode: "edit", admin })}
                              >
                                Edit
                              </button>

                              {["active", "inactive"].includes(normalize(admin.status)) && (
                                <button
                                  type="button"
                                  className={
                                    normalize(admin.status) === "active"
                                      ? "sa-admins-button sa-admins-action-danger-light"
                                      : "sa-admins-button sa-admins-action-success-light"
                                  }
                                  onClick={() => setManageAction({
                                    mode: normalize(admin.status) === "active"
                                      ? "deactivate"
                                      : "reactivate",
                                    admin,
                                  })}
                                >
                                  {normalize(admin.status) === "active"
                                    ? "Deactivate"
                                    : "Reactivate"}
                                </button>
                              )}
                              <button
                                type="button"
                                className="sa-admins-button sa-admins-button--light"
                                onClick={() => setSelectedAdmin(admin)}
                              >
                                View
                              </button>
                              <Link
                                to={teamUrl}
                                className="sa-admins-button sa-admins-button--light"
                              >
                                Team
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <footer className="sa-admins-pagination">
                <span>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, filtered.length)}
                  {" "}of {filtered.length}
                </span>

                <div className="sa-admins-page-buttons">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    aria-label="Previous page"
                  >
                    ‹
                  </button>

                  <strong>{currentPage}</strong>

                  <button
                    type="button"
                    disabled={currentPage >= pages}
                    onClick={() => setPage(currentPage + 1)}
                    aria-label="Next page"
                  >
                    ›
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>

      {manageAction && (
        <SuperAdminAdminActionDialog
          key={`${manageAction.mode}:${manageAction.admin.display_id}`}
          action={manageAction}
          onClose={() => setManageAction(null)}
          onSaved={(original, updated) => {
            setAdmins(previous => previous.map(item =>
              item.display_id === original.display_id
                ? {
                    ...item,
                    name: updated.fullName,
                    status: updated.status,
                  }
                : item
            ));
            setManageAction(null);
            void loadAdmins(false);
          }}
        />
      )}
      {selectedAdmin && (
        <AdminDetails
          admin={selectedAdmin}
          onClose={closeDetails}
        />
      )}
    </SuperAdminLayout>
  );
}

export default SuperAdminAdmins;