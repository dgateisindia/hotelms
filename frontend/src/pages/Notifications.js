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
import axios from "axios";

const API_BASE_URL = "/api/customer-requests";
const ROOMS_API_URL = "http://localhost:5000/api/rooms/available";

const statusClass = (status) => {
  switch (status) {
    case "pending":  return "badge badge-pending";
    case "approved": return "badge badge-confirmed";
    case "declined": return "badge badge-cancelled";
    default:         return "badge";
  }
};

// The backend returns snake_case columns straight from MySQL.
// Map them once here, the same way Rooms.js maps its room rows.
const mapRequest = (row) => ({
  id: row.request_id,
  fullName: row.full_name,
  phone: row.phone,
  email: row.email,
  roomType: row.room_type,
  checkIn: row.check_in,
  checkOut: row.check_out,
  guests: row.guests,
  specialRequest: row.special_request,
  status: row.status,
  assignedRoom: row.assigned_room,
  seen: !!row.seen,
});

const Notifications = () => {
  const [requests, setRequests] = useState([]);
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
      const res = await axios.get(API_BASE_URL);
      setRequests((res.data.data || []).map(mapRequest));
      setError("");
    } catch (err) {
      setError("Failed to load requests.");
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
        loadAvailableRooms(r.id, r.checkIn, r.checkOut);
      }
    });
  }, [requests]);

  const loadAvailableRooms = async (requestId, checkIn, checkOut) => {
    setRoomOptionsLoading((prev) => ({ ...prev, [requestId]: true }));
    try {
      const res = await axios.get(ROOMS_API_URL, {
        params: { checkIn, checkOut },
      });
      setRoomOptions((prev) => ({ ...prev, [requestId]: res.data.data || [] }));
    } catch (err) {
      setRoomOptions((prev) => ({ ...prev, [requestId]: [] }));
    } finally {
      setRoomOptionsLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const markSeen = async (id) => {
    try {
      await axios.patch(`${API_BASE_URL}/${id}/seen`);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, seen: true } : r))
      );
    } catch {
      // silent — not critical
    }
  };

  const handleApprove = async (id) => {
    const assignedRoom = roomInputs[id];
    if (!assignedRoom) {
      alert("Please select a room to assign before approving.");
      return;
    }
    try {
      setActingId(id);
      const res = await axios.patch(`${API_BASE_URL}/${id}/approve`, {
        assignedRoom,
      });
      const updated = res.data.data ? mapRequest(res.data.data) : null;
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? (updated || { ...r, status: "approved", assignedRoom }) : r))
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve request.");
    } finally {
      setActingId(null);
    }
  };

  const handleDecline = async (id) => {
    if (!window.confirm("Decline this request?")) return;
    try {
      setActingId(id);
      const res = await axios.patch(`${API_BASE_URL}/${id}/decline`);
      const updated = res.data.data ? mapRequest(res.data.data) : null;
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? (updated || { ...r, status: "declined" }) : r))
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to decline request.");
    } finally {
      setActingId(null);
    }
  };

  if (loading) return <div className="table-card">Loading requests…</div>;
  if (error) return <div className="table-card">{error}</div>;

  return (
    <div className="table-card">
      <div className="table-card-header">
        <span className="table-card-title">Customer Room Requests</span>
      </div>

      {requests.length === 0 ? (
        <p style={{ padding: "16px" }}>No requests yet.</p>
      ) : (
        <table className="bookings-table">
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const options = roomOptions[r.id] || [];
              const optionsLoading = !!roomOptionsLoading[r.id];
              const hasDates = Boolean(r.checkIn && r.checkOut);

              return (
              <tr
                key={r.id}
                onMouseEnter={() => !r.seen && markSeen(r.id)}
                style={!r.seen ? { fontWeight: 700 } : undefined}
              >
                <td>{r.fullName}</td>
                <td>
                  {r.phone}
                  {r.email ? <div style={{ fontSize: 12, color: "#9ca3af" }}>{r.email}</div> : null}
                </td>
                <td>{r.roomType || "—"}</td>
                <td>{r.checkIn}</td>
                <td>{r.checkOut}</td>
                <td>{r.guests}</td>
                <td style={{ maxWidth: 180 }}>{r.specialRequest || "—"}</td>
                <td><span className={statusClass(r.status)}>{r.status}</span></td>
                <td>
                  {r.status === "pending" ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        value={roomInputs[r.id] || ""}
                        onChange={(e) =>
                          setRoomInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        disabled={!hasDates || optionsLoading}
                        style={{ width: 150, padding: "4px 6px", fontSize: 12 }}
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
                        {options.map((room) => (
                          <option key={room.room_id} value={room.room_number}>
                            {room.room_number} — {room.room_type} (₹{room.price_per_night}/night)
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        disabled={actingId === r.id || !roomInputs[r.id]}
                        onClick={() => handleApprove(r.id)}
                      >
                        Approve
                      </button>
                      <button
                        style={{
                          fontSize: 12, padding: "4px 10px",
                          background: "#fee2e2", color: "#dc2626",
                          border: "none", borderRadius: 6, cursor: "pointer",
                        }}
                        disabled={actingId === r.id}
                        onClick={() => handleDecline(r.id)}
                      >
                        Decline
                      </button>
                    </div>
                  ) : r.status === "approved" ? (
                    <span style={{ fontSize: 12, color: "#16a34a" }}>Room {r.assignedRoom}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>Declined</span>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Notifications;