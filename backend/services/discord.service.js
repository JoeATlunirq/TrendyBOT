const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config(); // Ensure environment variables are loaded

let client = null;
let isClientReady = false;
let initializePromise = null; // To prevent multiple initializations racing

const initializeDiscordClient = () => {
    // If initialization is already in progress, return the existing promise
    if (initializePromise) {
        console.log('Discord client initialization already in progress.');
        return initializePromise;
    }
    // If client is already ready, resolve immediately
    if (client && isClientReady) {
         console.log('Discord client already initialized and ready.');
         return Promise.resolve(client);
    }

    // Start the initialization process
    initializePromise = new Promise((resolve, reject) => {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            console.warn('WARN: DISCORD_BOT_TOKEN env var not set.');
            isClientReady = false;
            client = null;
            initializePromise = null; // Reset promise
            return reject(new Error('DISCORD_BOT_TOKEN not set'));
        }

        console.log('Attempting to initialize Discord client...');
        client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
            partials: [Partials.Channel, Partials.User],
        });

        client.once('ready', () => {
            if (client && client.user) {
                isClientReady = true;
                console.log(`Discord Bot logged in as ${client.user.tag}!`);
                initializePromise = null; // Reset promise on success
                resolve(client); // Resolve the promise with the client
            } else {
                 console.warn('Discord client \'ready\' event fired, but client/user null.');
                 isClientReady = false;
                 client = null;
                 initializePromise = null; // Reset promise
                 reject(new Error('Client ready event fired but client/user was null'));
            }
        });

        client.on('error', (error) => {
            console.error('Discord Client Error:', error);
            isClientReady = false;
            client = null; // Destroy client on error? Maybe just set to null.
            initializePromise = null; // Reset promise
            reject(error); // Reject the promise on error
        });
        
        client.on('warn', (warning) => console.warn('Discord Client Warning:', warning));

        // Login attempt
        const loginTimeout = 15000; // 15 seconds
        Promise.race([
            client.login(token),
            new Promise((_, rejectRace) => setTimeout(() => rejectRace(new Error('Login timed out')), loginTimeout))
        ])
        .then(() => console.log('Discord client login promise resolved (waiting for ready event).'))
        .catch(err => {
            console.error('<<<<< FAILED TO LOGIN DISCORD BOT (or Timed Out) >>>>>', JSON.stringify(err, Object.getOwnPropertyNames(err)));
            isClientReady = false;
            client = null;
            initializePromise = null; // Reset promise
            reject(err); // Reject the main promise
        });
    }); // End of new Promise

    return initializePromise;
};

const sendDiscordDM = async (discordUserId, messageContent) => {
    console.log(`Attempting to send DM to ${discordUserId}.`);
    try {
        // Ensure client is initialized and ready *before* proceeding
        // This will either resolve with the ready client or reject if initialization fails/times out
        console.log('Ensuring Discord client is ready...');
        await initializeDiscordClient(); 
        console.log(`Client ready state confirmed. isClientReady: ${isClientReady}, client exists: ${!!client}`);

        // Double-check after awaiting initialization (should be redundant but safe)
        if (!client || !isClientReady) {
             console.error('Client initialization awaited, but still not ready. Cannot send DM.');
             return false;
        }
        
        if (!discordUserId) {
            console.error('No Discord User ID provided. Cannot send DM.');
            return false;
        }

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
        // Catch errors from initializeDiscordClient OR from sending the DM
        console.error(`Error in sendDiscordDM (Initialization or Send):`, error);
         if (error.code === 50007) { 
              console.warn(`Cannot send DM to user ${discordUserId}. They might have DMs disabled.`);
         }
        return false;
    }
};

module.exports = {
    // initializeDiscordClient, // Maybe not needed externally anymore?
    sendDiscordDM,
}; 