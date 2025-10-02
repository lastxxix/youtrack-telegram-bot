import dotenv from 'dotenv';

dotenv.config();
export const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
export const DB_PATH = process.env.DB_PATH || 'db/database.sqlite';
export const TELEGRAM_SERVER = process.env.TELEGRAM_SERVER || `https://api.telegram.org`;
export const BOT_COMMANDS = [
    { command: "help", description: "Show this help message." },
    { command: "start", description: "Start interacting with the bot." },
    { command: "setup", description: "Setup your YouTrack instance." },
    { command: "reset", description: "Resets the configuration." },
    { command: "list", description: "List all the projects in the instance."}
];


if(!TELEGRAM_TOKEN) {
    console.error("Error: TELEGRAM_TOKEN is not set in environment variables.");
    process.exit(1);
}