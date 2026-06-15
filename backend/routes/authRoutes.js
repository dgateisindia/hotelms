const express = require('express');
const router = express.Router();
const { login, register, forgotPassword } = require('../controllers/authController');

router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);

module.exports = router;
