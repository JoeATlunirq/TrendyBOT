const bcrypt = require('bcryptjs');
const authenticator = require('authenticator');
const { getNocoClient } = require('../services/nocoClient');

// NocoDB table and column names from environment variables or defaults
const USER_TABLE = process.env.NOCODB_USER_TABLE || 'Users';
const EMAIL_COLUMN = process.env.NOCODB_EMAIL_COLUMN || 'Email';
const PASSWORD_COLUMN = process.env.NOCODB_PASSWORD_COLUMN || 'PasswordHash';
const PLAN_COLUMN = process.env.NOCODB_PLAN_COLUMN || 'Plan';
const STRIPE_CUSTOMER_ID_COLUMN = process.env.NOCODB_STRIPE_CUSTOMER_ID_COLUMN || 'StripeCustomerId';
const PHOTO_URL_COLUMN = process.env.NOCODB_PHOTO_URL_COLUMN || 'PhotoUrl';
const TWO_FACTOR_SECRET_COLUMN = process.env.NOCODB_2FA_SECRET_COLUMN || 'two_factor_secret';
const TWO_FACTOR_ENABLED_COLUMN = process.env.NOCODB_2FA_ENABLED_COLUMN || 'is_two_factor_enabled';
const ID_COLUMN = process.env.NOCODB_ID_COLUMN || 'Id'; // Assuming default primary key

// ... getProfile, updateProfile, setup2FA, verify2FA functions ...

exports.getProfile = async (req, res) => {
    // ... existing getProfile code ...
};

exports.updateProfile = async (req, res) => {
    // ... existing updateProfile code ...
};

exports.setup2FA = async (req, res) => {
    // ... existing setup2FA code ...
};

exports.verify2FA = async (req, res) => {
    // ... existing verify2FA code ...
};

// New function to disable 2FA
exports.disable2FA = async (req, res) => {
    const userId = req.user.id; // Get user ID from authenticated request
    const dbClient = req.dbClient;

    if (!userId) {
        return res.status(400).json({ message: 'User ID not found in token.' });
    }

    try {
        console.log(`Attempting to disable 2FA for user ID: ${userId}`);
        // Update the user record in NocoDB
        const updateResult = await dbClient.dbTableRow.update(USER_TABLE, userId, {
            [TWO_FACTOR_ENABLED_COLUMN]: false,
            [TWO_FACTOR_SECRET_COLUMN]: null, 
        });

        console.log('NocoDB update result for disabling 2FA:', updateResult); // Log the full result

        // NocoDB API typically returns the updated record or an acknowledgement.
        // Check if the update was likely successful (adjust based on actual NocoDB client response structure if needed)
        // If the client throws an error on failure, the catch block will handle it.
        if (updateResult) { // Basic check, might need refinement based on actual response
            console.log(`Successfully disabled 2FA for user ID: ${userId}`);
            res.status(200).json({ message: 'Two-factor authentication disabled successfully.' });
        } else {
             // This might indicate an issue if the client doesn't throw errors but returns a falsy value
             console.error(`Failed to disable 2FA for user ID: ${userId} - NocoDB update returned unexpected result.`);
            res.status(500).json({ message: 'Failed to disable 2FA. Unexpected response from database.' });
        }

    } catch (error) {
        console.error(`Error disabling 2FA for user ID: ${userId}`, error);
        // Check for specific NocoDB errors if possible, e.g., record not found
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(500).json({ message: 'Failed to disable 2FA due to a server error.' });
    }
};

exports.deleteAccount = async (req, res) => {
    // ... existing deleteAccount code ...
}; 