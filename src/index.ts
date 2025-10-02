import { TelegramBot } from "./telegram/telegram-bot.js";

async function main() {
    const tg = new TelegramBot();
    tg.start();
}

main();