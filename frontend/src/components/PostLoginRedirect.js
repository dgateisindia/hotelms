import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useUserRole } from "../hooks/useUserRole";

const ROLE_ROUTES = Object.freeze({
  super_admin: "/superadmin-dashboard",
  admin: "/admin-dashboard",

  receptionist: "/dashboard",
  accountant: "/dashboard",
  housekeeping: "/dashboard",
});

function PostLoginRedirect() {
  const navigate = useNavigate();

  const {
    role,
    loading,
    error,
    refreshRole,
  } = useUserRole();

  useEffect(() => {
    if (loading || error || !role) {
      return;
    }

    const destination = ROLE_ROUTES[role];

    if (!destination) {
      navigate("/403", {
        replace: true,
      });

      return;
    }

    navigate(destination, {
      replace: true,
    });
  }, [
    role,
    loading,
    error,
    navigate,
  ]);

  if (loading) {
    return (
      <main className="auth-page">
        <section className="auth-panel-right">
          <div className="auth-form-header">
            <h2>Verifying Account</h2>

            <p>
              Please wait while your session and account role are
              being verified.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="auth-page">
        <section className="auth-panel-right">
          <div className="auth-form-header">
            <h2>Account Verification Failed</h2>

            <p>
              Your account could not be verified.
            </p>
          </div>

          <div
            className="alert alert-error"
            role="alert"
          >
            {error}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={refreshRole}
          >
            Retry Account Verification
          </button>
        </section>
      </main>
    );
  }

  return null;
}

export default PostLoginRedirect;