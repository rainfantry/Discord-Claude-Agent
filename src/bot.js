require('dotenv/config');
const { Client, IntentsBitField, EmbedBuilder, Events } = require('discord.js');
const { chat, webSearch, summarize, clearHistory } = require('./claude.js');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

// ── Helper: split long messages for Discord's 2000 char limit ────
function splitMessage(text, maxLen = 1990) {
    if (text.length <= maxLen) return [text];
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            chunks.push(remaining);
            break;
        }
        // Try to split at newline, then space, then hard cut
        let splitAt = remaining.lastIndexOf('\n', maxLen);
        if (splitAt < maxLen / 2) splitAt = remaining.lastIndexOf(' ', maxLen);
        if (splitAt < maxLen / 2) splitAt = maxLen;
        chunks.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt).trimStart();
    }
    return chunks;
}

// ── Rich embed response ──────────────────────────────────────────
function makeEmbed(title, description, color = 0xff0000) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description.slice(0, 4096))
        .setFooter({ text: 'MRROBOT' })
        .setTimestamp();
}

// ── Bot ready ────────────────────────────────────────────────────
client.on('ready', () => {
    console.log(`MRROBOT is online as ${client.user.tag}`);
});

// ── Regular messages (with vision + file analysis + memory) ──────
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Strip any bot mention from the text
    const text = message.content
        .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
        .trim();

    // Collect attachments
    const attachments = [...message.attachments.values()];

    if (!text && attachments.length === 0) return;

    await message.channel.sendTyping();

    try {
        const reply = await chat(message.channel.id, message.author.displayName || message.author.username, text, attachments);
        if (!reply) return;

        const chunks = splitMessage(reply);
        for (const chunk of chunks) {
            await message.reply(chunk);
        }
    } catch (err) {
        console.error('Reply failed:', err.message);
    }
});

// ── Slash commands ───────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // ── /ask ──
    if (commandName === 'ask') {
        await interaction.deferReply();
        const question = interaction.options.getString('question');
        const reply = await chat(interaction.channel.id, interaction.user.displayName || interaction.user.username, question);
        const chunks = splitMessage(reply);
        await interaction.editReply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp(chunks[i]);
        }
    }

    // ── /roast ──
    else if (commandName === 'roast') {
        await interaction.deferReply();
        const target = interaction.options.getUser('target') || interaction.user;
        const reply = await chat(
            interaction.channel.id,
            interaction.user.displayName || interaction.user.username,
            `Absolutely destroy and roast the user "${target.username}" with a creative, savage, personalized insult. Make it brutal and funny. This is a comedy roast they asked for.`
        );
        await interaction.editReply(`${target} ${reply}`);
    }

    // ── /search ──
    else if (commandName === 'search') {
        await interaction.deferReply();
        const query = interaction.options.getString('query');
        const reply = await webSearch(query);
        const embed = makeEmbed(`Search: ${query.slice(0, 200)}`, reply, 0x00ff00);
        await interaction.editReply({ embeds: [embed] });
    }

    // ── /summarize ──
    else if (commandName === 'summarize') {
        await interaction.deferReply();
        const count = Math.min(interaction.options.getInteger('count') || 20, 50);
        const messages = await interaction.channel.messages.fetch({ limit: count });
        const sorted = [...messages.values()].reverse();
        const reply = await summarize(sorted);
        const embed = makeEmbed(`Summary of last ${count} messages`, reply, 0x0099ff);
        await interaction.editReply({ embeds: [embed] });
    }

    // ── /clear ──
    else if (commandName === 'clear') {
        clearHistory(interaction.channel.id);
        await interaction.reply('Memory wiped. I remember nothing. Lucky you.');
    }

    // ── /analyze ──
    else if (commandName === 'analyze') {
        await interaction.deferReply();
        const attachment = interaction.options.getAttachment('image');
        const question = interaction.options.getString('question') || 'Describe and analyze this image in detail.';
        const reply = await chat(interaction.channel.id, interaction.user.displayName || interaction.user.username, question, [attachment]);
        const chunks = splitMessage(reply);
        await interaction.editReply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp(chunks[i]);
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
