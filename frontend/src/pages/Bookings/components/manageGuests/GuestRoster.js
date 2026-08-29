import React from "react";
import {
  normalizeGuestValue,
  formatGuestLabel,
  guestUsesExtraBed,
  formatGuestDateTime,
} from "./guestUtils";

function GuestRoster({
  guests,
  canManage,
  busy,
  processingGuestId,
  onCheckIn,
}) {
  if (!guests.length) {
    return (
      <div className="booking-special-request">
        No staying guests recorded yet.
      </div>
    );
  }

  return guests.map((guest, index) => {
    const status = normalizeGuestValue(guest.guest_status);
    const expected = status === "expected";
    const processing =
      processingGuestId === Number(guest.booking_guest_id);

    return (
      <div
        className="booking-detail-section"
        key={guest.booking_guest_id}
      >
        <div className="booking-detail-row">
          <span>Guest</span>
          <strong>{guest.full_name || `Guest ${index + 1}`}</strong>
        </div>

        <div className="booking-detail-row">
          <span>Type / Role</span>
          <strong>
            {formatGuestLabel(guest.guest_type)} ·{" "}
            {formatGuestLabel(guest.guest_role)}
          </strong>
        </div>

        {guest.phone && (
          <div className="booking-detail-row">
            <span>Mobile</span>

            <strong>
              {guest.phone}
            </strong>
          </div>
        )}

        <div className="booking-detail-row">
          <span>Status</span>
          <strong>{formatGuestLabel(status)}</strong>
        </div>

        {normalizeGuestValue(guest.guest_type) === "child" && (
          <div className="booking-detail-row">
            <span>Age</span>
            <strong>{guest.age ?? "—"}</strong>
          </div>
        )}

        <div className="booking-detail-row">
          <span>ID</span>
          <strong>
            {guest.id_proof_type && guest.id_proof_number
              ? `${guest.id_proof_type} · ${guest.id_proof_number}`
              : "Not recorded"}
          </strong>
        </div>

        <div className="booking-detail-row">
          <span>Extra Bed</span>
          <strong>{guestUsesExtraBed(guest) ? "Used" : "No"}</strong>
        </div>

        {status === "checked_in" && (
          <div className="booking-detail-row">
            <span>Checked In</span>
            <strong>{formatGuestDateTime(guest.actual_check_in)}</strong>
          </div>
        )}

        {expected && canManage && (
          <div className="booking-detail-row">
            <span>Arrival</span>
            <button
              type="button"
              className="booking-btn-primary"
              disabled={busy && !processing}
              onClick={() => onCheckIn(guest)}
            >
              {processing ? "Checking In..." : "Check In"}
            </button>
          </div>
        )}
      </div>
    );
  });
}

export default GuestRoster;