import React, { useState } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../../components/auth/AuthLayout/AuthLayout";
import "../../styles/LoginPage.css";

import {
  IconArrow,
  IconEmail,
  IconEye,
  IconLock,
} from "../../utils/icons/LoginIcons";

const INITIAL_FORM = {
  email: "",
  password: "",
};

function getClerkErrorMessage(error, fallbackMessage) {
  const clerkError = error?.errors?.[0];
  const errorCode = clerkError?.code;

  switch (errorCode) {
    case "form_identifier_not_found":
      return "No account was found with this email address.";

    case "form_password_incorrect":
      return "The entered password is incorrect.";

    case "form_param_format_invalid":
      return "Enter a valid email address.";

    case "session_exists":
      return "You are already signed in.";

    case "too_many_requests":
      return "Too many login attempts were made. Please wait and try again.";

    case "verification_expired":
      return "The verification code has expired. Request a new code.";

    case "form_code_incorrect":
      return "The verification code is incorrect.";

    default:
      return (
        clerkError?.longMessage ||
        clerkError?.message ||
        error?.message ||
        fallbackMessage
      );
  }
}

function LoginPage() {
  const navigate = useNavigate();

  const {
    isLoaded,
    signIn,
    setActive,
  } = useSignIn();

  const [form, setForm] = useState(INITIAL_FORM);

  const [step, setStep] = useState("credentials");

  const [verificationCode, setVerificationCode] =
    useState("");

  const [secondFactorStrategy, setSecondFactorStrategy] =
    useState("");

  const [verificationTarget, setVerificationTarget] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [verifying, setVerifying] =
    useState(false);

  const [resending, setResending] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setError("");
  };

  const validateLoginForm = () => {
    const email = form.email.trim();

    if (!email) {
      return "Email address is required.";
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return "Enter a valid email address.";
    }

    if (!form.password) {
      return "Password is required.";
    }

    return "";
  };

  const completeSignIn = async (sessionId) => {
    if (!sessionId) {
      throw new Error(
        "Clerk did not create a login session. Please try again."
      );
    }

    await setActive({
      session: sessionId,
    });

    /*
     * The /login route will render PostLoginRedirect after
     * Clerk marks the user as signed in.
     */
    navigate("/login", {
      replace: true,
    });
  };

  const prepareSecondFactor = async () => {
    const supportedFactors =
      signIn?.supportedSecondFactors || [];

    const factor =
      supportedFactors.find(
        (item) => item.strategy === "email_code"
      ) ||
      supportedFactors.find(
        (item) => item.strategy === "phone_code"
      ) ||
      supportedFactors.find(
        (item) => item.strategy === "totp"
      ) ||
      supportedFactors.find(
        (item) => item.strategy === "backup_code"
      );

    if (!factor) {
      throw new Error(
        "This account requires an additional verification method that is not available on this login screen."
      );
    }

    switch (factor.strategy) {
      case "email_code":
        await signIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId: factor.emailAddressId,
        });

        setVerificationTarget(
          factor.safeIdentifier ||
            form.email.trim()
        );
        break;

      case "phone_code":
        await signIn.prepareSecondFactor({
          strategy: "phone_code",
          phoneNumberId: factor.phoneNumberId,
        });

        setVerificationTarget(
          factor.safeIdentifier ||
            "your registered phone number"
        );
        break;

      case "totp":
        setVerificationTarget(
          "your authenticator application"
        );
        break;

      case "backup_code":
        setVerificationTarget(
          "one of your backup codes"
        );
        break;

      default:
        throw new Error(
          "The required verification method is not supported."
        );
    }

    setSecondFactorStrategy(factor.strategy);
    setVerificationCode("");
    setError("");
    setMessage("");
    setStep("verification");
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    const validationError =
      validateLoginForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isLoaded || !signIn) {
      setError(
        "Clerk authentication is still loading. Please wait and try again."
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const result = await signIn.create({
        identifier:
          form.email.trim().toLowerCase(),

        password: form.password,
      });

      switch (result.status) {
        case "complete":
          await completeSignIn(
            result.createdSessionId
          );
          return;

        case "needs_second_factor":
        case "needs_client_trust":
          await prepareSecondFactor();
          return;

        case "needs_new_password":
          setError(
            "This account requires a new password. Use Forgot Password to continue."
          );
          return;

        case "needs_first_factor":
          setError(
            "The email or password could not be verified."
          );
          return;

        default:
          setError(
            "Login could not be completed. Please try again."
          );
      }
    } catch (loginError) {
      const alreadySignedIn =
        loginError?.errors?.some(
          (item) =>
            item.code === "session_exists" ||
            /already signed in/i.test(
              item.longMessage ||
                item.message ||
                ""
            )
        );

      if (alreadySignedIn) {
        navigate("/login", {
          replace: true,
        });
        return;
      }

      const errorMessage =
        getClerkErrorMessage(
          loginError,
          "Login failed. Check your email and password and try again."
        );

      setError(errorMessage);

      if (process.env.NODE_ENV === "development") {
        console.error(
          `[CLERK_LOGIN] ${
            loginError?.errors?.[0]?.code ||
            "LOGIN_FAILED"
          }: ${errorMessage}`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (event) => {
    event.preventDefault();

    const code = verificationCode.trim();

    if (!code) {
      setError(
        "Enter the verification code to continue."
      );
      return;
    }

    if (
      !isLoaded ||
      !signIn ||
      !secondFactorStrategy
    ) {
      setError(
        "The verification process is no longer active. Start the login again."
      );
      return;
    }

    setVerifying(true);
    setError("");
    setMessage("");

    try {
      const result =
        await signIn.attemptSecondFactor({
          strategy: secondFactorStrategy,
          code,
        });

      if (result.status !== "complete") {
        setError(
          "Verification is incomplete. Check the code and try again."
        );
        return;
      }

      await completeSignIn(
        result.createdSessionId
      );
    } catch (verificationError) {
      const errorMessage =
        getClerkErrorMessage(
          verificationError,
          "The verification code is invalid or expired."
        );

      setError(errorMessage);

      if (process.env.NODE_ENV === "development") {
        console.error(
          `[CLERK_LOGIN_VERIFICATION] ${
            verificationError?.errors?.[0]
              ?.code ||
            "VERIFICATION_FAILED"
          }: ${errorMessage}`
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (
      !["email_code", "phone_code"].includes(
        secondFactorStrategy
      )
    ) {
      setError(
        "A new code cannot be sent for this verification method."
      );
      return;
    }

    setResending(true);
    setError("");
    setMessage("");

    try {
      const factors =
        signIn?.supportedSecondFactors || [];

      const factor = factors.find(
        (item) =>
          item.strategy ===
          secondFactorStrategy
      );

      if (!factor) {
        throw new Error(
          "The verification method is no longer available."
        );
      }

      if (
        secondFactorStrategy === "email_code"
      ) {
        await signIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId:
            factor.emailAddressId,
        });
      }

      if (
        secondFactorStrategy === "phone_code"
      ) {
        await signIn.prepareSecondFactor({
          strategy: "phone_code",
          phoneNumberId:
            factor.phoneNumberId,
        });
      }

      setMessage(
        "A new verification code has been sent."
      );
    } catch (resendError) {
      const errorMessage =
        getClerkErrorMessage(
          resendError,
          "A new verification code could not be sent."
        );

      setError(errorMessage);

      if (process.env.NODE_ENV === "development") {
        console.error(
          `[CLERK_RESEND_LOGIN_CODE] ${
            resendError?.errors?.[0]?.code ||
            "RESEND_FAILED"
          }: ${errorMessage}`
        );
      }
    } finally {
      setResending(false);
    }
  };

  const handleStartOver = () => {
    setStep("credentials");
    setVerificationCode("");
    setSecondFactorStrategy("");
    setVerificationTarget("");
    setError("");
    setMessage("");
  };

  return (
    <AuthLayout>
      {step === "credentials" ? (
        <>
          <div className="auth-form-header">
            <h2>Sign In</h2>

            <p>
              Enter your registered email
              address and password
            </p>
          </div>

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
            onSubmit={handleLogin}
            noValidate
          >
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="email"
              >
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
                  placeholder="Enter email address"
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
                  placeholder="Enter password"
                  autoComplete="current-password"
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

            <div className="auth-form-row">
              <span />

              <Link
                to="/forgot-password"
                className="auth-forgot-link"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={
                submitting || !isLoaded
              }
            >
              {submitting
                ? "Signing In..."
                : "Sign In"}

              {!submitting && <IconArrow />}
            </button>

            <div className="auth-signup-link">
              New business owner?{" "}

              <Link to="/register">
                Create Super Admin Account
              </Link>
            </div>
          </form>
        </>
      ) : (
        <>
          <div className="auth-form-header">
            <h2>Verify Your Identity</h2>

            <p>
              Enter the verification code from{" "}
              {verificationTarget}.
            </p>
          </div>

          {error && (
            <div
              className="alert alert-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {message && (
            <div
              className="alert alert-success"
              role="status"
            >
              {message}
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={handleVerifyCode}
            noValidate
          >
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="verificationCode"
              >
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
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={
                verifying ||
                !verificationCode.trim()
              }
            >
              {verifying
                ? "Verifying..."
                : "Verify & Sign In"}

              {!verifying && <IconArrow />}
            </button>

            <div className="auth-form-row">
              {[
                "email_code",
                "phone_code",
              ].includes(
                secondFactorStrategy
              ) ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleResendCode}
                  disabled={resending}
                >
                  {resending
                    ? "Sending..."
                    : "Resend Code"}
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                className="btn btn-outline"
                onClick={handleStartOver}
              >
                Start Again
              </button>
            </div>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

export default LoginPage;