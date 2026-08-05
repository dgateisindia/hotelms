import React, {
  useEffect,
  useRef,
  useState,
} from "react";

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

const RESET_STRATEGY =
  "reset_password_email_code";

const INITIAL_FORM = {
  email: "",
  code: "",
  password: "",
  confirmPassword: "",
};

function getClerkErrorMessage(
  error,
  fallbackMessage
) {
  const clerkError = error?.errors?.[0];
  const errorCode = clerkError?.code;

  switch (errorCode) {
    case "form_identifier_not_found":
      return "No account was found with this email address.";

    case "form_param_format_invalid":
      return "Enter a valid email address.";

    case "form_code_incorrect":
      return "The verification code is incorrect.";

    case "verification_expired":
      return "The verification code has expired. Request a new code.";

    case "form_password_length_too_short":
      return "The new password does not meet the minimum length requirement.";

    case "form_password_not_strong_enough":
      return "The new password is not strong enough. Use a stronger password.";

    case "form_password_pwned":
      return "This password has appeared in a known data breach. Choose a different password.";

    case "too_many_requests":
      return "Too many requests were made. Please wait before trying again.";

    case "session_exists":
      return "You are already signed in. Sign out before resetting the password.";

    default:
      return (
        clerkError?.longMessage ||
        clerkError?.message ||
        error?.message ||
        fallbackMessage
      );
  }
}

