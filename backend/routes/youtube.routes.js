const express = require('express');
const { lookupChannel } = require('../controllers/youtube.controller');
const { protect } = require('../middleware/auth.middleware');
const youtubeController = require('../controllers/youtube.controller');

const router = express.Router();

// @route   POST /api/youtube/lookup
// @desc    Lookup YouTube channel info by query
// @access  Private 
router.post('/lookup', protect, lookupChannel);

// @desc    Get aggregated channel data for a list of channel IDs
// @route   POST /api/youtube/channel-data
// @access  Private (user must be logged in)
router.post('/channel-data', protect, youtubeController.getChannelData);

router.get(
    "/videos", // New route for fetching videos for a list of channels
    protect,    // Use protect middleware directly
    youtubeController.getVideosForChannels
);

module.exports = router; 