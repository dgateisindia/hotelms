// ============================================================
//  ProfileModal.js — Admin profile editor (custom UI over Clerk)
//  - Edit name (instant), email (Clerk email-code verification),
//    phone (Clerk SMS verification), password (current + new)
//  - Full client-side validation per section, in addition to
//    whatever Clerk itself enforces server-side.
//  - "Done" signs the admin out and sends them to /login so they
//    re-authenticate — satisfies "edit → verify → re-login" flow.
//
//  NOTE: This only updates the admin's record in Clerk. If your
//  MySQL `admins` table also stores name/email/phone separately,
//  those columns will NOT auto-update — you'd need a Clerk webhook
//  (user.updated) to sync them back. Ask me if you want that added.
// ============================================================
import React, { useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[1-9]\d{7,14}$/; // loose E.164: 8–15 digits, optional leading +
const CODE_RE  = /^\d{4,8}$/;

const fieldErrorStyle = { color: '#b91c1c', fontSize: 12, marginTop: 4 };

function ProfileModal({ onClose }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  // ── Name ──
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName]   = useState(user?.lastName || '');
  const [nameError, setNameError] = useState('');

  // ── Email ──
  const currentEmail = user?.primaryEmailAddress?.emailAddress || '';
  const [newEmail, setNewEmail]             = useState('');
  const [emailStage, setEmailStage]         = useState('idle'); // idle | code-sent
  const [emailCode, setEmailCode]           = useState('');
  const [pendingEmailId, setPendingEmailId] = useState(null);
  const [emailFieldError, setEmailFieldError] = useState('');
  const [emailCodeError, setEmailCodeError]   = useState('');

  // ── Phone ──
  const currentPhone = user?.primaryPhoneNumber?.phoneNumber || '';
  const [newPhone, setNewPhone]             = useState('');
  const [phoneStage, setPhoneStage]         = useState('idle'); // idle | code-sent
  const [phoneCode, setPhoneCode]           = useState('');
  const [pendingPhoneId, setPendingPhoneId] = useState(null);
  const [phoneFieldError, setPhoneFieldError] = useState('');
  const [phoneCodeError, setPhoneCodeError]   = useState('');

  // ── Password ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors]   = useState({});

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(''); // server-side / Clerk errors

  const toast = (title) =>
    Swal.fire({ icon: 'success', title, timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });

  // ────────────────────────────────────────────────────────
  //  Live validity (drives disabled state on each button)
  // ────────────────────────────────────────────────────────
  const nameValid = firstName.trim().length > 0;

  const emailValid =
    EMAIL_RE.test(newEmail.trim()) &&
    newEmail.trim().toLowerCase() !== currentEmail.toLowerCase();

  const emailCodeValid = CODE_RE.test(emailCode.trim());

  const phoneValid =
    PHONE_RE.test(newPhone.trim().replace(/\s+/g, '')) &&
    newPhone.trim().replace(/\s+/g, '') !== currentPhone.replace(/\s+/g, '');

  const phoneCodeValid = CODE_RE.test(phoneCode.trim());

  const passwordValid =
    currentPassword.trim().length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  // ── Name save (instant, no verification needed) ──
  const saveName = async () => {
    setError('');
    setNameError('');
    if (!firstName.trim()) {
      setNameError('First name is required.');
      return;
    }
    try {
      await user.update({ firstName: firstName.trim(), lastName: lastName.trim() });
      toast('Name updated');
    } catch (err) {
      setError(err?.errors?.[0]?.message || 'Could not update name.');
    }
  };

  // ── Email flow ──
  const sendEmailCode = async () => {
    setError('');
    setEmailFieldError('');
    const trimmed = newEmail.trim();
    if (!trimmed) {
      setEmailFieldError('Enter a new email address.');
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setEmailFieldError('Enter a valid email address.');
      return;
    }
    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      setEmailFieldError('This is already your current email.');
      return;
    }
    try {
      const emailAddress = await user.createEmailAddress({ email: trimmed });
      await emailAddress.prepareVerification({ strategy: 'email_code' });
      setPendingEmailId(emailAddress.id);
      setEmailStage('code-sent');
    } catch (err) {
      setError(err?.errors?.[0]?.message || 'Could not send verification code.');
    }
  };

  const confirmEmailCode = async () => {
    setError('');
    setEmailCodeError('');
    if (!CODE_RE.test(emailCode.trim())) {
      setEmailCodeError('Enter the numeric code from your email.');
      return;
    }
    try {
      const emailAddress = user.emailAddresses.find((e) => e.id === pendingEmailId);
      await emailAddress.attemptVerification({ code: emailCode.trim() });
      await user.update({ primaryEmailAddressId: pendingEmailId });
      setEmailStage('idle');
      setNewEmail('');
      setEmailCode('');
      setPendingEmailId(null);
      toast('Email updated & verified');
    } catch (err) {
      setError(err?.errors?.[0]?.message || 'Invalid or expired code.');
    }
  };

  // ── Phone flow ──
  const sendPhoneCode = async () => {
    setError('');
    setPhoneFieldError('');
    const trimmed = newPhone.trim().replace(/\s+/g, '');
    if (!trimmed) {
      setPhoneFieldError('Enter a new phone number.');
      return;
    }
    if (!PHONE_RE.test(trimmed)) {
      setPhoneFieldError('Enter a valid phone number, e.g. +919876543210.');
      return;
    }
    if (trimmed === currentPhone.replace(/\s+/g, '')) {
      setPhoneFieldError('This is already your current phone number.');
      return;
    }
    try {
      const phoneNumber = await user.createPhoneNumber({ phoneNumber: newPhone.trim() });
      await phoneNumber.prepareVerification();
      setPendingPhoneId(phoneNumber.id);
      setPhoneStage('code-sent');
    } catch (err) {
      setError(err?.errors?.[0]?.message || 'Could not send verification code.');
    }
  };

  const confirmPhoneCode = async () => {
    setError('');
    setPhoneCodeError('');
    if (!CODE_RE.test(phoneCode.trim())) {
      setPhoneCodeError('Enter the numeric code from the SMS.');
      return;
    }
    try {
      const phoneNumber = user.phoneNumbers.find((p) => p.id === pendingPhoneId);
      await phoneNumber.attemptVerification({ code: phoneCode.trim() });
      await user.update({ primaryPhoneNumberId: pendingPhoneId });
      setPhoneStage('idle');
      setNewPhone('');
      setPhoneCode('');
      setPendingPhoneId(null);
      toast('Phone updated & verified');
    } catch (err) {
      setError(err?.errors?.[0]?.message || 'Invalid or expired code.');
    }
  };

  // ── Password ──
  const savePassword = async () => {
    setError('');
    const errs = {};
    if (!currentPassword.trim()) errs.currentPassword = 'Current password is required.';
    if (newPassword.length < 8) errs.newPassword = 'New password must be at least 8 characters.';
    if (newPassword && newPassword === currentPassword) errs.newPassword = 'New password must be different from the current one.';
    if (confirmPassword !== newPassword) errs.confirmPassword = 'Passwords do not match.';
    setPasswordErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await user.updatePassword({
        currentPassword,
        newPassword,
        signOutOfOtherSessions: true,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
      toast('Password updated');
    } catch (err) {
      setError(err?.errors?.[0]?.message || 'Could not update password. Check your current password.');
    }
  };

  // ── Finish: log out and send back to login for re-auth ──
 const handleDone = async () => {
  setError("");

  const nameChanged =
    firstName.trim() !== (user?.firstName || "") ||
    lastName.trim() !== (user?.lastName || "");

  const emailChanged = newEmail.trim() !== "";

  const phoneChanged = newPhone.trim() !== "";

  const passwordChanged =
    currentPassword.trim() !== "" ||
    newPassword.trim() !== "" ||
    confirmPassword.trim() !== "";

  if (
    !nameChanged &&
    !emailChanged &&
    !phoneChanged &&
    !passwordChanged
  ) {
    Swal.fire({
      icon: "warning",
      title: "Required",
      text: "Please update at least one field before clicking Done.",
      confirmButtonColor: "#3085d6",
    });

    return;
  }

  setSaving(true);

  try {
    await signOut();
    onClose();
    navigate("/login");
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Profile</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div
              className="phone-found-banner"
              style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' }}
            >
              {error}
            </div>
          )}

          {/* ── Name ── */}
          <div className="modal-section-title">Name</div>
          <div className="modal-grid">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              {nameError && <div style={fieldErrorStyle}>{nameError}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <button className="btn-add-room-row" onClick={saveName} disabled={!nameValid} style={{ marginTop: 8 }}>
            Save Name
          </button>

          {/* ── Email ── */}
          <div className="modal-section-title" style={{ marginTop: 24 }}>Email</div>
          <div className="modal-grid">
            <div className="form-group">
              <label className="form-label">Current Email</label>
              <input className="form-input" value={currentEmail} disabled />
            </div>
            {emailStage === 'idle' ? (
              <div className="form-group">
                <label className="form-label">New Email</label>
                <input
                  className="form-input"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@email.com"
                />
                {emailFieldError && <div style={fieldErrorStyle}>{emailFieldError}</div>}
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <input
                  className="form-input"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  placeholder="Enter code sent to new email"
                  inputMode="numeric"
                />
                {emailCodeError && <div style={fieldErrorStyle}>{emailCodeError}</div>}
              </div>
            )}
          </div>
          {emailStage === 'idle' ? (
            <button
              className="btn-add-room-row"
              onClick={sendEmailCode}
              disabled={!emailValid}
              style={{ marginTop: 8 }}
            >
              Send Verification Code
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn-add-room-row" onClick={confirmEmailCode} disabled={!emailCodeValid}>
                Confirm Code
              </button>
              <button
                className="btn-remove-room"
                onClick={() => { setEmailStage('idle'); setEmailCode(''); setEmailCodeError(''); }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── Phone ── */}
          <div className="modal-section-title" style={{ marginTop: 24 }}>Phone Number</div>
          <div className="modal-grid">
            <div className="form-group">
              <label className="form-label">Current Phone</label>
              <input className="form-input" value={currentPhone || 'Not set'} disabled />
            </div>
            {phoneStage === 'idle' ? (
              <div className="form-group">
                <label className="form-label">New Phone</label>
                <input
                  className="form-input"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 00000 00000"
                />
                {phoneFieldError && <div style={fieldErrorStyle}>{phoneFieldError}</div>}
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <input
                  className="form-input"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  placeholder="Enter code sent via SMS"
                  inputMode="numeric"
                />
                {phoneCodeError && <div style={fieldErrorStyle}>{phoneCodeError}</div>}
              </div>
            )}
          </div>
          {phoneStage === 'idle' ? (
            <button
              className="btn-add-room-row"
              onClick={sendPhoneCode}
              disabled={!phoneValid}
              style={{ marginTop: 8 }}
            >
              Send Verification Code
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn-add-room-row" onClick={confirmPhoneCode} disabled={!phoneCodeValid}>
                Confirm Code
              </button>
              <button
                className="btn-remove-room"
                onClick={() => { setPhoneStage('idle'); setPhoneCode(''); setPhoneCodeError(''); }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── Password ── */}
          <div className="modal-section-title" style={{ marginTop: 24 }}>Password</div>
          <div className="modal-grid">
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                className="form-input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              {passwordErrors.currentPassword && <div style={fieldErrorStyle}>{passwordErrors.currentPassword}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                className="form-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {passwordErrors.newPassword && <div style={fieldErrorStyle}>{passwordErrors.newPassword}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                className="form-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {passwordErrors.confirmPassword && <div style={fieldErrorStyle}>{passwordErrors.confirmPassword}</div>}
            </div>
          </div>
          <button
            className="btn-add-room-row"
            onClick={savePassword}
            disabled={!passwordValid}
            style={{ marginTop: 8 }}
          >
            Save Password
          </button>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Close</button>
          <button className="btn-save" onClick={handleDone} disabled={saving}>
            {saving ? 'Logging out…' : 'Done — Log Out & Re-login'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;