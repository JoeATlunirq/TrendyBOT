const axios = require('axios');

const { 
    NOCODB_BASE_URL, 
    NOCODB_USERS_TABLE_ID, 
    NOCODB_API_TOKEN,
    NOCODB_EMAIL_COLUMN,
    NOCODB_PASSWORD_COLUMN,
    NOCODB_NAME_COLUMN,
    NOCODB_ONBOARDING_COLUMN,
    NOCODB_NICHE_COLUMN,
    NOCODB_NOTIF_CHANNELS_COLUMN,
    NOCODB_NOTIF_EMAIL_COLUMN,
    NOCODB_NOTIF_TELEGRAM_COLUMN,
    NOCODB_NOTIF_DISCORD_COLUMN,
    NOCODB_PAYPAL_SUB_ID_COLUMN,
    // NOCODB_TRACKED_CHANNELS_COLUMN // Uncomment if needed
} = process.env;

const nocoAxios = axios.create({
    baseURL: `${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_USERS_TABLE_ID}`,
    headers: {
        'xc-token': NOCODB_API_TOKEN
    }
});

const handleNocoError = (error, context) => {
    console.error(`NocoDB Service Error (${context}):`, error.response?.data || error.message);
    const message = error.response?.data?.msg || `Failed to ${context} user in NocoDB`;
    const status = error.response?.status || 500;
    const serviceError = new Error(message);
    serviceError.statusCode = status;
    throw serviceError;
};

/**
 * Finds a user record in NocoDB by email.
 * @param {string} email - The email to search for.
 * @returns {Promise<object|null>} The user object if found, otherwise null.
 */
const findUserByEmail = async (email) => {
    const emailColumn = NOCODB_EMAIL_COLUMN || 'email'; // Default to 'email'
    const params = {
        // NocoDB v2 filter syntax: (columnName, comparisonOperator, value)
        where: `(${emailColumn},eq,${email})`,
        limit: 1 // We only need one result
    };

    try {
        console.log(`Attempting to find user with email: ${email} using column: ${emailColumn}`);
        const response = await nocoAxios.get('/records', { params });
        console.log('NocoDB findUserByEmail response:', response.data);

        if (response.data?.list && response.data.list.length > 0) {
            return response.data.list[0]; // Return the first user found
        } else {
            return null; // User not found
        }
    } catch (error) {
        // Don't throw here if user not found (404 is expected), just return null
        // Only throw for actual server/network errors or unexpected NocoDB errors
        if (error.response && error.response.status !== 404) {
             handleNocoError(error, 'find user by email');
        } else if (!error.response) {
            // Network or other connection errors
             handleNocoError(error, 'find user by email');
        }
        // If it's a 404 or expected empty list, return null
        console.log(`User with email ${email} not found.`);
        return null; 
    }
};

/**
 * Creates a new user record in NocoDB.
 * @param {string} name - User's full name.
 * @param {string} email - User's email.
 * @param {string} hashedPassword - The hashed password.
 * @returns {Promise<object>} The newly created user object from NocoDB.
 */
const createUser = async (name, email, hashedPassword) => {
    const emailColumn = NOCODB_EMAIL_COLUMN || 'email';
    const passwordColumn = NOCODB_PASSWORD_COLUMN || 'password';
    const nameColumn = NOCODB_NAME_COLUMN || 'name';

    const userData = {
        [nameColumn]: name,
        [emailColumn]: email,
        [passwordColumn]: hashedPassword,
    };

    try {
        console.log('Attempting to create user:', { [nameColumn]: name, [emailColumn]: email });
        const response = await nocoAxios.post('/records', userData);
        console.log('NocoDB createUser response:', response.data);
        // NocoDB often returns the created object directly on POST
        return response.data; 
    } catch (error) {
        handleNocoError(error, 'create user');
    }
};

/**
 * Updates a user record in NocoDB.
 * @param {string} userId - The ID of the user to update (NocoDB's 'Id' field).
 * @param {object} dataToUpdate - An object containing the fields and values to update.
 * @returns {Promise<object>} The updated user object from NocoDB.
 */
const updateUser = async (userId, dataToUpdate) => {
    if (!userId || typeof dataToUpdate !== 'object' || Object.keys(dataToUpdate).length === 0) {
        throw new Error('Invalid arguments for updateUser');
    }

    // *** ASSUMPTION: NocoDB Primary Key column is named 'Id' ***
    // Prepare data for bulk update (array with one object)
    const updatePayload = [{
        Id: userId,
        ...dataToUpdate
    }];
    
    const bulkUpdateUrl = '/records';

    try {
        console.log(`Attempting bulk update for user ${userId} with payload:`, updatePayload);
        
        console.log(`[NocoDB UPDATE PRE-FLIGHT (Bulk)] Method: PATCH, URL: ${nocoAxios.defaults.baseURL}${bulkUpdateUrl}, Data:`, updatePayload);
        
        // Use Bulk PATCH /records with data in an array
        const response = await nocoAxios.patch(bulkUpdateUrl, updatePayload); 
        
        // NocoDB bulk update might return the updated records in an array
        console.log('NocoDB updateUser (bulk) response:', response.data);
        
        // Check if the response is an array and return the first element (assuming success)
        if (Array.isArray(response.data) && response.data.length > 0) {
            return response.data[0];
        } else {
            // Fallback or handle unexpected response format
            console.warn('NocoDB bulk update response format was unexpected. Returning constructed data.');
            return { Id: userId, ...dataToUpdate };
        }

    } catch (error) {
        console.error(`[NocoDB UPDATE FAILED (Bulk PATCH)] Payload:`, updatePayload, ` Status: ${error.response?.status}`, ` Response:`, error.response?.data);
        handleNocoError(error, `bulk update user ${userId}`);
    }
};

