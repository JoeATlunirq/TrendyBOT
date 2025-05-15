require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
    console.error('ERROR: SUPABASE_URL is not defined in the environment variables.');
    // Potentially throw an error or exit, depending on desired behavior if Supabase is critical
}
if (!supabaseServiceKey) {
    console.error('ERROR: SUPABASE_SERVICE_KEY is not defined in the environment variables.');
    // Potentially throw an error or exit
}

let supabase;
if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            // autoRefreshToken: true, // Default is true
            // persistSession: true, // Default is true, but less relevant for server-side
            // detectSessionInUrl: false // Default is true, but typically for client-side OAuth
        }
    });
    console.log('[SupabaseService] Supabase client initialized.');
} else {
    console.error('[SupabaseService] Supabase client could not be initialized due to missing URL or Service Key.');
    // Fallback or error handling - for now, supabase will be undefined
    // This allows the app to potentially run in a degraded mode if Supabase is not critical for all parts
}

/**
 * Checks if the Supabase client is initialized and ready to use.
 * @returns {boolean} True if the client is initialized, false otherwise.
 */
function isSupabaseReady() {
    return !!supabase;
}

// Export the initialized Supabase client directly and the readiness check function
module.exports = { 
    supabase, 
    isSupabaseReady 
}; 