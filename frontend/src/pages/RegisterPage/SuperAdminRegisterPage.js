// ============================================================
// SuperAdminRegisterPage.js
// Same UI as LoginPage
// ============================================================

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";

import { registerSuperAdmin } from "../../services/authService";

import hotelBg from "../../assets/images/hotel-bg.jpg";

import "../../styles/LoginPage.css";

import {
  IconBed,
  IconUsers,
  IconChart,
  IconHeadphone,
  IconEmail,
  IconLock,
  IconEye,
  IconArrow,
  IconShield,
  IconBuilding,
  IconThumb,
  HotelierCrown,
} from "../../utils/icons/LoginIcons";

function SuperAdminRegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (
      !form.full_name ||
      !form.email ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please fill all fields.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await registerSuperAdmin(form);

      await Swal.fire({
        icon: "success",
        title: "Registration Successful",
        text:
          res.data.message ||
          "Super Admin registered successfully.",
        confirmButtonText: "Continue",
      });

      navigate("/login");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  };
    return (
    <div className="auth-page">
      <div className="auth-container">

        {/* ================= LEFT PANEL ================= */}

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
              <h2>Create Your Super Admin Account</h2>

              <p>
                Register the first Super Admin to manage hotels,
                admins and the complete Hotel Management System.
              </p>
            </div>

            {/* Features */}

            <div className="auth-features">

              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <IconBed />
                </div>

                <div className="auth-feature-text">
                  <h4>Manage Hotels</h4>

                  <p>
                    Create and manage multiple hotels from one dashboard.
                  </p>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <IconUsers />
                </div>

                <div className="auth-feature-text">
                  <h4>Create Hotel Admins</h4>

                  <p>
                    Assign administrators securely for every hotel.
                  </p>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <IconChart />
                </div>

                <div className="auth-feature-text">
                  <h4>Centralized Dashboard</h4>

                  <p>
                    Track hotels, bookings, reports and performance.
                  </p>
                </div>
              </div>

            </div>

            {/* Help */}

            <div className="auth-help">

              <div className="auth-help-icon">
                <IconHeadphone />
              </div>

              <div className="auth-help-text">

                <h5>Need Help?</h5>

                <p
                  style={{
                    color: "rgba(255,255,255,.6)",
                    fontSize: 13,
                    margin: "2px 0",
                  }}
                >
                  Our support team is always here to help.
                </p>

                <a href="/support">
                  Contact Support →
                </a>

              </div>

            </div>

          </div>

        </div>

        {/* ================= RIGHT PANEL ================= */}

        <div className="auth-panel-right">

          <div className="auth-form-header">

            <h2>Super Admin Registration</h2>

            <p>
              Create your Super Admin account to get started.
            </p>

          </div>

          {error && (
            <div
              className="alert alert-error"
              style={{ marginBottom: 18 }}
            >
              ⚠ {error}
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={handleSubmit}
            noValidate
          >

            {/* Full Name */}

            <div className="form-group">

              <label className="form-label">
                Full Name
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  <IconUsers />
                </span>

                <input
                  type="text"
                  name="full_name"
                  className="form-input"
                  placeholder="Enter full name"
                  value={form.full_name}
                  onChange={handleChange}
                />

              </div>

            </div>

            {/* Email */}

            <div className="form-group">

              <label className="form-label">
                Email Address
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  <IconEmail />
                </span>

                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="Enter email"
                  value={form.email}
                  onChange={handleChange}
                />

              </div>

            </div>
                        {/* Password */}

            <div className="form-group">

              <label className="form-label">
                Password
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  <IconLock />
                </span>

                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="form-input"
                  placeholder="Enter password"
                  value={form.password}
                  onChange={handleChange}
                  style={{ paddingRight: 45 }}
                />

                <button
                  type="button"
                  className="input-right-icon"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <IconEye open={showPassword} />
                </button>

              </div>

            </div>

            {/* Confirm Password */}

            <div className="form-group">

              <label className="form-label">
                Confirm Password
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  <IconLock />
                </span>

                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  className="form-input"
                  placeholder="Confirm password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  style={{ paddingRight: 45 }}
                />

                <button
                  type="button"
                  className="input-right-icon"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                >
                  <IconEye open={showConfirmPassword} />
                </button>

              </div>

            </div>

            {/* Register Button */}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? "Registering..." : "Register Super Admin"}

              {!loading && <IconArrow />}
            </button>

            {/* Divider */}

            <div className="divider">
              Already have an account?
            </div>

            {/* Login Link */}

            <div className="auth-signup-link">

              <Link to="/login">
                Sign In
              </Link>

            </div>

          </form>

        </div>

      </div>

      {/* ================= FOOTER ================= */}

      <div className="auth-footer">

        <div className="auth-footer-item">
          <div className="auth-footer-icon">
            <IconShield />
          </div>

          <div className="auth-footer-text">
            <h6>Secure & Safe</h6>
            <p>Your data is protected.</p>
          </div>
        </div>

        <div className="auth-footer-item">
          <div className="auth-footer-icon">
            <IconHeadphone />
          </div>

          <div className="auth-footer-text">
            <h6>24/7 Support</h6>
            <p>Always available.</p>
          </div>
        </div>

        <div className="auth-footer-item">
          <div className="auth-footer-icon">
            <IconBuilding />
          </div>

          <div className="auth-footer-text">
            <h6>Trusted Hotels</h6>
            <p>Manage multiple hotels.</p>
          </div>
        </div>

        <div className="auth-footer-item">
          <div className="auth-footer-icon">
            <IconThumb />
          </div>

          <div className="auth-footer-text">
            <h6>Easy to Use</h6>
            <p>Modern and simple interface.</p>
          </div>
        </div>

      </div>

    </div>
  );
}

export default SuperAdminRegisterPage;