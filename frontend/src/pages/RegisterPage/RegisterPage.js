// ============================================================
//  RegisterPage.js — Hotel Registration (logic + JSX only)
//  Step 1: Admin Account Details
//  Step 2: Hotel Information (name, type, desc, star, year, GST, PAN, reg no, logo)
//  Step 3: Review & Submit
//  Icons  → ../../utils/icons/RegisterIcons.js
//  Styles → ../../styles/RegisterPage.css
// ============================================================
import swal from 'sweetalert2';
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/RegisterPage.css';
import {
  IconHotel, IconType, IconDesc, IconStar, IconYear,
  IconGST, IconPAN, IconReg, IconUpload, IconArrow,
  IconCheck, IconEmail, IconLock, IconPhone, IconUser,
  IconEye, GoogleLogo, HotelierCrown,
} from '../../utils/icons/RegisterIcons';
import axios from 'axios';

// ── Hotel type options ───────────────────────────────────────
const HOTEL_TYPES = [
  'Resort',
  'Business Hotel',
  'Budget Hotel',
  'Boutique Hotel',
  'Homestay',
  'Lodge',
];

// ── Step definitions ─────────────────────────────────────────
const STEPS = [
  { label: 'Account',  num: 1 },
  { label: 'Hotel Info', num: 2 },
  { label: 'Review',   num: 3 },
];

