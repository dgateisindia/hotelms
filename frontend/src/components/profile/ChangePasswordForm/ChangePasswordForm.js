import React, { useState } from "react";
import { useUser } from "@clerk/clerk-react";

import {
  IconEye,
  IconLock,
} from "../../../utils/icons/LoginIcons";

const INITIAL_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function getPasswordErrorMessage(
  error,
  fallbackMessage
) {
  const clerkError = error?.errors?.[0];
  const errorCode = clerkError?.code;

  switch (errorCode) {
    case "form_password_incorrect":
      return "The current password is incorrect.";

    case "form_password_length_too_short":
      return "The new password does not meet the minimum length requirement.";

    case "form_password_not_strong_enough":
      return "The new password is not strong enough. Use uppercase, lowercase, numbers and special characters.";

    case "form_password_pwned":
      return "This password has appeared in a known data breach. Choose a different password.";

    case "too_many_requests":
      return "Too many password change attempts were made. Please wait and try again.";

    case "verification_required":
      return "Additional account verification is required before changing the password.";

    default:
      return (
        clerkError?.longMessage ||
        clerkError?.message ||
        error?.message ||
        fallbackMessage
      );
  }
}

function ChangePasswordForm({
  onSuccess,
  onCancel,
}) {
  const {
    isLoaded,
    isSignedIn,
    user,
  } = useUser();

  const [form, setForm] =
    useState(INITIAL_FORM);

  const [
    showCurrentPassword,
    setShowCurrentPassword,
  ] = useState(false);

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setError("");
    setMessage("");
  };

  const validateForm = () => {
    if (!form.currentPassword) {
      return "Current password is required.";
    }

    if (!form.newPassword) {
      return "New password is required.";
    }

    if (form.newPassword.length < 8) {
      return "New password must contain at least 8 characters.";
    }

    if (
      form.newPassword ===
      form.currentPassword
    ) {
      return "New password must be different from the current password.";
    }

    if (!form.confirmPassword) {
      return "Confirm new password is required.";
    }

    if (
      form.newPassword !==
      form.confirmPassword
    ) {
      return "New password and confirm password do not match.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isLoaded) {
      setError(
        "Clerk authentication is still loading. Please wait and try again."
      );

      return;
    }

    if (!isSignedIn || !user) {
      setError(
        "Your login session is no longer active. Please sign in again."
      );

      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await user.updatePassword({
        currentPassword:
          form.currentPassword,

        newPassword:
          form.newPassword,

        signOutOfOtherSessions: true,
      });

      setForm(INITIAL_FORM);

      setMessage(
        "Password changed successfully. Other active sessions have been signed out."
      );

      if (
        typeof onSuccess === "function"
      ) {
        onSuccess();
      }
    } catch (passwordError) {
      const errorMessage =
        getPasswordErrorMessage(
          passwordError,
          "The password could not be changed. Check your current password and try again."
        );

      setError(errorMessage);

      if (
        process.env.NODE_ENV ===
        "development"
      ) {
        console.error(
          `[CHANGE_PASSWORD] ${
            passwordError?.errors?.[0]
              ?.code ||
            "PASSWORD_CHANGE_FAILED"
          }: ${errorMessage}`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {message && (
        <div
          className="alert alert-success"
          role="status"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          className="alert alert-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <form
        className="auth-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="form-group">
          <label
            className="form-label"
            htmlFor="currentPassword"
          >
            Current Password
          </label>

          <div className="input-wrapper">
            <span className="input-icon">
              <IconLock />
            </span>

            <input
              id="currentPassword"
              name="currentPassword"
              type={
                showCurrentPassword
                  ? "text"
                  : "password"
              }
              className="form-input"
              placeholder="Enter current password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={handleChange}
            />

            <button
              type="button"
              className="input-right-icon"
              onClick={() => {
                setShowCurrentPassword(
                  (currentValue) =>
                    !currentValue
                );
              }}
              aria-label={
                showCurrentPassword
                  ? "Hide current password"
                  : "Show current password"
              }
            >
              <IconEye
                open={showCurrentPassword}
              />
            </button>
          </div>
        </div>

        <div className="form-group">
          <label
            className="form-label"
            htmlFor="newPassword"
          >
            New Password
          </label>

          <div className="input-wrapper">
            <span className="input-icon">
              <IconLock />
            </span>

            <input
              id="newPassword"
              name="newPassword"
              type={
                showNewPassword
                  ? "text"
                  : "password"
              }
              className="form-input"
              placeholder="Enter new password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={handleChange}
            />

            <button
              type="button"
              className="input-right-icon"
              onClick={() => {
                setShowNewPassword(
                  (currentValue) =>
                    !currentValue
                );
              }}
              aria-label={
                showNewPassword
                  ? "Hide new password"
                  : "Show new password"
              }
            >
              <IconEye
                open={showNewPassword}
              />
            </button>
          </div>
        </div>

        <div className="form-group">
          <label
            className="form-label"
            htmlFor="confirmPassword"
          >
            Confirm New Password
          </label>

          <div className="input-wrapper">
            <span className="input-icon">
              <IconLock />
            </span>

            <input
              id="confirmPassword"
              name="confirmPassword"
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              className="form-input"
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
            />

            <button
              type="button"
              className="input-right-icon"
              onClick={() => {
                setShowConfirmPassword(
                  (currentValue) =>
                    !currentValue
                );
              }}
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
            >
              <IconEye
                open={showConfirmPassword}
              />
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={
            submitting ||
            !isLoaded
          }
        >
          {submitting
            ? "Changing Password..."
            : "Change Password"}
        </button>

        {typeof onCancel ===
          "function" && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </form>
    </>
  );
}

export default ChangePasswordForm;