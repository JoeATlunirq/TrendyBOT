const { supabase, isSupabaseReady } = require('./supabase.service'); // Supabase client

// NocoDB specific constants - will be replaced or adapted for Supabase
// const NocoDBService = require('./nocodb.service'); 
// const { NOCODB_API_KEY_STATUS_TABLE_ID } = process.env;

// Supabase table name
const SUPABASE_API_KEY_STATUS_TABLE = 'ApiKeyDailyStatus';

// Define Supabase column names for the ApiKeyDailyStatus table
// These should match your Supabase table schema EXACTLY.
const COL_API_KEY_NAME = 'api_key'; // Stores the env var name, e.g., TRENDYBOT_MAIN_TASK_API_KEY (Primary Key in Supabase)
const COL_IS_FAILED = 'is_failed_today';    // Boolean
const COL_CALLS_TODAY = 'calls_made_today'; // Number (integer)
const COL_LAST_FAILED_PT_DATE = 'last_failed_pt_date'; // Date (YYYY-MM-DD string)
const COL_API_DAILY_STATUS = 'api_daily_status'; // Text
const COL_DAILY_USE_PERCENT = 'daily_use_percent'; // Number (float/double)
const COL_ID = 'id'; // Standard Supabase primary key (auto-incrementing integer)

const QUOTA_PER_KEY = 10000; 

const KEY_NAMES = [
  'TRENDYBOT_MAIN_TASK_API_KEY',
  'TRENDYBOT_BACKUP_KEY_API_KEY',
  'TRENDYBOT_CHANNELS_PFP_API_KEY',
  'TRENDYBOT_PREF_PAGE_API_KEY',
  'TRENDYBOT_TRENDING_PAGE_API_KEY',
  'TRENDYBOT_RESEARCH_PAGE_API_KEY',
  'TRENDYBOT_ANALYTICS_API_KEY',
  'TRENDYBOT_FAILSAFE_API_KEY',
  'TRENDYBOT_FALLBACK_API_KEY',
  'TRENDYBOT_ADMIN_API_KEY',
];

class ApiKeyManager {
  constructor(callbacks = {}) {
    this.keys = []; 
    this.failedKeyValues = new Set(); 
    this.lastResetDatePT = null; 
    this.lastUsedKeyIndex = -1; 
    this.callbacks = callbacks;
    this.isInitialized = false;
    this.callbacksSet = false; // To track if callbacks have been applied from getInstance
    this.managerLogicLastResetDatePT = null; // Internal tracking for reset logic
    this.initializationPromise = this._initializeManager();
  }

  async _initializeManager() {
    if (!isSupabaseReady()) {
      console.error('CRITICAL: Supabase client is not ready. ApiKeyManager cannot persist state.');
      this.isInitialized = true; 
      this.keys = KEY_NAMES.map(name => ({
        name,
        value: process.env[name],
        supabaseId: null, // No Supabase record ID
        callsMadeToday: 0,
        isFailedToday: false, 
        lastFailedPtDate: null,
        [COL_API_DAILY_STATUS]: 'Okay',
        [COL_DAILY_USE_PERCENT]: 0.0
      })).filter(k => k.value);
      if (this.keys.length === 0) console.error("ApiKeyManager: No API keys loaded from .env.");
      else console.warn("ApiKeyManager: Running in DEGRADED mode without Supabase persistence.");
      await this._performDailyResetCheck(true); 
      return this;
    }

    console.log('ApiKeyManager: Initializing and syncing with Supabase...');
    try {
      const keyPromises = KEY_NAMES.map(name => this._loadOrInitializeKeyStatusFromSupabase(name));
      const resolvedKeys = await Promise.all(keyPromises);
      this.keys = resolvedKeys.filter(k => k && k.value); 

      const currentPTDate = this._getPacificDateString(new Date());
      this.keys.forEach(key => {
        if (key.isFailedToday && key.lastFailedPtDate === currentPTDate) {
          this.failedKeyValues.add(key.value);
        }
      });

      await this._performDailyResetCheck(); 
      
      console.log(`ApiKeyManager: Initialized with ${this.keys.length} API keys from Supabase sync.`);
    } catch (error) {
        console.error("ApiKeyManager: Error during Supabase initialization sequence:", error);
        // Fallback to degraded mode if full initialization fails
        this.keys = KEY_NAMES.map(name => ({
            name,
            value: process.env[name],
            supabaseId: null,
            callsMadeToday: 0,
            isFailedToday: false,
            lastFailedPtDate: null,
            [COL_API_DAILY_STATUS]: 'Okay',
            [COL_DAILY_USE_PERCENT]: 0.0
        })).filter(k => k.value);
        console.warn("ApiKeyManager: Reverted to DEGRADED mode due to initialization error.");
        await this._performDailyResetCheck(true);
    }
    this.isInitialized = true;
    return this;
  }