// ── Empty form ───────────────────────────────────────────────
const EMPTY_FORM = {
  adminName: '',
  adminEmail: '',
  adminPhone: '',
  password: '',
  confirmPassword: '',

  hotelName: '',
  hotelType: '',
  hotelDesc: '',
  starRating: 0,
  yearEstablished: '',
  gstNumber: '',
  panNumber: '',
  businessRegNumber: '',
  hotelLogo: null,

  agreeTerms: false,
};

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep]           = useState(1);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [errors, setErrors]       = useState({});
  const [showPass, setShowPass]   = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Field change ──
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // ── Star rating ──
  const handleStar = (val) => {
    setForm(prev => ({ ...prev, starRating: val }));
    setErrors(prev => ({ ...prev, starRating: '' }));
  };

  // ── Logo upload ──
  const handleLogoUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url  = URL.createObjectURL(file);
    const size = (file.size / 1024).toFixed(1) + ' KB';
    setForm(prev => ({ ...prev, hotelLogo: { file, name: file.name, url, size } }));
  };

  const removeLogo = () => setForm(prev => ({ ...prev, hotelLogo: null }));

  // ── Google register ──
  const handleGoogleRegister = () => {
    // TODO: Google OAuth flow
    alert('Google registration coming soon!');
  };

  // ── Validate per step ──
  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.adminName.trim())   e.adminName   = 'Full name is required.';
      if (!form.adminEmail.trim())  e.adminEmail  = 'Email is required.';
      else if (!/\S+@\S+\.\S+/.test(form.adminEmail)) e.adminEmail = 'Enter a valid email.';
      if (!form.adminPhone.trim())  e.adminPhone  = 'Phone number is required.';
      if (!form.password)           e.password    = 'Password is required.';
      else if (form.password.length < 8) e.password = 'Minimum 8 characters.';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    }
    if (step === 2) {
      if (!form.hotelName.trim())         e.hotelName         = 'Hotel name is required.';
      if (!form.hotelType)                e.hotelType         = 'Please select a hotel type.';
      if (!form.hotelDesc.trim())         e.hotelDesc         = 'Hotel description is required.';
      if (!form.starRating)               e.starRating        = 'Please select a star rating.';
      if (!form.yearEstablished.trim())   e.yearEstablished   = 'Year established is required.';
      if (!form.gstNumber.trim())         e.gstNumber         = 'GST number is required.';
      if (!form.panNumber.trim())         e.panNumber         = 'PAN number is required.';
      if (!form.businessRegNumber.trim()) e.businessRegNumber = 'Business registration number is required.';
    }
    if (step === 3) {
      if (!form.agreeTerms) e.agreeTerms = 'You must agree to the terms to proceed.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate()) setStep(s => s + 1); };
  const handleBack = () => { setStep(s => s - 1); setErrors({}); };
const handleSubmit = async () => {
  if (!validate()) return;

  try {
    const response = await axios.post(
      'http://localhost:5000/api/auth/register',
      {
        full_name: form.adminName,
        email: form.adminEmail,
        phone: form.adminPhone,
        password: form.password,
      }
    );

    if (response.data.success) {
      await swal.fire({
        icon: 'success',
        title: 'Registration Successful',
        text: 'Please login to continue',
      });

      navigate('/login');
    }
  } catch (error) {
    console.error('Register Error:', error);

    Swal.fire({
      icon: 'error',
      title: 'Registration Failed',
      text:
        error.response?.data?.message ||
        'Unable to register user.',
    });
  }
};

  // ── Step circle helper ──
  const stepStatus = (n) => n < step ? 'done' : n === step ? 'active' : '';
  const lineStatus = (n) => n < step ? 'done' : '';

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div className="register-page">

      {/* ── Top bar ── */}
      <div className="register-topbar">
        <div className="register-logo">
          <HotelierCrown />
          <div className="register-logo-text">
            <h1>Hotel Management System</h1>
            <p>Register Your Hotel</p>
          </div>
        </div>
        <div className="register-topbar-link">
          Already registered? <Link to="/login">Sign In</Link>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="register-main">
        <div className="register-card">

          {/* ── Card header + steps ── */}
          <div className="register-card-header">
            <h2>
              {submitted ? '🎉 Registration Complete!' :
               step === 1 ? 'Create Your Admin Account' :
               step === 2 ? 'Hotel Information' :
               'Review & Submit'}
            </h2>
            <p>
              {submitted ? 'Your hotel has been successfully registered.' :
               step === 1 ? 'Set up your administrator login credentials.' :
               step === 2 ? 'Tell us about your hotel — all fields marked * are required.' :
               'Review your details before submitting.'}
            </p>

            {/* Step indicator */}
            {!submitted && (
              <div className="register-steps">
                {STEPS.map((s, i) => (
                  <React.Fragment key={s.num}>
                    <div className="step-item">
                      <div className={`step-circle ${stepStatus(s.num)}`}>
                        {step > s.num ? <IconCheck /> : s.num}
                      </div>
                      <span className={`step-label ${stepStatus(s.num)}`}>{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`step-line ${lineStatus(s.num)}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* ══════════ SUCCESS ══════════ */}
          {submitted && (
            <div className="reg-success">
              <div className="reg-success-icon">✅</div>
              <h3>Hotel Registered Successfully!</h3>
              <p>
                Your hotel <strong>{form.hotelName}</strong> has been registered. Our team will review your details and activate your account within 24 hours.
              </p>
              <button className="btn-next" onClick={() => navigate('/login')}>
                Go to Login <IconArrow />
              </button>
            </div>
          )}

          {/* ══════════ STEP 1 — Admin Account ══════════ */}
          {!submitted && step === 1 && (
            <>
              <div className="register-card-body">
                {/* Google register */}
                <button className="btn-google-reg" onClick={handleGoogleRegister}>
                  <GoogleLogo />
                  Register with Google
                </button>
                <div className="or-divider">
                  <span className="or-divider-line" />
                  <span className="or-divider-text">or fill in your details</span>
                  <span className="or-divider-line" />
                </div>

                <div className="reg-section-title"><IconUser /> Admin Account Details</div>

                <div className="reg-grid">
                  {/* Full Name */}
                  <div className="form-group full">
                    <label className="form-label"><span className="req">*</span> Full Name</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconUser /></span>
                      <input className={`form-input ${errors.adminName ? 'error-input' : ''}`} name="adminName" value={form.adminName} onChange={handleChange} placeholder="Enter your full name" />
                    </div>
                    {errors.adminName && <span className="field-error">{errors.adminName}</span>}
                  </div>

                  {/* Email */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> Email Address</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconEmail /></span>
                      <input className={`form-input ${errors.adminEmail ? 'error-input' : ''}`} name="adminEmail" type="email" value={form.adminEmail} onChange={handleChange} placeholder="admin@hotel.com" />
                    </div>
                    {errors.adminEmail && <span className="field-error">{errors.adminEmail}</span>}
                  </div>

                  {/* Phone */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> Phone Number</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconPhone /></span>
                      <input className={`form-input ${errors.adminPhone ? 'error-input' : ''}`} name="adminPhone" value={form.adminPhone} onChange={handleChange} placeholder="+91 00000 00000" />
                    </div>
                    {errors.adminPhone && <span className="field-error">{errors.adminPhone}</span>}
                  </div>

                  {/* Password */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> Password</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconLock /></span>
                      <input className={`form-input ${errors.password ? 'error-input' : ''}`} name="password" type={showPass ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="Min. 8 characters" style={{ paddingRight: 40 }} />
                      <button type="button" className="input-right-icon" onClick={() => setShowPass(p => !p)}><IconEye open={showPass} /></button>
                    </div>
                    {errors.password && <span className="field-error">{errors.password}</span>}
                    <span className="field-hint">At least 8 characters</span>
                  </div>

                  {/* Confirm Password */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> Confirm Password</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconLock /></span>
                      <input className={`form-input ${errors.confirmPassword ? 'error-input' : ''}`} name="confirmPassword" type={showConf ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} placeholder="Re-enter password" style={{ paddingRight: 40 }} />
                      <button type="button" className="input-right-icon" onClick={() => setShowConf(p => !p)}><IconEye open={showConf} /></button>
                    </div>
                    {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                  </div>
                </div>
              </div>

              <div className="register-card-footer">
                <span className="footer-step-info">Step 1 of 3</span>
                <button className="btn-next" onClick={handleNext}>
                  Next: Hotel Info <IconArrow />
                </button>
              </div>
            </>
          )}

          {/* ══════════ STEP 2 — Hotel Information ══════════ */}
          {!submitted && step === 2 && (
            <>
              <div className="register-card-body">

                {/* ── Basic Info ── */}
                <div className="reg-section-title"><IconHotel /> Basic Hotel Information</div>
                <div className="reg-grid">

                  {/* Hotel Name */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> Hotel Name</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconHotel /></span>
                      <input className={`form-input ${errors.hotelName ? 'error-input' : ''}`} name="hotelName" value={form.hotelName} onChange={handleChange} placeholder="e.g. Grand Palace Hotel" />
                    </div>
                    {errors.hotelName && <span className="field-error">{errors.hotelName}</span>}
                  </div>

                  {/* Hotel Type */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> Hotel Type</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconType /></span>
                      <select className={`form-select ${errors.hotelType ? 'error-input' : ''}`} name="hotelType" value={form.hotelType} onChange={handleChange}>
                        <option value="">Select hotel type</option>
                        {HOTEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {errors.hotelType && <span className="field-error">{errors.hotelType}</span>}
                  </div>

                  {/* Star Rating */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> Star Rating</label>
                    <div className={`star-rating ${errors.starRating ? 'error-input' : ''}`}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} type="button" className="star-btn" onClick={() => handleStar(n)}>
                          <span className={n <= form.starRating ? 'star-filled' : 'star-empty'}>★</span>
                        </button>
                      ))}
                      <span className="star-label">
                        {form.starRating ? `${form.starRating} Star${form.starRating > 1 ? 's' : ''}` : 'Select rating'}
                      </span>
                    </div>
                    {errors.starRating && <span className="field-error">{errors.starRating}</span>}
                  </div>

                  {/* Year Established */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> Year Established</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconYear /></span>
                      <input className={`form-input ${errors.yearEstablished ? 'error-input' : ''}`} name="yearEstablished" value={form.yearEstablished} onChange={handleChange} placeholder="e.g. 2005" maxLength={4} />
                    </div>
                    {errors.yearEstablished && <span className="field-error">{errors.yearEstablished}</span>}
                  </div>

                  {/* Hotel Description */}
                  <div className="form-group full">
                    <label className="form-label"><span className="req">*</span> Hotel Description</label>
                    <textarea className={`form-textarea ${errors.hotelDesc ? 'error-input' : ''}`} name="hotelDesc" value={form.hotelDesc} onChange={handleChange} placeholder="Describe your hotel — location, facilities, unique features..." rows={4} />
                    {errors.hotelDesc && <span className="field-error">{errors.hotelDesc}</span>}
                    <span className="field-hint">{form.hotelDesc.length}/500 characters</span>
                  </div>
                </div>

                {/* ── Legal & Tax Info ── */}
                <div className="reg-section-title"><IconReg /> Legal & Tax Information</div>
                <div className="reg-grid three">

                  {/* GST Number */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> GST Number</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconGST /></span>
                      <input className={`form-input ${errors.gstNumber ? 'error-input' : ''}`} name="gstNumber" value={form.gstNumber} onChange={handleChange} placeholder="e.g. 22ABCDE1234F1Z5" style={{ textTransform: 'uppercase' }} />
                    </div>
                    {errors.gstNumber && <span className="field-error">{errors.gstNumber}</span>}
                    <span className="field-hint">15-digit GST Identification Number</span>
                  </div>

                  {/* PAN Number */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> PAN Number</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconPAN /></span>
                      <input className={`form-input ${errors.panNumber ? 'error-input' : ''}`} name="panNumber" value={form.panNumber} onChange={handleChange} placeholder="e.g. ABCDE1234F" style={{ textTransform: 'uppercase' }} maxLength={10} />
                    </div>
                    {errors.panNumber && <span className="field-error">{errors.panNumber}</span>}
                    <span className="field-hint">10-character PAN</span>
                  </div>

                  {/* Business Registration Number */}
                  <div className="form-group">
                    <label className="form-label"><span className="req">*</span> Business Registration No.</label>
                    <div className="input-wrapper">
                      <span className="input-icon"><IconReg /></span>
                      <input className={`form-input ${errors.businessRegNumber ? 'error-input' : ''}`} name="businessRegNumber" value={form.businessRegNumber} onChange={handleChange} placeholder="e.g. U55101MH2005PTC153147" />
                    </div>
                    {errors.businessRegNumber && <span className="field-error">{errors.businessRegNumber}</span>}
                  </div>
                </div>

                {/* ── Hotel Logo ── */}
                <div className="reg-section-title"><IconUpload /> Hotel Logo</div>
                {!form.hotelLogo ? (
                  <div className="logo-upload-box">
                    <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" onChange={handleLogoUpload} />
                    <div className="logo-upload-icon"><IconUpload /></div>
                    <div className="logo-upload-title">Click or drag to upload your hotel logo</div>
                    <div className="logo-upload-sub">PNG, JPG, SVG, WEBP — Max 5MB</div>
                  </div>
                ) : (
                  <div className="logo-preview-wrap">
                    <img src={form.hotelLogo.url} alt="Hotel Logo" className="logo-preview-img" />
                    <div className="logo-preview-info">
                      <div className="logo-preview-name">{form.hotelLogo.name}</div>
                      <div className="logo-preview-size">{form.hotelLogo.size}</div>
                    </div>
                    <button className="logo-preview-remove" onClick={removeLogo}>Remove</button>
                  </div>
                )}

              </div>

              <div className="register-card-footer">
                <button className="btn-back" onClick={handleBack}>← Back</button>
                <span className="footer-step-info">Step 2 of 3</span>
                <button className="btn-next" onClick={handleNext}>
                  Review Details <IconArrow />
                </button>
              </div>
            </>
          )}

          {/* ══════════ STEP 3 — Review & Submit ══════════ */}
          {!submitted && step === 3 && (
            <>
              <div className="register-card-body">
                <div className="reg-section-title"><IconUser /> Admin Account</div>
                <div className="reg-grid">
                  {[
                    ['Full Name',    form.adminName],
                    ['Email',        form.adminEmail],
                    ['Phone',        form.adminPhone],
                    ['Password',     '••••••••'],
                  ].map(([k, v]) => (
                    <div className="form-group" key={k}>
                      <label className="form-label" style={{ color: '#9ca3af', fontWeight: 500 }}>{k}</label>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e4e8f0' }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>

                <div className="reg-section-title"><IconHotel /> Hotel Information</div>
                <div className="reg-grid">
                  {[
                    ['Hotel Name',        form.hotelName],
                    ['Hotel Type',        form.hotelType],
                    ['Star Rating',       form.starRating ? `${'★'.repeat(form.starRating)} (${form.starRating} Star${form.starRating > 1 ? 's' : ''})` : '—'],
                    ['Year Established',  form.yearEstablished],
                    ['GST Number',        form.gstNumber],
                    ['PAN Number',        form.panNumber],
                    ['Business Reg No.',  form.businessRegNumber],
                    ['Hotel Logo',        form.hotelLogo ? form.hotelLogo.name : 'Not uploaded'],
                  ].map(([k, v]) => (
                    <div className="form-group" key={k}>
                      <label className="form-label" style={{ color: '#9ca3af', fontWeight: 500 }}>{k}</label>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e4e8f0' }}>{v || '—'}</div>
                    </div>
                  ))}
                  <div className="form-group full">
                    <label className="form-label" style={{ color: '#9ca3af', fontWeight: 500 }}>Hotel Description</label>
                    <div style={{ fontSize: 14, color: '#1a1f36', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e4e8f0', lineHeight: 1.6 }}>{form.hotelDesc || '—'}</div>
                  </div>
                </div>

                {/* Logo preview in review */}
                {form.hotelLogo && (
                  <div style={{ marginBottom: 24 }}>
                    <div className="reg-section-title">Hotel Logo Preview</div>
                    <img src={form.hotelLogo.url} alt="Hotel Logo" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12, border: '2px solid #e4e8f0' }} />
                  </div>
                )}

                {/* Terms */}
                <div className="form-group">
                  <div className="terms-group">
                    <input type="checkbox" name="agreeTerms" checked={form.agreeTerms} onChange={handleChange} />
                    <span className="terms-text">
                      I agree to the <a href="/terms">Terms &amp; Conditions</a> and <a href="/privacy">Privacy Policy</a>. I confirm that all the information provided is accurate and complete.
                    </span>
                  </div>
                  {errors.agreeTerms && <span className="field-error">{errors.agreeTerms}</span>}
                </div>
              </div>

              <div className="register-card-footer">
                <button className="btn-back" onClick={handleBack}>← Back</button>
                <span className="footer-step-info">Step 3 of 3</span>
                <button className="btn-submit" onClick={handleSubmit}>
                  ✓ Submit Registration
                </button>
              </div>
            </>
          )}

          {/* ── Bottom sign in link ── */}
          {!submitted && (
            <div className="register-signin-link">
              Already have an account? <Link to="/login">Sign In</Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default RegisterPage;