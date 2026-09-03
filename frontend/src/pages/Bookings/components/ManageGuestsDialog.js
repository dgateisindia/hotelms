import React, { useEffect, useState } from "react";
import apiClient from "../../../services/apiClient";
import AppAlert from "../../../components/common/AppAlert";
import GuestRoster from "./manageGuests/GuestRoster";
import ArrivingGuestForm from "./manageGuests/ArrivingGuestForm";
import {
  normalizeGuestValue,
  formatGuestLabel,
  guestUsesExtraBed,
} from "./manageGuests/guestUtils";

const EMPTY_GUEST = {
  guestRole: "accompanying",
  guestType: "adult",
  fullName: "",
  phone: "",
  age: "",
  idProofType: "",
  idProofNumber: "",
  extraBedUsed: false,
};

function findPrimaryAllocation(group) {
  const bookings = Array.isArray(group?.bookings) ? group.bookings : [];

  for (const booking of bookings) {
    const guests = Array.isArray(booking?.occupancy?.guests)
      ? booking.occupancy.guests
      : [];

    const guest = guests.find(
      (item) =>
        normalizeGuestValue(item.guest_role) === "primary" &&
        normalizeGuestValue(item.guest_status) !== "cancelled"
    );

    if (guest) return { guest, booking };
  }

  return null;
}

