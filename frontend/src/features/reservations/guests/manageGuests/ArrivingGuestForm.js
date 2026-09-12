import React from "react";

const LEGACY_ALLOWED_ID_PROOF_TYPES = [
  "Aadhaar",
  "Passport",
  "Driving Licence",
  "Voter ID",
  "Other",
];

function ArrivingGuestForm({
  form,
  formError,
  policy,
  details,
  submitting,
  primaryAllocated,
  primaryStoredId,
  idRequired,
  childBedPolicy,
  childBedPolicyLabel,
  extraBedsLeft,
  capacityLeft,
  canManage,
  onFieldChange,
  onRoleChange,
  onTypeChange,
  onCancel,
  onSubmit,
}) {
  const accompanying = form.guestRole === "accompanying";
  const child = accompanying && form.guestType === "child";
  const extraBedEnabled =
    accompanying && policy.extra_bed_enabled === true;

  const policyIdProofTypes =
    policy?.allowed_id_proof_types;

  const allowedIdProofTypes =
    policyIdProofTypes === undefined ||
    policyIdProofTypes === null
      ? LEGACY_ALLOWED_ID_PROOF_TYPES
      : Array.isArray(
          policyIdProofTypes
        )
        ? policyIdProofTypes
        : [];

  const idProofNumberPlaceholder =
    form.idProofType === "Aadhaar"
      ? "12-digit Aadhaar number"
      : form.idProofType === "Passport"
        ? "Passport number"
        : form.idProofType ===
            "Driving Licence"
          ? "Driving Licence number"
          : form.idProofType ===
              "Voter ID"
            ? "Voter ID number"
            : form.idProofType ===
                "Other"
              ? "ID proof number"
              : "Select ID proof type first";

  return (
    <form onSubmit={onSubmit}>
      <section className="booking-detail-section">
        <h4>Add Arriving Guest</h4>

        {formError && (
          <div className="form-error" role="alert">
            {formError}
          </div>
        )}

        <div className="booking-detail-row">
          <span>Guest Role</span>
          <select
            value={form.guestRole}
            disabled={submitting}
            onChange={(e) => onRoleChange(e.target.value)}
          >
            <option value="accompanying">Accompanying</option>
            {!primaryAllocated && (
              <option value="primary">Primary Guest</option>
            )}
          </select>
        </div>

        {form.guestRole === "primary" ? (
          <div className="booking-detail-row">
            <span>Primary Guest</span>
            <strong>
              {details.full_name || "Reservation Customer"}
            </strong>
          </div>
        ) : (
          <>
            <div className="booking-detail-row">
              <span>Guest Type</span>
              <select
                value={form.guestType}
                disabled={submitting}
                onChange={(e) => onTypeChange(e.target.value)}
              >
                <option value="adult">Adult</option>
                <option value="child">Child</option>
              </select>
            </div>

            <div className="booking-detail-row">
              <span>
                Name
                {policy.all_guest_names_required === true ? " *" : ""}
              </span>

              <input
                type="text"
                value={form.fullName}
                disabled={submitting}
                placeholder="Guest name"
                onChange={(e) =>
                  onFieldChange("fullName", e.target.value)
                }
              />
            </div>

            {child && (
              <div className="booking-detail-row">
                <span>
                  Age
                  {policy.child_age_required === true ? " *" : ""}
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.age}
                  disabled={submitting}
                  placeholder="Child age"
                  onChange={(e) =>
                    onFieldChange("age", e.target.value)
                  }
                />
              </div>
            )}
          </>
        )}

        <div className="booking-detail-row">
          <span>Mobile Number</span>

          <input
            type="tel"
            value={form.phone}
            readOnly={form.guestRole === "primary"}
            disabled={submitting}
            placeholder={
              form.guestRole === "primary"
                ? "Reservation contact phone"
                : "Guest mobile number (optional)"
            }
            onChange={(e) =>
              onFieldChange("phone", e.target.value)
            }
          />
        </div>

        <div className="booking-detail-row">
          <span>ID Proof Type{idRequired ? " *" : ""}</span>

          <select
            value={form.idProofType}
            disabled={submitting}
            onChange={(e) => {
              const nextType =
                e.target.value;

              onFieldChange(
                "idProofType",
                nextType
              );

              /*
              * An ID number belongs to its selected type.
              * Do not carry an Aadhaar number into Passport,
              * Driving Licence, etc.
              */
              onFieldChange(
                "idProofNumber",
                ""
              );
            }}
          >
            <option value="">
              Select ID proof type
            </option>

            {allowedIdProofTypes.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              )
            )}
          </select>
        </div>

        <div className="booking-detail-row">
          <span>ID Proof Number{idRequired ? " *" : ""}</span>

          <input
            type="text"
            value={form.idProofNumber}
            disabled={
              submitting ||
              !form.idProofType
            }
            inputMode={
              form.idProofType === "Aadhaar"
                ? "numeric"
                : "text"
            }
            placeholder={
              idProofNumberPlaceholder
            }
            onChange={(e) =>
              onFieldChange(
                "idProofNumber",
                e.target.value
              )
            }
          />
        </div>

        {form.guestRole === "primary" &&
          primaryStoredId &&
          !form.idProofType &&
          !form.idProofNumber && (
            <div className="booking-detail-row">
              <span>Stored ID</span>
              <strong>
                {details.id_proof_type} · {details.id_proof_number}
              </strong>
            </div>
          )}

        {extraBedEnabled && (
          <div className="booking-detail-row">
            <span>Extra Bed</span>

            <label>
              <input
                type="checkbox"
                checked={form.extraBedUsed}
                disabled={
                  submitting ||
                  childBedPolicy === "share_existing_bed" ||
                  (extraBedsLeft <= 0 && !form.extraBedUsed)
                }
                onChange={(e) =>
                  onFieldChange("extraBedUsed", e.target.checked)
                }
              />{" "}
              Use extra bed
            </label>
          </div>
        )}

        {child && childBedPolicyLabel && (
          <div className="booking-detail-row">
            <span>Child Bed Policy</span>
            <strong>{childBedPolicyLabel}</strong>
          </div>
        )}

        <div className="booking-detail-row">
          <span>Capacity Left</span>
          <strong>{capacityLeft}</strong>
        </div>

        <div className="booking-detail-row">
          <span>Extra Beds Left</span>
          <strong>{extraBedsLeft}</strong>
        </div>
      </section>

      <div className="booking-confirm-actions">
        <button
          type="button"
          className="booking-btn-secondary"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="booking-btn-primary"
          disabled={submitting || !canManage || capacityLeft <= 0}
        >
          {submitting ? "Checking In..." : "Check In Guest"}
        </button>
      </div>
    </form>
  );
}

export default ArrivingGuestForm;