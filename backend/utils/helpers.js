const crypto = require('crypto');

/**
 * Generates a secure random alphanumeric string.
 * @param {number} length - Desired length (12 recommended for Telegram code)
 * @returns {string} Random access code
 */
const generateTelegramAccessCode = (length = 12) => {
    if (length < 8) length = 8;
    if (length > 12) length = 12;
    // Generate random bytes, encode to hex for alphanumeric, slice to length
    const byteLength = Math.ceil(length / 2);
    return crypto.randomBytes(byteLength).toString('hex').slice(0, length);
};

module.exports = { generateTelegramAccessCode }; 