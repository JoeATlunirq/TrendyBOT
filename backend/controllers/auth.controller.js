const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const NocoDBService = require('../services/nocodb.service');
const SubscriptionLogicService = require('../services/subscriptionLogic.service');
const COLS = require('../config/nocodb_columns');

// --- Helper Functions ---
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
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
 * @desc    Authenticate user and get token
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
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' }); // User not found
    }

    // Compare password
    const passwordColumn = COLS.PASSWORD; // Use COLS constant
    const isMatch = await bcrypt.compare(password, user[passwordColumn]);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' }); // Wrong password
    }

    // Generate JWT
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

module.exports = {
  signup,
  login,
}; 