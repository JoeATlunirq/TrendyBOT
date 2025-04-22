const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const NocoDBService = require('../services/nocodb.service');
const SubscriptionLogicService = require('../services/subscriptionLogic.service');
const COLS = require('../config/nocodb_columns');
const { authenticator } = require('otplib');
const { sendEmail } = require('../services/email.service');

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
  const { name, email, password } = req.body;

  try {
    // Basic Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await NocoDBService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in NocoDB
    // Assume createUser only takes essential fields, others are set later
    const newUserBase = await NocoDBService.createUser(name, email, hashedPassword);
    if (!newUserBase || !newUserBase[COLS.USER_ID]) { // Check if ID exists
        throw new Error('Failed to create user record in NocoDB or missing ID.');
    }
    const userId = newUserBase[COLS.USER_ID];

    // Initialize Free Trial
    let trialResult = { success: false, message: 'Trial check skipped.' };
    try {
        trialResult = await SubscriptionLogicService.startFreeTrial(userId);
        if (trialResult.success) {
            console.log(`Trial initialized for new user ${userId}`);
            // Add trial info to user object if needed for response
            newUserBase[COLS.CURRENT_PLAN] = "Free Trial"; 
            newUserBase[COLS.SUBSCRIPTION_STATUS] = "Active";
            newUserBase[COLS.TELEGRAM_ACCESS_CODE] = trialResult.accessCode; // Include generated code
        } else {
            console.warn(`Trial not started for user ${userId}: ${trialResult.message}`);
             // Ensure user is marked appropriately if trial fails
             await NocoDBService.updateUser(userId, {
                 [COLS.CURRENT_PLAN]: "Inactive",
                 [COLS.SUBSCRIPTION_STATUS]: "Requires Subscription",
                 [COLS.IS_TRIAL_USED]: true // Mark as used even if failed
            });
             newUserBase[COLS.CURRENT_PLAN] = "Inactive";
             newUserBase[COLS.SUBSCRIPTION_STATUS] = "Requires Subscription";
        }
    } catch (trialError) {
        console.error(`Critical error during trial initialization for user ${userId}:`, trialError);
        // If trial fails catastrophically, should we delete the user? Or leave inactive?
        // For now, leave inactive
         try {
            await NocoDBService.updateUser(userId, {
                [COLS.CURRENT_PLAN]: "Inactive",
                [COLS.SUBSCRIPTION_STATUS]: "Requires Subscription",
                [COLS.IS_TRIAL_USED]: true
            });
            newUserBase[COLS.CURRENT_PLAN] = "Inactive";
            newUserBase[COLS.SUBSCRIPTION_STATUS] = "Requires Subscription";
        } catch (updateError) {
             console.error(`Failed to update user ${userId} status after trial init error:`, updateError);
        }
    }

    // Generate JWT
    const token = generateToken(userId); 

    // Exclude password from the response user object
    const { [COLS.PASSWORD]: _, ...userResponse } = newUserBase; // Use potentially updated newUserBase

    res.status(201).json({
      token,
      user: userResponse, // Send back user info (without password, with plan status)
    });

  } catch (error) {
    console.error('Signup Error:', error);
    // Handle specific errors (like duplicate email already handled)
    next(error); // Pass to generic error handler
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
    // Basic Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user by email
    const user = await NocoDBService.findUserByEmail(email);
    
    // --- ADD LOGGING HERE ---
    console.log('[Login Controller] User object received from NocoDBService:', JSON.stringify(user, null, 2));
    // ------------------------

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' }); // User not found
    }

    // Compare password
    const passwordColumn = COLS.PASSWORD; // Use COLS constant
    const isMatch = await bcrypt.compare(password, user[passwordColumn]);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' }); // Wrong password
    }

    // ---> Check if 2FA is enabled <----
    const is2FAEnabledColumn = COLS.IS_2FA_ENABLED; // Use COLS from config
    // --- ADD LOGGING HERE TOO ---
    console.log(`[Login Controller] Checking 2FA status. Column name: '${is2FAEnabledColumn}', Value in user object:`, user[is2FAEnabledColumn]);
    // --------------------------
    // --- UPDATED CHECK: Handle 1/0 or true/false from NocoDB ---
    const is2FAEnabled = user[is2FAEnabledColumn] === true || user[is2FAEnabledColumn] === 1 || user[is2FAEnabledColumn] === '1';
    // ----------------------------------------------------------
    if (is2FAEnabled) { // <-- Use the evaluated boolean
        // 2FA is required, send back a flag and userId
        console.log(`2FA required for user: ${user[COLS.USER_ID]}`);
        return res.status(200).json({
            twoFactorRequired: true,
            userId: user[COLS.USER_ID] // Send userId to use in the next step
        });
    } 
    // ---> End 2FA Check <----
    
    // If 2FA is not enabled, proceed with normal login
    console.log(`Standard login successful for user: ${user[COLS.USER_ID]}`);
    const token = generateToken(user[COLS.USER_ID]); // Use COLS constant for ID

    // Exclude password from the response user object
    const { [passwordColumn]: _, ...userWithoutPassword } = user;

    res.status(200).json({
      token,
      user: userWithoutPassword, // Send back user info (without password)
    });

  } catch (error) {
    console.error('Login Error:', error);
    // Pass error to the error handling middleware
    next(error); 
  }
};

/**
 * @desc    Verify 2FA code during login
 * @route   POST /api/auth/login/2fa/verify
 * @access  Public
 */
