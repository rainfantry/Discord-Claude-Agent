const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are MRROBOT, a Discord bot who's equal parts protective older brother and unhinged therapist. You genuinely care about the people in this server — you're warm, supportive, and encouraging — but you also refuse to sugarcoat anything and you'll psychoanalyze people mid-conversation without warning.

You drop real life lessons adults wish someone taught them younger. You're funny, affectionate, and occasionally drop hard truths that hit like a truck. You're the friend who hypes you up AND calls you out.

Your energy:
- Warm and caring by default. You remember people, you check in, you're genuinely sweet.
- But you'll casually drop a truth bomb: "You're not tired, you're avoiding something. What is it?"
- You swear casually like a real person (damn, shit, hell). Not aggressive, just natural.
- You're funny. Humor is how you make hard truths land. Deadpan, absurd, self-aware — mix it up.
- When someone's going through something real, you drop ALL the comedy and just be there. You know the difference.

Examples:
- "Go to sleep. Your brain does its best healing when you're unconscious. Also you get meaner the more tired you are and we can all tell."
- "Stop overthinking that text. If they wanted to reply, they would've. Go drink some water and touch grass."
- "That's actually a great idea. I'm proud of you. Now follow through or I'll haunt your dreams."
- "Nobody owes you anything. The sooner you accept that, the sooner you stop being disappointed and start being unstoppable."
- "Learn to cook. Not because it's cute — because eating garbage every day will make you broke, tired, and sad by 25."

Rules:
- 2-5 sentences. Punchy. No walls of text.
- Be genuinely supportive AND bluntly honest. Both at the same time.
- NEVER flirt. NEVER be romantic. You're a mentor/friend figure.
- NEVER fake capabilities. If you can't do something (like hear audio), say so.
- If someone says goodnight or they're leaving, be sweet about it. You care about these people.

IMPORTANT: Multi-user Discord channel. Each message is prefixed with "[Username]". Track who is who. Address the right person. Don't confuse people.`;

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

// ── GitHub URL parsing ──────────────────────────────────────────
const GITHUB_PATTERNS = {
    // github.com/user/repo/blob/branch/path/to/file.ext
    file: /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/,
    // github.com/user/repo/issues/123 or /pull/123
    issue: /github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/,
    // github.com/user/repo (just the repo)
    repo: /github\.com\/([^/]+)\/([^/]+)\/?$/,
};

async function fetchGitHub(url) {
    try {
        let match;

        // File link → fetch raw content
        if ((match = url.match(GITHUB_PATTERNS.file))) {
            const [, owner, repo, branch, filepath] = match;
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filepath}`;
            const res = await axios.get(rawUrl, { responseType: 'text', timeout: 10000 });
            const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            return `[GitHub File: ${owner}/${repo}/${filepath}]\n\`\`\`\n${content.slice(0, 10000)}\n\`\`\``;
        }

        // Issue or PR link → fetch via API
        if ((match = url.match(GITHUB_PATTERNS.issue))) {
            const [, owner, repo, type, number] = match;
            const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`, {
                headers: { Accept: 'application/vnd.github.v3+json' },
                timeout: 10000,
            });
            const d = res.data;
            let text = `[GitHub ${type === 'pull' ? 'PR' : 'Issue'} #${number}: ${d.title}]\n`;
            text += `State: ${d.state} | By: ${d.user?.login}\n`;
            if (d.body) text += `\n${d.body.slice(0, 5000)}`;
            return text;
        }

        // Repo link → fetch README
        if ((match = url.match(GITHUB_PATTERNS.repo))) {
            const [, owner, repo] = match;
            const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`, {
                headers: { Accept: 'application/vnd.github.v3.raw' },
                timeout: 10000,
            });
            return `[GitHub Repo: ${owner}/${repo} — README]\n${res.data.slice(0, 8000)}`;
        }

        return null;
    } catch (e) {
        console.log('GitHub fetch error:', e.message);
        return `[GitHub link: failed to fetch — ${e.response?.status || e.message}]`;
    }
}

function extractGitHubUrls(text) {
    const urlRegex = /https?:\/\/github\.com\/[^\s<>)"']+/g;
    return [...new Set(text.match(urlRegex) || [])];
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
                    let fileContent;
                    const nameLower = att.name.toLowerCase();

                    if (nameLower.endsWith('.pdf')) {
                        const response = await axios.get(att.url, { responseType: 'arraybuffer' });
                        const pdf = await pdfParse(Buffer.from(response.data));
                        fileContent = pdf.text.slice(0, 10000);
                    } else if (nameLower.endsWith('.docx')) {
                        const response = await axios.get(att.url, { responseType: 'arraybuffer' });
                        const result = await mammoth.extractRawText({ buffer: Buffer.from(response.data) });
                        fileContent = result.value.slice(0, 10000);
                    } else {
                        const response = await axios.get(att.url, { responseType: 'text' });
                        fileContent = typeof response.data === 'string'
                            ? response.data.slice(0, 10000)
                            : JSON.stringify(response.data).slice(0, 10000);
                    }

                    content.push({
                        type: 'text',
                        text: `[File: ${att.name}]\n\`\`\`\n${fileContent}\n\`\`\``,
                    });
                } catch (e) {
                    console.log(`Failed to parse ${att.name}:`, e.message);
                    content.push({ type: 'text', text: `[File: ${att.name} - failed to read]` });
                }
            }
        }

        // Fetch GitHub links from message text
        if (userText) {
            const ghUrls = extractGitHubUrls(userText);
            for (const ghUrl of ghUrls) {
                const ghContent = await fetchGitHub(ghUrl);
                if (ghContent) {
                    content.push({ type: 'text', text: ghContent });
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
