# Discord-Claude-Agent

A Discord bot powered by the Anthropic API (Claude). Responds to messages in a channel with a customizable personality, supports image analysis, file reading, slash commands, web search, conversation memory, and multi-user tracking.

## Features

- **Conversation Memory** — remembers the last 20 messages per channel
- **Multi-User Tracking** — prefixes each message with the sender's username so the bot knows who's who
- **Vision** — analyze images posted in chat (base64 encoding, Claude vision API)
- **File Analysis** — reads text-based file attachments (code, CSV, logs, etc.)
- **Slash Commands** — `/ask`, `/roast`, `/search`, `/summarize`, `/analyze`, `/clear`
- **Web Search** — uses Claude's built-in web search tool
- **Rich Embeds** — search results and summaries displayed as Discord embeds
- **Message Splitting** — auto-splits long responses to fit Discord's 2000 char limit

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A Discord bot token ([Developer Portal](https://discord.com/developers/applications))
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com/))

### Install

```bash
git clone https://github.com/rainfantry/Discord-Claude-Agent.git
cd Discord-Claude-Agent
npm install
```

### Configure

Create a `.env` file in the project root:

```
DISCORD_BOT_TOKEN='your-discord-bot-token'
ANTHROPIC_API_KEY='sk-ant-your-key-here'
```

### Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. **Bot** tab → enable all 3 **Privileged Gateway Intents** (Presence, Server Members, Message Content)
4. Copy the bot token into `.env`
5. **OAuth2 → URL Generator** → check `bot` scope → check **Send Messages** + **Read Message History**
6. Open the generated URL to invite the bot to your server

### Register Slash Commands

Run once (or whenever you change commands):

```bash
node src/deploy-commands.js
```

> Edit `deploy-commands.js` line 63 and replace the application ID with your own.

### Run

```bash
node .
```

Bot responds to every message in channels it can see.

## Project Structure

```
src/
  bot.js              — Discord client, event handlers, slash commands
  claude.js           — Anthropic API wrapper, memory, vision, search
  deploy-commands.js  — One-time slash command registration
package.json
.env                  — Secrets (gitignored)
```

## Customization

### System Prompt

Edit `SYSTEM_PROMPT` in `src/claude.js` to change the bot's personality.

### Per-User Behavior

Add special rules for specific users by checking the `[Username]` prefix in the system prompt. See the example in `claude.js`.

### Model

Change the `model` field in `claude.js` to swap models (e.g. `claude-haiku-4-20250514` for cheaper/faster).

## Slash Commands

| Command | Description |
|---------|-------------|
| `/ask <question>` | Ask the bot a question |
| `/roast [@user]` | Personalized roast |
| `/search <query>` | Web search with embed results |
| `/summarize [count]` | Summarize recent channel messages |
| `/analyze <image> [question]` | Analyze an uploaded image |
| `/clear` | Wipe bot memory for this channel |

## License

MIT
