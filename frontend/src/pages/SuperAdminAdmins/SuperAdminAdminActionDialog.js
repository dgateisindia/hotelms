import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import superAdminAdminService from "../../services/superAdminAdminService";
import "./SuperAdminAdminActionDialog.css";

/* SUPER ADMIN-SA3B-2-R1 */

function SuperAdminAdminActionDialog({ action, onClose, onSaved }) {
  const { admin, mode } = action;

  const isEdit = mode === "edit";
  const isDeactivate = mode === "deactivate";
  const targetStatus = isDeactivate ? "inactive" : "active";

  const [fullName, setFullName] = useState(admin.name || "");
  const [phone, setPhone] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(isEdit);
  const [profileError, setProfileError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dialogRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    dialogRef.current?.focus();

    const handleKey = event => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, saving]);

  useEffect(() => {
    if (!isEdit) return undefined;

    let cancelled = false;

    async function fetchCurrentProfile() {
      try {
        const result = await superAdminAdminService.getHotelAdmins(
          admin.hotel_display_id
        );

        if (result?.success !== true) {
          throw new Error("Could not load Admin profile.");
        }

        const profile = result.admins.find(item =>
          String(item.displayId || "").toUpperCase() ===
          String(admin.display_id || "").toUpperCase()
        );

        if (!profile) {
          throw new Error("Admin profile not found in selected hotel.");
        }

        if (!cancelled) {
          setFullName(profile.fullName || "");
          setPhone(profile.phone || "");
        }
      } catch (err) {
        if (!cancelled) {
          setProfileError(
            err?.response?.data?.message ||
            err?.message ||
            "Unable to load Admin details."
          );
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    void fetchCurrentProfile();

    return () => {
      cancelled = true;
    };
  }, [isEdit, admin.hotel_display_id, admin.display_id]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving || loadingProfile || profileError) return;

    setSaving(true);
    setError("");

    try {
      const result = isEdit
        ? await superAdminAdminService.updateHotelAdminProfile(
            admin.hotel_display_id,
            admin.display_id,
            { fullName, phone }
          )
        : await superAdminAdminService.updateHotelAdminStatus(
            admin.hotel_display_id,
            admin.display_id,
            targetStatus
          );

      if (result?.success !== true || !result?.admin) {
        throw new Error("Admin update was not confirmed.");
      }

      onSaved(admin, result.admin);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Admin update failed."
      );
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit
    ? "Edit Hotel Admin"
    : isDeactivate
      ? "Deactivate Hotel Admin"
      : "Reactivate Hotel Admin";

  return createPortal(
    <div
      className="sa-admins-modal-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        className="sa-admins-modal sa-admins-action-dialog"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sa-admin-action-title"
      >
        <header className="sa-admins-modal__header">
          <div>
            <span className="sa-admins-eyebrow">HOTEL ADMIN ACCOUNT</span>
            <h2 id="sa-admin-action-title">{title}</h2>
          </div>

          <button
            type="button"
            className="sa-admins-modal__close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="sa-admins-modal__body">
            <div className="sa-admins-action-identity">
              <strong>{admin.name || "Hotel Admin"}</strong>
              <span>
                {admin.display_id} · {admin.hotel_display_id}
              </span>
            </div>

            {isEdit ? (
              loadingProfile ? (
                <p role="status">Loading latest Admin profile...</p>
              ) : profileError ? (
                <div className="sa-admins-action-error" role="alert">
                  {profileError}
                </div>
              ) : (
                <div className="sa-admins-action-fields">
                  <label>
                    <span>Full Name *</span>
                    <input
                      required
                      type="text"
                      maxLength={150}
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                    />
                  </label>

                  <label>
                    <span>Phone Number</span>
                    <input
                      type="tel"
                      maxLength={30}
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </label>

                  <label>
                    <span>Email Address — Read Only</span>
                    <input
                      type="email"
                      value={admin.email || ""}
                      disabled
                    />
                  </label>

                  <p className="sa-admins-action-note">
                    Email, password and hotel assignment cannot be
                    changed here.
                  </p>
                </div>
              )
            ) : (
              <div className="sa-admins-action-confirm">
                <strong>
                  {isDeactivate ? "Deactivate" : "Reactivate"}{" "}
                  {admin.name}?
                </strong>

                <p>
                  {isDeactivate
                    ? "This Admin will lose access to protected HMS APIs until reactivated. Existing Clerk sessions are not automatically revoked."
                    : "This Admin can regain HMS access only while the assigned hotel is active."}
                </p>

                <p>
                  Assigned Hotel: <strong>{admin.hotel_name}</strong>
                </p>
              </div>
            )}

            {error && (
              <div className="sa-admins-action-error" role="alert">
                {error}
              </div>
            )}
          </div>

          <footer className="sa-admins-modal__footer">
            <button
              type="button"
              className="sa-admins-button sa-admins-button--light"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={
                isDeactivate
                  ? "sa-admins-button sa-admins-action-danger"
                  : "sa-admins-button sa-admins-button--primary"
              }
              disabled={
                saving ||
                loadingProfile ||
                Boolean(profileError) ||
                (isEdit && !fullName.trim())
              }
            >
              {saving
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : isDeactivate
                    ? "Yes, Deactivate"
                    : "Yes, Reactivate"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}

export default SuperAdminAdminActionDialog;