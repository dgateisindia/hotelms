import React, { useState } from "react";

import { useAuth } from "@clerk/clerk-react";

import {
  Navigate,
  useNavigate,
} from "react-router-dom";

import AuthLayout from "../components/auth/AuthLayout/AuthLayout";
import { useUserRole } from "../hooks/useUserRole";

function RequireSuperAdmin({ children }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const {
    user,
    role,
    loading,
    error,
    refreshRole,
  } = useUserRole();

  const [signingOut, setSigningOut] =
    useState(false);

  const [actionError, setActionError] =
    useState("");

  const handleRetry = () => {
    setActionError("");
    refreshRole();
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setActionError("");

    try {
      await signOut();

      navigate("/login", {
        replace: true,
      });
    } catch (signOutError) {
      const message =
        signOutError?.message ||
        "Your session could not be closed. Refresh the page and try again.";

      setActionError(message);

      if (
        process.env.NODE_ENV ===
        "development"
      ) {
        console.error(
          `[SUPER_ADMIN_GUARD_SIGN_OUT] ${
            signOutError?.errors?.[0]?.code ||
            "SIGN_OUT_FAILED"
          }: ${message}`
        );
      }
    } finally {
      setSigningOut(false);
    }
  };

  /*
   * Wait until Clerk session and HMS database role
   * verification are both complete.
   */
  if (loading) {
    return (
      <AuthLayout
        welcomeTitle="Secure Access"
        welcomeDescription="Your Super Admin session is being verified"
      >
        <div className="auth-form-header">
          <h2>Verifying Account</h2>

          <p>
            Please wait while your Clerk session
            and HMS Super Admin profile are
            verified.
          </p>
        </div>

        <div
          className="alert alert-success"
          role="status"
        >
          Checking account permissions...
        </div>
      </AuthLayout>
    );
  }

  /*
   * Show the actual verification problem instead of
   * silently sending the user back to login.
   */
  if (error) {
    return (
      <AuthLayout
        welcomeTitle="Account Verification"
        welcomeDescription="We could not verify access to the Super Admin dashboard"
      >
        <div className="auth-form-header">
          <h2>Account Verification Failed</h2>

          <p>
            Your session exists, but the HMS
            account could not be verified.
          </p>
        </div>

        <div
          className="alert alert-error"
          role="alert"
        >
          {error}
        </div>

        {actionError && (
          <div
            className="alert alert-error"
            role="alert"
          >
            {actionError}
          </div>
        )}

        <div className="auth-form">
          <button
            type="button"
            className="btn-primary"
            onClick={handleRetry}
          >
            Retry Account Verification
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut
              ? "Signing Out..."
              : "Sign Out and Go to Login"}
          </button>
        </div>
      </AuthLayout>
    );
  }

  /*
   * A signed-in Admin or Staff user must never access
   * the Super Admin dashboard.
   */
  if (role !== "super_admin") {
    return (
      <Navigate
        to="/403"
        replace
      />
    );
  }

  /*
   * A valid Super Admin role must always contain its
   * internal database ID.
   */
  if (!user?.superadminId) {
    return (
      <AuthLayout
        welcomeTitle="Account Configuration"
        welcomeDescription="Your Super Admin profile is incomplete"
      >
        <div className="auth-form-header">
          <h2>Super Admin ID Missing</h2>

          <p>
            Your account role was verified, but
            the linked HMS Super Admin profile
            could not be identified.
          </p>
        </div>

        <div
          className="alert alert-error"
          role="alert"
        >
          Your Super Admin profile is incomplete.
          Sign out and contact support before
          continuing.
        </div>

        {actionError && (
          <div
            className="alert alert-error"
            role="alert"
          >
            {actionError}
          </div>
        )}

        <button
          type="button"
          className="btn-primary"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut
            ? "Signing Out..."
            : "Sign Out and Go to Login"}
        </button>
      </AuthLayout>
    );
  }

  return children;
}

export default RequireSuperAdmin;