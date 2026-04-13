# Discord-Claude-Agent

A Discord bot powered by the Anthropic API with optional local Ollama bots for multi-bot group chat. Supports image analysis, document parsing (PDF/DOCX), GitHub link reading, file analysis, slash commands, web search, conversation memory, multi-user tracking, and local LLM personas.

## Features

- **Conversation Memory** — remembers the last 20 messages per channel
- **Multi-User Tracking** — each message is tagged with the sender's username so the bot knows who's who
- **Vision** — analyze images posted in chat (base64 → vision API)
- **PDF Parsing** — upload a `.pdf` file and the bot extracts and reads the text content
- **DOCX Parsing** — upload a `.docx` (Word) file and the bot extracts and reads the text content
- **File Analysis** — reads text-based file attachments (code, CSV, logs, etc.)
- **GitHub Link Reading** — paste a GitHub URL and the bot fetches and reads the content:
  - **Repo link** (`github.com/user/repo`) → reads the README
  - **File link** (`github.com/user/repo/blob/main/file.js`) → reads the file content
  - **Issue/PR link** (`github.com/user/repo/issues/1`) → reads the issue or pull request
- **Slash Commands** — 6 built-in commands
- **Web Search** — built-in web search with results in rich embeds
- **Rich Embeds** — search and summary results as Discord embeds
- **Message Splitting** — auto-splits long responses for Discord's 2000 char limit
- **Ollama Group Chat** — run additional bot personas powered by local LLMs alongside the main bot
- **Hot-swappable Personas** — add/remove/edit bot personalities by editing JSON files

## Setup

### Step 1: Install Node.js

