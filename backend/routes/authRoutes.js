const express = require('express');
const router = express.Router();
const { login, register, forgotPassword,sendOTP,verifyOTP,resetPassword } = require('../controllers/authController');
router.post('/send-otp', sendOTP);

router.post('/verify-otp', verifyOTP);

router.post('/reset-password', resetPassword);

router.post('/login', login);
router.post('/register', register);
router.post('/ForgotPassword', forgotPassword);

module.exports = router;
