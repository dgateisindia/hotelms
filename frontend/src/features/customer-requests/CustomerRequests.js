// ============================================================
//  Notifications.js — Admin panel for customer room requests
//  (submitted via the QR code form)
//
//  Room assignment on Approve now uses a live dropdown of rooms
//  actually available (status + date-overlap check) for that
//  request's own check-in/check-out dates, instead of a free-text
//  room number field.
// ============================================================

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import apiClient, { getApiErrorMessage } from "../../shared/api/apiClient";
import "./CustomerRequests.css";

const API_BASE_URL = "/customer-requests";
const ROOMS_API_URL = "/rooms/available";

const statusClass = (status) => {
  switch (status) {
    case "pending": return "customer-requests-badge customer-requests-badge--pending";
    case "approved": return "customer-requests-badge customer-requests-badge--approved";
    case "declined": return "customer-requests-badge customer-requests-badge--declined";
    default: return "customer-requests-badge";
  }
};

// The backend returns snake_case columns straight from MySQL.
// Map them once here, the same way Rooms.js maps its room rows.
const mapRequest = (row) => ({
  id: row.request_id,
  fullName: row.full_name,
  phone: row.phone,
  email: row.email,
  gender: row.gender,
  nationality: row.nationality,
  address: row.address,
  roomType: row.room_type,
  checkIn: row.check_in,
  checkOut: row.check_out,
  guests: row.guests,
  specialRequest: row.special_request,
  status: row.status,
  assignedRoomId: row.assigned_room_id,
  assignedRoomNumber: row.assigned_room_number,
  seen: !!row.seen,
});

