const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config(); // Ensure environment variables are loaded

let client = null;
let isClientReady = false;

const initializeDiscordClient = () => {
    if (client) {
        console.log('Discord client already initialized.');
        return client;
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        console.warn('WARN: DISCORD_BOT_TOKEN environment variable not set. Discord DM functionality disabled.');
        return null;
    }

    console.log('Initializing Discord client...');
    client = new Client({
        intents: [
            GatewayIntentBits.Guilds, // Needed for some user fetching, even for DMs
            GatewayIntentBits.DirectMessages
        ],
        partials: [Partials.Channel, Partials.User], // Required to receive DMs
    });

    client.once('ready', () => {
        isClientReady = true;
        console.log(`Discord Bot logged in as ${client.user?.tag}! Ready to send DMs.`);
    });

    client.on('error', (error) => {
        console.error('Discord Client Error:', error);
        isClientReady = false; // Mark as not ready on error
    });
    
    client.on('warn', (warning) => {
        console.warn('Discord Client Warning:', warning);
    });

    // Login to Discord with your client's token
    const loginTimeout = 15000; // 15 seconds
    Promise.race([
        client.login(token),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Login timed out')), loginTimeout))
    ])
    .then(() => {
        // This block executes if login succeeds (though we already have the 'ready' event handler)
        console.log('Discord client login promise resolved.'); 
    })
    .catch(err => {
        // Log the *entire* error object to get more details
        console.error('<<<<< FAILED TO LOGIN DISCORD BOT (or Timed Out) >>>>>', JSON.stringify(err, Object.getOwnPropertyNames(err))); 
        client = null; // Reset client on login failure
    });

    return client;
};

const sendDiscordDM = async (discordUserId, messageContent) => {
    if (!client || !isClientReady) {
        console.error('Discord client not initialized or not ready. Cannot send DM.');
        return false;
    }
    if (!discordUserId) {
        console.error('No Discord User ID provided. Cannot send DM.');
        return false;
    }

    try {
        console.log(`Attempting to fetch user ${discordUserId} to send DM...`);
        console.log(`[discord.service] Value passed to client.users.fetch: ${discordUserId}, Type: ${typeof discordUserId}`);
        
        // FIX: Ensure the ID is passed as a string
        const userIdString = String(discordUserId); 
        
        const user = await client.users.fetch(userIdString); // Use the string version
        if (!user) {
            console.error(`Could not find Discord user with ID: ${userIdString}`);
            return false;
        }

        console.log(`Sending DM to ${user.tag} (ID: ${userIdString})`);
        await user.send(messageContent);
        console.log(`Successfully sent DM to ${user.tag}`);
        return true;
    } catch (error) {
        console.error(`Failed to send Discord DM to user ${discordUserId}:`, error);
        // Handle specific errors like "Cannot send messages to this user" (DMs disabled)
        if (error.code === 50007) { // DiscordAPIError[50007]: Cannot send messages to this user
             console.warn(`Cannot send DM to user ${discordUserId}. They might have DMs disabled or haven't interacted with the bot.`);
        }
        return false;
    }
};

module.exports = {
    initializeDiscordClient,
    sendDiscordDM,
    // Optionally export the client instance if needed elsewhere, but prefer exported functions
    // getDiscordClient: () => client 
}; 