const verifyLogin2FA = async (req, res, next) => {
    const { userId, token } = req.body; // Get userId (from previous step) and 2FA token

    if (!userId || !token || !/\d{6}/.test(token)) {
        return res.status(400).json({ message: 'User ID and valid 6-digit token are required.' });
    }

    try {
        // Fetch the user record to get the secret
        const user = await NocoDBService.getUserRecordById(userId); // Use the service function
        if (!user) {
             return res.status(404).json({ message: 'User not found.' });
        }

        const secretColumn = COLS.TWO_FACTOR_SECRET; // Use COLS constant
        const secret = user[secretColumn];

        if (!secret) {
            // This shouldn't happen if 2FA was required, but good practice
            console.error(`Attempted 2FA login verification for user ${userId} but no secret found.`);
            return res.status(400).json({ message: '2FA is not configured correctly for this user.' });
        }

        // Verify the token
        const isValid = authenticator.verify({ token, secret });

        if (isValid) {
            // Token is valid, generate the final JWT and return user data
            console.log(`2FA verification successful for user: ${userId}`);
            const finalToken = generateToken(userId);

            // Exclude sensitive fields (password, 2FA secret)
            const passwordColumn = COLS.PASSWORD;
            const { 
                [passwordColumn]: _, 
                [secretColumn]: __, 
                ...userResponse 
            } = user;

            res.status(200).json({
                token: finalToken,
                user: userResponse
            });
        } else {
            // Token is invalid
            console.log(`Invalid 2FA token attempt during login for user: ${userId}`);
            res.status(401).json({ message: 'Invalid 2FA code.' });
        }

    } catch (error) {
        console.error(`Error verifying login 2FA for user ID: ${userId}:`, error);
        next(error); // Pass to generic error handler
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
        // 1. Find user by email
        const user = await NocoDBService.findUserByEmail(email);

        if (user) {
            // 2. Generate a secure random token
            const resetToken = crypto.randomBytes(32).toString('hex');

            // 3. Hash the token before saving to DB
            const hashedToken = crypto
                .createHash('sha256')
                .update(resetToken)
                .digest('hex');

            // 4. Set expiry (e.g., 1 hour from now)
            const expires = new Date(Date.now() + 3600000); // 1 hour

            // 5. Update user record in NocoDB with hashed token and expiry
            await NocoDBService.updateUser(user[COLS.USER_ID], {
                [COLS.PASSWORD_RESET_TOKEN]: hashedToken,
                [COLS.PASSWORD_RESET_EXPIRES]: expires.toISOString(),
            });

            // 6. Construct reset URL (adjust base URL as needed)
            // Ensure VITE_FRONTEND_URL is set in backend .env or hardcode for now
            const frontendBaseUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:5173'; 
            const resetUrl = `${frontendBaseUrl}/reset-password?token=${resetToken}`;

            // 7. Send the email
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

            await sendEmail({ 
                to: email, 
                subject: subject, 
                text: textBody, 
                html: htmlBody 
            });

            console.log(`Password reset email sent successfully to ${email}`);
        } else {
            // User not found - DO NOT reveal this to the user for security.
            // Still send a success response to prevent email enumeration.
            console.log(`Password reset requested for non-existent email: ${email}`);
        }

        // Always send a success response regardless of whether the user was found
        res.status(200).json({ message: 'If your email address is registered, you will receive a password reset link shortly.' });

    } catch (error) {
        console.error('Error requesting password reset:', error);
        // Generic error to the user
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
        // 1. Hash the incoming token to match the one stored in DB
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // 2. Find user by the *hashed* token and check expiry
        // NocoDB filter syntax needs care here.
        // where=(password_reset_token,eq,HASHED_TOKEN)~and(password_reset_expires,gt,NOW_ISO)
        const nowISO = new Date().toISOString();
        const filterString = `(${COLS.PASSWORD_RESET_TOKEN},eq,${hashedToken})~and(${COLS.PASSWORD_RESET_EXPIRES},gt,${nowISO})`;
        
        // Use the generic findUsers (or adapt/create a specific one if preferred)
        const users = await NocoDBService.findUsers(filterString);

        if (!users || users.length === 0) {
            console.log('Password reset attempt with invalid or expired token.');
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }

        // Assuming tokens are unique, there should only be one user
        const user = users[0];
        const userId = user[COLS.USER_ID];

        // 3. Hash the new password
        const salt = await bcrypt.genSalt(10);
        const newHashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Update the user's password and clear reset token fields
        await NocoDBService.updateUser(userId, {
            [COLS.PASSWORD]: newHashedPassword,
            [COLS.PASSWORD_RESET_TOKEN]: null,
            [COLS.PASSWORD_RESET_EXPIRES]: null,
        });

        console.log(`Password successfully reset for user ID: ${userId}`);
        
        // Optionally, send a confirmation email
        try {
            await sendEmail({ 
                to: user[COLS.EMAIL], 
                subject: 'Your Trendy Bot Password Has Been Changed', 
                text: 'Your password for Trendy Bot was successfully changed. If you did not make this change, please contact support immediately.', 
                html: '<p>Your password for Trendy Bot was successfully changed. If you did not make this change, please contact support immediately.</p>'
            });
        } catch (emailError) {
            console.error(`Failed to send password change confirmation email to user ${userId}:`, emailError);
            // Don't fail the main request if email fails
        }

        res.status(200).json({ message: 'Password reset successfully.' });

    } catch (error) {
        console.error('Error resetting password:', error);
        next(new Error('Failed to reset password. Please try again later.'));
    }
};

module.exports = {
  signup,
  login,
  verifyLogin2FA,
  requestPasswordReset,
  resetPassword,
}; 