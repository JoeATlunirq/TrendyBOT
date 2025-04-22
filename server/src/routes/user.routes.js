const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, setup2FA, verify2FA, disable2FA, deleteAccount } = require('../controllers/user.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');

// Get user profile
router.get('/profile', authenticateJWT, getProfile);

// Update user profile
router.put('/profile', authenticateJWT, updateProfile);

// Setup 2FA
router.post('/2fa/setup', authenticateJWT, setup2FA);

// Verify and enable 2FA
router.post('/2fa/verify', authenticateJWT, verify2FA);

// Disable 2FA
router.post('/2fa/disable', authenticateJWT, disable2FA);

// Delete user account
router.delete('/account', authenticateJWT, deleteAccount);

module.exports = router; 