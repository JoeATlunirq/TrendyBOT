const express = require('express');
const { lookupChannel } = require('../controllers/youtube.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// @route   POST /api/youtube/lookup
// @desc    Lookup YouTube channel info by query
// @access  Private 
router.post('/lookup', protect, lookupChannel);

module.exports = router; 