  async _loadOrInitializeKeyStatusFromSupabase(keyEnvVarName) {
    const keyValue = process.env[keyEnvVarName];
    if (!keyValue) {
      console.warn(`ApiKeyManager: Environment variable ${keyEnvVarName} is not set. Skipping.`);
      return null;
    }

    try {
      const { data: existingRecords, error: fetchError } = await supabase
        .from(SUPABASE_API_KEY_STATUS_TABLE)
        .select('*')
        .eq(COL_API_KEY_NAME, keyEnvVarName)
        .limit(1);

      if (fetchError) {
        console.error(`ApiKeyManager: Supabase error fetching record for ${keyEnvVarName}.`);
        console.error('Fetch Error Object:', fetchError);
        if (fetchError.message) console.error('Fetch Error Message:', fetchError.message);
        if (fetchError.details) console.error('Fetch Error Details:', fetchError.details);
        if (fetchError.hint) console.error('Fetch Error Hint:', fetchError.hint);
        throw fetchError;
      }
      
      const existingRecord = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;

      if (existingRecord && existingRecord[COL_ID]) {
        return {
          name: keyEnvVarName,
          value: keyValue,
          supabaseId: existingRecord[COL_ID],
          callsMadeToday: existingRecord[COL_CALLS_TODAY] || 0,
          isFailedToday: existingRecord[COL_IS_FAILED] || false, 
          lastFailedPtDate: existingRecord[COL_LAST_FAILED_PT_DATE] || null,
          [COL_API_DAILY_STATUS]: existingRecord[COL_API_DAILY_STATUS] || (existingRecord[COL_IS_FAILED] ? 'Failed' : 'Okay'),
          [COL_DAILY_USE_PERCENT]: existingRecord[COL_DAILY_USE_PERCENT] === undefined || existingRecord[COL_DAILY_USE_PERCENT] === null
            ? parseFloat(((existingRecord[COL_CALLS_TODAY] || 0) / QUOTA_PER_KEY).toFixed(4))
            : (typeof existingRecord[COL_DAILY_USE_PERCENT] === 'number' 
                ? parseFloat(existingRecord[COL_DAILY_USE_PERCENT].toFixed(4)) 
                : parseFloat(((existingRecord[COL_CALLS_TODAY] || 0) / QUOTA_PER_KEY).toFixed(4)))
        };
      } else {
        console.log(`ApiKeyManager: No Supabase record for ${keyEnvVarName}. Creating one.`);
        const newRecordData = {
          [COL_API_KEY_NAME]: keyEnvVarName,
          [COL_IS_FAILED]: false,
          [COL_CALLS_TODAY]: 0,
          [COL_API_DAILY_STATUS]: 'Okay',
          [COL_DAILY_USE_PERCENT]: 0.0 
        };
        const { data: createdData, error: insertError } = await supabase
          .from(SUPABASE_API_KEY_STATUS_TABLE)
          .insert(newRecordData)
          .select()
          .single();

        if (insertError) {
          console.error(`ApiKeyManager: Supabase error creating record for ${keyEnvVarName}.`);
          console.error('Insert Error Object:', insertError);
          if (insertError.message) console.error('Insert Error Message:', insertError.message);
          if (insertError.details) console.error('Insert Error Details:', insertError.details);
          if (insertError.hint) console.error('Insert Error Hint:', insertError.hint);
          throw insertError;
        }
        
        return {
          name: keyEnvVarName,
          value: keyValue,
          supabaseId: createdData ? createdData[COL_ID] : null,
          callsMadeToday: 0,
          isFailedToday: false,
          lastFailedPtDate: null,
          [COL_API_DAILY_STATUS]: 'Okay',
          [COL_DAILY_USE_PERCENT]: 0.0
        };
      }
    } catch (error) {
      console.error(`*** CAUGHT ERROR in _loadOrInitializeKeyStatusFromSupabase for ${keyEnvVarName} ***`);
      console.error('Raw error object caught:', error);
      if (error && error.message) console.error('Raw error message:', error.message);
      // Existing fallback message
      console.error(`ApiKeyManager: Error in _loadOrInitializeKeyStatusFromSupabase for ${keyEnvVarName}. Falling back to in-memory for this key.`);
      return { // Fallback to in-memory if Supabase fails for this key
        name: keyEnvVarName,
        value: keyValue,
        supabaseId: null,
        callsMadeToday: 0,
        isFailedToday: false,
        lastFailedPtDate: null,
        [COL_API_DAILY_STATUS]: 'Okay',
        [COL_DAILY_USE_PERCENT]: 0.0
      };
    }
  }

