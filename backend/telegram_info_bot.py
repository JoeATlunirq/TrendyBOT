import os
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
import logging
from telegram.helpers import escape_markdown_v2

# Load environment variables
load_dotenv()

# Get bot token from environment variable
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

# Validate environment variables
if not BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN environment variable is not set. Please set it in your .env file.")

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO,
    handlers=[
        logging.FileHandler('telegram_bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Add error handler
async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Log the error and send a message to the user."""
    logger.error(f"Exception while handling an update: {context.error}")
    if update and update.effective_message:
        await update.effective_message.reply_text(
            "Sorry, something went wrong. Please try again later."
        )

# Handler for the /getinfo command
async def get_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        if not update.effective_user or not update.effective_chat:
            logger.error("No user or chat found in update")
            await update.message.reply_text("Sorry, I couldn't identify your chat. Please try again.")
            return

        user = update.effective_user
        chat = update.effective_chat
        
        # Validate chat ID
        if not chat.id:
            logger.error("No chat ID found")
            await update.message.reply_text("Sorry, I couldn't get your chat ID. Please try again.")
            return

        logger.info(f"Received /getinfo from user {user.id} in chat {chat.id}")
        
        # Prepare username part, escaping if necessary
        if user.username:
            username_part = f"@{escape_markdown_v2(user.username)}"
        else:
            username_part = '\(Not Set\)' # Already escaped
        
        # Escape the chat ID string just in case (though it should be numeric)
        escaped_chat_id = escape_markdown_v2(str(chat.id))

        msg = (
            f"🆔 Your Telegram User ID: `{user.id}`\n"
            f"👤 Username: {username_part}\n"
            f"💬 This Chat ID: `{escaped_chat_id}`\n\n"
            # Escape parentheses around the chat ID reference
            f"Please copy the **Chat ID** \(`{escaped_chat_id}`\) and paste it into the Trendy Notification Settings page\."
        )
        await update.message.reply_text(msg, parse_mode='MarkdownV2')
    except Exception as e:
        logger.error(f"Failed to send message for /getinfo: {e}")
        await update.message.reply_text("Sorry, I couldn't retrieve the info right now. Please try again later.")

# Main function to run the bot
async def main():
    try:
        # Create the Application and pass it your bot's token
        application = Application.builder().token(BOT_TOKEN).connect_timeout(30).read_timeout(30).pool_timeout(30).build()
        
        # Add command handler
        application.add_handler(CommandHandler("getinfo", get_info))
        
        # Add error handler
        application.add_error_handler(error_handler)
        
        # Start the bot
        logger.info("Starting bot...")
        await application.run_polling(allowed_updates=Update.ALL_TYPES)
    except Exception as e:
        logger.error(f"Failed to start bot: {e}")
        raise

if __name__ == "__main__":
    try:
        import asyncio
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot stopped due to error: {e}") 