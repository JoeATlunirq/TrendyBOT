// backend/services/subscriptionLogic.service.js

const NocoDBService = require('./nocodb.service'); // Adjust path if needed
const COLS = require('../config/nocodb_columns'); // Adjust path if needed
const { generateTelegramAccessCode } = require('../utils/helpers'); // Adjust path
const { addDays, formatISO, isBefore } = require('date-fns');

/**
 * Handles the logic for starting a free trial for a user.
 * Checks eligibility and updates NocoDB record.
 *
 * @param {string|number} userId The ID of the user.
 * @returns {Promise<{success: boolean, message: string, accessCode?: string}>} Operation result.
 */
async function startFreeTrial(userId) {
    console.log(`Attempting to start free trial for user ID: ${userId}`);
    try {
        const user = await NocoDBService.getUserRecordById(userId);
        if (!user) {
            console.error(`startFreeTrial failed: User not found with ID: ${userId}`);
            return { success: false, message: 'User not found.' };
        }

        // --- Check 1: Has trial already been used? ---
        if (user[COLS.IS_TRIAL_USED] === true) {
            console.log(`User ${userId} has already used their trial.`);
            return { success: false, message: 'Free trial already used for this account.' };
        }

        // --- Proceed with Trial Initialization ---
        const now = new Date();
        const trialExpires = addDays(now, 3);
        const accessCode = generateTelegramAccessCode(12); // 12 chars alphanumeric

        const trialUpdateData = {
            [COLS.TRIAL_STARTED_AT]: formatISO(now),
            [COLS.TRIAL_EXPIRES_AT]: formatISO(trialExpires),
            [COLS.IS_TRIAL_USED]: true,
            [COLS.SUBSCRIPTION_STATUS]: "Active", // Use exact string expected by NocoDB/frontend
            [COLS.CURRENT_PLAN]: "Free Trial", // Use exact string
            [COLS.TELEGRAM_ACCESS_CODE]: accessCode,
            [COLS.IS_TELEGRAM_CODE_VALID]: true
        };

        console.log(`Updating user ${userId} with trial data:`, trialUpdateData);
        await NocoDBService.updateUser(userId, trialUpdateData);
        console.log(`Free trial successfully started for user ${userId}. Access code: ${accessCode}`);

        return {
            success: true,
            message: 'Free trial started successfully.',
            accessCode: accessCode // Return code so it can be shown to user
        };

    } catch (error) {
        console.error(`Error starting free trial for user ${userId}:`, error);
        return { success: false, message: 'An unexpected error occurred while starting the trial.' };
    }
}

/**
 * Handles the logic when a user subscribes to the "Viral" plan.
 * Updates plan/status and generates a new valid Telegram access code.
 *
 * @param {string|number} userId The ID of the user.
 * @returns {Promise<{success: boolean, message: string, accessCode?: string}>} Operation result.
 */
async function handleViralSubscription(userId) {
    console.log(`Handling 'Viral' plan subscription for user ID: ${userId}`);
    try {
        // Fetch user to confirm existence (good practice)
        const user = await NocoDBService.getUserRecordById(userId);
        if (!user) {
            console.error(`handleViralSubscription failed: User not found with ID: ${userId}`);
            return { success: false, message: 'User not found.' };
        }

        const accessCode = generateTelegramAccessCode(12);

        const viralUpdateData = {
            [COLS.CURRENT_PLAN]: "Viral", // Ensure correct casing
            [COLS.SUBSCRIPTION_STATUS]: "Active",
            [COLS.TELEGRAM_ACCESS_CODE]: accessCode,
            [COLS.IS_TELEGRAM_CODE_VALID]: true
            // Do not touch trial dates here
        };

        console.log(`Updating user ${userId} for Viral plan:`, viralUpdateData);
        await NocoDBService.updateUser(userId, viralUpdateData);
        console.log(`User ${userId} successfully subscribed to Viral plan. New access code: ${accessCode}`);

        return {
            success: true,
            message: 'Successfully subscribed to Viral plan.',
            accessCode: accessCode
        };
    } catch (error) {
        console.error(`Error handling Viral subscription for user ${userId}:`, error);
        return { success: false, message: 'An unexpected error occurred during subscription.' };
    }
}

/**
 * Handles the logic for other plan subscriptions (Surge, Spark)
 * where NO Telegram access code should be generated.
 *
 * @param {string|number} userId The ID of the user.
 * @param {string} planName The name of the plan ("Surge", "Spark").
 * @returns {Promise<{success: boolean, message: string}>} Operation result.
 */
async function handleOtherSubscription(userId, planName) {
    console.log(`Handling '${planName}' plan subscription for user ID: ${userId}`);
    if (planName !== "Surge" && planName !== "Spark") {
         console.warn(`handleOtherSubscription called with invalid plan: ${planName}`);
         return { success: false, message: 'Invalid plan specified.' };
    }
    try {
        const otherPlanUpdateData = {
            [COLS.CURRENT_PLAN]: planName,
            [COLS.SUBSCRIPTION_STATUS]: "Active",
            // Explicitly DO NOT generate or update TELEGRAM_ACCESS_CODE
            // Explicitly DO NOT update IS_TELEGRAM_CODE_VALID
        };

        console.log(`Updating user ${userId} for ${planName} plan:`, otherPlanUpdateData);
        await NocoDBService.updateUser(userId, otherPlanUpdateData);
        console.log(`User ${userId} successfully subscribed to ${planName} plan.`);

        return {
            success: true,
            message: `Successfully subscribed to ${planName} plan.`
        };
    } catch (error) {
        console.error(`Error handling ${planName} subscription for user ${userId}:`, error);
        return { success: false, message: 'An unexpected error occurred during subscription.' };
    }
}