  _getPacificDateString(date) {
    const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const year = pstDate.getFullYear();
    const month = ('0' + (pstDate.getMonth() + 1)).slice(-2);
    const day = ('0' + pstDate.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  async _performDailyResetCheck(degradedMode = false) {
    const now = new Date();
    const currentDatePT = this._getPacificDateString(now);

    if (this.managerLogicLastResetDatePT !== currentDatePT) {
      console.log(`ApiKeyManager: New day in Pacific Time (${currentDatePT}). Last logic reset was on ${this.managerLogicLastResetDatePT || 'N/A'}. Performing daily reset.`);
      this.failedKeyValues.clear(); 
      let clearedInSupabaseCount = 0;

      for (const key of this.keys) {
        key.callsMadeToday = 0;
        key.isFailedToday = false; 
        key[COL_API_DAILY_STATUS] = 'Okay';
        key[COL_DAILY_USE_PERCENT] = 0.0;
        
        if (!degradedMode && key.supabaseId && isSupabaseReady()) {
          try {
            const { error } = await supabase
              .from(SUPABASE_API_KEY_STATUS_TABLE)
              .update({
                [COL_IS_FAILED]: false,
                [COL_CALLS_TODAY]: 0,
                [COL_API_DAILY_STATUS]: 'Okay',
                [COL_DAILY_USE_PERCENT]: 0.0 
              })
              .eq(COL_ID, key.supabaseId);
            
            if (error) throw error;
            clearedInSupabaseCount++;
          } catch (error) {
            console.error(`ApiKeyManager: Supabase error resetting status for key ${key.name} (ID: ${key.supabaseId}):`, error);
          }
        }
      }
      if (!degradedMode) console.log(`ApiKeyManager: Reset Supabase status for ${clearedInSupabaseCount} keys.`);
      else console.log('ApiKeyManager: Performed in-memory daily reset (degraded mode).');

      this.managerLogicLastResetDatePT = currentDatePT;
      this.lastResetDatePT = currentDatePT; 

      if (this.callbacks.onReset) { 
        this.callbacks.onReset(currentDatePT, this.keys.length, 0); 
      }
    } 
    if (!this.lastResetDatePT) this.lastResetDatePT = this.managerLogicLastResetDatePT || currentDatePT;
  }

  async getKey() {
    if (!this.isInitialized) {
      console.log("ApiKeyManager.getKey(): Waiting for initializationPromise...");
      await this.initializationPromise;
      console.log("ApiKeyManager.getKey(): Initialization complete.");
    }
    
    await this._performDailyResetCheck();

    const availableKeys = this.keys.filter(key => key.value && !this.failedKeyValues.has(key.value) && !key.isFailedToday);

    if (availableKeys.length === 0) {
      console.warn("ApiKeyManager: All API keys are currently marked as failed or no keys were loaded.");
      return null;
    }

    this.lastUsedKeyIndex = (this.lastUsedKeyIndex + 1) % availableKeys.length;
    const selectedKey = availableKeys[this.lastUsedKeyIndex];
    
    selectedKey.callsMadeToday++; 
    const usagePercent = parseFloat(Math.min(selectedKey.callsMadeToday / QUOTA_PER_KEY, 1.0).toFixed(4)); // Ensure float with precision

    selectedKey[COL_DAILY_USE_PERCENT] = usagePercent;
    // selectedKey[COL_API_DAILY_STATUS] = 'Okay'; // Already set during reset or init, only changes on failure

    if (selectedKey.supabaseId && isSupabaseReady()) {
      try {
        const { error } = await supabase
          .from(SUPABASE_API_KEY_STATUS_TABLE)
          .update({
            [COL_CALLS_TODAY]: selectedKey.callsMadeToday,
            [COL_DAILY_USE_PERCENT]: usagePercent
            // [COL_API_DAILY_STATUS] will remain 'Okay' unless explicitly failed
          })
          .eq(COL_ID, selectedKey.supabaseId);
        if (error) throw error;
      } catch (error) {
        console.error(`ApiKeyManager: Supabase error updating call count for key ${selectedKey.name} (ID: ${selectedKey.supabaseId}):`, error);
      }
    }

    if (this.callbacks.onKeyUsed) { 
      this.callbacks.onKeyUsed(selectedKey.name, selectedKey.callsMadeToday);
    }
    return selectedKey.value;
  }

  async reportKeyFailure(keyValue) {
    if (!this.isInitialized) await this.initializationPromise;
    if (!keyValue) return;

    const keyObject = this.keys.find(k => k.value === keyValue);
    if (!keyObject) {
      console.warn(`ApiKeyManager: Attempted to report failure for an unknown key value: ${keyValue.substring(0,10)}...`);
      return;
    }

    const currentPTDate = this._getPacificDateString(new Date());
    
    keyObject.isFailedToday = true;
    keyObject.lastFailedPtDate = currentPTDate;
    keyObject[COL_API_DAILY_STATUS] = 'Failed'; // Update in-memory status
    keyObject[COL_DAILY_USE_PERCENT] = parseFloat(Math.min(keyObject.callsMadeToday / QUOTA_PER_KEY, 1.0).toFixed(4));

    this.failedKeyValues.add(keyValue);
    console.log(`ApiKeyManager: Key ${keyObject.name} reported as failed for today (${currentPTDate}).`);

    if (keyObject.supabaseId && isSupabaseReady()) {
      try {
        const { error } = await supabase
          .from(SUPABASE_API_KEY_STATUS_TABLE)
          .update({
            [COL_IS_FAILED]: true,
            [COL_LAST_FAILED_PT_DATE]: currentPTDate,
            [COL_API_DAILY_STATUS]: 'Failed',
            [COL_DAILY_USE_PERCENT]: keyObject[COL_DAILY_USE_PERCENT]
          })
          .eq(COL_ID, keyObject.supabaseId);
        if (error) throw error;
        console.log(`ApiKeyManager: Updated Supabase status to FAILED for key ${keyObject.name} (ID: ${keyObject.supabaseId}).`);
      } catch (error) {
        console.error(`ApiKeyManager: Supabase error updating status to FAILED for key ${keyObject.name} (ID: ${keyObject.supabaseId}):`, error);
      }
    }

    if (this.callbacks.onKeyFailed) {
      this.callbacks.onKeyFailed(keyObject.name, keyObject.callsMadeToday);
    }
  }

  async getStats() {
    if (!this.isInitialized) await this.initializationPromise;
    await this._performDailyResetCheck(); // Ensures in-memory state is fresh

    const totalKeys = this.keys.length;
    const failedKeysCount = this.failedKeyValues.size; // Use the size of the Set for accuracy
    
    const detailedKeyStats = this.keys.map(k => {
      const callsMade = k.callsMadeToday || 0;
      const isFailed = k.isFailedToday || false;
      const statusText = k[COL_API_DAILY_STATUS] || (isFailed ? 'Failed' : 'Okay');
      
      let usePercent = 0.0;
      if (typeof k[COL_DAILY_USE_PERCENT] === 'number') {
        usePercent = parseFloat(k[COL_DAILY_USE_PERCENT].toFixed(4));
      } else if (k[COL_DAILY_USE_PERCENT] !== undefined && k[COL_DAILY_USE_PERCENT] !== null) {
        const parsed = parseFloat(k[COL_DAILY_USE_PERCENT]);
        usePercent = isNaN(parsed) ? parseFloat(Math.min(callsMade / QUOTA_PER_KEY, 1.0).toFixed(4)) : parseFloat(parsed.toFixed(4));
      } else {
        usePercent = parseFloat(Math.min(callsMade / QUOTA_PER_KEY, 1.0).toFixed(4));
      }
      usePercent = Math.min(Math.max(usePercent, 0.0), 1.0); // Clamp between 0.0 and 1.0

      return {
        name: k.name || 'Unknown Key', 
        callsMadeToday: callsMade,
        isFailedToday: isFailed, 
        lastFailedPtDate: k.lastFailedPtDate || null,
        apiDailyStatus: statusText,
        dailyUsePercent: usePercent
      };
    });

    if (totalKeys > 0 && detailedKeyStats.every(s => s.name === 'Unknown Key')) {
        console.warn("ApiKeyManager.getStats(): detailedKeyStats seems to contain only placeholder data. this.keys might not be populated correctly with names.");
    }
     if (detailedKeyStats.length === 0 && totalKeys > 0) {
        console.warn("ApiKeyManager.getStats(): detailedKeyStats is empty, but totalKeys > 0. Problem mapping this.keys.");
    }

    return {
      totalKeys,
      availableKeys: totalKeys - failedKeysCount,
      failedKeysToday: failedKeysCount, 
      lastResetDatePT: this.lastResetDatePT || this._getPacificDateString(new Date()),
      detailedKeyStats
    };
  }
}

let instance = null;
let apiKeyManagerPromise = null;

// getInstance is now async and manages a singleton promise for initialization
async function getInstance(callbacks = {}) {
  if (instance && instance.isInitialized) {
    if (callbacks && Object.keys(callbacks).length > 0 && !instance.callbacksSet) {
        console.log("ApiKeyManager.getInstance(): Applying new callbacks to existing instance.");
        instance.callbacks = callbacks;
        instance.callbacksSet = true;
    }
    return instance;
  }
  
  if (!apiKeyManagerPromise) {
    console.log("ApiKeyManager.getInstance(): Creating new ApiKeyManager instance promise.");
    apiKeyManagerPromise = new Promise(async (resolve, reject) => {
        try {
            const newInstance = new ApiKeyManager(callbacks); // Constructor starts _initializeManager
            await newInstance.initializationPromise; // Wait for its completion
            instance = newInstance; 
            instance.callbacksSet = (callbacks && Object.keys(callbacks).length > 0);
            console.log("ApiKeyManager.getInstance(): New instance initialized and resolved.");
            resolve(instance);
        } catch (error) {
            console.error("ApiKeyManager.getInstance(): Failed to initialize ApiKeyManager:", error);
            apiKeyManagerPromise = null; // Reset promise on failure so retry is possible
            reject(error);
        }
    });
  }
  return apiKeyManagerPromise;
}

module.exports = { getInstance }; 