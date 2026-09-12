import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useAuth,
  useSignUp,
} from "@clerk/clerk-react";

import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import apiClient from "../../shared/api/apiClient";
import "../../styles/RegisterPage.css";

import {
  IconCheck,
  IconEmail,
  IconEye,
  IconLock,
  IconPhone,
  IconUser,
  HotelierCrown,
} from "../../utils/icons/RegisterIcons";

const INITIAL_FORM = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  agreeTerms: false,
};

function getClerkError(error, fallbackMessage) {
  return (
    error?.errors?.[0]?.longMessage ||
    error?.errors?.[0]?.message ||
    error?.message ||
    fallbackMessage
  );
}

function isProfileErrorRetryable(error) {
  if (!error) {
    return true;
  }

  /*
   * These errors normally require a new login or the correct
   * Clerk account. Repeating the same request will not fix them.
   */
  if ([401, 403, 409].includes(error.status)) {
    return false;
  }

  return true;
}

function RegisterPage({ mode = "selfRegister" }) {
  const navigate = useNavigate();

  const {
    isLoaded,
    signUp,
    setActive,
  } = useSignUp();

  const {
    isSignedIn,
    getToken,
    signOut,
  } = useAuth();

  const [form, setForm] = useState(INITIAL_FORM);
  const [verificationCode, setVerificationCode] =
    useState("");

  const [phase, setPhase] = useState("register");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const [profilePending, setProfilePending] =
    useState(false);

  const [profileRetry, setProfileRetry] = useState(0);

  const [profileErrorRetryable, setProfileErrorRetryable] =
    useState(true);

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const profileRequestStarted = useRef(false);
  const dashboardRedirectTimer = useRef(null);

  /*
   * The current development stage supports only Super Admin
   * self-registration. Admin creation will be implemented later
   * through a dedicated Super Admin workflow.
   */
  const unsupportedMode = mode !== "selfRegister";

  useEffect(() => {
    return () => {
      if (dashboardRedirectTimer.current) {
        window.clearTimeout(
          dashboardRedirectTimer.current
        );
      }
    };
  }, []);

  /*
   * After Clerk verification:
   *
   * 1. Get the Clerk session token.
   * 2. Create or verify the Super Admin MySQL profile.
   * 3. Verify the role through /api/auth/me.
   * 4. Redirect to the Super Admin dashboard.
   */
  useEffect(() => {
    if (
      !profilePending ||
      !isSignedIn ||
      profileRequestStarted.current
    ) {
      return;
    }

    profileRequestStarted.current = true;

    const createSuperAdminProfile = async () => {
      try {
        setPhase("saving");
        setError("");
        setMessage("");
        setProfileErrorRetryable(true);

        const token = await getToken();

        if (!token) {
          const sessionError = new Error(
            "Your Clerk session could not be verified. Please sign in again."
          );

          sessionError.status = 401;
          throw sessionError;
        }

        const registrationResponse = await apiClient.post(
          "/auth/register-super-admin",
          {
            full_name: form.fullName.trim(),
            phone: form.phone.trim() || null,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        /*
         * Do not redirect based only on profile creation.
         * Confirm that the backend recognizes this account as an
         * active Super Admin.
         */
        const accountResponse = await apiClient.get(
          "/auth/me",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const authenticatedUser =
          accountResponse.data?.user;

        if (
          !authenticatedUser ||
          authenticatedUser.role !== "super_admin"
        ) {
          const roleError = new Error(
            "Your account was created, but the Super Admin role could not be verified."
          );

          roleError.status = 403;
          throw roleError;
        }

        setMessage(
          registrationResponse.data?.message ||
            "Super Admin registered successfully."
        );

        setPhase("success");

        dashboardRedirectTimer.current =
          window.setTimeout(() => {
            navigate("/superadmin-dashboard", {
              replace: true,
            });
          }, 1000);
      } catch (requestError) {
        console.error(
          `[SUPER_ADMIN_REGISTRATION] ${
            requestError?.code ||
            "PROFILE_CREATION_FAILED"
          }: ${
            requestError?.message ||
            "Unknown registration error"
          }`
        );

        profileRequestStarted.current = false;

        setProfileErrorRetryable(
          isProfileErrorRetryable(requestError)
        );

        setError(
          requestError?.message ||
            "Your Clerk account was created, but the HMS profile could not be saved."
        );

        setPhase("profile-error");
      }
    };

    createSuperAdminProfile();
  }, [
    profilePending,
    profileRetry,
    isSignedIn,
    getToken,
    form.fullName,
    form.phone,
    navigate,
  ]);

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    setError("");
  };

  const validateRegistrationForm = () => {
    const fullName = form.fullName.trim();
    const email = form.email.trim();

    if (!fullName) {
      return "Full name is required.";
    }

    if (fullName.length > 150) {
      return "Full name must not exceed 150 characters.";
    }

    if (!email) {
      return "Email address is required.";
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return "Enter a valid email address.";
    }

    if (form.phone.trim().length > 30) {
      return "Phone number must not exceed 30 characters.";
    }

    if (!form.password) {
      return "Password is required.";
    }

    if (form.password.length < 8) {
      return "Password must contain at least 8 characters.";
    }

    if (form.password !== form.confirmPassword) {
      return "Password and confirm password do not match.";
    }

    if (!form.agreeTerms) {
      return "You must accept the terms and privacy policy.";
    }

    return "";
  };

  const handleRegistration = async (event) => {
    event.preventDefault();

    const validationError =
      validateRegistrationForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isLoaded || !signUp) {
      setError(
        "Clerk authentication is still loading. Please wait and try again."
      );

      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await signUp.create({
        emailAddress:
          form.email.trim().toLowerCase(),

        password: form.password,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setMessage(
        `A verification code was sent to ${form.email.trim()}.`
      );

      setPhase("verify");
    } catch (registrationError) {
      console.error(
        `[CLERK_SIGN_UP] ${
          registrationError?.errors?.[0]?.code ||
          "SIGN_UP_FAILED"
        }: ${
          registrationError?.errors?.[0]?.message ||
          registrationError?.message ||
          "Unknown Clerk signup error"
        }`
      );

      setError(
        getClerkError(
          registrationError,
          "The Clerk account could not be created. Please check your information and try again."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEmail = async (event) => {
    event.preventDefault();

    const code = verificationCode.trim();

    if (!code) {
      setError(
        "Enter the verification code sent to your email."
      );

      return;
    }

    if (!isLoaded || !signUp) {
      setError(
        "Clerk authentication is still loading. Please wait and try again."
      );

      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const verificationResult =
        await signUp.attemptEmailAddressVerification({
          code,
        });

      if (
        verificationResult.status !== "complete" ||
        !verificationResult.createdSessionId
      ) {
        setError(
          "Email verification is incomplete. Check the verification code and try again."
        );

        return;
      }

      await setActive({
        session:
          verificationResult.createdSessionId,
      });

      setProfilePending(true);
      setPhase("saving");
    } catch (verificationError) {
      console.error(
        `[CLERK_EMAIL_VERIFICATION] ${
          verificationError?.errors?.[0]?.code ||
          "EMAIL_VERIFICATION_FAILED"
        }: ${
          verificationError?.errors?.[0]?.message ||
          verificationError?.message ||
          "Unknown verification error"
        }`
      );

      setError(
        getClerkError(
          verificationError,
          "The verification code is invalid or expired. Request a new code and try again."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || !signUp) {
      setError(
        "Clerk authentication is still loading. Please wait and try again."
      );

      return;
    }

    setResending(true);
    setError("");
    setMessage("");

    try {
      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setMessage(
        `A new verification code was sent to ${form.email.trim()}.`
      );
    } catch (resendError) {
      console.error(
        `[CLERK_RESEND_CODE] ${
          resendError?.errors?.[0]?.code ||
          "RESEND_CODE_FAILED"
        }: ${
          resendError?.errors?.[0]?.message ||
          resendError?.message ||
          "Unknown resend error"
        }`
      );

      setError(
        getClerkError(
          resendError,
          "A new verification code could not be sent. Please wait and try again."
        )
      );
    } finally {
      setResending(false);
    }
  };

  const handleRetryProfile = () => {
    profileRequestStarted.current = false;

    setError("");
    setMessage("");
    setPhase("saving");

    setProfileRetry(
      (currentValue) => currentValue + 1
    );
  };

  const handleSignOutAndLogin = async () => {
    try {
      await signOut();

      navigate("/login", {
        replace: true,
      });
    } catch (signOutError) {
      console.error(
        `[SIGN_OUT] ${
          signOutError?.message ||
          "Unable to sign out"
        }`
      );

      setError(
        "The current Clerk session could not be closed. Refresh the page and try again."
      );
    }
  };

  const handleStartAgain = () => {
    window.location.reload();
  };

  if (unsupportedMode) {
    return (
      <Navigate
        to="/403"
        replace
      />
    );
  }

  const currentStep =
    phase === "register" ? 1 : 2;

  return (
    <div className="register-page">
      <div className="register-topbar">
        <div className="register-logo">
          <HotelierCrown />

          <div className="register-logo-text">
            <h1>
              Hotel Management System
            </h1>

            <p>
              Super Admin Registration
            </p>
          </div>
        </div>

        <div className="register-topbar-link">
          Already registered?{" "}

          <Link to="/login">
            Sign In
          </Link>
        </div>
      </div>

      <div className="register-main">
        <div className="register-card">
          <div className="register-card-header">
            <h2>
              {phase === "register" &&
                "Create Super Admin Account"}

              {phase === "verify" &&
                "Verify Email Address"}

              {phase === "saving" &&
                "Creating HMS Profile"}

              {phase === "profile-error" &&
                "Profile Creation Failed"}

              {phase === "success" &&
                "Registration Complete"}
            </h2>

            <p>
              {phase === "register" &&
                "Create the business owner's account. Hotels will be created separately after login."}

              {phase === "verify" &&
                "Enter the verification code sent by Clerk to your email address."}

              {phase === "saving" &&
                "Your Clerk account is verified. The HMS profile is now being created."}

              {phase === "profile-error" &&
                "The Clerk account exists, but the HMS database profile could not be completed."}

              {phase === "success" &&
                "Your Super Admin account is ready."}
            </p>

            {phase !== "success" &&
              phase !== "profile-error" && (
                <div className="register-steps">
                  <div className="step-item">
                    <div
                      className={`step-circle ${
                        currentStep > 1
                          ? "done"
                          : "active"
                      }`}
                    >
                      {currentStep > 1
                        ? <IconCheck />
                        : 1}
                    </div>

                    <span
                      className={`step-label ${
                        currentStep > 1
                          ? "done"
                          : "active"
                      }`}
                    >
                      Account
                    </span>
                  </div>

                  <div
                    className={`step-line ${
                      currentStep > 1
                        ? "done"
                        : ""
                    }`}
                  />

                  <div className="step-item">
                    <div
                      className={`step-circle ${
                        currentStep === 2
                          ? "active"
                          : ""
                      }`}
                    >
                      2
                    </div>

                    <span
                      className={`step-label ${
                        currentStep === 2
                          ? "active"
                          : ""
                      }`}
                    >
                      Verify
                    </span>
                  </div>
                </div>
              )}
          </div>

          {phase === "register" && (
            <form
              onSubmit={handleRegistration}
              noValidate
            >
              <div className="register-card-body">
                {error && (
                  <div
                    className="alert alert-error"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <div className="reg-section-title">
                  <IconUser />
                  Business Owner Details
                </div>

                <div className="reg-grid">
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="fullName"
                    >
                      <span className="req">
                        *
                      </span>

                      Full Name
                    </label>

                    <div className="input-wrapper">
                      <span className="input-icon">
                        <IconUser />
                      </span>

                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        className="form-input"
                        placeholder="Enter full name"
                        autoComplete="name"
                        maxLength={150}
                        value={form.fullName}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="phone"
                    >
                      Phone Number
                    </label>

                    <div className="input-wrapper">
                      <span className="input-icon">
                        <IconPhone />
                      </span>

                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        className="form-input"
                        placeholder="+91 00000 00000"
                        autoComplete="tel"
                        maxLength={30}
                        value={form.phone}
                        onChange={handleChange}
                      />
                    </div>

                    <span className="field-hint">
                      Phone number is optional.
                    </span>
                  </div>

                  <div className="form-group full">
                    <label
                      className="form-label"
                      htmlFor="email"
                    >
                      <span className="req">
                        *
                      </span>

                      Email Address
                    </label>

                    <div className="input-wrapper">
                      <span className="input-icon">
                        <IconEmail />
                      </span>

                      <input
                        id="email"
                        name="email"
                        type="email"
                        className="form-input"
                        placeholder="owner@hotel.com"
                        autoComplete="email"
                        value={form.email}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="password"
                    >
                      <span className="req">
                        *
                      </span>

                      Password
                    </label>

                    <div className="input-wrapper">
                      <span className="input-icon">
                        <IconLock />
                      </span>

                      <input
                        id="password"
                        name="password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        className="form-input"
                        placeholder="Minimum 8 characters"
                        autoComplete="new-password"
                        value={form.password}
                        onChange={handleChange}
                      />

                      <button
                        type="button"
                        className="input-right-icon"
                        onClick={() => {
                          setShowPassword(
                            (currentValue) =>
                              !currentValue
                          );
                        }}
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        <IconEye
                          open={showPassword}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="confirmPassword"
                    >
                      <span className="req">
                        *
                      </span>

                      Confirm Password
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
                        placeholder="Re-enter password"
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
                </div>

                <div className="terms-group">
                  <input
                    id="agreeTerms"
                    name="agreeTerms"
                    type="checkbox"
                    checked={form.agreeTerms}
                    onChange={handleChange}
                  />

                  <label
                    className="terms-text"
                    htmlFor="agreeTerms"
                  >
                    I agree to the Terms and
                    Privacy Policy.
                  </label>
                </div>

                <div id="clerk-captcha" />
              </div>

              <div className="register-card-footer">
                <span className="footer-step-info">
                  Step 1 of 2
                </span>

                <button
                  type="submit"
                  className="btn-next"
                  disabled={
                    submitting || !isLoaded
                  }
                >
                  {submitting
                    ? "Creating Account..."
                    : "Create Account"}
                </button>
              </div>
            </form>
          )}

          {phase === "verify" && (
            <form
              onSubmit={handleVerifyEmail}
              noValidate
            >
              <div className="register-card-body">
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

                <div className="reg-section-title">
                  <IconEmail />
                  Email Verification
                </div>

                <div className="reg-grid single">
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="verificationCode"
                    >
                      <span className="req">
                        *
                      </span>

                      Verification Code
                    </label>

                    <div className="input-wrapper">
                      <span className="input-icon">
                        <IconLock />
                      </span>

                      <input
                        id="verificationCode"
                        name="verificationCode"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="form-input"
                        placeholder="Enter verification code"
                        value={verificationCode}
                        onChange={(event) => {
                          setVerificationCode(
                            event.target.value
                          );

                          setError("");
                        }}
                      />
                    </div>

                    <span className="field-hint">
                      Code sent to{" "}
                      {form.email.trim()}.
                    </span>
                  </div>
                </div>

                <div className="reg-grid">
                  <button
                    type="button"
                    className="btn-back"
                    onClick={handleStartAgain}
                  >
                    Change Email
                  </button>

                  <button
                    type="button"
                    className="btn-back"
                    onClick={handleResendCode}
                    disabled={resending}
                  >
                    {resending
                      ? "Sending..."
                      : "Resend Code"}
                  </button>
                </div>
              </div>

              <div className="register-card-footer">
                <span className="footer-step-info">
                  Step 2 of 2
                </span>

                <button
                  type="submit"
                  className="btn-next"
                  disabled={
                    submitting ||
                    !verificationCode.trim()
                  }
                >
                  {submitting
                    ? "Verifying..."
                    : "Verify & Register"}
                </button>
              </div>
            </form>
          )}

          {phase === "saving" && (
            <div className="reg-success">
              <div className="reg-success-icon">
                ⏳
              </div>

              <h3>
                Creating Super Admin Profile
              </h3>

              <p>
                Email verification is complete.
                Please wait while your HMS
                profile and account role are
                verified.
              </p>
            </div>
          )}

          {phase === "profile-error" && (
            <div className="reg-success">
              <div className="reg-success-icon">
                ⚠
              </div>

              <h3>
                Profile Could Not Be Completed
              </h3>

              <p>
                {error}
              </p>

              {profileErrorRetryable ? (
                <button
                  type="button"
                  className="btn-next"
                  onClick={handleRetryProfile}
                >
                  Retry Profile Creation
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-next"
                  onClick={handleSignOutAndLogin}
                >
                  Sign Out and Go to Login
                </button>
              )}
            </div>
          )}

          {phase === "success" && (
            <div className="reg-success">
              <div className="reg-success-icon">
                <IconCheck />
              </div>

              <h3>
                Super Admin Registered Successfully
              </h3>

              <p>
                {message}
                <br />
                Opening your Super Admin
                dashboard...
              </p>

              <strong>
                {form.email.trim()}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;