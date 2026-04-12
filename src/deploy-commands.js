// Run this once to register slash commands with Discord
// Usage: node tutorial/deploy-commands.js

require('dotenv/config');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask MRROBOT a question')
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('Your question')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('roast')
        .setDescription('Get roasted by MRROBOT')
        .addUserOption(opt =>
            opt.setName('target')
                .setDescription('Who to roast (defaults to you)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search the web via MRROBOT')
        .addStringOption(opt =>
            opt.setName('query')
                .setDescription('What to search for')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('summarize')
        .setDescription('Summarize recent messages in this channel')
        .addIntegerOption(opt =>
            opt.setName('count')
                .setDescription('Number of messages to summarize (default 20, max 50)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear MRROBOT\'s memory of this channel'),

    new SlashCommandBuilder()
        .setName('analyze')
        .setDescription('Analyze an image')
        .addAttachmentOption(opt =>
            opt.setName('image')
                .setDescription('Image to analyze')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('What to ask about the image')
                .setRequired(false)),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log(`Registering ${commands.length} slash commands...`);
        // Register globally (takes up to 1 hour to propagate)
        await rest.put(
            Routes.applicationCommands(process.env.APP_ID),
            { body: commands },
        );
        console.log('Slash commands registered successfully!');
    } catch (error) {
        console.error('Failed to register commands:', error);
    }
})();
