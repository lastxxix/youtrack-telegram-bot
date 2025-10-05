import { TelegramBot } from "./telegram/telegram-bot.js";
import { YouTrackClient } from "./youtrack/youtrack-client.js";

async function main() {
    const tg = new TelegramBot();
    tg.start();
}

main();