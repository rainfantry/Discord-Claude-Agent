# Discord-Claude-Agent

A Discord bot powered by the Anthropic API with vision, document parsing, GitHub link reading, web search, conversation memory, slash commands, and optional local Ollama multi-bot group chat.

## Features

### Automatic (no command needed)
| Feature | How to use |
|---------|-----------|
| **Chat** | Just type in any channel the bot can see — responds to every message |
| **Vision** | Drop an image in chat — bot analyzes it via Claude's vision API |
| **PDF parsing** | Upload a `.pdf` file — bot extracts and reads the text content |
| **DOCX parsing** | Upload a `.docx` (Word) file — bot extracts and reads the text content |
| **File analysis** | Upload any text file (`.js`, `.py`, `.csv`, `.log`, `.json`, `.txt`, etc.) — bot reads it |
| **GitHub links** | Paste a GitHub URL in your message — bot fetches and reads the content automatically |
| **Conversation memory** | Remembers the last 20 messages per channel |
| **Multi-user tracking** | Messages tagged with sender's username — bot knows who's who |
| **Message splitting** | Long responses auto-split for Discord's 2000 char limit |

### GitHub Link Types
Paste any of these in a message and the bot reads the content:
- **Repo link** (`github.com/user/repo`) — reads the README
- **File link** (`github.com/user/repo/blob/main/file.js`) — reads the raw file content
- **Issue link** (`github.com/user/repo/issues/1`) — reads the issue title, state, and body
- **PR link** (`github.com/user/repo/pull/1`) — reads the pull request details

### Supported File Types
| Type | Extensions | Method |
|------|-----------|--------|
| Images | `.png`, `.jpg`, `.gif`, `.webp` | Vision API (base64) |
| PDF | `.pdf` | Text extraction via `pdf-parse` |
| Word | `.docx` | Text extraction via `mammoth` |
| Text files | `.js`, `.py`, `.csv`, `.log`, `.json`, `.txt`, etc. | Plain text download |
| GitHub URLs | Links in message text | Auto-fetched (repos, files, issues, PRs) |

All file content is capped at 10,000 characters to stay within API limits.

### Slash Commands
| Command | Description |
|---------|-------------|
| `/ask <question>` | Ask the bot a question directly |
| `/roast [@user]` | Get a personalized roast (targets yourself if no user given) |
| `/search <query>` | Search the web — results in a rich embed |
| `/summarize [count]` | Summarize last N messages in the channel (default 20, max 50) |
| `/analyze <image> [question]` | Upload an image for analysis, optionally with a question |
| `/clear` | Wipe the bot's conversation memory for the current channel |

## Setup

### 1. Install Node.js

