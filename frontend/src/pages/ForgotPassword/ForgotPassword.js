import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Send OTP
  const handleSendOTP = async () => {
    try {
      const res = await axios.post(
        'http://localhost:5000/api/auth/send-otp',
        { email }
      );

      Swal.fire(
        'Success',
        res.data.message,
        'success'
      );

      setStep(2);

    } catch (error) {
      Swal.fire(
        'Error',
        error.response?.data?.message || 'Failed to send OTP',
        'error'
      );
    }
  };


  // Verify OTP
  const handleVerifyOTP = async () => {
    try {
      const res = await axios.post(
        'http://localhost:5000/api/auth/verify-otp',
        {
          email,
          otp
        }
      );

      if (res.data.success) {
        Swal.fire(
          'Success',
          'OTP Verified',
          'success'
        );

        setStep(3);
      }

    } catch (error) {
      Swal.fire(
        'Error',
        error.response?.data?.message || 'Invalid OTP',
        'error'
      );
    }
  };

  // Reset Password
  const handleResetPassword = async () => {

    if (password !== confirmPassword) {
      return Swal.fire(
        'Error',
        'Passwords do not match',
        'error'
      );
    }

    try {
      const res = await axios.post(
        'http://localhost:5000/api/auth/reset-password',
        {
          email,
          password
        }
      );

      Swal.fire(
        'Success',
        res.data.message,
        'success'
      );

      navigate('/login');

    } catch (error) {
      Swal.fire(
        'Error',
        error.response?.data?.message ||
        'Failed to reset password',
        'error'
      );
    }
  };

  return (
    <div
      style={{
        width: '400px',
        margin: '50px auto',
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '10px'
      }}
    >
      <h2>Forgot Password</h2>

      {/* STEP 1 */}
      {step === 1 && (
        <>
          <label>Email</label>

          <input
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            style={{
              width: '100%',
              padding: '10px',
              marginTop: '10px'
            }}
          />

          <button
            onClick={handleSendOTP}
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '10px'
            }}
          >
            Send OTP
          </button>
        </>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <>
          <label>OTP</label>

          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value)
            }
            style={{
              width: '100%',
              padding: '10px',
              marginTop: '10px'
            }}
          />

          <button
            onClick={handleVerifyOTP}
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '10px'
            }}
          >
            Verify OTP
          </button>
        </>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <>
          <label>New Password</label>

          <input
            type="password"
            placeholder="Enter New Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            style={{
              width: '100%',
              padding: '10px',
              marginTop: '10px'
            }}
          />

          <label
            style={{
              marginTop: '15px',
              display: 'block'
            }}
          >
            Confirm Password
          </label>

          <input
  type="password"
  placeholder="Confirm Password"
  value={confirmPassword}
  onChange={(e) => setConfirmPassword(e.target.value)}
  style={{
              width: '100%',
              padding: '10px',
              marginTop: '10px'
  }}
/>

          <button
            onClick={handleResetPassword}
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '10px'
            }}
          >
            Reset Password
          </button>
        </>
      )}
    </div>
  );
};

export default ForgotPassword;