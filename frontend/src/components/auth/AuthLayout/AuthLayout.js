import React from "react";
import { Link } from "react-router-dom";

import hotelBg from "../../../assets/images/hotel-bg.jpg";

import {
  IconBed,
  IconBuilding,
  IconChart,
  IconHeadphone,
  IconShield,
  IconThumb,
  IconUsers,
  HotelierCrown,
} from "../../../utils/icons/LoginIcons";

/**
 * Shared layout for:
 * - Login
 * - Forgot Password
 * - Reset Password
 * - Authentication verification pages
 *
 * Page-specific forms are passed through children.
 */
function AuthLayout({
  children,
  welcomeTitle = "Welcome Back!",
  welcomeDescription = "Sign in to continue to your account",
}) {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <section className="auth-panel-left">
          <div
            className="auth-panel-bg"
            style={{
              backgroundImage: `url(${hotelBg})`,
            }}
            aria-hidden="true"
          />

          <div className="auth-panel-content">
            <div className="auth-logo">
              <HotelierCrown />

              <div className="auth-logo-text">
                <h1>Hotel Management System</h1>
              </div>
            </div>

            <div className="auth-welcome">
              <h2>{welcomeTitle}</h2>

              <p>{welcomeDescription}</p>
            </div>

            <div className="auth-features">
              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <IconBed />
                </div>

                <div className="auth-feature-text">
                  <h4>Manage Bookings</h4>

                  <p>
                    View and manage hotel bookings securely
                  </p>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <IconUsers />
                </div>

                <div className="auth-feature-text">
                  <h4>Guest Management</h4>

                  <p>
                    Manage guest information and stay history
                  </p>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <IconChart />
                </div>

                <div className="auth-feature-text">
                  <h4>Reports &amp; Analytics</h4>

                  <p>
                    Track hotel performance and business reports
                  </p>
                </div>
              </div>
            </div>

            <div className="auth-help">
              <div className="auth-help-icon">
                <IconHeadphone />
              </div>

              <div className="auth-help-text">
                <h5>Need Help?</h5>

                <p>
                  Our support team is available to help you.
                </p>

                <Link to="/support">
                  Contact Support →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-panel-right">
          {children}
        </section>
      </div>

      <footer className="auth-footer">
        <div className="auth-footer-item">
          <div className="auth-footer-icon">
            <IconShield />
          </div>

          <div className="auth-footer-text">
            <h6>Secure &amp; Safe</h6>
            <p>Authentication by Clerk</p>
          </div>
        </div>

        <div className="auth-footer-item">
          <div className="auth-footer-icon">
            <IconHeadphone />
          </div>

          <div className="auth-footer-text">
            <h6>Support</h6>
            <p>Help when you need it</p>
          </div>
        </div>

        <div className="auth-footer-item">
          <div className="auth-footer-icon">
            <IconBuilding />
          </div>

          <div className="auth-footer-text">
            <h6>Multi-Hotel</h6>
            <p>Manage multiple properties</p>
          </div>
        </div>

        <div className="auth-footer-item">
          <div className="auth-footer-icon">
            <IconThumb />
          </div>

          <div className="auth-footer-text">
            <h6>Easy to Use</h6>
            <p>Simple operational workflow</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AuthLayout;