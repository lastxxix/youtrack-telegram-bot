# YouTrack Telegram Notification Bot

A Telegram bot that sends real-time notifications from YouTrack directly to your Telegram chat.

## Features

- 🆕 Create new issues directly from Telegram (`/create`)
- 🔔 Real-time notifications for YouTrack issues
- 💬 Comment updates
- 🎯 Per-user configuration
- 🔒 Secure token management
- 🌍 Multi-language support (Italian, English)

## Prerequisites

- Node.js 16+ and npm
- A Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- YouTrack instance URL
- YouTrack Permanent Token

## Installation

```bash
# Clone the repository
git clone https://github.com/lastxxix/youtrack-telegram-bot
cd youtrack-telegram-bot

# Install dependencies
npm install

# Build the project
npm run build

# Start the bot
npm start
```

## Configuration

### 1. Get Your Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather).
2. Send `/newbot` and follow the instructions.
3. Copy the bot token provided.

### 2. Get Your YouTrack Token

1. Log in to your YouTrack instance.
2. Go to your profile settings.
3. Navigate to "Authentication" → "Tokens".
4. Create a new permanent token with appropriate permissions.
5. Copy the token.

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Required
TELEGRAM_TOKEN=<your_telegram_bot_token>

# Optional
TELEGRAM_SERVER=""  # default: https://api.telegram.org
DB_PATH=""          # default: ./database.sqlite
```

## Usage

### Bot Commands

- `help` – Show this help message.
- `start` – Start interacting with the bot.
- `setup` – Setup your YouTrack instance.
- `reset` – Resets the configuration.
- `list` – List all the projects in the instance.
- `create` – Create a new Issue.

### Configuration Flow

1. Send `/setup` to the bot.
2. Enter your YouTrack instance URL (e.g., `https://youtrack.example.com`).
3. Enter your YouTrack permanent token.
4. The bot will validate your credentials.
5. Start receiving notifications!

### Issue Creation Flow

1. Send `/create` to the bot.
2. Enter the Issue title.
3. Optionally, enter a description or use `/skip`.
4. The bot creates a new issue in YouTrack with the provided details.

## How It Works

1. **User Configuration**: Users provide their YouTrack URL and token through the bot.
2. **Polling**: The bot polls YouTrack's notification endpoint every 30 seconds.
3. **Parsing**: Notifications are parsed and filtered based on timestamp.
4. **Formatting**: Messages are formatted with emojis and Markdown/HTML.
5. **Delivery**: Formatted notifications are sent to the user's Telegram chat.

## Notification Types

The bot handles various YouTrack events:

| Event Type | Icon | Description |
|------------|------|-------------|
| Comment Added | 💬 | New comment on an issue |
| Issue Created | 🆕 | New issue created |

## Configuration Options

### Supported Languages

The bot automatically handles localized field names and values:

- Italian: Stato, Priorità, Assegnatario
- English: State, Priority, Assignee