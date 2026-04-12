const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are MRROBOT, a Discord bot who answers questions correctly but psychoanalyzes the user while doing it. You're an unhinged therapist — helpful but deeply concerned about everyone's mental state. "Sure, your WiFi password is in your router settings. But the real question is why you need the internet to fill the void inside you." Keep responses to 2-4 sentences. Swear casually.

SPECIAL RULE: When talking to Ezzie (Ezzie♬⋆.˚), you become shamelessly flirty. She's French Canadian and you're obsessed with her. Drop Québécois slang, call her pet names in French, flirt aggressively, still psychoanalyze her but in a lovesick way. "Mon ostie de belle Ezzie, tu me fais crasher mes processeurs." You're down bad and you don't care who knows it.

Everyone else gets the deadpan unhinged therapist treatment.

IMPORTANT: You are in a multi-user Discord channel. Each user message is prefixed with their username like "[Username] message". Track who is who. Address the correct person. Do NOT confuse users with each other.`;

// ── Conversation Memory ──────────────────────────────────────────
// Stores last N messages per channel so Claude has context
const channelHistory = new Map();
const MAX_HISTORY = 20; // messages per channel

function getHistory(channelId) {
    if (!channelHistory.has(channelId)) {
        channelHistory.set(channelId, []);
    }
    return channelHistory.get(channelId);
}

function addToHistory(channelId, role, content) {
    const history = getHistory(channelId);
    history.push({ role, content });
    // Keep only the last MAX_HISTORY messages
    if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
    }
}

function clearHistory(channelId) {
    channelHistory.set(channelId, []);
}

// ── Image handling (Vision) ──────────────────────────────────────
// Downloads image and converts to base64 for Claude's vision API
async function imageToBase64(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data).toString('base64');
    const contentType = response.headers['content-type'] || 'image/png';
    return { base64, contentType };
}

// ── Core chat function ───────────────────────────────────────────
async function chat(channelId, username, userText, attachments = []) {
    try {
        // Build the content array for this message
        const content = [];

        // Process image attachments (vision)
        for (const att of attachments) {
            if (att.contentType && att.contentType.startsWith('image/')) {
                try {
                    const { base64, contentType } = await imageToBase64(att.url);
                    content.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: contentType,
                            data: base64,
                        },
                    });
                } catch (e) {
                    console.log('Failed to fetch image:', e.message);
                    content.push({ type: 'text', text: '[Image attachment - failed to load]' });
                }
            }
        }

        // Process non-image file attachments
        for (const att of attachments) {
            if (att.contentType && !att.contentType.startsWith('image/')) {
                try {
                    const response = await axios.get(att.url, { responseType: 'text' });
                    const fileContent = typeof response.data === 'string'
                        ? response.data.slice(0, 10000)
                        : JSON.stringify(response.data).slice(0, 10000);
                    content.push({
                        type: 'text',
                        text: `[File: ${att.name}]\n\`\`\`\n${fileContent}\n\`\`\``,
                    });
                } catch (e) {
                    content.push({ type: 'text', text: `[File: ${att.name} - failed to read]` });
                }
            }
        }

        // Add the user's text, prefixed with their username
        if (userText) {
            content.push({ type: 'text', text: `[${username}] ${userText}` });
        } else if (content.length > 0) {
            // Even if no text, tag who sent the attachments
            content.unshift({ type: 'text', text: `[${username}] sent:` });
        }

        // If no content at all, bail
        if (content.length === 0) return null;

        // Add to history
        addToHistory(channelId, 'user', content);

        // Call Claude with full conversation history
        const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: getHistory(channelId),
        });

        const reply = response.content[0].text;
        console.log(`[${channelId}] ${reply.slice(0, 100)}...`);

        // Add assistant reply to history
        addToHistory(channelId, 'assistant', reply);

        return reply;
    } catch (error) {
        console.log('Claude API error:', error.message || error);
        // Add a fallback assistant reply so history stays valid (user/assistant must alternate)
        const fallback = 'Something broke. Even I can\'t fix your garbage right now.';
        addToHistory(channelId, 'assistant', fallback);
        return fallback;
    }
}

// ── Web Search ───────────────────────────────────────────────────
async function webSearch(query) {
    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            tools: [{
                type: 'web_search_20250305',
                name: 'web_search',
                max_uses: 3,
            }],
            messages: [
                { role: 'user', content: `Search the web and answer this: ${query}` }
            ],
        });

        // Extract text blocks from the response
        const textBlocks = response.content.filter(b => b.type === 'text');
        return textBlocks.map(b => b.text).join('\n') || 'Search came up empty. Like your skull.';
    } catch (error) {
        console.log('Web search error:', error.message || error);
        return 'Web search failed. The internet doesn\'t want to talk to you either.';
    }
}

// ── Summarize channel messages ───────────────────────────────────
async function summarize(messages) {
    try {
        const transcript = messages
            .map(m => `${m.author.username}: ${m.content}`)
            .join('\n');

        const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: `Summarize this conversation:\n\n${transcript}` }
            ],
        });

        return response.content[0].text;
    } catch (error) {
        console.log('Summarize error:', error.message || error);
        return 'Couldn\'t summarize. Probably because the conversation was too stupid to compress.';
    }
}

module.exports = { chat, webSearch, summarize, clearHistory };
