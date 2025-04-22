const express = require('express');
const {
    signup,
    login,
    verifyLogin2FA,
    requestPasswordReset,
    resetPassword
} = require('../controllers/auth.controller');

const router = express.Router();

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', signup);

// @route   POST /api/auth/login
// @desc    Authenticate user and get token OR trigger 2FA check
// @access  Public
router.post('/login', login);

// @route   POST /api/auth/login/2fa/verify
// @desc    Verify 2FA code after login attempt
// @access  Public
router.post('/login/2fa/verify', verifyLogin2FA);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset email
// @access  Public
router.post('/forgot-password', requestPasswordReset);

// @route   POST /api/auth/reset-password
// @desc    Reset password using token from email
// @access  Public
router.post('/reset-password', resetPassword);

module.exports = router;