// const NocoDBService = require('../services/nocodb.service'); // Removed
const { supabase, isSupabaseReady } = require('../services/supabase.service'); 

// const { NOCODB_TRIGGERED_ALERTS_TABLE_ID, NOCODB_VIDEO_STATS_HISTORY_TABLE_ID } = process.env; // Removed

// Supabase Table Names
const TRIGGERED_ALERTS_TABLE = 'TriggeredAlerts';
const VIDEO_STATS_HISTORY_TABLE = 'VideoStatsHistory';

// Column Name Constants (ensure these match your Supabase schema)
const TA_COL_USER_ID = 'user_id'; // Assuming 'user_id' is the column in TriggeredAlerts for the user FK
const TA_COL_ID = 'id'; // Assuming 'id' is the primary key for TriggeredAlerts
const TA_COL_VIDEO_ID = 'video_id'; // Assuming 'video_id' exists in TriggeredAlerts
const TA_COL_TRIGGERED_AT = 'triggered_at'; // Assuming 'triggered_at' for sorting

const VSH_COL_VIDEO_ID = 'video_id'; // Assuming 'video_id' is the column in VideoStatsHistory
const VSH_COL_CHECKED_AT = 'checked_at'; // Assuming 'checked_at' for sorting history


/**
 * @desc    Get all triggered alerts for the authenticated user
 * @route   GET /api/trends/my-alerts
 * @access  Private
 */
const getMyAlerts = async (req, res, next) => {
    // if (!NOCODB_TRIGGERED_ALERTS_TABLE_ID) { // Removed NocoDB check
    //     return next(new Error('Triggered Alerts Table ID is not configured.'));
    // }
    if (!isSupabaseReady()) {
        console.error('[TrendsController][getMyAlerts] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }
    const userId = req.userId; // From auth.middleware
    if (!userId) { 
        return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }

    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;
        const rangeTo = offset + limit - 1;

        // const filterString = `(${TA_COL_USER_ID},eq,${req.user.id})`; // NocoDB filter
        
        const { data: alerts, error, count } = await supabase
            .from(TRIGGERED_ALERTS_TABLE)
            .select('*', { count: 'exact' })
            .eq(TA_COL_USER_ID, userId)
            .order(TA_COL_TRIGGERED_AT, { ascending: false })
            .range(offset, rangeTo);

        if (error) {
            console.error('[TrendsController][getMyAlerts] Supabase error:', error.message);
            return next(error);
        }
        
        res.json({
            alerts: alerts || [],
            pagination: {
                totalItems: count,
                currentPage: page,
                pageSize: limit,
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('[TrendsController] Error in getMyAlerts:', error);
        next(error);
    }
};

/**
 * @desc    Get a single triggered alert by its ID, potentially with related video stats history
 * @route   GET /api/trends/alert/:alertId
 * @access  Private 
 */
const getAlertDetails = async (req, res, next) => {
    // if (!NOCODB_TRIGGERED_ALERTS_TABLE_ID) { // Removed NocoDB check
    //     return next(new Error('Triggered Alerts Table ID is not configured.'));
    // }
    if (!isSupabaseReady()) {
        console.error('[TrendsController][getAlertDetails] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable.' });
    }
    const userId = req.userId; // From auth.middleware
    if (!userId) {
        return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }

    const { alertId } = req.params;

    try {
        // const alert = await NocoDBService.getRecordById(NOCODB_TRIGGERED_ALERTS_TABLE_ID, alertId); // NocoDB fetch
        const { data: alert, error: alertError } = await supabase
            .from(TRIGGERED_ALERTS_TABLE)
            .select()
            .eq(TA_COL_ID, alertId)
            // .eq(TA_COL_USER_ID, userId) // Also ensure user owns this alert
            .single();

        if (alertError) {
            console.error(`[TrendsController][getAlertDetails] Supabase error fetching alert ${alertId}:`, alertError.message);
            if (alertError.code === 'PGRST116') { // Not found code for .single()
                 return res.status(404).json({ message: 'Alert not found.' });
            }
            return next(alertError);
        }

        if (!alert) { // Should be caught by .single() error, but as a safeguard
            return res.status(404).json({ message: 'Alert not found.' });
        }

        // Ensure the authenticated user owns this alert
        if (alert[TA_COL_USER_ID] !== userId) {
            return res.status(403).json({ message: 'Not authorized to view this alert.' });
        }

        let videoStatsHistory = [];
        if (alert[TA_COL_VIDEO_ID]) { // Ensure the alert has a video_id to lookup
            const { data: history, error: historyError } = await supabase
                .from(VIDEO_STATS_HISTORY_TABLE)
                .select()
                .eq(VSH_COL_VIDEO_ID, alert[TA_COL_VIDEO_ID])
                .order(VSH_COL_CHECKED_AT, { ascending: false })
                .limit(50); // Example limit
            
            if (historyError) {
                console.error(`[TrendsController][getAlertDetails] Supabase error fetching video stats history for video ${alert[TA_COL_VIDEO_ID]}:`, historyError.message);
                // Decide if you want to fail the whole request or return alert with empty/error in history
            } else {
                videoStatsHistory = history || [];
            }
        }

        res.json({ ...alert, videoStatsHistory });

    } catch (error) {
        console.error('[TrendsController] Error in getAlertDetails:', error);
        next(error);
    }
};

module.exports = {
    getMyAlerts,
    getAlertDetails,
}; 