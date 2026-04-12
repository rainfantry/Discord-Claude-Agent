# Discord-Claude-Agent

A Discord bot powered by the Anthropic API. Responds to every message in a channel with a customizable personality. Supports image analysis, file reading, slash commands, web search, conversation memory, and multi-user tracking.

## Features

- **Conversation Memory** — remembers the last 20 messages per channel
- **Multi-User Tracking** — each message is tagged with the sender's username so the bot tracks who's who
- **Vision** — analyze images posted in chat (base64 encoding → vision API)
- **File Analysis** — reads text-based file attachments (code, CSV, logs, etc.)
- **Slash Commands** — 6 built-in commands (see below)
- **Web Search** — built-in web search tool with results in rich embeds
- **Rich Embeds** — search results and summaries rendered as Discord embeds
- **Message Splitting** — auto-splits long responses to stay within Discord's 2000 char limit

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

Run once (or whenever you add/change commands):

```bash
node src/deploy-commands.js
```

> Edit `deploy-commands.js` and replace the application ID on line 63 with your own.

### Run

```bash
node .
```

Bot responds to every message in channels it has access to.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/ask <question>` | Ask the bot a question |
| `/roast [@user]` | Get a personalized roast (targets yourself if no user specified) |
| `/search <query>` | Search the web, results displayed in a rich embed |
| `/summarize [count]` | Summarize the last N messages in the channel (default 20, max 50) |
| `/analyze <image> [question]` | Upload an image for analysis, optionally ask a specific question about it |
| `/clear` | Wipe the bot's conversation memory for the current channel |

## Project Structure

```
src/
  bot.js              — Discord client, event handlers, slash command routing
  claude.js           — API wrapper, conversation memory, vision, web search
  deploy-commands.js  — One-time slash command registration with Discord
package.json
.env                  — Your tokens (gitignored)
```

## Customization

### Personality

Edit the `SYSTEM_PROMPT` constant in `src/claude.js`. The default personality is a warm but blunt older-brother figure who gives real life advice with casual profanity — supportive by default, brutally honest when needed.

### Per-User Rules

Add special behavior for specific users by referencing their `[Username]` prefix in the system prompt.

### Model

Change the `model` field in `claude.js` to use a different model (e.g. `claude-haiku-4-20250514` for cheaper/faster responses).

## License

MIT
