const sgMail = require('@sendgrid/mail');

// Load SendGrid API Key and From Address
const { 
    SENDGRID_API_KEY, 
    EMAIL_FROM_ADDRESS // e.g., '"App Name" <verified@yourdomain.com>'
} = process.env;

// Basic check for essential SendGrid config
if (!SENDGRID_API_KEY || !EMAIL_FROM_ADDRESS) {
    console.warn('\n⚠️ WARNING: SendGrid environment variables (SENDGRID_API_KEY, EMAIL_FROM_ADDRESS) are not fully configured. Email sending will likely fail.\n');
}

// Set the API key for the SendGrid library
sgMail.setApiKey(SENDGRID_API_KEY);

/**
 * Sends an email using SendGrid.
 * 
 * @param {string} to Recipient email address.
 * @param {string} subject Email subject line.
 * @param {string} text Plain text body of the email.
 * @param {string} html HTML body of the email.
 * @returns {Promise<object>} The result from SendGrid's send function (usually includes response status code).
 * @throws {Error} If sending fails.
 */
const sendEmail = async ({ to, subject, text, html }) => {
    // Ensure required SendGrid variables are somewhat present before attempting
    if (!SENDGRID_API_KEY || !EMAIL_FROM_ADDRESS) {
        console.error('Cannot send email: SendGrid service is not configured in .env');
        throw new Error('Email service not configured.');
    }

    const msg = {
        to: to,
        from: EMAIL_FROM_ADDRESS, // Use the verified sender identity
        subject: subject,
        text: text, // Optional: SendGrid can generate this from HTML if omitted
        html: html,
        // Optional: Add categories, tracking settings, etc.
        // categories: ['password-reset'], 
        // trackingSettings: { clickTracking: { enable: false } }
    };

    try {
        console.log(`Attempting to send email via SendGrid to: ${to} with subject: ${subject}`);
        // send() returns an array, first element is the client response
        const [response] = await sgMail.send(msg);
        console.log(`SendGrid email sent successfully to ${to}. Status code: ${response.statusCode}`);
        return response; // Return the response object
    } catch (error) {
        console.error(`Error sending SendGrid email to ${to}:`);
        // Log SendGrid specific errors if available
        if (error.response) {
            console.error(error.response.body)
        }
        throw new Error(`Failed to send email via SendGrid. ${error.message}`); // Rethrow for controller to handle
    }
};

module.exports = { sendEmail }; 