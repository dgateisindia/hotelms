// ============================================================
//  LoginPage.js — Only logic, state, and JSX (HTML structure)
//  Icons  → imported from LoginIcons.js
//  Styles → imported from LoginPage.css
// ============================================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import hotelBg from '../../assets/images/hotel-bg.jpg';
import axios from 'axios';
import Swal from 'sweetalert2';
// ── Separate files ──
import './LoginPage.css';
import {
  IconBed, IconUsers, IconChart, IconHeadphone,
  IconEmail, IconLock, IconEye, IconArrow,
  IconShield, IconBuilding, IconThumb,
  IconGlobe, IconChevron,
  GoogleLogo, MicrosoftLogo, HotelierCrown,
} from './LoginIcons';

// ============================================================
//  COMPONENT
// ============================================================
function LoginPage() {
  const navigate = useNavigate();

  // ── State ──
  const [formData, setFormData]       = useState({ email: '', password: '', rememberMe: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  // ── Handlers ──
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

 const handleSubmit = async (e) => {
  e.preventDefault();

  console.log("Login button clicked");
  setError('');

  if (!formData.email || !formData.password) {
    setError('Please enter your email and password.');
    return;
  }

  setLoading(true);

  try {
    console.log("Sending login request...");

    const response = await axios.post(
      'http://localhost:5000/api/auth/login',
      {
        email: formData.email,
        password: formData.password,
      }
    );

    console.log("Response:", response.data);

    if (response.data.success) {
      // Save token
      localStorage.setItem('token', response.data.token);

      // Save user data
      localStorage.setItem(
        'user',
        JSON.stringify(response.data.user)
      );

      // Success popup
      await Swal.fire({
        icon: 'success',
        title: 'Welcome Back!',
        text: 'You have successfully logged in.',
        confirmButtonText: 'Continue',
        confirmButtonColor: '#0f1f63',
        allowOutsideClick: false,
        allowEscapeKey: false,
      });

      // Redirect after clicking Continue
      navigate('/dashboard');
    }
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    const errorMessage =
      err.response?.data?.message ||
      err.message ||
      'Invalid email or password.';

    setError(errorMessage);

    // Error popup
    Swal.fire({
      icon: 'error',
      title: 'Login Failed',
      text: errorMessage,
      confirmButtonText: 'OK',
    });
  } finally {
    setLoading(false);
  }
};
  // ── JSX (HTML structure) ──
  return (
    <div className="auth-page">
      <div className="auth-container">

        {/* ════════════ LEFT PANEL ════════════ */}
        <div className="auth-panel-left">

          {/* Background image */}
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
              <h2>Welcome Back!</h2>
              <p>Sign in to continue to your account</p>
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

          {/* Language picker */}
          <div className="auth-lang-selector">
            <IconGlobe />
            <span>English</span>
            <IconChevron />
          </div>

          {/* Form header */}
          <div className="auth-form-header">
            <h2>Sign In</h2>
            <p>Enter your credentials to access your account</p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <span>⚠</span> {error}
            </div>
          )}

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit} noValidate>

            {/* Email field */}
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

            {/* Password field */}
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

            {/* Remember me + Forgot password */}
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
              <Link to="/ForgotPassword" className="auth-forgot-link">Forgot Password?</Link>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
              {!loading && <IconArrow />}
            </button>

          </form>
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

export default LoginPage;