const CustomerRequests = () => {
  const {
    syncPendingRequests,
  } =
    useOutletContext() || {};

  const [requests, setRequests] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);

  // Close the read-only details dialog with Escape.
  useEffect(() => {
    if (detailId === null) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setDetailId(null);
    };

    document.addEventListener("keydown", closeOnEscape);
    return () =>
      document.removeEventListener("keydown", closeOnEscape);
  }, [detailId]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // room-number SELECT value, keyed by request id
  const [roomInputs, setRoomInputs] = useState({});
  const [actingId, setActingId] = useState(null);

  // Available-room options per request id, e.g.
  // { [requestId]: [{ room_id, room_number, room_type, price_per_night }, ...] }
  const [roomOptions, setRoomOptions] = useState({});
  const [roomOptionsLoading, setRoomOptionsLoading] = useState({});

  const fetchRequests = async () => {
    try {
      const res =
        await apiClient.get(
          API_BASE_URL
        );

      const mappedRequests =
        (
          res.data.data ||
          []
        ).map(
          mapRequest
        );

      setRequests(
        mappedRequests
      );

      if (
        typeof syncPendingRequests ===
        "function"
      ) {
        syncPendingRequests(
          mappedRequests.filter(
            (request) =>
              request.status ===
              "pending"
          ).length
        );
      }

      setError("");
    } catch (err) {
      setError(
        "Failed to load requests."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Poll every 15s so new QR submissions show up without a manual refresh
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, []);

  // Load available rooms for every pending request that doesn't have
  // options cached yet (runs whenever the request list refreshes).
  useEffect(() => {
    requests.forEach((r) => {
      if (
        r.status === "pending" &&
        r.checkIn &&
        r.checkOut &&
        roomOptions[r.id] === undefined &&
        !roomOptionsLoading[r.id]
      ) {
        loadAvailableRooms(
          r.id,
          r.checkIn,
          r.checkOut,
          r.roomType
        );
      }
    });
  }, [requests]);

  const loadAvailableRooms = async (
    requestId,
    checkIn,
    checkOut,
    requestedRoomType
  ) => {
    setRoomOptionsLoading(
      (prev) => ({
        ...prev,
        [requestId]: true,
      })
    );

    try {
      const res =
        await apiClient.get(
          ROOMS_API_URL,
          {
            params: {
              checkIn,
              checkOut,
            },
          }
        );

      const availableRooms =
        Array.isArray(
          res.data?.data
        )
          ? res.data.data
          : [];

      const normalizedRequestedType =
        String(
          requestedRoomType ||
          ""
        )
          .trim()
          .toLowerCase();

      const matchingRooms =
        normalizedRequestedType
          ? availableRooms.filter(
              (room) =>
                String(
                  room.room_type ||
                  ""
                )
                  .trim()
                  .toLowerCase() ===
                normalizedRequestedType
            )
          : availableRooms;

      setRoomOptions(
        (prev) => ({
          ...prev,
          [requestId]:
            matchingRooms,
        })
      );
    } catch (err) {
      setRoomOptions(
        (prev) => ({
          ...prev,
          [requestId]: [],
        })
      );
    } finally {
      setRoomOptionsLoading(
        (prev) => ({
          ...prev,
          [requestId]: false,
        })
      );
    }
  };

  const markSeen = async (id) => {
    try {
      await apiClient.patch(`${API_BASE_URL}/${id}/seen`);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, seen: true } : r))
      );
    } catch {
      // silent — not critical
    }
  };

  const handleApprove = async (id) => {
    const request = requests.find((item) => item.id === id);
    const roomId = Number(roomInputs[id]);

    if (!request) {
      alert("Customer request could not be found.");
      return;
    }

    if (!Number.isInteger(roomId) || roomId < 1) {
      alert("Please select a room to assign before approving.");
      return;
    }

    const guestCount = Number(request.guests || 0);

    try {
      setActingId(id);

      await apiClient.post("/bookings", {
        source_request_id: id,
        stay_type: "overnight",
        guest_name: request.fullName,
        phone: request.phone,
        email: request.email || null,
        gender: request.gender || null,
        nationality: request.nationality || null,
        address: request.address || null,
        booking_status: "confirmed",
        special_request: request.specialRequest || null,
        rooms: [{
          room_id: roomId,
          stay_type: "overnight",
          check_in: request.checkIn,
          check_out: request.checkOut,
          total_guests: Number.isFinite(guestCount) && guestCount >= 0 ? guestCount : 0,
        }],
      });

      setRoomInputs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      await fetchRequests();
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to convert request into booking."));
    } finally {
      setActingId(null);
    }
  };

  const handleDecline = async (id) => {
    if (!window.confirm("Decline this request?")) return;
    try {
      setActingId(id);
      await apiClient.patch(
        `${API_BASE_URL}/${id}/decline`
      );

      await fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to decline request.");
    } finally {
      setActingId(null);
    }
  };

  // CUSTOMER-REQUESTS-C2 — presentation and client-side filtering.
  // The original booking creation and decline handlers remain unchanged.

  const counts = {
    total: requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    declined: requests.filter(r => r.status === "declined").length,
    unseen: requests.filter(r => !r.seen).length,
  };

  const term = searchText.trim().toLowerCase();

  const filteredRequests = requests.filter((r) => {
    const statusMatch =
      statusFilter === "all" || r.status === statusFilter;

    const text = [
      r.fullName, r.phone, r.email,
      r.roomType, r.assignedRoomNumber
    ].map(v => String(v || "")).join(" ").toLowerCase();

    return statusMatch && (!term || text.includes(term));
  });

  const pageCount = Math.max(
    1,
    Math.ceil(filteredRequests.length / 8)
  );

  const safePage = Math.min(page, pageCount);

  const pageRows = filteredRequests.slice(
    (safePage - 1) * 8,
    safePage * 8
  );

  const detailRequest =
    requests.find(r => r.id === detailId) || null;

  const displayDate = (value) => {
    if (!value) return "—";

    const iso = String(value).slice(0, 10);

    return /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`
      : String(value);
  };

  const showDetails = (request) => {
    setDetailId(request.id);

    if (!request.seen) {
      markSeen(request.id);
    }
  };

  if (loading) {
    return (
      <div className="customer-requests-page hms-page">
        <div className="customer-requests-state hms-panel" role="status">
          Loading customer requests…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-requests-page hms-page">
        <div className="customer-requests-state hms-panel" role="alert">
          <strong>Customer Requests Unavailable</strong>
          <p>{error}</p>
          <button type="button" className="cr-refresh-button"
            onClick={fetchRequests}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="customer-requests-page hms-page"
      data-hms-fast-ui="customer-requests"
    >
      <div className="customer-requests-page-header hms-page-header">
        <div className="hms-page-header__content">
          <div className="hms-page-header__eyebrow">
            GUEST REQUESTS
          </div>
          <h1 className="hms-page-header__title">
            Customer Requests
          </h1>
          <p className="hms-page-header__description">
            Review guest room enquiries and convert eligible
            requests into bookings.
          </p>
        </div>
      </div>

      {/* REQUEST SUMMARY */}

      <div className="cr-stats" aria-label="Request overview">
        {[
          ["Total Requests", counts.total, "all"],
          ["Pending", counts.pending, "pending"],
          ["Approved", counts.approved, "approved"],
          ["Declined", counts.declined, "declined"],
          ["Unseen", counts.unseen, "unseen"],
        ].map(([label, value, type]) => (
          <div key={type} className={`cr-stat cr-stat--${type}`}>
            <span className="cr-stat-icon" aria-hidden="true">
              {type === "all" ? "▣"
                : type === "pending" ? "◷"
                : type === "approved" ? "✓"
                : type === "declined" ? "×" : "•"}
            </span>

            <div className="cr-stat-body">
              <span className="cr-stat-label">{label}</span>
              <strong className="cr-stat-value">{value}</strong>
              <span className="cr-stat-caption">
                {type === "unseen"
                  ? "Not yet reviewed"
                  : type === "all"
                    ? "Guest QR submissions"
                    : `${label} requests`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* SEARCH AND FILTERS */}

      <div className="cr-filter-panel">
        <div className="cr-filter-copy">
          <strong>Request Register</strong>
          <span>Search, review and manage guest room requests</span>
        </div>

        <div className="cr-filter-controls">
          <label className="cr-search">
            <span className="cr-sr-only">
              Search customer requests
            </span>
            <input
              type="search"
              placeholder="Search guest, phone, email or room…"
              value={searchText}
              onChange={e => {
                setSearchText(e.target.value);
                setPage(1);
              }}
            />
          </label>

          <label className="cr-status-filter">
            <span className="cr-sr-only">Filter by status</span>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </select>
          </label>

          <button
            type="button"
            className="cr-refresh-button"
            onClick={fetchRequests}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* REQUEST REGISTER */}

      <section className="customer-requests-card hms-panel">
        <div className="customer-requests-card-header">
          <div>
            <strong className="customer-requests-card-title">
              Customer Room Requests
            </strong>
            <span className="cr-card-subtitle">
              Showing {filteredRequests.length} of {requests.length} requests
            </span>
          </div>
          <span className="cr-results-count">
            {filteredRequests.length} results
          </span>
        </div>

        {requests.length === 0 || filteredRequests.length === 0 ? (
          <div className="customer-requests-empty hms-empty">
            <strong>
              {requests.length === 0
                ? "No requests yet"
                : "No matching requests"}
            </strong>
            <p>
              {requests.length === 0
                ? "New QR room requests will appear here automatically."
                : "Try a different search or status filter."}
            </p>
          </div>
        ) : (
          <>
            <div className="customer-requests-table-shell">
              <table className="customer-requests-table hms-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Room Type</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Guests</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pageRows.map(r => {
                    const options = roomOptions[r.id] || [];
                    const optionsLoading = !!roomOptionsLoading[r.id];
                    const hasDates = Boolean(r.checkIn && r.checkOut);

                    return (
                      <tr
                        key={r.id}
                        className={
                          `customer-requests-row ${
                            !r.seen
                              ? "customer-requests-row--unseen"
                              : ""
                          }`
                        }
                        onMouseEnter={() => {
                          if (!r.seen) markSeen(r.id);
                        }}
                      >
                        <td>
                          <div className="cr-guest-cell">
                            <span className="cr-avatar" aria-hidden="true">
                              {String(r.fullName || "?")
                                .trim().charAt(0).toUpperCase()}
                            </span>
                            <span className="cr-guest-name">
                              {r.fullName || "—"}
                              {!r.seen && (
                                <small className="cr-new-label">New</small>
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span>{r.phone || "—"}</span>
                          {r.email && (
                            <div className="customer-requests-email">
                              {r.email}
                            </div>
                          )}
                        </td>

                        <td>{r.roomType || "—"}</td>
                        <td>{displayDate(r.checkIn)}</td>
                        <td>{displayDate(r.checkOut)}</td>
                        <td>{r.guests ?? "—"}</td>

                        <td className="customer-requests-notes">
                          {r.specialRequest || "—"}
                        </td>

                        <td>
                          <span className={statusClass(r.status)}>
                            {r.status}
                          </span>
                        </td>

                        <td className="cr-action-cell">
                          <div className="cr-action-stack">
                            <button
                              type="button"
                              className="cr-details-button"
                              onClick={() => showDetails(r)}
                            >
                              View Details
                            </button>

                            {r.status === "pending" ? (
                              <div className="customer-requests-actions">
                                <select
                                  className="customer-requests-room-select hms-control"
                                  aria-label={`Choose room for ${r.fullName || "guest"}`}
                                  value={roomInputs[r.id] || ""}
                                  onChange={e =>
                                    setRoomInputs(prev => ({
                                      ...prev,
                                      [r.id]: e.target.value
                                    }))
                                  }
                                  disabled={
                                    !hasDates ||
                                    optionsLoading ||
                                    actingId === r.id
                                  }
                                >
                                  <option value="">
                                    {!hasDates
                                      ? "No dates on request"
                                      : optionsLoading
                                        ? "Loading rooms…"
                                        : options.length === 0
                                          ? "No rooms available"
                                          : "Select a room"}
                                  </option>

                                  {options.map(room => (
                                    <option
                                      key={room.room_id}
                                      value={room.room_id}
                                    >
                                      {room.room_number} — {room.room_type}
                                      {" "}(₹{room.price_per_night}/night)
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  className="customer-requests-btn customer-requests-btn--primary hms-button hms-button--primary"
                                  disabled={
                                    actingId === r.id ||
                                    !roomInputs[r.id]
                                  }
                                  onClick={() => handleApprove(r.id)}
                                >
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  className="customer-requests-btn customer-requests-btn--danger hms-button"
                                  disabled={actingId === r.id}
                                  onClick={() => handleDecline(r.id)}
                                >
                                  Decline
                                </button>
                              </div>
                            ) : r.status === "approved" ? (
                              <span className="customer-requests-assigned">
                                Room {r.assignedRoomNumber ||
                                  r.assignedRoomId || "—"}
                              </span>
                            ) : (
                              <span className="customer-requests-declined">
                                Declined
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="cr-pagination">
              <span>
                Showing {(safePage - 1) * 8 + 1}–
                {Math.min(safePage * 8, filteredRequests.length)}
                {" "}of {filteredRequests.length} requests
              </span>

              <div className="cr-page-buttons">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  aria-label="Previous page"
                >
                  ‹
                </button>

                <span aria-current="page">
                  {safePage} / {pageCount}
                </span>

                <button
                  type="button"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage(safePage + 1)}
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* READ-ONLY CUSTOMER DETAILS POPUP */}

      {detailRequest && createPortal(
        <div
          className="cr-modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              setDetailId(null);
            }
          }}
        >
          <section
            className="cr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cr-modal-title"
          >
            <header className="cr-modal-header">
              <div>
                <span>GUEST ROOM ENQUIRY</span>
                <h2 id="cr-modal-title">Request Details</h2>
              </div>
              <button
                type="button"
                aria-label="Close request details"
                onClick={() => setDetailId(null)}
              >
                ×
              </button>
            </header>

            <div className="cr-modal-body">
              <div className="cr-modal-guest">
                <strong>{detailRequest.fullName || "Guest"}</strong>
                <span className={statusClass(detailRequest.status)}>
                  {detailRequest.status}
                </span>
              </div>

              <dl>
                {[
                  ["Phone", detailRequest.phone],
                  ["Email", detailRequest.email],
                  ["Gender", detailRequest.gender],
                  ["Nationality", detailRequest.nationality],
                  ["Address", detailRequest.address],
                  ["Requested Room", detailRequest.roomType],
                  ["Check In", displayDate(detailRequest.checkIn)],
                  ["Check Out", displayDate(detailRequest.checkOut)],
                  ["Guests", detailRequest.guests],
                  ["Special Request", detailRequest.specialRequest],
                  ["Assigned Room",
                    detailRequest.assignedRoomNumber ||
                    detailRequest.assignedRoomId]
                ].map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <footer className="cr-modal-footer">
              <button
                type="button"
                onClick={() => setDetailId(null)}
              >
                Close
              </button>
            </footer>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomerRequests;