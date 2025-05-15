const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { supabase, isSupabaseReady } = require('../services/supabase.service'); // Corrected typo
const { authenticator } = require('otplib');
const { sendEmail } = require('../services/email.service');
// const SubscriptionLogicService = require('../services/subscriptionLogic.service'); // Keep if still used, assess later

// Remove NocoDB specific imports
// const NocoDBService = require('../services/nocodb.service.js');
// const COLS = require('../config/nocodb_columns');

// --- Supabase Table and Column Constants ---
// Users Table
const USERS_TABLE = 'Users';
const USER_COL_ID = 'id'; // Assuming 'id' is the primary key in Supabase
const USER_COL_NAMES = 'Names'; // Or 'name' - verify actual column name
const USER_COL_EMAIL = 'Emails'; // Changed from 'email' to 'Emails'
const USER_COL_PASSWORD = 'Passwords'; // Changed from 'password' to 'Passwords'
const USER_COL_CURRENT_PLAN = 'current_plan'; // Assuming 'current_plan' not 'current_plan_id'
const USER_COL_SUBSCRIPTION_STATUS = 'subscription_status'; // Example, verify actual
const USER_COL_IS_TRIAL_USED = 'is_trial_used'; // Example, verify actual
const USER_COL_TELEGRAM_ACCESS_CODE = 'telegram_access_code'; // Verify actual
const USER_COL_IS_2FA_ENABLED = 'is_2fa_enabled'; // Verify actual
const USER_COL_TWO_FACTOR_SECRET = 'two_factor_secret'; // Verify actual
const USER_COL_PASSWORD_RESET_TOKEN = 'password_reset_token'; // Verify actual
const USER_COL_PASSWORD_RESET_EXPIRES = 'password_reset_expires'; // Verify actual
// Add other USER_COL_... as needed from the old COLS object and your Supabase schema

// AccessCodes Table
const ACCESS_CODES_TABLE = 'AccessCodes'; // Verify actual table name
const AC_COL_ID = 'id'; // Assuming 'id' is PK
const AC_COL_CODE = 'code'; // Verify actual column name for the access code string
const AC_COL_IS_USED = 'is_used'; // Verify actual
const AC_COL_USED_BY_USER_ID = 'used_by_user_id'; // Verify actual
const AC_COL_USED_AT = 'date_used'; // UPDATED from 'used_at'
// Add other AC_COL_... if needed

// --- Helper Functions ---
const generateToken = (userId) => {
  return jwt.sign({ userId: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
};

// --- Controller Functions ---

/**
 * @desc    Register a new user & initialize free trial
 * @route   POST /api/auth/signup
 * @access  Public
 */
const signup = async (req, res, next) => {
  const { name, email, password, accessCode } = req.body;

  try {
    if (!name || !email || !password || !accessCode) {
      return res.status(400).json({ message: 'Please provide name, email, password, and access code' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Validate Access Code with Supabase
    const { data: accessCodeRecord, error: accessCodeError } = await supabase
      .from(ACCESS_CODES_TABLE)
      .select('*')
      .eq(AC_COL_CODE, accessCode)
      .single();

    if (accessCodeError || !accessCodeRecord) {
      console.error('[Auth Signup] Error validating access code:', accessCodeError?.message || 'Access code not found');
      return res.status(400).json({ message: 'Invalid or expired access code.' });
    }
    if (accessCodeRecord[AC_COL_IS_USED]) {
      return res.status(400).json({ message: 'Access code has already been used.' });
    }
    // TODO: Add check for access code expiry if you have an expiry column

    // Check if user already exists with Supabase
    const { data: existingUser, error: existingUserError } = await supabase
      .from(USERS_TABLE)
      .select(USER_COL_ID)
      .eq(USER_COL_EMAIL, email)
      .maybeSingle(); // Use maybeSingle as user might not exist

    if (existingUserError && existingUserError.code !== 'PGRST116') { // PGRST116: 0 rows
        console.error('[Auth Signup] Error checking existing user:', existingUserError.message);
        throw existingUserError; 
    }
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in Supabase
    const newUserPayload = {
      [USER_COL_NAMES]: name,
      [USER_COL_EMAIL]: email,
      [USER_COL_PASSWORD]: hashedPassword,
      // Add any other default fields required by your Users table schema for new users
      // e.g., email_verified: false, if you have such a column
    };
    const { data: newUserBase, error: createUserError } = await supabase
      .from(USERS_TABLE)
      .insert(newUserPayload)
      .select()
      .single();

    if (createUserError || !newUserBase) {
        console.error('[Auth Signup] Failed to create user record in Supabase:', createUserError?.message || 'No user data returned');
        throw new Error('Failed to create user record or missing ID.');
    }
    const userId = newUserBase.id; // Supabase typically returns 'id' as primary key

    // Mark the access code as used
    const { error: markUsedError } = await supabase
      .from(ACCESS_CODES_TABLE)
      .update({ 
          [AC_COL_IS_USED]: true,
          [AC_COL_USED_BY_USER_ID]: userId,
          [AC_COL_USED_AT]: new Date().toISOString()
      })
      .eq(AC_COL_ID, accessCodeRecord.id); // Use the ID of the fetched access code record

    if (markUsedError) {
        console.error(`CRITICAL: Failed to mark access code ${accessCode} (ID: ${accessCodeRecord.id}) as used for user ${userId} AFTER user creation:`, markUsedError.message);
        // Consider rollback or cleanup strategy if this fails
    }

    const userForResponse = newUserBase; // Assign newUserBase directly

    // Generate JWT (remains the same)
    const token = generateToken(userId);

    // Exclude password and other sensitive fields from the response user object
    const { [USER_COL_PASSWORD]: _, [USER_COL_TELEGRAM_ACCESS_CODE]: __, ...userResponse } = userForResponse;
    // Add any other fields to exclude from the response, like 2FA secrets, reset tokens etc.

    res.status(201).json({
      token,
      user: userResponse,
    });

  } catch (error) {
    console.error('Signup Error:', error.message);
    // Ensure the error passed to next() is an actual Error object
    if (error instanceof Error) {
        next(error);
    } else {
        next(new Error(error.message || 'An unexpected error occurred during signup.'));
    }
  }
};

/**
 * @desc    Authenticate user and get token OR request 2FA
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!isSupabaseReady()) {
        console.error('[Auth Login] Supabase client not ready.');
        return res.status(503).json({ message: 'Server is temporarily unavailable. Please try again later.' });
    }

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user by email in Supabase
    // Select all columns needed for login logic and for the user object in response
    const { data: user, error: findUserError } = await supabase
      .from(USERS_TABLE)
      .select('*') // Or specify columns: `${USER_COL_ID}, ${USER_COL_EMAIL}, ${USER_COL_PASSWORD}, ${USER_COL_IS_2FA_ENABLED}, ...other_needed_columns`
      .eq(USER_COL_EMAIL, email)
      .maybeSingle(); // User might not exist

    if (findUserError && findUserError.code !== 'PGRST116') { // PGRST116: 0 rows, handled by !user check
        console.error('[Auth Login] Error finding user:', findUserError.message);
        throw findUserError;
    }

    if (!user) {
      console.log(`[Auth Login] User not found with email: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // console.log('[Auth Login] User object received from Supabase:', JSON.stringify(user, null, 2));

    // Compare password
    const isMatch = await bcrypt.compare(password, user[USER_COL_PASSWORD]);

    if (!isMatch) {
      console.log(`[Auth Login] Password mismatch for user: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if 2FA is enabled
    // Supabase boolean columns are true/false
    const is2FAEnabled = user[USER_COL_IS_2FA_ENABLED] === true;
    // console.log(`[Auth Login] Checking 2FA status. Column: '${USER_COL_IS_2FA_ENABLED}', Value:`, user[USER_COL_IS_2FA_ENABLED], 'Parsed as:', is2FAEnabled);
    
    if (is2FAEnabled) {
        console.log(`[Auth Login] 2FA required for user: ${user[USER_COL_ID]}`);
        return res.status(200).json({
            twoFactorRequired: true,
            userId: user[USER_COL_ID] // Or user.id directly if USER_COL_ID is 'id'
        });
    } 
    
    // If 2FA is not enabled, proceed with normal login
    console.log(`[Auth Login] Standard login successful for user: ${user[USER_COL_ID]}`);
    const token = generateToken(user[USER_COL_ID]);

    // Exclude password and other sensitive fields from the response user object
    const { 
        [USER_COL_PASSWORD]: _,
        [USER_COL_TWO_FACTOR_SECRET]: __, // Also exclude 2FA secret if present
        [USER_COL_PASSWORD_RESET_TOKEN]: ___,
        [USER_COL_PASSWORD_RESET_EXPIRES]: ____,
        ...userWithoutSensitiveData 
    } = user;

    res.status(200).json({
      token,
      user: userWithoutSensitiveData,
    });

  } catch (error) {
    console.error('Login Error:', error.message);
    if (error instanceof Error) {
        next(error);
    } else {
        next(new Error(error.message || 'An unexpected error occurred during login.'));
    }
  }
};

/**
 * @desc    Verify 2FA code during login
 * @route   POST /api/auth/login/2fa/verify
 * @access  Public
 */
const verifyLogin2FA = async (req, res, next) => {
    const { userId, token } = req.body;

    if (!userId || !token || !/^\d{6}$/.test(token)) { // Corrected regex test
        return res.status(400).json({ message: 'User ID and valid 6-digit token are required.' });
    }

    try {
        if (!isSupabaseReady()) {
            console.error('[Auth Verify2FA] Supabase client not ready.');
            return res.status(503).json({ message: 'Server is temporarily unavailable.' });
        }

        // Fetch the user record to get the secret
        // Construct select string carefully if USER_COL_... constants might have spaces or special chars (not typical)
        const selectColumns = [
            USER_COL_ID,
            USER_COL_EMAIL,
            USER_COL_PASSWORD, // Though not strictly needed for 2FA verify, often part of user object
            USER_COL_TWO_FACTOR_SECRET,
            USER_COL_NAMES
            // Add any other columns needed for the response user object
        ].join(',');

        const { data: user, error: findUserError } = await supabase
            .from(USERS_TABLE)
            .select(selectColumns)
            .eq(USER_COL_ID, userId)
            .single(); // Expect a single user

        if (findUserError || !user) {
            console.error(`[Auth Verify2FA] User not found with ID: ${userId}`, findUserError?.message);
            return res.status(404).json({ message: 'User not found.' });
        }

        const secret = user[USER_COL_TWO_FACTOR_SECRET];

        if (!secret) {
            console.error(`[Auth Verify2FA] Attempted 2FA login verification for user ${userId} but no secret found.`);
            return res.status(400).json({ message: '2FA is not configured correctly for this user.' });
        }

        // Verify the token (otplib authenticator usage remains the same)
        const isValid = authenticator.verify({ token, secret });

        if (isValid) {
            console.log(`[Auth Verify2FA] 2FA verification successful for user: ${userId}`);
            const finalToken = generateToken(userId); // JWT generation remains the same

            // Exclude sensitive fields (password, 2FA secret) from the response user object
            const { 
                [USER_COL_PASSWORD]: _,
                [USER_COL_TWO_FACTOR_SECRET]: __,
                [USER_COL_PASSWORD_RESET_TOKEN]: ___,
                [USER_COL_PASSWORD_RESET_EXPIRES]: ____,
                ...userResponse 
            } = user;

            res.status(200).json({
                token: finalToken,
                user: userResponse
            });
        } else {
            console.log(`[Auth Verify2FA] Invalid 2FA token attempt during login for user: ${userId}`);
            res.status(401).json({ message: 'Invalid 2FA code.' });
        }

    } catch (error) {
        console.error(`[Auth Verify2FA] Error verifying login 2FA for user ID: ${userId}:`, error.message);
        if (error instanceof Error) {
            next(error);
        } else {
            next(new Error(error.message || 'An unexpected error occurred during 2FA verification.'));
        }
    }
};

/**
 * @desc    Request a password reset link
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const requestPasswordReset = async (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Please provide an email address.' });
    }

    try {
        if (!isSupabaseReady()) {
            console.error('[Auth ReqPassReset] Supabase client not ready.');
            return res.status(503).json({ message: 'Server is temporarily unavailable.' });
        }

        // 1. Find user by email in Supabase
        const { data: user, error: findUserError } = await supabase
            .from(USERS_TABLE)
            .select(`${USER_COL_ID}, ${USER_COL_EMAIL}`) // Only need ID and email for this step
            .eq(USER_COL_EMAIL, email)
            .maybeSingle();

        if (findUserError && findUserError.code !== 'PGRST116') { // PGRST116 means 0 rows
            console.error('[Auth ReqPassReset] Error finding user by email:', findUserError.message);
            // Don't throw, proceed to generic success response to prevent email enumeration
        } else if (user) {
            // User found, proceed to generate and store token
            console.log(`[Auth ReqPassReset] User found for password reset: ${email} (ID: ${user.id})`);
            // 2. Generate a secure random token (remains the same)
            const resetToken = crypto.randomBytes(32).toString('hex');

            // 3. Hash the token before saving to DB (remains the same)
            const hashedToken = crypto
                .createHash('sha256')
                .update(resetToken)
                .digest('hex');

            // 4. Set expiry (e.g., 1 hour from now) (remains the same)
            const expires = new Date(Date.now() + 3600000); // 1 hour

            // 5. Update user record in Supabase with hashed token and expiry
            const { error: updateError } = await supabase
                .from(USERS_TABLE)
                .update({
                    [USER_COL_PASSWORD_RESET_TOKEN]: hashedToken,
                    [USER_COL_PASSWORD_RESET_EXPIRES]: expires.toISOString(),
                })
                .eq(USER_COL_ID, user.id); // Use user.id from the fetched record

            if (updateError) {
                console.error(`[Auth ReqPassReset] Failed to update user with reset token for ${email}:`, updateError.message);
                // Don't throw, proceed to generic success to prevent detailed error leakage
            } else {
                // 6. Construct reset URL (remains the same)
                const frontendBaseUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:5173'; 
                const resetUrl = `${frontendBaseUrl}/reset-password?token=${resetToken}`;

                // 7. Send the email (sendEmail service usage remains the same)
                const subject = 'Password Reset Request for Trendy Bot';
                const textBody = `You requested a password reset. Click the link below to reset your password. This link is valid for 1 hour.\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;
                const htmlBody = `
                    <p>You requested a password reset for your Trendy Bot account.</p>
                    <p>Click the link below to reset your password. This link is valid for <strong>1 hour</strong>.</p>
                    <p><a href="${resetUrl}" target="_blank">Reset Your Password</a></p>
                    <p>If you cannot click the link, copy and paste this URL into your browser:</p>
                    <p>${resetUrl}</p>
                    <p>If you did not request this, please ignore this email.</p>
                `;
                try {
                    await sendEmail({ 
                        to: email, 
                        subject: subject, 
                        text: textBody, 
                        html: htmlBody 
                    });
                    console.log(`[Auth ReqPassReset] Password reset email sent successfully to ${email}`);
                } catch (emailError) {
                    console.error(`[Auth ReqPassReset] Failed to send password reset email to ${email}:`, emailError.message);
                    // Log error but still send generic success to user
                }
            }
        } else {
            // User not found - DO NOT reveal this to the user for security.
            console.log(`[Auth ReqPassReset] Password reset requested for non-existent email: ${email}`);
        }

        // Always send a success response regardless of whether the user was found or if errors occurred server-side (except critical ones like DB down)
        res.status(200).json({ message: 'If your email address is registered, you will receive a password reset link shortly.' });

    } catch (error) {
        // This catch block is for truly unexpected errors (e.g. Supabase client itself failing catastrophically)
        console.error('[Auth ReqPassReset] Critical error requesting password reset:', error.message);
        // Generic error to the user in case of unexpected server issues
        next(new Error('Failed to process password reset request. Please try again later.')); 
    }
};

/**
 * @desc    Reset password using token
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Reset token and new password are required.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    try {
        if (!isSupabaseReady()) {
            console.error('[Auth ResetPassword] Supabase client not ready.');
            return res.status(503).json({ message: 'Server is temporarily unavailable.' });
        }

        // 1. Hash the incoming token to match the one stored in DB (remains the same)
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // 2. Find user by the *hashed* token and check expiry using Supabase
        const nowISO = new Date().toISOString();
        
        const { data: users, error: findUserError } = await supabase
            .from(USERS_TABLE)
            .select(`${USER_COL_ID}, ${USER_COL_EMAIL}`) // Select ID and email for later use
            .eq(USER_COL_PASSWORD_RESET_TOKEN, hashedToken)
            .gt(USER_COL_PASSWORD_RESET_EXPIRES, nowISO); // Check that expiry is greater than now
            // .maybeSingle(); // If tokens are unique, single() or maybeSingle() is appropriate
            // If multiple users could somehow have the same valid token (bad), then remove .maybeSingle()
            // For now, assuming it could be multiple if DB constraints aren't strict, then we take users[0]

        if (findUserError) {
            console.error('[Auth ResetPassword] Error finding user by reset token:', findUserError.message);
            return res.status(500).json({ message: 'Error validating reset token. Please try again.' });
        }

        if (!users || users.length === 0) {
            console.log('[Auth ResetPassword] Password reset attempt with invalid or expired token.');
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }

        // Assuming tokens should be unique for a valid reset, take the first user found.
        const userToReset = users[0];
        const userId = userToReset[USER_COL_ID];
        const userEmail = userToReset[USER_COL_EMAIL];

        // 3. Hash the new password (remains the same)
        const salt = await bcrypt.genSalt(10);
        const newHashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Update the user's password and clear reset token fields in Supabase
        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update({
                [USER_COL_PASSWORD]: newHashedPassword,
                [USER_COL_PASSWORD_RESET_TOKEN]: null,
                [USER_COL_PASSWORD_RESET_EXPIRES]: null,
            })
            .eq(USER_COL_ID, userId);

        if (updateError) {
            console.error(`[Auth ResetPassword] Failed to update password for user ID: ${userId}:`, updateError.message);
            return res.status(500).json({ message: 'Failed to reset password. Please try again later.' });
        }

        console.log(`[Auth ResetPassword] Password successfully reset for user ID: ${userId}`);
        
        // Optionally, send a confirmation email (sendEmail service usage remains the same)
        if (userEmail) {
            try {
                await sendEmail({ 
                    to: userEmail, 
                    subject: 'Your Trendy Bot Password Has Been Changed', 
                    text: 'Your password for Trendy Bot was successfully changed. If you did not make this change, please contact support immediately.', 
                    html: '<p>Your password for Trendy Bot was successfully changed. If you did not make this change, please contact support immediately.</p>'
                });
            } catch (emailError) {
                console.error(`[Auth ResetPassword] Failed to send password change confirmation email to user ${userId}:`, emailError.message);
                // Don't fail the main request if email fails, just log it.
            }
        } else {
            console.warn(`[Auth ResetPassword] User email not found for user ID: ${userId}, cannot send confirmation email.`);
        }

        res.status(200).json({ message: 'Password reset successfully.' });

    } catch (error) {
        console.error('[Auth ResetPassword] Critical error resetting password:', error.message);
        if (error instanceof Error) {
            next(error);
        } else {
            next(new Error(error.message || 'An unexpected error occurred while resetting password.'));
        }
    }
};

module.exports = {
  signup,
  login,
  verifyLogin2FA,
  requestPasswordReset,
  resetPassword,
}; 