/**
 * Fetches a single user record from NocoDB by its primary ID.
 * @param {string} userId - The ID of the user record (NocoDB's 'Id' field).
 * @returns {Promise<object|null>} The user object if found, otherwise null.
 */
const getUserRecordById = async (userId) => {
    if (!userId) {
        console.error('getUserRecordById called without userId');
        return null; 
    }
    try {
        // NocoDB v2 uses GET /records/{recordId}
        // Note: This assumes the default primary key is 'Id'
        const response = await nocoAxios.get(`/records/${userId}`);
        console.log(`NocoDB getUserRecordById (${userId}) response status:`, response.status);
        return response.data; // Return the full user object
    } catch (error) {
        // Handle 404 specifically - user not found is not necessarily a throw-worthy error here
        if (error.response && error.response.status === 404) {
            console.warn(`User record not found for ID: ${userId}`);
            return null;
        }
        // Throw other errors to be handled by the controller
        handleNocoError(error, `get user record by id ${userId}`);
        return null; // Should be unreachable due to handleNocoError throwing
    }
};

/**
 * Finds a user record in NocoDB by their PayPal Subscription ID.
 * @param {string} subscriptionId - The PayPal Subscription ID to search for.
 * @returns {Promise<object|null>} The user object if found, otherwise null.
 */
const findUserBySubscriptionId = async (subscriptionId) => {
    const subIdColumn = NOCODB_PAYPAL_SUB_ID_COLUMN || 'paypal_subscription_id'; // Default column name
    if (!subscriptionId) {
        console.error('findUserBySubscriptionId called without subscriptionId');
        return null;
    }
    
    const params = {
        where: `(${subIdColumn},eq,${subscriptionId})`,
        limit: 1
    };

    try {
        console.log(`Attempting to find user with PayPal Sub ID: ${subscriptionId} using column: ${subIdColumn}`);
        const response = await nocoAxios.get('/records', { params });
        console.log('NocoDB findUserBySubscriptionId response:', response.data);

        if (response.data?.list && response.data.list.length > 0) {
            return response.data.list[0]; // Return the user found
        } else {
            console.log(`User with PayPal Sub ID ${subscriptionId} not found.`);
            return null; // User not found
        }
    } catch (error) {
        if (error.response && error.response.status !== 404) {
             handleNocoError(error, 'find user by subscription ID');
        } else if (!error.response) {
             handleNocoError(error, 'find user by subscription ID');
        }
        console.log(`Error finding user by subscription ID ${subscriptionId}, likely not found.`);
        return null; 
    }
};

/**
 * Finds user records based on a NocoDB filter string.
 * **PLACEHOLDER - ADAPT 'where' PARAMETER BASED ON NOCODB API DOCS**
 * @param {string} filterString - NocoDB API filter string (e.g., "(column,eq,value)~and(...)")
 * @returns {Promise<Array<object>>} List of user records matching the filter.
 * @throws {Error} If the API request fails.
 */
const findUsers = async (filterString) => {
    console.log(`NocoDBService.findUsers called with filter: ${filterString}`);
    try {
        // *** IMPORTANT: The parameter name for filtering (`where`, `filterByFormula`, etc.) ***
        // *** depends heavily on your NocoDB API version. CONSULT NOCODB DOCS! ***
        const response = await nocoAxios.get('/records', {
            params: {
                // COMMON NocoDB v1/v2 parameter name is 'where'
                where: filterString,
                // Other potential params if needed:
                // limit: 1000, // Adjust limit as needed
                // fields: 'Id,trial_expires_at,subscription_status,current_plan' // Fetch only needed fields
            }
        });

        // NocoDB usually returns data in a nested structure, e.g., response.data.list
        const userList = response.data?.list || response.data || []; // Adapt based on actual response structure
        console.log(`NocoDBService.findUsers found ${userList.length} users.`);
        return userList;

    } catch (error) {
        console.error('NocoDB findUsers Error:', error.response?.data || error.message);
        // Don't crash the scheduler, return empty list or re-throw based on desired behavior
        // throw new Error(`Failed to find users in NocoDB: ${error.response?.data?.msg || error.message}`);
        return []; // Return empty on error to prevent scheduler crash
    }
};

/**
 * Deletes a user record from NocoDB.
 * @param {string|number} userId - The ID of the user to delete.
 * @returns {Promise<boolean>} True if deletion was successful (or user didn't exist), false otherwise.
 * @throws {Error} If the API request fails unexpectedly.
 */
const deleteUser = async (userId) => {
    if (!userId) {
        console.error('deleteUser called without userId');
        return false;
    }
    try {
        console.log(`Attempting to delete user record with ID: ${userId}`);
        // NocoDB v2 DELETE /records expects IDs in the body
        const response = await nocoAxios.delete('/records', {
            data: {
                Id: userId // Use singular 'Id' based on the error message
            }
        });
        
        console.log(`NocoDB deleteUser response for ID ${userId}: Status ${response.status}`, response.data);
        return response.status >= 200 && response.status < 300;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.warn(`User record not found for deletion (ID: ${userId}), considering deletion successful.`);
            return true; 
        }
        // Check for the specific 422 error we saw
        if (error.response && error.response.status === 422) {
            console.error(`NocoDB validation error during delete for user ${userId}:`, error.response.data);
            // Re-throw a more specific error or handle differently if needed
        }
        handleNocoError(error, `delete user ${userId}`);
        return false; 
    }
};

module.exports = {
    findUserByEmail,
    createUser,
    updateUser,
    getUserRecordById,
    findUserBySubscriptionId,
    findUsers,
    deleteUser,
}; 