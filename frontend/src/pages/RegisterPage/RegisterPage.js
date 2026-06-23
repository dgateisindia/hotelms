import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import hotelBg from '../../assets/images/hotel-bg.jpg';

import '../../styles/LoginPage.css';
import {
  IconBed, IconUsers, IconChart, IconHeadphone,
  IconEmail, IconLock, IconEye, IconArrow,
  IconShield, IconBuilding, IconThumb, IconPhone,
  GoogleLogo, MicrosoftLogo, HotelierCrown,
} from '../../utils/icons/LoginIcons';

const API_BASE_URL = 'http://localhost:5000/api/auth';

function RegisterPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.fullName || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/register`, {
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });

      if (res.status === 201) {
        navigate('/login');
      }
    } catch (err) {
      if (!err.response || err.response.status >= 500) {
        navigate('/500');
      } else {
        setError(err.response?.data?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = () => {
    alert('Google sign-up coming soon!');
  };

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

            <div className="auth-logo">
              <HotelierCrown />
              <div className="auth-logo-text">
                <h1>Hotel Management System</h1>
              </div>
            </div>

            <div className="auth-welcome">
              <h2>Join Us Today!</h2>
              <p>Create an account to get started</p>
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

        {/* ════════════ RIGHT PANEL ════════════ */}
        <div className="auth-panel-right">

          <div className="auth-form-header">
            <h2>Create Account</h2>
            <p>Fill in your details to get started</p>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>

            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Full Name</label>
              <div className="input-wrapper">
                <span className="input-icon"><IconUsers /></span>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  className="form-input"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={handleChange}
                  autoComplete="name"
                />
              </div>
            </div>

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
              <label className="form-label" htmlFor="phone">Phone Number</label>
              <div className="input-wrapper">
                <span className="input-icon"><IconPhone /></span>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="form-input"
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
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
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
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
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Register'}
              {!loading && <IconArrow />}
            </button>

            <div className="auth-divider">
              <span className="auth-divider-line" />
              <span className="auth-divider-text">or continue with</span>
              <span className="auth-divider-line" />
            </div>

            <div className="auth-social-buttons">
              <button type="button" className="btn-social" onClick={handleGoogleRegister}>
                <GoogleLogo />
                Sign up with Google
              </button>
              <button type="button" className="btn-social" onClick={() => {}}>
                <MicrosoftLogo />
                Sign up with Microsoft
              </button>
            </div>

            <p className="auth-signin-link">
              Already have an account?{' '}
              <Link to="/login" className="auth-link-text">Sign In</Link>
            </p>

          </form>
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

export default RegisterPage;