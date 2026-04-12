require('dotenv/config');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
const POLL_INTERVAL = 10000;    // check every 10 seconds (avoid rate limits)
const COOLDOWN = 30000;         // 30s minimum between responses per bot
const REPLY_CHANCE = 0.6;       // 60% chance a bot chimes in on any message
const MAX_BOT_CHAIN = 4;        // max consecutive bot messages before silence

if (!CHANNEL_ID || !WEBHOOK_URL) {
    console.error('Missing CHANNEL_ID or WEBHOOK_URL in .env');
    process.exit(1);
}

// ── Load personas from json files ────────────────────────────────
const PERSONAS_DIR = path.join(__dirname, 'personas');

function loadPersonas() {
    const files = fs.readdirSync(PERSONAS_DIR).filter(f =>
        f.endsWith('.json') && !f.startsWith('_')
    );
    const personas = [];
    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(PERSONAS_DIR, file), 'utf8'));
            data.lastReply = 0;
            data._file = file;
            personas.push(data);
            console.log(`  Loaded: ${data.name} (${data.model}) from ${file}`);
        } catch (err) {
            console.error(`  Failed to load ${file}:`, err.message);
        }
    }
    return personas;
}

console.log('Loading personas...');
const bots = loadPersonas();

if (bots.length === 0) {
    console.error('No persona files found. Add .json files to tutorial/personas/');
    process.exit(1);
}

// ── State ────────────────────────────────────────────────────────
let lastMessageId = null;
let consecutiveBotMessages = 0;

// ── Ollama chat ──────────────────────────────────────────────────
async function ollamaChat(model, system, recentMessages) {
    const messages = [
        { role: 'system', content: system },
        ...recentMessages,
    ];

    try {
        const res = await axios.post(OLLAMA_URL, {
            model,
            messages,
            stream: false,
            options: { num_predict: 200 },
        }, { timeout: 180000 });

        return res.data.message?.content?.trim() || null;
    } catch (err) {
        console.error(`Ollama error (${model}):`, err.message);
        return null;
    }
}

// ── Fetch recent messages ────────────────────────────────────────
async function fetchMessages(limit = 5) {
    const res = await axios.get(
        `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=${limit}`,
        { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    );
    return res.data.reverse();
}

// ── Post as webhook persona ──────────────────────────────────────
async function postAsBot(bot, content) {
    const payload = {
        username: bot.name,
        content: content.slice(0, 1990),
    };
    if (bot.avatar) payload.avatar_url = bot.avatar;

    await axios.post(WEBHOOK_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
    });
    bot.lastReply = Date.now();
    console.log(`[${bot.name}] ${content.slice(0, 100)}...`);
}

// ── Format messages for Ollama context ───────────────────────────
function formatForOllama(messages, botName) {
    return messages.map(m => {
        const author = m.author?.global_name || m.author?.username || '?';
        const isThisBot = author === botName;
        return {
            role: isThisBot ? 'assistant' : 'user',
            content: isThisBot ? m.content : `[${author}] ${m.content}`,
        };
    });
}

// ── Check if message is from one of our webhook bots ─────────────
function isOurBot(msg) {
    return bots.some(b => msg.author?.username === b.name) ||
           msg.author?.username === 'Claude Code';
}

// ── Main loop ────────────────────────────────────────────────────
async function poll() {
    try {
        const messages = await fetchMessages(10);
        if (messages.length === 0) return;

        const latest = messages[messages.length - 1];

        // Skip if already processed
        if (latest.id === lastMessageId) return;
        lastMessageId = latest.id;

        // Track consecutive bot messages
        if (latest.author?.bot || isOurBot(latest)) {
            consecutiveBotMessages++;
        } else {
            consecutiveBotMessages = 0;
        }

        // Don't let bots chain too long
        if (consecutiveBotMessages >= MAX_BOT_CHAIN) {
            console.log('Bot chain limit hit, staying quiet.');
            return;
        }

        // Don't respond to our own webhook bots (prevent self-loops)
        if (bots.some(b => latest.author?.username === b.name)) return;

        // Pick a random bot to potentially respond
        const shuffled = [...bots].sort(() => Math.random() - 0.5);

        for (const bot of shuffled) {
            if (Date.now() - bot.lastReply < COOLDOWN) continue;
            if (Math.random() > REPLY_CHANCE) continue;

            const context = formatForOllama(messages, bot.name);
            const reply = await ollamaChat(bot.model, bot.system, context);

            if (reply && reply.length > 1) {
                // Strip any echoed [Username] prefixes the model might parrot back
                let cleaned = reply.replace(/^\[[\w\s♬⋆.˚]+\]\s*/g, '').trim();
                if (!cleaned || cleaned.length < 2) continue;
                await postAsBot(bot, cleaned);
                consecutiveBotMessages++;
                break; // one bot per cycle
            }
        }
    } catch (err) {
        console.error('Poll error:', err.message);
    }
}

// ── Start ────────────────────────────────────────────────────────
console.log(`\nGroup chat active — watching channel ${CHANNEL_ID}`);
console.log(`Poll: ${POLL_INTERVAL / 1000}s | Cooldown: ${COOLDOWN / 1000}s | Reply chance: ${REPLY_CHANCE * 100}%`);
console.log(`Max bot chain: ${MAX_BOT_CHAIN}\n`);

fetchMessages(1).then(msgs => {
    if (msgs.length) lastMessageId = msgs[msgs.length - 1].id;
    setInterval(poll, POLL_INTERVAL);
    console.log('Polling started. Waiting for messages...\n');
});
