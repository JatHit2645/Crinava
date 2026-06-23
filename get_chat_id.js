import axios from 'axios';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === "your-bot-token-here") {
    console.error("❌ Error: TELEGRAM_BOT_TOKEN is not configured in your .env file.");
    console.log("Please create a bot via BotFather, get the token, and add it to your .env file first.");
    process.exit(1);
  }

  console.log("📡 Querying Telegram servers for updates...");
  try {
    const res = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`);
    const updates = res.data.result;

    if (!updates || updates.length === 0) {
      console.log("\n⚠️ No messages found yet.");
      console.log("👉 Please open Telegram, search for your bot, and send it a message (like 'hello' or '/start').");
      console.log("Then run this script again.");
      process.exit(0);
    }

    // Get the chat ID of the most recent message
    const lastUpdate = updates[updates.length - 1];
    const chatId = lastUpdate.message?.chat.id || lastUpdate.callback_query?.message?.chat.id;
    const sender = lastUpdate.message?.from?.username || "Admin";

    if (!chatId) {
      console.error("❌ Could not extract chat ID from the message.");
      process.exit(1);
    }

    console.log(`\n✅ Success! Found recent message from: @${sender}`);
    console.log(`🆔 Your Telegram Chat ID is: ${chatId}`);

    // Update the .env file automatically
    const envPath = path.join(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    if (envContent.includes('TELEGRAM_CHAT_ID=')) {
      envContent = envContent.replace(/TELEGRAM_CHAT_ID=".*?"/, `TELEGRAM_CHAT_ID="${chatId}"`);
    } else {
      envContent += `\nTELEGRAM_CHAT_ID="${chatId}"\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log("💾 Saved TELEGRAM_CHAT_ID to your .env file!");
    console.log("\n=======================================================");
    console.log("🎉 Telegram Bot setup is 100% complete!");
    console.log("=======================================================\n");

  } catch (err) {
    console.error("❌ API request failed. Make sure your bot token is correct.");
    console.error(err.message);
  }
}

main();