Download and install [Node.js](https://nodejs.org/) v18 or higher. Verify it's installed:

```bash
node --version
npm --version
```

### Step 2: Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name, click **Create**
3. Copy the **Application ID** from the General Information page — you'll need this later
4. Go to the **Bot** tab in the left sidebar
5. Click **Reset Token**, copy the token — this is your `DISCORD_BOT_TOKEN`
6. Scroll down to **Privileged Gateway Intents** and enable all three:
   - Presence Intent ✅
   - Server Members Intent ✅
   - Message Content Intent ✅
7. Click **Save Changes**

### Step 3: Invite the Bot to Your Server

1. Go to **OAuth2 → URL Generator** in the left sidebar
2. Under **Scopes**, tick `bot`
3. Under **Bot Permissions**, tick:
   - Send Messages ✅
   - Read Message History ✅
4. Copy the generated URL at the bottom
5. Paste it in your browser, select your server, click **Authorize**

### Step 4: Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Go to **API Keys**, create a new key
4. Copy it — this is your `ANTHROPIC_API_KEY`

### Step 5: Clone and Install

```bash
git clone https://github.com/rainfantry/Discord-Claude-Agent.git
cd Discord-Claude-Agent
npm install
```

### Step 6: Configure

Create a `.env` file in the project root:

```env
# Required
DISCORD_BOT_TOKEN=your-discord-bot-token
ANTHROPIC_API_KEY=sk-ant-your-key-here
APP_ID=your-application-id

# Optional (for group chat with Ollama bots)
CHANNEL_ID=your-channel-id
WEBHOOK_URL=your-webhook-url
WEBHOOK_ID=your-webhook-id
OLLAMA_URL=http://localhost:11434/api/chat
```

**How to get the optional values:**

- **CHANNEL_ID**: Right-click a channel in Discord → **Copy Channel ID** (enable Developer Mode in Discord Settings → App Settings → Advanced)
- **WEBHOOK_URL**: Right-click channel → **Edit Channel** → **Integrations** → **Webhooks** → **New Webhook** → **Copy Webhook URL**
- **WEBHOOK_ID**: The number in the webhook URL between `/webhooks/` and the next `/`

### Step 7: Register Slash Commands

Run this once (or whenever you add new commands):

```bash
node src/deploy-commands.js
```

Slash commands can take up to an hour to appear globally in Discord, but usually show up within a few minutes.

### Step 8: Start the Bot

```bash
node .
```

You should see `MRROBOT is online as [botname]#[number]`. The bot now responds to every message in channels it can see.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/ask <question>` | Ask the bot a question |
| `/roast [@user]` | Get a personalized roast (targets yourself if no user given) |
| `/search <query>` | Search the web, results in a rich embed |
| `/summarize [count]` | Summarize last N messages in the channel (default 20, max 50) |
| `/analyze <image> [question]` | Upload an image for analysis, optionally with a question |
| `/clear` | Wipe the bot's conversation memory for the current channel |

## Automatic Features (no command needed)

These work by just typing in any channel the bot can see:

| Feature | How to use |
|---------|-----------|
| **Chat** | Just type — the bot responds to every message |
| **Vision** | Drop an image in chat — the bot analyzes it |
| **PDF reading** | Upload a `.pdf` file — the bot extracts and reads the text |
| **DOCX reading** | Upload a `.docx` file — the bot extracts and reads the text |
| **File reading** | Upload any text file (.js, .csv, .log, .json, etc.) — the bot reads it |
| **GitHub links** | Paste a GitHub URL — the bot fetches and reads the content (repos, files, issues, PRs) |
| **Memory** | The bot remembers the last 20 messages per channel |
| **Multi-user** | The bot tracks who is who and addresses the right person |

### GitHub Link Examples

Just paste a link in your message and the bot will automatically fetch the content:

```
Check out this repo: https://github.com/rainfantry/Discord-Claude-Agent
```
→ Bot reads the README and responds about the project

```
What does this file do? https://github.com/rainfantry/Discord-Claude-Agent/blob/main/src/claude.js
```
→ Bot reads the source code and explains it

```
https://github.com/rainfantry/Discord-Claude-Agent/issues/1
```
→ Bot reads the issue and responds

## Group Chat (Optional — Local Ollama Bots)

Run additional bot personas powered by local LLMs through [Ollama](https://ollama.com/). These bots watch the same channel and chime in alongside the main bot.

### Setup

1. Install [Ollama](https://ollama.com/) and pull a model:

```bash
ollama pull llama3:8b
```

2. Set `CHANNEL_ID` and `WEBHOOK_URL` in your `.env` (see Step 6)

3. Edit or create persona files in `src/personas/`:

```json
{
    "name": "BotName",
    "model": "llama3:8b",
    "avatar": null,
    "system": "Your system prompt here. Keep responses to 1-3 sentences."
}
```

4. Run in a separate terminal:

```bash
node src/group-chat.js
```

### Managing Personas

- Each `.json` file in `src/personas/` is a bot personality
- Files starting with `_` are ignored (use `_template.json` as a starting point)
- Add a new bot: copy `_template.json`, rename it, edit the fields
- Remove a bot: delete the file or prefix it with `_`
- Change a bot's model: edit the `"model"` field to any model from `ollama list`
- Change personality: edit the `"system"` field
- Restart `group-chat.js` after any changes

### Anti-Loop Protection

- 30-second cooldown per bot between responses
- 60% random chance to stay quiet on any message
- Max 4 consecutive bot messages before forced silence
- Bots don't reply to their own webhook messages

## Project Structure

```
src/
  bot.js              — Discord client, event handlers, slash commands
  claude.js           — Anthropic API, conversation memory, vision, document parsing, GitHub fetching, web search
  deploy-commands.js  — One-time slash command registration
  group-chat.js       — Ollama-powered multi-bot group chat
  personas/           — Bot personality JSON files
    _template.json    — Copy this to create a new bot
    sgt.json          — Example: military sergeant persona
    codebreaker.json  — Example: hacker persona
package.json
.env                  — Your tokens (gitignored)
```

## Customization

### Main Bot Personality

Edit `SYSTEM_PROMPT` in `src/claude.js`. The default is a warm but blunt older-brother figure — supportive by default, honest when needed.

### Per-User Rules

Add special behavior for specific users by referencing their `[Username]` prefix in the system prompt.

### Model

Change the `model` field in `claude.js` to swap Anthropic models (e.g. `claude-haiku-4-20250514` for cheaper/faster).

## Supported File Types

| Type | Extension | How it works |
|------|-----------|-------------|
| Images | `.png`, `.jpg`, `.gif`, `.webp` | Sent to Claude's vision API as base64 |
| PDF | `.pdf` | Text extracted via `pdf-parse` |
| Word | `.docx` | Text extracted via `mammoth` |
| Text files | `.js`, `.py`, `.csv`, `.log`, `.json`, `.txt`, etc. | Read as plain text |
| GitHub URLs | Links in message text | Fetched automatically (repos, files, issues, PRs) |

All file content is capped at 10,000 characters to stay within API limits.

## License

MIT
