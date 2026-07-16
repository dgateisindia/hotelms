// ============================================================
//  ForgotPassword.js — styled to match LoginPage.js
//  Icons  → imported from LoginIcons.js
//  Styles → imported from LoginPage.css
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useSignIn, useClerk } from '@clerk/clerk-react';
import { useNavigate, Link } from 'react-router-dom';
import hotelBg from '../../assets/images/hotel-bg.jpg';

import '../../styles/LoginPage.css';
import {
  IconBed, IconUsers, IconChart, IconHeadphone,
  IconEmail, IconLock, IconEye, IconArrow,
  IconShield, IconBuilding, IconThumb,
  HotelierCrown,
} from '../../utils/icons/LoginIcons';

// ── Timing constants ──
const CODE_EXPIRY_SECONDS = 60;   // code is treated as expired after this
const RESEND_COOLDOWN_SECONDS = 30; // resend button stays disabled for this long

// ============================================================
//  COMPONENT
// ============================================================
function ForgotPassword() {
  const navigate = useNavigate();
  const { signIn, isLoaded } = useSignIn();
  const { signOut } = useClerk();

  // step: 1 -> email, 2 -> code, 3 -> new password
  const [step, setStep] = useState(1);

  const [email, setEmail]                     = useState('');
  const [otp, setOtp]                         = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword]               = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Countdown state ──
  const [secondsLeft, setSecondsLeft] = useState(CODE_EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const timerRef = useRef(null);

  const codeExpired = secondsLeft <= 0;
  const canResend = resendCooldown <= 0;

  // Start / restart the countdown whenever we land on step 2
  useEffect(() => {
    if (step !== 2) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setSecondsLeft(CODE_EXPIRY_SECONDS);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [step]);

  const restartCountdown = () => {
    setSecondsLeft(CODE_EXPIRY_SECONDS);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Step 1: send code ──
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await signIn.create({
        identifier: email,
        strategy: 'reset_password_email_code',
      });

      setOtp('');
      setSuccess('A verification code has been sent to your email.');
      setStep(2);
    } catch (err) {
      console.error(err);
      setError(err.errors?.[0]?.longMessage || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify code ──
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;

    if (codeExpired) {
      setError('This code has expired. Please request a new one.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: otp,
      });

      console.log(result);
      setSuccess('Code verified. Please set a new password.');
      setStep(3);
    } catch (err) {
      console.error(err);
      setError(err.errors?.[0]?.longMessage || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: reset password ──
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await signIn.resetPassword({ password });

      console.log(result);

      // signIn.resetPassword() activates a session as part of completing
      // the reset flow, even though we never called setActive() ourselves.
      // Explicitly sign out so the user lands on /login in a signed-out
      // state and has to sign in fresh with their new password, rather
      // than seeing "You're already signed in."
      if (result.status === 'complete' || result.status === 'needs_new_password') {
        setSuccess('Password reset successfully. Redirecting to login…');

        try {
          await signOut();
        } catch (signOutErr) {
          console.error('Sign-out after reset failed:', signOutErr);
        }

        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        console.log('Reset status:', result.status);

        try {
          await signOut();
        } catch (signOutErr) {
          console.error('Sign-out after reset failed:', signOutErr);
        }

        navigate('/login');
      }
    } catch (err) {
      console.error(err);
      setError(err.errors?.[0]?.longMessage || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || !canResend) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await signIn.create({
        identifier: email,
        strategy: 'reset_password_email_code',
      });
      setOtp('');
      restartCountdown();
      setSuccess('A new code has been sent to your email.');
    } catch (err) {
      console.error(err);
      setError(err.errors?.[0]?.longMessage || "Couldn't resend the code.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartOver = () => {
    setStep(1);
    setOtp('');
    setError('');
    setSuccess('');
  };

  const stepTitles = {
    1: { title: 'Forgot Password', subtitle: 'Enter your email to receive a verification code' },
    2: { title: 'Enter Verification Code', subtitle: `We've sent a code to ${email || 'your email'}` },
    3: { title: 'Set New Password', subtitle: 'Choose a strong new password for your account' },
  };

  // ── JSX ──
  return (
    <div className="auth-page">
      <div className="auth-container">

        {/* ════════════ LEFT PANEL ════════════ */}
        <div className="auth-panel-left">

          <div
            className="auth-panel-bg"
            style={{ backgroundImage: `url(${hotelBg})` }}
          />

          <div className="auth-panel-content">

            {/* Logo */}
            <div className="auth-logo">
              <HotelierCrown />
              <div className="auth-logo-text">
                <h1>Hotel Management System</h1>
              </div>
            </div>

            {/* Welcome */}
            <div className="auth-welcome">
              <h2>Account Recovery</h2>
              <p>We'll help you get back into your account</p>
            </div>

            {/* Features */}
            <div className="auth-features">
              <div className="auth-feature">
                <div className="auth-feature-icon"><IconBed /></div>
                <div className="auth-feature-text">
                  <h4>Manage Bookings</h4>
                  <p>View and manage all your hotel bookings easily</p>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon"><IconUsers /></div>
                <div className="auth-feature-text">
                  <h4>Guest Management</h4>
                  <p>Manage guest information and stay history</p>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon"><IconChart /></div>
                <div className="auth-feature-text">
                  <h4>Reports &amp; Analytics</h4>
                  <p>Track performance and generate powerful reports</p>
                </div>
              </div>
            </div>

            {/* Help box */}
            <div className="auth-help">
              <div className="auth-help-icon"><IconHeadphone /></div>
              <div className="auth-help-text">
                <h5>Need Help?</h5>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '2px 0' }}>
                  Our support team is always here to help you.
                </p>
                <a href="/support">Contact Support →</a>
              </div>
            </div>

          </div>
        </div>

        {/* ════════════ RIGHT PANEL ════════════ */}
        <div className="auth-panel-right">

          {/* Form header */}
          <div className="auth-form-header">
            <h2>{stepTitles[step].title}</h2>
            <p>{stepTitles[step].subtitle}</p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <span>⚠</span> {error}
            </div>
          )}

          {/* Success alert */}
          {success && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              <span>✓</span> {success}
            </div>
          )}

          {/* STEP 1 — Email */}
          {step === 1 && (
            <form className="auth-form" onSubmit={handleSendOTP} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <span className="input-icon"><IconEmail /></span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-input"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !email}
              >
                {loading ? 'Sending…' : 'Send Verification Code'}
                {!loading && <IconArrow />}
              </button>

              <p className="auth-signin-link" style={{ marginTop: 20, textAlign: 'center' }}>
                Remember your password?{' '}
                <Link to="/login" className="auth-link-text">Sign In</Link>
              </p>
            </form>
          )}

          {/* STEP 2 — Code */}
          {step === 2 && (
            <form className="auth-form" onSubmit={handleVerifyOTP} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="otp">Verification Code</label>
                <div className="input-wrapper">
                  <span className="input-icon"><IconLock /></span>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="form-input"
                    placeholder="Enter the 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    disabled={codeExpired}
                  />
                </div>

                {/* Countdown / expiry messaging */}
                <p
                  style={{
                    fontSize: 13,
                    marginTop: 8,
                    color: codeExpired ? '#dc2626' : 'rgba(0,0,0,0.55)',
                  }}
                >
                  {codeExpired
                    ? 'Code expired. Please request a new one below.'
                    : `Code expires in ${formatTime(secondsLeft)}`}
                </p>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !otp || codeExpired}
              >
                {loading ? 'Verifying…' : 'Verify Code'}
                {!loading && <IconArrow />}
              </button>

              <div className="auth-form-row" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={handleResendCode}
                  disabled={loading || !canResend}
                  style={{ background: 'none', border: 'none', cursor: canResend ? 'pointer' : 'not-allowed' }}
                >
                  {canResend ? 'Resend code' : `Resend in ${resendCooldown}s`}
                </button>
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={handleStartOver}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Start over
                </button>
              </div>
            </form>
          )}

          {/* STEP 3 — New password */}
          {step === 3 && (
            <form className="auth-form" onSubmit={handleResetPassword} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="password">New Password</label>
                <div className="input-wrapper">
                  <span className="input-icon"><IconLock /></span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    className="input-right-icon"
                    onClick={() => setShowPassword(p => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <IconEye open={showPassword} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-wrapper">
                  <span className="input-icon"><IconLock /></span>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    className="input-right-icon"
                    onClick={() => setShowConfirmPassword(p => !p)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <IconEye open={showConfirmPassword} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !password || !confirmPassword}
              >
                {loading ? 'Resetting…' : 'Reset Password'}
                {!loading && <IconArrow />}
              </button>
            </form>
          )}

        </div>
      </div>

      {/* ════════════ FOOTER BAR ════════════ */}
      <div className="auth-footer">
        <div className="auth-footer-item">
          <div className="auth-footer-icon"><IconShield /></div>
          <div className="auth-footer-text">
            <h6>Secure &amp; Safe</h6>
            <p>Your data is 100% secure</p>
          </div>
        </div>
        <div className="auth-footer-item">
          <div className="auth-footer-icon"><IconHeadphone /></div>
          <div className="auth-footer-text">
            <h6>24/7 Support</h6>
            <p>We are here to help</p>
          </div>
        </div>
        <div className="auth-footer-item">
          <div className="auth-footer-icon"><IconBuilding /></div>
          <div className="auth-footer-text">
            <h6>Trusted by Hotels</h6>
            <p>500+ Hotels Worldwide</p>
          </div>
        </div>
        <div className="auth-footer-item">
          <div className="auth-footer-icon"><IconThumb /></div>
          <div className="auth-footer-text">
            <h6>Easy to Use</h6>
            <p>Simple and intuitive interface</p>
          </div>
        </div>
      </div>

    </div>
  );
}

export default ForgotPassword;