function ManageGuestsDialog({ booking, onClose, onChanged }) {
  const bookingId = Number(booking?.booking_id || 0);

  const [details, setDetails] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingGuestId, setProcessingGuestId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_GUEST);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");

  const busy = loading || processingGuestId !== null || submitting;

  async function loadData() {
    if (!bookingId) return;

    setLoading(true);
    setError("");

    try {
      const bookingResponse = await apiClient.get(`/bookings/${bookingId}`);
      const bookingDetails = bookingResponse.data;

      setDetails(bookingDetails);

      const groupId = Number(bookingDetails?.reservation_group_id || 0);

      if (!groupId) {
        setGroup(null);
        return;
      }

      const groupResponse = await apiClient.get(
        `/bookings/groups/${groupId}`
      );

      setGroup(groupResponse.data?.data || null);
    } catch (loadError) {
      setError(
        loadError?.message ||
          "Guest occupancy details could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!bookingId) return;

    setDetails(null);
    setGroup(null);
    setError("");
    setSuccess("");
    setFormError("");
    setShowForm(false);
    setForm(EMPTY_GUEST);

    void loadData();
  }, [bookingId]);

  if (!booking) return null;

  const policy =
    details?.booking_policy_snapshot?.guest_requirements || {};

  const guests = Array.isArray(details?.occupancy?.guests)
    ? details.occupancy.guests
    : [];

  const activeGuests = guests.filter((guest) =>
    ["expected", "checked_in"].includes(
      normalizeGuestValue(guest.guest_status)
    )
  );

  const capacity = Number(details?.capacity || 0);
  const maxExtraBeds = Number(details?.max_extra_beds || 0);

  const extraBedsUsed = activeGuests.filter(guestUsesExtraBed).length;
  const extraBedsLeft = Math.max(0, maxExtraBeds - extraBedsUsed);
  const capacityLeft = Math.max(0, capacity - activeGuests.length);

  const primaryAllocation = findPrimaryAllocation(group);
  const primaryAllocated = Boolean(primaryAllocation);

  const status = normalizeGuestValue(details?.booking_status);

  const canManage =
    status === "confirmed" ||
    status === "checked_in";

  const canCheckOut =
    status === "checked_in";

  const primaryStoredId = Boolean(
    String(details?.id_proof_type || "").trim() &&
      String(details?.id_proof_number || "").trim()
  );

  const childRules = Array.isArray(policy.child_age_rules)
    ? policy.child_age_rules
    : [];

  const childAge = form.age === "" ? null : Number(form.age);

  const childRule =
    form.guestType === "child" &&
    Number.isInteger(childAge)
      ? childRules.find(
          (rule) =>
            childAge >= Number(rule.min_age) &&
            childAge <= Number(rule.max_age)
        ) || null
      : null;

  const childBedPolicy = normalizeGuestValue(childRule?.bed_policy);

  const idRequired =
    form.guestRole === "primary"
      ? policy.id_proof_required === true && !primaryStoredId
      : form.guestType === "adult"
        ? policy.other_adult_id_required === true
        : policy.child_id_required === true;

  function changeForm(field, value) {
    setFormError("");
    setSuccess("");

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function changeGuestRole(role) {
    setForm({
      ...EMPTY_GUEST,
      guestRole: role,
      phone:
        role === "primary"
          ? String(details?.phone || "")
          : "",
    });

    setFormError("");
    setSuccess("");
  }

  function changeGuestType(type) {
    setForm((current) => ({
      ...current,
      guestType: type,
      age: "",
      extraBedUsed: false,
    }));
    setFormError("");
    setSuccess("");
  }

  function cancelGuestForm() {
    setShowForm(false);
    setForm(EMPTY_GUEST);
    setFormError("");
  }

  async function refresh() {
    await loadData();

    if (typeof onChanged === "function") {
      onChanged();
    }
  }

  async function checkInExpectedGuest(guest) {
    const guestId = Number(guest?.booking_guest_id || 0);

    if (!guestId || !canManage) return;

    setProcessingGuestId(guestId);
    setError("");
    setSuccess("");

    try {
      const response = await apiClient.post(
        `/bookings/${bookingId}/guests/check-in`,
        { booking_guest_id: guestId }
      );

      setSuccess(
        response.data?.message || "Guest checked in successfully."
      );

      await refresh();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Guest check-in could not be completed."
      );
    } finally {
      setProcessingGuestId(null);
    }
  }

  async function checkOutGuest(guest) {
    const guestId =
      Number(
        guest?.booking_guest_id ||
        0
      );

    if (
      !guestId ||
      !canCheckOut
    ) {
      return;
    }

    setProcessingGuestId(
      guestId
    );

    setError("");
    setSuccess("");

    try {
      const response =
        await apiClient.post(
          `/bookings/${bookingId}/guests/${guestId}/checkout`
        );

      setSuccess(
        response.data?.message ||
          "Guest checked out successfully."
      );

      await refresh();
    } catch (
      requestError
    ) {
      setError(
        requestError
          ?.response
          ?.data
          ?.message ||
        requestError?.message ||
        "Guest checkout could not be completed."
      );
    } finally {
      setProcessingGuestId(
        null
      );
    }
  }

  function validateNewGuest() {
    if (!canManage) {
      return "Guests cannot be checked in from this booking status.";
    }

    if (capacityLeft <= 0) {
      return "This room has reached its guest capacity.";
    }

    if (form.guestRole === "primary" && primaryAllocated) {
      return "Primary Guest is already allocated in this reservation group.";
    }

    if (
      form.guestRole === "accompanying" &&
      policy.all_guest_names_required === true &&
      !form.fullName.trim()
    ) {
      return "Guest name is required.";
    }

    const guestPhone = form.phone.trim();

    if (
      form.guestRole === "accompanying" &&
      guestPhone
    ) {
      if (!/^[+\d\s().-]+$/.test(guestPhone)) {
        return "Enter a valid guest mobile number.";
      }

      const digitCount =
        guestPhone.replace(/\D/g, "").length;

      if (
        digitCount < 7 ||
        digitCount > 15
      ) {
        return "Guest mobile number must contain 7 to 15 digits.";
      }
    }

    if (
      form.guestRole === "accompanying" &&
      form.guestType === "child"
    ) {
      if (policy.child_age_required === true && form.age === "") {
        return "Child age is required.";
      }

      if (form.age !== "") {
        const age = Number(form.age);
        const adultAgeFrom = Number(policy.adult_age_from);

        if (!Number.isInteger(age) || age < 0) {
          return "Enter a valid child age.";
        }

        if (
          Number.isFinite(adultAgeFrom) &&
          age >= adultAgeFrom
        ) {
          return `Age ${age} must be recorded as Adult.`;
        }
      }
    }

    const hasIdType = Boolean(form.idProofType.trim());
    const hasIdNumber = Boolean(form.idProofNumber.trim());

    if (hasIdType !== hasIdNumber) {
      return "ID proof type and number must be entered together.";
    }

    if (idRequired && (!hasIdType || !hasIdNumber)) {
      return "ID proof is required by this booking's policy.";
    }

    if (
      form.extraBedUsed &&
      policy.extra_bed_enabled !== true
    ) {
      return "Extra bed is disabled for this booking.";
    }

    if (form.extraBedUsed && extraBedsLeft <= 0) {
      return "This room has reached its extra-bed limit.";
    }

    if (
      form.guestType === "child" &&
      childBedPolicy === "share_existing_bed" &&
      form.extraBedUsed
    ) {
      return "This child age slab must share the existing bed.";
    }

    if (
      form.guestType === "child" &&
      childBedPolicy === "extra_bed_required" &&
      !form.extraBedUsed
    ) {
      return "Extra bed is required for this child age slab.";
    }

    return "";
  }

  async function submitNewGuest(event) {
    event.preventDefault();

    const validationError = validateNewGuest();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    setFormError("");
    setSuccess("");

    const primary = form.guestRole === "primary";

    const payload = {
      guest_role: form.guestRole,
      guest: primary
        ? {
            id_proof_type: form.idProofType.trim() || null,
            id_proof_number: form.idProofNumber.trim() || null,
          }
        : {
            guest_type: form.guestType,
            full_name: form.fullName.trim() || null,
            phone: form.phone.trim() || null,

            age:
              form.guestType === "child" && form.age !== ""
                ? Number(form.age)
                : null,

            id_proof_type:
              form.idProofType.trim() || null,

            id_proof_number:
              form.idProofNumber.trim() || null,

            extra_bed_used:
              Boolean(form.extraBedUsed),
          },
    };

    try {
      const response = await apiClient.post(
        `/bookings/${bookingId}/guests/check-in`,
        payload
      );

      setSuccess(
        response.data?.message || "Guest checked in successfully."
      );

      setShowForm(false);
      setForm(EMPTY_GUEST);

      await refresh();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Guest check-in could not be completed."
      );

      if (requestError?.code === "PRIMARY_GUEST_ALREADY_ALLOCATED") {
        await loadData();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="booking-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        className="booking-view-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-guests-title"
      >
        <div className="booking-modal-header">
          <div>
            <h3 id="manage-guests-title">
              Manage Guests / Check-In
            </h3>

            <p>
              {details?.booking_code ||
                booking.booking_code ||
                "Booking"}
            </p>
          </div>

          <button
            type="button"
            className="booking-modal-close"
            disabled={busy}
            onClick={onClose}
            aria-label="Close guest management"
          >
            ×
          </button>
        </div>

        <AppAlert type="error" message={error}
          onClose={() => setError("")}
        />

        <AppAlert type="success" message={success}
          onClose={() => setSuccess("")}
        />

        {loading && !details ? (
          <div className="booking-view-loading">
            Loading guest occupancy...
          </div>
        ) : details ? (
          <div className="booking-view-body">
            <section className="booking-detail-section">
              <h4>Room & Occupancy</h4>

              <div className="booking-detail-row">
                <span>Room</span>
                <strong>
                  Room {details.room_number || "—"}
                  {details.room_type
                    ? ` · ${details.room_type}`
                    : ""}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Booking Status</span>
                <strong>{formatGuestLabel(details.booking_status)}</strong>
              </div>

              <div className="booking-detail-row">
                <span>Room Status</span>
                <strong>{formatGuestLabel(details.room_status)}</strong>
              </div>

              <div className="booking-detail-row">
                <span>Occupancy</span>
                <strong>
                  {activeGuests.length} / {capacity || "—"}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Extra Beds</span>
                <strong>
                  {extraBedsUsed} / {maxExtraBeds}
                </strong>
              </div>
            </section>

            <section className="booking-detail-section">
              <h4>Reservation Contact</h4>

              <div className="booking-detail-row">
                <span>Name</span>
                <strong>{details.full_name || "—"}</strong>
              </div>

              <div className="booking-detail-row">
                <span>Phone</span>
                <strong>{details.phone || "—"}</strong>
              </div>

              <div className="booking-detail-row">
                <span>Primary Guest</span>
                <strong>
                  {primaryAllocation
                    ? `Allocated · Room ${
                        primaryAllocation.booking?.room_number || "—"
                      }`
                    : "Not Allocated"}
                </strong>
              </div>
            </section>

            <section className="booking-detail-section">
              <h4>Staying Guests</h4>

              <GuestRoster
                guests={guests}
                canManage={canManage}
                canCheckOut={canCheckOut}
                busy={busy}
                processingGuestId={processingGuestId}
                onCheckIn={(guest) =>
                  void checkInExpectedGuest(
                    guest
                  )
                }
                onCheckOut={(guest) =>
                  void checkOutGuest(
                    guest
                  )
                }
              />
            </section>

            {!showForm ? (
              <div className="booking-confirm-actions">
                <button
                  type="button"
                  className="booking-btn-primary"
                  disabled={busy || !canManage || capacityLeft <= 0}
                  onClick={() => {
                    setForm(EMPTY_GUEST);
                    setFormError("");
                    setSuccess("");
                    setShowForm(true);
                  }}
                >
                  + Add Arriving Guest
                </button>
              </div>
            ) : (
              <ArrivingGuestForm
                form={form}
                formError={formError}
                policy={policy}
                details={details}
                submitting={submitting}
                primaryAllocated={primaryAllocated}
                primaryStoredId={primaryStoredId}
                idRequired={idRequired}
                childBedPolicy={childBedPolicy}
                childBedPolicyLabel={
                  childRule ? formatGuestLabel(childRule.bed_policy) : ""
                }
                extraBedsLeft={extraBedsLeft}
                capacityLeft={capacityLeft}
                canManage={canManage}
                onFieldChange={changeForm}
                onRoleChange={changeGuestRole}
                onTypeChange={changeGuestType}
                onCancel={cancelGuestForm}
                onSubmit={submitNewGuest}
              />
            )}
          </div>
        ) : (
          <div className="booking-view-error">
            {error || "Guest occupancy could not be loaded."}
          </div>
        )}

        <div className="booking-confirm-actions">
          <button
            type="button"
            className="booking-btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManageGuestsDialog;