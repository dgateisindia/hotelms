// ============================================================
//  Notifications.js — Admin panel for customer room requests
//  (submitted via the QR code form)
// ============================================================

import React, { useEffect, useState } from "react";
import axios from "axios";

const statusClass = (status) => {
  switch (status) {
    case "pending":  return "badge badge-pending";
    case "approved": return "badge badge-confirmed";
    case "declined": return "badge badge-cancelled";
    default:         return "badge";
  }
};

const Notifications = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // room-number input state, keyed by request id
  const [roomInputs, setRoomInputs] = useState({});
  const [actingId, setActingId] = useState(null);

  const fetchRequests = async () => {
    try {
      const res = await axios.get("/api/customer-request");
      setRequests(res.data);
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

  const markSeen = async (id) => {
    try {
      await axios.patch(`/api/customer-request/${id}/seen`);
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? { ...r, seen: true } : r))
      );
    } catch {
      // silent — not critical
    }
  };

  const handleApprove = async (id) => {
    const assignedRoom = roomInputs[id];
    if (!assignedRoom) {
      alert("Please enter a room number to assign before approving.");
      return;
    }
    try {
      setActingId(id);
      const res = await axios.patch(`/api/customer-request/${id}/approve`, {
        assignedRoom,
      });
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? res.data.request : r))
      );
    } catch (err) {
      alert("Failed to approve request.");
    } finally {
      setActingId(null);
    }
  };

  const handleDecline = async (id) => {
    if (!window.confirm("Decline this request?")) return;
    try {
      setActingId(id);
      const res = await axios.patch(`/api/customer-request/${id}/decline`);
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? res.data.request : r))
      );
    } catch (err) {
      alert("Failed to decline request.");
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
            {requests.map((r) => (
              <tr
                key={r._id}
                onMouseEnter={() => !r.seen && markSeen(r._id)}
                style={!r.seen ? { fontWeight: 700 } : undefined}
              >
                <td>{r.fullName}</td>
                <td>
                  {r.phone}
                  {r.email ? <div style={{ fontSize: 12, color: "#9ca3af" }}>{r.email}</div> : null}
                </td>
                <td>{r.roomType}</td>
                <td>{r.checkIn}</td>
                <td>{r.checkOut}</td>
                <td>{r.guests}</td>
                <td style={{ maxWidth: 180 }}>{r.specialRequest || "—"}</td>
                <td><span className={statusClass(r.status)}>{r.status}</span></td>
                <td>
                  {r.status === "pending" ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Room #"
                        value={roomInputs[r._id] || ""}
                        onChange={(e) =>
                          setRoomInputs((prev) => ({ ...prev, [r._id]: e.target.value }))
                        }
                        style={{ width: 70, padding: "4px 6px", fontSize: 12 }}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        disabled={actingId === r._id}
                        onClick={() => handleApprove(r._id)}
                      >
                        Approve
                      </button>
                      <button
                        style={{
                          fontSize: 12, padding: "4px 10px",
                          background: "#fee2e2", color: "#dc2626",
                          border: "none", borderRadius: 6, cursor: "pointer",
                        }}
                        disabled={actingId === r._id}
                        onClick={() => handleDecline(r._id)}
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Notifications;