function ForgotPassword() {
  const navigate = useNavigate();

  const {
    isLoaded,
    signIn,
  } = useSignIn();

  const [form, setForm] =
    useState(INITIAL_FORM);

  const [step, setStep] =
    useState("email");

  const [
    secondFactorStrategy,
    setSecondFactorStrategy,
  ] = useState("");

  const [
    secondFactorTarget,
    setSecondFactorTarget,
  ] = useState("");

  const [
    secondFactorCode,
    setSecondFactorCode,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [resending, setResending] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const redirectTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(
          redirectTimerRef.current
        );
      }
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setError("");
  };

  const scheduleLoginRedirect = () => {
    setStep("success");

    setMessage(
      "Your password was reset successfully. You can now sign in with the new password."
    );

    redirectTimerRef.current =
      window.setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 1800);
  };

  const prepareSecondFactor = async (
    signInAttempt
  ) => {
    const supportedFactors =
      signInAttempt
        ?.supportedSecondFactors ||
      signIn?.supportedSecondFactors ||
      [];

    const factor =
      supportedFactors.find(
        (item) =>
          item.strategy ===
          "email_code"
      ) ||
      supportedFactors.find(
        (item) =>
          item.strategy ===
          "phone_code"
      ) ||
      supportedFactors.find(
        (item) =>
          item.strategy === "totp"
      ) ||
      supportedFactors.find(
        (item) =>
          item.strategy ===
          "backup_code"
      );

    if (!factor) {
      throw new Error(
        "Password verification requires an additional security method that is not available on this page."
      );
    }

    switch (factor.strategy) {
      case "email_code":
        await signIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId:
            factor.emailAddressId,
        });

        setSecondFactorTarget(
          factor.safeIdentifier ||
            form.email.trim()
        );
        break;

      case "phone_code":
        await signIn.prepareSecondFactor({
          strategy: "phone_code",
          phoneNumberId:
            factor.phoneNumberId,
        });

        setSecondFactorTarget(
          factor.safeIdentifier ||
            "your registered phone number"
        );
        break;

      case "totp":
        setSecondFactorTarget(
          "your authenticator application"
        );
        break;

      case "backup_code":
        setSecondFactorTarget(
          "one of your backup codes"
        );
        break;

      default:
        throw new Error(
          "The required security verification method is not supported."
        );
    }

    setSecondFactorStrategy(
      factor.strategy
    );

    setSecondFactorCode("");
    setError("");
    setMessage("");
    setStep("second-factor");
  };

  const handleSendCode = async (
    event
  ) => {
    event.preventDefault();

    const email =
      form.email.trim().toLowerCase();

    if (!email) {
      setError(
        "Email address is required."
      );

      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError(
        "Enter a valid email address."
      );

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
      await signIn.create({
        strategy: RESET_STRATEGY,
        identifier: email,
      });

      setForm((currentForm) => ({
        ...currentForm,
        email,
        code: "",
        password: "",
        confirmPassword: "",
      }));

      setMessage(
        `A password reset code was sent to ${email}.`
      );

      setStep("reset");
    } catch (sendCodeError) {
      const errorMessage =
        getClerkErrorMessage(
          sendCodeError,
          "The password reset code could not be sent. Please try again."
        );

      setError(errorMessage);

      if (
        process.env.NODE_ENV ===
        "development"
      ) {
        console.error(
          `[FORGOT_PASSWORD_SEND_CODE] ${
            sendCodeError?.errors?.[0]
              ?.code ||
            "SEND_CODE_FAILED"
          }: ${errorMessage}`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const validateResetForm = () => {
    if (!form.code.trim()) {
      return "Enter the verification code sent to your email.";
    }

    if (!form.password) {
      return "New password is required.";
    }

    if (form.password.length < 8) {
      return "New password must contain at least 8 characters.";
    }

    if (
      form.password !==
      form.confirmPassword
    ) {
      return "New password and confirm password do not match.";
    }

    return "";
  };

  const handleResetPassword = async (
    event
  ) => {
    event.preventDefault();

    const validationError =
      validateResetForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isLoaded || !signIn) {
      setError(
        "The password reset session is not available. Start the process again."
      );

      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const result =
        await signIn.attemptFirstFactor({
          strategy: RESET_STRATEGY,
          code: form.code.trim(),
          password: form.password,
        });

      if (
        result.status === "complete"
      ) {
        scheduleLoginRedirect();
        return;
      }

      if (
        result.status ===
          "needs_second_factor" ||
        result.status ===
          "needs_client_trust"
      ) {
        await prepareSecondFactor(
          result
        );

        return;
      }

      if (
        result.status ===
        "needs_new_password"
      ) {
        setError(
          "The new password could not be applied. Choose a different password and try again."
        );

        return;
      }

      setError(
        "Password reset could not be completed. Please request a new verification code."
      );
    } catch (resetError) {
      const errorMessage =
        getClerkErrorMessage(
          resetError,
          "The password could not be reset. Check the verification code and password."
        );

      setError(errorMessage);

      if (
        process.env.NODE_ENV ===
        "development"
      ) {
        console.error(
          `[FORGOT_PASSWORD_RESET] ${
            resetError?.errors?.[0]
              ?.code ||
            "PASSWORD_RESET_FAILED"
          }: ${errorMessage}`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSecondFactor = async (
    event
  ) => {
    event.preventDefault();

    const code =
      secondFactorCode.trim();

    if (!code) {
      setError(
        "Enter the additional verification code."
      );

      return;
    }

    if (
      !isLoaded ||
      !signIn ||
      !secondFactorStrategy
    ) {
      setError(
        "The additional verification process is no longer active. Start the password reset again."
      );

      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const result =
        await signIn.attemptSecondFactor({
          strategy:
            secondFactorStrategy,
          code,
        });

      if (
        result.status === "complete"
      ) {
        scheduleLoginRedirect();
        return;
      }

      setError(
        "Additional verification is incomplete. Check the code and try again."
      );
    } catch (
      secondFactorError
    ) {
      const errorMessage =
        getClerkErrorMessage(
          secondFactorError,
          "The additional verification code is invalid or expired."
        );

      setError(errorMessage);

      if (
        process.env.NODE_ENV ===
        "development"
      ) {
        console.error(
          `[FORGOT_PASSWORD_SECOND_FACTOR] ${
            secondFactorError
              ?.errors?.[0]?.code ||
            "SECOND_FACTOR_FAILED"
          }: ${errorMessage}`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendResetCode =
    async () => {
      if (!isLoaded || !signIn) {
        setError(
          "The password reset service is still loading. Please try again."
        );

        return;
      }

      setResending(true);
      setError("");
      setMessage("");

      try {
        await signIn.create({
          strategy: RESET_STRATEGY,
          identifier:
            form.email
              .trim()
              .toLowerCase(),
        });

        setForm((currentForm) => ({
          ...currentForm,
          code: "",
        }));

        setMessage(
          "A new password reset code was sent to your email."
        );
      } catch (resendError) {
        const errorMessage =
          getClerkErrorMessage(
            resendError,
            "A new password reset code could not be sent."
          );

        setError(errorMessage);

        if (
          process.env.NODE_ENV ===
          "development"
        ) {
          console.error(
            `[FORGOT_PASSWORD_RESEND] ${
              resendError?.errors?.[0]
                ?.code ||
              "RESEND_FAILED"
            }: ${errorMessage}`
          );
        }
      } finally {
        setResending(false);
      }
    };

  const handleStartAgain = () => {
    setForm(INITIAL_FORM);
    setSecondFactorCode("");
    setSecondFactorStrategy("");
    setSecondFactorTarget("");
    setError("");
    setMessage("");
    setStep("email");
  };

  return (
    <AuthLayout
      welcomeTitle="Account Recovery"
      welcomeDescription="We will help you securely reset your password"
    >
      {step === "email" && (
        <>
          <div className="auth-form-header">
            <h2>Forgot Password</h2>

            <p>
              Enter your registered email
              address to receive a password
              reset code.
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
            onSubmit={handleSendCode}
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
                  placeholder="Enter registered email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={
                submitting || !isLoaded
              }
            >
              {submitting
                ? "Sending Code..."
                : "Send Reset Code"}

              {!submitting && (
                <IconArrow />
              )}
            </button>

            <div className="auth-signup-link">
              Remember your password?{" "}

              <Link to="/login">
                Back to Sign In
              </Link>
            </div>
          </form>
        </>
      )}

      {step === "reset" && (
        <>
          <div className="auth-form-header">
            <h2>Reset Password</h2>

            <p>
              Enter the code sent to{" "}
              {form.email} and choose a new
              password.
            </p>
          </div>

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
            onSubmit={
              handleResetPassword
            }
            noValidate
          >
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="code"
              >
                Verification Code
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <IconLock />
                </span>

                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="form-input"
                  placeholder="Enter reset code"
                  value={form.code}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label
                className="form-label"
                htmlFor="password"
              >
                New Password
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
                  placeholder="Enter new password"
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
                  value={
                    form.confirmPassword
                  }
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
                    open={
                      showConfirmPassword
                    }
                  />
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting
                ? "Resetting Password..."
                : "Reset Password"}

              {!submitting && (
                <IconArrow />
              )}
            </button>

            <div className="auth-form-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={
                  handleResendResetCode
                }
                disabled={resending}
              >
                {resending
                  ? "Sending..."
                  : "Resend Code"}
              </button>

              <button
                type="button"
                className="btn btn-outline"
                onClick={handleStartAgain}
              >
                Change Email
              </button>
            </div>
          </form>
        </>
      )}

      {step === "second-factor" && (
        <>
          <div className="auth-form-header">
            <h2>
              Additional Verification
            </h2>

            <p>
              Enter the security code from{" "}
              {secondFactorTarget}.
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
            onSubmit={
              handleSecondFactor
            }
            noValidate
          >
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="secondFactorCode"
              >
                Security Code
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <IconLock />
                </span>

                <input
                  id="secondFactorCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="form-input"
                  placeholder="Enter security code"
                  value={
                    secondFactorCode
                  }
                  onChange={(event) => {
                    setSecondFactorCode(
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
                submitting ||
                !secondFactorCode.trim()
              }
            >
              {submitting
                ? "Verifying..."
                : "Verify & Complete"}

              {!submitting && (
                <IconArrow />
              )}
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleStartAgain}
            >
              Start Again
            </button>
          </form>
        </>
      )}

      {step === "success" && (
        <>
          <div className="auth-form-header">
            <h2>Password Reset Complete</h2>

            <p>
              Your account password has been
              updated securely by Clerk.
            </p>
          </div>

          <div
            className="alert alert-success"
            role="status"
          >
            {message}
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              navigate("/login", {
                replace: true,
              });
            }}
          >
            Go to Sign In
            <IconArrow />
          </button>
        </>
      )}
    </AuthLayout>
  );
}

export default ForgotPassword;