/**
 * Verifies a submitted Telegram access code against the stored code.
 * If valid, updates the user's Telegram Chat ID and invalidates the code.
 *
 * @param {string|number} userId The ID of the user.
 * @param {string} submittedCode The code entered by the user.
 * @param {string} telegramChatId The user's actual Telegram Chat ID.
 * @returns {Promise<{success: boolean, message: string}>} Verification result.
 */
async function verifyTelegramCodeAndUpdate(userId, submittedCode, telegramChatId) {
    console.log(`Attempting Telegram verification for user ${userId} with chat ID ${telegramChatId}`);
    try {
        const user = await NocoDBService.getUserRecordById(userId);
        if (!user) {
            console.error(`verifyTelegramCodeAndUpdate failed: User not found with ID: ${userId}`);
            return { success: false, message: 'User not found.' };
        }

        const expectedCode = user[COLS.TELEGRAM_ACCESS_CODE];
        const isCodeCurrentlyValid = user[COLS.IS_TELEGRAM_CODE_VALID];

        // --- Check 1: Code existence and match ---
        if (!expectedCode || expectedCode !== submittedCode) {
            console.warn(`Invalid Telegram code attempt for user ${userId}. Submitted: ${submittedCode}, Expected: ${expectedCode}`);
            return { success: false, message: 'Invalid verification code.' };
        }

        // --- Check 2: Is the code marked as valid? ---
        if (isCodeCurrentlyValid !== true) {
            console.warn(`Attempt to use invalid/used Telegram code for user ${userId}. Code: ${submittedCode}`);
            return { success: false, message: 'Verification code has already been used or is invalid.' };
        }

        // --- Checks passed, proceed with update ---
        const verificationUpdateData = {
            [COLS.TELEGRAM_CHAT_ID]: telegramChatId,   // Store the verified Chat ID
            [COLS.IS_TELEGRAM_CODE_VALID]: false      // Invalidate the code
        };

        console.log(`Telegram code verified for user ${userId}. Updating record:`, verificationUpdateData);
        await NocoDBService.updateUser(userId, verificationUpdateData);
        console.log(`Telegram Chat ID updated and code invalidated for user ${userId}.`);

        return { success: true, message: 'Telegram account connected successfully.' };

    } catch (error) {
        console.error(`Error verifying Telegram code for user ${userId}:`, error);
        return { success: false, message: 'An unexpected error occurred during verification.' };
    }
}

/**
 * Finds users whose trial has expired and deactivates them.
 * To be run by a scheduler (e.g., daily).
 *
 * @returns {Promise<void>}
 */
async function expireInactiveTrials() {
    console.log(`[${new Date().toISOString()}] Running trial expiry check...`);
    const now = new Date();
    const nowISO = formatISO(now);

    // --- Construct NocoDB Filter String ---
    // Find users where:
    // - trial_expires_at < NOW
    // - AND subscription_status = 'Active'
    // - AND current_plan = 'Free Trial'
    // IMPORTANT: Adjust filter syntax based on your NocoDB API version/capabilities!
    const filter = `(${COLS.TRIAL_EXPIRES_AT},lt,${nowISO})~and(${COLS.SUBSCRIPTION_STATUS},eq,Active)~and(${COLS.CURRENT_PLAN},eq,Free%20Trial)`;

    try {
        console.log(`Executing NocoDB findUsers with filter: ${filter}`);
        // Assume findUsers returns a list [{ Id: 1, ... }, { Id: 2, ... }] or an empty list
        const expiredTrialUsers = await NocoDBService.findUsers(filter);

        if (!expiredTrialUsers || expiredTrialUsers.length === 0) {
            console.log(`[${new Date().toISOString()}] No expired trials found needing deactivation.`);
            return;
        }

        console.log(`[${new Date().toISOString()}] Found ${expiredTrialUsers.length} users with expired trials.`);

        for (const user of expiredTrialUsers) {
            const userId = user[COLS.USER_ID]; // Make sure COLS.USER_ID is correct ('Id')
            if (!userId) {
                console.warn("Skipping user record with missing ID during expiry check:", user);
                continue;
            }
            console.log(`Processing expired trial for user ID: ${userId}`);

            // Double-check expiry in code
            if (user[COLS.TRIAL_EXPIRES_AT] && isBefore(new Date(user[COLS.TRIAL_EXPIRES_AT]), now)) {

                const expiryUpdateData = {
                    [COLS.IS_TELEGRAM_CODE_VALID]: false, // Invalidate code on expiry
                    [COLS.SUBSCRIPTION_STATUS]: "Inactive",
                    [COLS.CURRENT_PLAN]: "" // Set plan to blank or null
                };

                try {
                    console.log(`Deactivating user ${userId} due to trial expiry. Update data:`, expiryUpdateData);
                    await NocoDBService.updateUser(userId, expiryUpdateData);
                    console.log(`Successfully deactivated user ${userId}.`);
                } catch (updateError) {
                    console.error(`Failed to deactivate user ${userId} after trial expiry:`, updateError);
                }
            } else {
                 console.log(`Skipping user ${userId} - expiry date (${user[COLS.TRIAL_EXPIRES_AT]}) not before now (${nowISO}) upon detailed check.`);
            }
        }
        console.log(`[${new Date().toISOString()}] Finished trial expiry check.`);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Critical error during trial expiry check (maybe findUsers failed or filter is wrong):`, error);
    }
}


module.exports = {
    startFreeTrial,
    handleViralSubscription,
    handleOtherSubscription,
    verifyTelegramCodeAndUpdate,
    expireInactiveTrials
}; 