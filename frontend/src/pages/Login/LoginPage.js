import React, { useState } from 'react';
import { useSignIn, useAuth } from "@clerk/clerk-react";
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import hotelBg from '../../assets/images/hotel-bg.jpg';

import '../../styles/LoginPage.css';
import {
  IconBed, IconUsers, IconChart, IconHeadphone,
  IconEmail, IconLock, IconEye, IconArrow,
  IconShield, IconBuilding, IconThumb,
  IconGlobe, IconChevron,
  GoogleLogo, HotelierCrown,
} from '../../utils/icons/LoginIcons';

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, setActive } = useSignIn();
  const { getToken } = useAuth();

  const [formData, setFormData]         = useState({ email: '', password: '', rememberMe: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  const [step, setStep]                     = useState('credentials');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyLoading, setVerifyLoading]       = useState(false);
  const [resendLoading, setResendLoading]       = useState(false);
  const [resendMessage, setResendMessage]       = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleChangeCode = (e) => {
    setVerificationCode(e.target.value);
  };

  const prepareEmailCodeFactor = async () => {
    const supportedSecondFactors = signIn.supportedSecondFactors || [];
    const emailFactor = supportedSecondFactors.find(
      (f) => f.strategy === 'email_code'
    );

    if (emailFactor) {
      await signIn.prepareSecondFactor({
        strategy: 'email_code',
        emailAddressId: emailFactor.emailAddressId,
      });
    } else {
      await signIn.prepareSecondFactor({ strategy: 'email_code' });
    }
  };

  // ── Shared success toast, fired right before navigating to dashboard ──
  const showLoginSuccessToast = () => {
    Swal.fire({
      icon: 'success',
      title: 'Welcome back!',
      text: 'You have signed in successfully.',
      timer: 2000,
      timerProgressBar: true,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier: formData.email,
        password: formData.password,
      });

      switch (result.status) {

        case "complete":
          await setActive({ session: result.createdSessionId });

          const token = await getToken();
          console.log("TOKEN:", token);

          showLoginSuccessToast();
          navigate("/login"); // PostLoginRedirect will route based on role
          break;

        case "needs_second_factor":
        case "needs_client_trust":
          try {
            await prepareEmailCodeFactor();
            setStep('verify');
          } catch (prepErr) {
            console.error(prepErr);
            setError(
              prepErr.errors?.[0]?.longMessage ||
              "Couldn't send a verification code. Please try again."
            );
          }
          break;

        case "needs_first_factor":
          setError("Password is incorrect.");
          break;

        default:
          setError("Unable to sign in.");
      }

    } catch (err) {
      console.error(err);
      setError(err.errors?.length ? err.errors[0].longMessage : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();

    setVerifyLoading(true);
    setError("");

    try {
      const result = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: verificationCode,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });

        const token = await getToken();
        console.log("TOKEN:", token);

        showLoginSuccessToast();
        navigate("/login"); // PostLoginRedirect will route based on role
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError(
        err.errors?.length ? err.errors[0].longMessage : "Invalid or expired code. Please try again."
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setResendMessage('');
    setError('');

    try {
      await prepareEmailCodeFactor();
      setResendMessage('A new code has been sent to your email.');
    } catch (err) {
      console.error(err);
      setError(
        err.errors?.[0]?.longMessage || "Couldn't resend the code. Please try again."
      );
    } finally {
      setResendLoading(false);
    }
  };

  const handleStartOver = () => {
    setStep('credentials');
    setVerificationCode('');
    setError('');
    setResendMessage('');
  };

  const handleGoogleLogin = () => {
    alert('Google login coming soon!');
  };

  return (
    <div className="auth-page">
      <div className="auth-container">

        <div className="auth-panel-left">
          <div
            className="auth-panel-bg"
            style={{ backgroundImage: `url(${hotelBg})` }}
          />
          <div className="auth-panel-content">
            <div className="auth-logo">
              <HotelierCrown />
              <div className="auth-logo-text">
                <h1>Hotel Management System</h1>
              </div>
            </div>

            <div className="auth-welcome">
              <h2>Welcome Back!</h2>
              <p>Sign in to continue to your account</p>
            </div>

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

        <div className="auth-panel-right">

          {step === 'credentials' ? (
            <>
              <div className="auth-form-header">
                <h2>Sign In</h2>
                <p>Enter your credentials to access your account</p>
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <span>⚠</span> {error}
                </div>
              )}

              <form className="auth-form" onSubmit={handleSubmit} noValidate>

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
                      value={formData.email}
                      onChange={handleChange}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="password">Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><IconLock /></span>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="current-password"
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

                <div className="auth-form-row">
                  <label className="checkbox-group">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                    />
                    <span className="checkbox-label">Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="auth-forgot-link">Forgot Password?</Link>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                  {!loading && <IconArrow />}
                </button>

                <div className="auth-divider">
                  <span className="auth-divider-line" />
                  <span className="auth-divider-text">or continue with</span>
                  <span className="auth-divider-line" />
                </div>

                <div className="auth-social-buttons">
                  <button type="button" className="btn-social" onClick={handleGoogleLogin}>
                    <GoogleLogo />
                    Sign in with Google
                  </button>
                </div>

              </form>
            </>
          ) : (
            <>
              <div className="auth-form-header">
                <h2>Verify Your Identity</h2>
                <p>
                  We've sent a verification code to <strong>{formData.email}</strong>.
                  Enter it below to continue.
                </p>
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <span>⚠</span> {error}
                </div>
              )}

              {resendMessage && (
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  <span>✓</span> {resendMessage}
                </div>
              )}

              <form className="auth-form" onSubmit={handleVerifyCode} noValidate>

                <div className="form-group">
                  <label className="form-label" htmlFor="verificationCode">Verification Code</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><IconLock /></span>
                    <input
                      id="verificationCode"
                      name="verificationCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="form-input"
                      placeholder="Enter the 6-digit code"
                      value={verificationCode}
                      onChange={handleChangeCode}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={verifyLoading || !verificationCode}
                >
                  {verifyLoading ? 'Verifying…' : 'Verify & Sign In'}
                  {!verifyLoading && <IconArrow />}
                </button>

                <div className="auth-form-row" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={handleResendCode}
                    disabled={resendLoading}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {resendLoading ? 'Sending…' : 'Resend code'}
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
            </>
          )}
        </div>
      </div>

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

export default LoginPage;