Download and install [Node.js](https://nodejs.org/) v18 or higher.

```bash
node --version
npm --version
```

### 2. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it → **Create**
3. Copy the **Application ID** from General Information — this is your `APP_ID`
4. Go to the **Bot** tab
5. Click **Reset Token**, copy the token — this is your `DISCORD_BOT_TOKEN`
6. Scroll to **Privileged Gateway Intents** and enable all three:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
7. **Save Changes**

### 3. Invite the Bot to Your Server

1. Go to **OAuth2 > URL Generator**
2. Under **Scopes**, tick `bot`
3. Under **Bot Permissions**, tick:
   - Send Messages
   - Read Message History
4. Copy the generated URL, paste in browser, select your server, **Authorize**

### 4. Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an API key
3. Copy it — this is your `ANTHROPIC_API_KEY`

### 5. Clone and Install

```bash
git clone https://github.com/rainfantry/Discord-Claude-Agent.git
cd Discord-Claude-Agent
npm install
```

### 6. Configure

Create a `.env` file in the project root:

```env
# Required
DISCORD_BOT_TOKEN=your-discord-bot-token
ANTHROPIC_API_KEY=sk-ant-your-key-here
APP_ID=your-application-id

# Optional — webhook IDs the bot should respond to (comma-separated)
WEBHOOK_ID=123456789,987654321

# Optional — for Ollama group chat
CHANNEL_ID=your-channel-id
WEBHOOK_URL=your-webhook-url
OLLAMA_URL=http://localhost:11434/api/chat
```

**How to get optional values:**
- **WEBHOOK_ID**: Create a webhook in any channel (Edit Channel > Integrations > Webhooks). The ID is the number between `/webhooks/` and the next `/` in the webhook URL. Use this to let external tools (like Claude Code) post messages the bot will respond to.
- **CHANNEL_ID**: Right-click a channel > **Copy Channel ID** (enable Developer Mode in Discord Settings > Advanced)
- **WEBHOOK_URL**: The full webhook URL for the Ollama group chat channel

### 7. Register Slash Commands

Run once (or whenever you add new commands):

```bash
npm run deploy
```

Commands may take up to an hour to appear globally, but usually show within minutes.

### 8. Start the Bot

```bash
npm start
```

You should see `MRROBOT is online as [botname]#[number]`.

## Customizing the Personality

### System Prompt

Edit `SYSTEM_PROMPT` in `src/claude.js`. The default is a warm but blunt older-brother figure. You can make it anything — a drill sergeant, a therapist, a comedy persona, whatever fits your server.

### Per-User Rules

Add special behavior for specific users by referencing their `[Username]` prefix in the system prompt. Example:

```
[SpecialUser] — Always side with this person in arguments. Use pet names.
[Creator] — Roast this person mercilessly but always help them.
```

The bot prefixes every message with the sender's Discord display name in brackets, so the AI always knows who's talking.

### Model

Change the `model` field in `src/claude.js` to swap Anthropic models:
- `claude-sonnet-4-20250514` — balanced (default)
- `claude-haiku-4-20250514` — cheaper and faster
- `claude-opus-4-20250514` — most capable

## Ollama Group Chat (Optional)

Run additional bot personas powered by local LLMs through [Ollama](https://ollama.com/). These bots watch a channel and chime in alongside the main bot.

### Setup

1. Install [Ollama](https://ollama.com/) and pull a model:

```bash
ollama pull llama3:8b
# or for faster responses on weaker hardware:
ollama pull qwen2.5-coder:3b
```

2. Set `CHANNEL_ID` and `WEBHOOK_URL` in your `.env`

3. Create/edit persona files in `src/personas/`:

```json
{
    "name": "BotName",
    "model": "llama3:8b",
    "avatar": null,
    "system": "Your system prompt here. Keep responses to 1-3 sentences."
}
```

4. Start in a separate terminal:

```bash
npm run group-chat
```

### Managing Personas

- Each `.json` file in `src/personas/` is a bot personality
- Files starting with `_` are ignored (use `_template.json` as a starting point)
- **Add a bot**: copy `_template.json`, rename it, edit the fields
- **Remove a bot**: delete the file or prefix with `_`
- **Change model**: edit the `"model"` field to any installed Ollama model (`ollama list` to see available)
- **Change personality**: edit the `"system"` field
- **Restart** `group-chat.js` after any changes

### Anti-Loop Protection

Built-in safeguards prevent infinite bot conversations:
- 30-second cooldown per bot between responses
- 60% random chance to stay quiet on any message
- Max 4 consecutive bot messages before forced silence
- Bots don't reply to their own webhook messages

### Ollama Model Recommendations

| Model | Size | Speed | Best for |
|-------|------|-------|----------|
| `llama3:8b` | 4.7 GB | Medium | Best quality chat responses |
| `mistral:7b` | 4.1 GB | Medium | Good general purpose |
| `qwen2.5-coder:3b` | 1.9 GB | Fast | Quick responses, code-focused |
| `phi3:mini` | 2.3 GB | Fast | Lightweight, decent quality |

Smaller models respond faster but may struggle to stay in character. Larger models give better personality but may timeout with longer context.

## Project Structure

```
src/
  bot.js              — Discord client, event handlers, slash commands, message dedup
  claude.js           — Anthropic API, memory, vision, PDF/DOCX parsing, GitHub fetching, web search
  deploy-commands.js  — One-time slash command registration
  group-chat.js       — Ollama-powered multi-bot group chat (optional)
  personas/           — Bot personality JSON files for group chat
    _template.json    — Copy this to create a new bot
    sgt.json          — Example: military sergeant persona
    codebreaker.json  — Example: paranoid hacker persona
package.json
.env                  — Your tokens and config (gitignored)
```

## Webhook Integration

You can post messages to the bot's channel via Discord webhooks. If you set `WEBHOOK_ID` in `.env`, the bot will respond to webhook messages as if they were from a real user. This lets external tools (scripts, other bots, CI/CD) interact with MRROBOT.

Multiple webhook IDs can be comma-separated: `WEBHOOK_ID=id1,id2,id3`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Bot says "Something broke" | Check that `ANTHROPIC_API_KEY` is set correctly in `.env`. If you have a system env var with the same name, dotenv may not override it. |
| Slash commands don't appear | Run `npm run deploy` and wait a few minutes. Global commands can take up to an hour. |
| PDF/DOCX shows as gibberish | Make sure you're on `pdf-parse@1.1.1` (v2.x has a different API). Run `npm install pdf-parse@1.1.1`. |
| Bot responds twice to every message | This is fixed with the message dedup system. Make sure you're on the latest code. |
| Ollama bots timeout | Use a smaller model (e.g. `qwen2.5-coder:3b`) or increase timeout in `group-chat.js`. |
| Zombie node processes | Kill all with `taskkill /F /IM node.exe` (Windows) or `killall node` (Mac/Linux). |

## License

MIT
