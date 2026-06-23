// ============================================================
//  ErrorPages.js — All error pages: 400, 401, 403, 404, 500, 503
//  Style: Split layout, floating bubbles, SVG illustration
//  Each page has its own accent color and character SVG
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/ErrorPage.css';

// ════════════════════════════════════════════════════════════
//  SHARED LAYOUT WRAPPER
// ════════════════════════════════════════════════════════════
const ErrorLayout = ({ code, colorClass, accentColor, oops, title, desc, codeWord, primaryBtn, primaryPath, secondaryBtn, secondaryPath, CharSVG }) => {
  const navigate = useNavigate();
  return (
    <div className={`error-page ${colorClass}`}>
      {/* Background blobs */}
      <div className="error-blob-1" />
      <div className="error-blob-2" />

      <div className="error-content">
        {/* ── LEFT ── */}
        <div className="error-left">
          <div className="error-oops">
            <span className="error-oops-icon">💫</span>
            <h1 className="error-oops-text">
              {oops}<span>!</span>
            </h1>
          </div>

          <div className="error-code-badge" style={{ background: accentColor }}>
            Error {code}
          </div>

          <h2 className="error-title">{title}</h2>
          <p className="error-desc">{desc}</p>

          <div className="error-actions">
            <button className="btn-error-primary" style={{ background: accentColor }} onClick={() => navigate(primaryPath)}>
              {primaryBtn}
            </button>
            {secondaryBtn && (
              <button className="btn-error-secondary" onClick={() => navigate(secondaryPath || -1)}>
                {secondaryBtn}
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="error-right">
          <div className="error-illustration">
            <div className="error-illus-blob" />

            {/* Floating bubbles */}
            <div className="error-bubbles">
              <div className="error-bubble error-bubble-code" style={{ background: accentColor }}>{code}</div>
              <div className="error-bubble error-bubble-word" style={{ color: accentColor }}>{codeWord}</div>
              <div className="error-bubble error-bubble-dots" style={{ background: accentColor }}>• • •</div>
            </div>

            {/* Character SVG */}
            <div className="error-illus-content">
              <CharSVG color={accentColor} />
            </div>
          </div>
        </div>
      </div>

      <div className="error-footer">
        Need help? <a href="/login">Contact Support</a> &nbsp;|&nbsp; © 2024 Hotel Management System
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  SVG CHARACTERS — one unique illustration per error type
// ════════════════════════════════════════════════════════════

// 400 — Person confused with question marks
const Char400 = ({ color }) => (
  <svg viewBox="0 0 300 280" width="300" height="280" fill="none">
    {/* desk */}
    <rect x="40" y="200" width="220" height="12" rx="6" fill={color} opacity="0.2"/>
    {/* laptop */}
    <rect x="90" y="150" width="120" height="80" rx="8" fill="#fff" stroke={color} strokeWidth="3"/>
    <rect x="80" y="228" width="140" height="8" rx="4" fill={color} opacity="0.4"/>
    {/* screen content */}
    <rect x="100" y="162" width="100" height="8" rx="3" fill={color} opacity="0.3"/>
    <rect x="100" y="176" width="70" height="6" rx="3" fill={color} opacity="0.2"/>
    <rect x="100" y="188" width="85" height="6" rx="3" fill={color} opacity="0.2"/>
    {/* body */}
    <ellipse cx="150" cy="130" rx="28" ry="36" fill="#FBBF24"/>
    {/* head */}
    <circle cx="150" cy="88" r="28" fill="#FDE68A"/>
    {/* eyes */}
    <circle cx="141" cy="86" r="4" fill="#1a1f36"/>
    <circle cx="159" cy="86" r="4" fill="#1a1f36"/>
    {/* confused mouth */}
    <path d="M141 98 Q150 94 159 98" stroke="#1a1f36" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    {/* question marks floating */}
    <text x="185" y="70" fontSize="22" fill={color} fontWeight="900" opacity="0.8">?</text>
    <text x="100" y="60" fontSize="18" fill={color} fontWeight="900" opacity="0.6">?</text>
    <text x="200" y="100" fontSize="14" fill={color} fontWeight="900" opacity="0.5">?</text>
    {/* arms */}
    <path d="M122 140 Q100 155 95 165" stroke="#FBBF24" strokeWidth="10" strokeLinecap="round"/>
    <path d="M178 140 Q200 155 205 165" stroke="#FBBF24" strokeWidth="10" strokeLinecap="round"/>
  </svg>
);

// 401 — Person locked out
const Char401 = ({ color }) => (
  <svg viewBox="0 0 300 280" width="300" height="280" fill="none">
    {/* big lock */}
    <rect x="100" y="130" width="100" height="90" rx="12" fill={color} opacity="0.15" stroke={color} strokeWidth="3"/>
    <path d="M120 130 V110 A30 30 0 0 1 180 110 V130" stroke={color} strokeWidth="12" strokeLinecap="round" fill="none"/>
    <circle cx="150" cy="170" r="14" fill={color} opacity="0.8"/>
    <rect x="146" y="170" width="8" height="18" rx="4" fill="#fff"/>
    {/* person standing */}
    <circle cx="220" cy="100" r="22" fill="#FDE68A"/>
    <ellipse cx="220" cy="148" rx="22" ry="30" fill="#3b82f6"/>
    {/* sad eyes */}
    <circle cx="213" cy="98" r="3.5" fill="#1a1f36"/>
    <circle cx="227" cy="98" r="3.5" fill="#1a1f36"/>
    <path d="M213 108 Q220 104 227 108" stroke="#1a1f36" strokeWidth="2" strokeLinecap="round" fill="none"/>
    {/* arms reaching */}
    <path d="M200 138 Q175 155 160 160" stroke="#3b82f6" strokeWidth="9" strokeLinecap="round"/>
    <path d="M240 138 Q250 150 248 168" stroke="#3b82f6" strokeWidth="9" strokeLinecap="round"/>
    {/* ground */}
    <rect x="40" y="226" width="220" height="8" rx="4" fill={color} opacity="0.15"/>
  </svg>
);

// 403 — Person behind barrier/stop sign
const Char403 = ({ color }) => (
  <svg viewBox="0 0 300 280" width="300" height="280" fill="none">
    {/* stop sign */}
    <polygon points="150,60 175,68 188,90 183,115 163,128 137,128 117,115 112,90 125,68" fill={color} opacity="0.15" stroke={color} strokeWidth="3"/>
    <text x="132" y="105" fontSize="24" fill={color} fontWeight="900">STOP</text>
    {/* barrier */}
    <rect x="50" y="190" width="200" height="12" rx="6" fill={color} opacity="0.3"/>
    <rect x="70" y="170" width="12" height="30" rx="4" fill={color} opacity="0.5"/>
    <rect x="140" y="165" width="12" height="35" rx="4" fill={color} opacity="0.5"/>
    <rect x="210" y="170" width="12" height="30" rx="4" fill={color} opacity="0.5"/>
    {/* person behind */}
    <circle cx="230" cy="148" r="22" fill="#FDE68A"/>
    <ellipse cx="230" cy="192" rx="20" ry="26" fill="#ef4444" opacity="0.7"/>
    <circle cx="222" cy="146" r="3" fill="#1a1f36"/>
    <circle cx="238" cy="146" r="3" fill="#1a1f36"/>
    <path d="M222 158 Q230 154 238 158" stroke="#1a1f36" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {/* hand up */}
    <path d="M212 180 Q195 165 190 155" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" opacity="0.7"/>
  </svg>
);

// 404 — Person at laptop looking confused
const Char404 = ({ color }) => (
  <svg viewBox="0 0 300 280" width="300" height="280" fill="none">
    {/* desk */}
    <rect x="40" y="205" width="220" height="12" rx="6" fill={color} opacity="0.2"/>
    {/* chair */}
    <rect x="115" y="218" width="70" height="8" rx="4" fill={color} opacity="0.15"/>
    <rect x="140" y="226" width="20" height="30" rx="4" fill={color} opacity="0.15"/>
    {/* laptop */}
    <rect x="85" y="148" width="130" height="85" rx="10" fill="#fff" stroke={color} strokeWidth="3"/>
    <rect x="75" y="231" width="150" height="8" rx="4" fill={color} opacity="0.35"/>
    {/* laptop screen - shows 404 */}
    <rect x="98" y="162" width="104" height="58" rx="5" fill={color} opacity="0.06"/>
    <text x="118" y="198" fontSize="26" fontWeight="900" fill={color} opacity="0.6">404</text>
    {/* cat */}
    <ellipse cx="68" cy="210" rx="22" ry="16" fill="#5b5bd6"/>
    <ellipse cx="68" cy="194" rx="16" ry="14" fill="#5b5bd6"/>
    <polygon points="56,183 60,170 64,183" fill="#5b5bd6"/>
    <polygon points="72,183 76,170 80,183" fill="#5b5bd6"/>
    <circle cx="63" cy="193" r="2.5" fill="#FFD700"/>
    <circle cx="73" cy="193" r="2.5" fill="#FFD700"/>
    <path d="M63 200 Q68 204 73 200" stroke="#FF9CAC" strokeWidth="1.5" fill="none"/>
    {/* tail */}
    <path d="M46 218 Q30 210 32 196" stroke="#5b5bd6" strokeWidth="6" strokeLinecap="round" fill="none"/>
    {/* person */}
    <circle cx="195" cy="108" r="26" fill="#FDE68A"/>
    <ellipse cx="195" cy="150" rx="24" ry="34" fill="#FBBF24"/>
    {/* hand on chin */}
    <path d="M173 144 Q162 160 168 175" stroke="#FBBF24" strokeWidth="10" strokeLinecap="round"/>
    <path d="M217 144 Q228 148 226 168" stroke="#FBBF24" strokeWidth="10" strokeLinecap="round"/>
    {/* thinking face */}
    <circle cx="188" cy="106" r="4" fill="#1a1f36"/>
    <circle cx="202" cy="106" r="4" fill="#1a1f36"/>
    <path d="M188 116 Q192 112 202 115" stroke="#1a1f36" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    {/* eyebrow worried */}
    <path d="M184 98 Q191 95 196 98" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {/* steam from coffee */}
    <circle cx="246" cy="200" r="10" fill="#ef4444" opacity="0.7"/>
    <path d="M242 195 Q246 188 250 195" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);

// 500 — Server on fire
const Char500 = ({ color }) => (
  <svg viewBox="0 0 300 280" width="300" height="280" fill="none">
    {/* server rack */}
    <rect x="90" y="110" width="120" height="130" rx="8" fill="#fff" stroke={color} strokeWidth="3"/>
    {/* server units */}
    {[120, 150, 180, 210].map((y, i) => (
      <g key={i}>
        <rect x="100" y={y} width="100" height="22" rx="4" fill={color} opacity="0.08" stroke={color} strokeWidth="1.5" strokeOpacity="0.3"/>
        <circle cx="186" cy={y + 11} r="4" fill={i === 1 ? '#ef4444' : '#10b981'}/>
        <rect x="112" y={y + 8} width="55" height="6" rx="3" fill={color} opacity="0.15"/>
      </g>
    ))}
    {/* fire on top of server */}
    <path d="M130 110 Q140 85 150 95 Q155 75 165 90 Q170 70 180 95 Q185 80 195 110" fill="#f97316" opacity="0.9"/>
    <path d="M135 110 Q143 90 150 100 Q157 82 163 98 Q168 85 175 110" fill="#FCD34D" opacity="0.8"/>
    {/* sparks */}
    <circle cx="115" cy="95" r="4" fill="#f97316" opacity="0.7"/>
    <circle cx="200" cy="88" r="5" fill="#FCD34D" opacity="0.6"/>
    <circle cx="108" cy="115" r="3" fill="#ef4444" opacity="0.5"/>
    {/* person panicking */}
    <circle cx="240" cy="150" r="22" fill="#FDE68A"/>
    <ellipse cx="240" cy="192" rx="20" ry="26" fill={color} opacity="0.7"/>
    {/* panicking face */}
    <circle cx="233" cy="148" r="3.5" fill="#1a1f36"/>
    <circle cx="247" cy="148" r="3.5" fill="#1a1f36"/>
    {/* open mouth */}
    <ellipse cx="240" cy="160" rx="6" ry="5" fill="#1a1f36"/>
    {/* arms up in panic */}
    <path d="M222 180 Q205 160 200 145" stroke={color} strokeWidth="9" strokeLinecap="round" opacity="0.7"/>
    <path d="M258 180 Q275 160 278 145" stroke={color} strokeWidth="9" strokeLinecap="round" opacity="0.7"/>
    {/* ground */}
    <rect x="40" y="242" width="220" height="8" rx="4" fill={color} opacity="0.1"/>
  </svg>
);

// 503 — Server under maintenance
const Char503 = ({ color }) => (
  <svg viewBox="0 0 300 280" width="300" height="280" fill="none">
    {/* server */}
    <rect x="80" y="120" width="110" height="110" rx="8" fill="#fff" stroke={color} strokeWidth="3"/>
    {[138, 165, 192].map((y, i) => (
      <g key={i}>
        <rect x="92" y={y} width="86" height="20" rx="4" fill={color} opacity="0.07" stroke={color} strokeWidth="1.2" strokeOpacity="0.3"/>
        <circle cx="166" cy={y + 10} r="3.5" fill={i === 0 ? '#f59e0b' : '#d1d5db'}/>
        <rect x="102" y={y + 7} width="48" height="5" rx="2.5" fill={color} opacity="0.12"/>
      </g>
    ))}
    {/* wrench */}
    <g transform="rotate(-35 220 130)">
      <rect x="205" y="80" width="14" height="60" rx="5" fill={color} opacity="0.7"/>
      <ellipse cx="212" cy="82" rx="12" ry="10" fill={color} opacity="0.5"/>
      <ellipse cx="212" cy="138" rx="10" ry="8" fill={color} opacity="0.5"/>
    </g>
    {/* clock/timer */}
    <circle cx="225" cy="195" r="28" fill="#fff" stroke={color} strokeWidth="3"/>
    <line x1="225" y1="175" x2="225" y2="195" stroke={color} strokeWidth="3" strokeLinecap="round"/>
    <line x1="225" y1="195" x2="238" y2="204" stroke={color} strokeWidth="3" strokeLinecap="round"/>
    {/* person with tools */}
    <circle cx="65" cy="160" r="20" fill="#FDE68A"/>
    <ellipse cx="65" cy="200" rx="18" ry="24" fill={color} opacity="0.6"/>
    <circle cx="59" cy="158" r="3" fill="#1a1f36"/>
    <circle cx="71" cy="158" r="3" fill="#1a1f36"/>
    <path d="M59 168 Q65 172 71 168" stroke="#1a1f36" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {/* tool in hand */}
    <path d="M79 185 Q100 168 115 155" stroke={color} strokeWidth="8" strokeLinecap="round" opacity="0.6"/>
    <rect x="112" y="148" width="20" height="10" rx="4" fill={color} opacity="0.8" transform="rotate(-35 112 148)"/>
    {/* ground */}
    <rect x="30" y="235" width="240" height="8" rx="4" fill={color} opacity="0.1"/>
  </svg>
);

// ════════════════════════════════════════════════════════════
//  INDIVIDUAL ERROR PAGE EXPORTS
// ════════════════════════════════════════════════════════════

export function Error400() {
  return (
    <ErrorLayout
      code="400"
      colorClass="error-400"
      accentColor="#f59e0b"
      oops="Oooops"
      title="Bad Request!"
      desc="We couldn't understand your request. Something seems off with the data you sent. Please check and try again."
      codeWord="bad request"
      primaryBtn="↩ Back to Home"
      primaryPath="/dashboard"
      secondaryBtn="Go Back"
      secondaryPath={-1}
      CharSVG={Char400}
    />
  );
}

export function Error401() {
  return (
    <ErrorLayout
      code="401"
      colorClass="error-401"
      accentColor="#3b82f6"
      oops="Oooops"
      title="Unauthorized Access!"
      desc="You need to be logged in to access this page. Please sign in with your credentials and try again."
      codeWord="unauthorized"
      primaryBtn="🔑 Sign In"
      primaryPath="/login"
      secondaryBtn="Go Back"
      secondaryPath={-1}
      CharSVG={Char401}
    />
  );
}

export function Error403() {
  return (
    <ErrorLayout
      code="403"
      colorClass="error-403"
      accentColor="#ef4444"
      oops="Oooops"
      title="Access Forbidden!"
      desc="You don't have permission to access this page. Only administrators are allowed here. Contact your admin for access."
      codeWord="forbidden"
      primaryBtn="↩ Back to Home"
      primaryPath="/dashboard"
      secondaryBtn="Contact Admin"
      secondaryPath="/settings"
      CharSVG={Char403}
    />
  );
}

export function Error404() {
  return (
    <ErrorLayout
      code="404"
      colorClass="error-404"
      accentColor="#6c63ff"
      oops="Oooops"
      title="Page Not Found!"
      desc="We can't seem to find the page you're looking for. It may have been moved, deleted, or never existed."
      codeWord="not found"
      primaryBtn="↩ Back to Home"
      primaryPath="/dashboard"
      secondaryBtn="Go Back"
      secondaryPath={-1}
      CharSVG={Char404}
    />
  );
}

export function Error500() {
  return (
    <ErrorLayout
      code="500"
      colorClass="error-500"
      accentColor="#8b5cf6"
      oops="Oooops"
      title="Internal Server Error!"
      desc="Something went wrong on our end. Our team has been notified and we're working on a fix. Please try again later."
      codeWord="server error"
      primaryBtn="↩ Back to Home"
      primaryPath="/dashboard"
      secondaryBtn="Try Again"
      secondaryPath={0}
      CharSVG={Char500}
    />
  );
}

export function Error503() {
  return (
    <ErrorLayout
      code="503"
      colorClass="error-503"
      accentColor="#10b981"
      oops="Oooops"
      title="Service Unavailable!"
      desc="Our server is temporarily down for maintenance. We'll be back shortly. Thank you for your patience!"
      codeWord="unavailable"
      primaryBtn="↩ Back to Home"
      primaryPath="/dashboard"
      secondaryBtn="Check Status"
      secondaryPath="/notifications"
      CharSVG={Char503}
    />
  );
}

// Default export = 404 (most common)
export default Error404;
