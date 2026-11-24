import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

// In-memory store for autoresponders (Map<trigger, response>)
const autoResponders = new Map();

// Flag to ensure the messageCreate listener is attached only once
let isListenerAttached = false;

export default {
    data: new SlashCommandBuilder()
        .setName('autorespond')
        .setDescription('Manage server autoresponders (Administrator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add')
               .setDescription('Add a new autoresponder')
               .addStringOption(opt => opt.setName('trigger').setDescription('The phrase to trigger on').setRequired(true))
               .addStringOption(opt => opt.setName('response').setDescription('The response text').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
               .setDescription('Remove an existing autoresponder')
               .addStringOption(opt => opt.setName('trigger').setDescription('The trigger phrase to remove').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list')
               .setDescription('View all active autoresponders')
        ),

    async execute(interaction) {
        if (!interaction.guild) return;

        // Automatically attach messageCreate listener to client on first command execution if not attached
        if (!isListenerAttached && interaction.client) {
            interaction.client.on('messageCreate', async (message) => {
                if (message.author?.bot || !message.guild) return;

                const content = message.content.toLowerCase().trim();
                if (autoResponders.has(content)) {
                    const reply = autoResponders.get(content);
                    await message.channel.send(reply);
                }
            });
            isListenerAttached = true;
        }

        // Check for Administrator permissions
        const member = interaction.member;
        if (!member?.permissions?.has(PermissionFlagsBits.Administrator)) {
            const noPermMsg = 'You need **Administrator** permissions to use this command.';
            return interaction.reply ? interaction.reply({ content: noPermMsg, flags: 64 }) : interaction.channel.send(`> ${noPermMsg}`);
        }

        const subcommand = interaction.options?.getSubcommand?.() || interaction.args?.[0]?.toLowerCase();

        const reply = async (payload) => {
            if (interaction.reply) {
                return interaction.reply(payload);
            } else if (interaction.channel) {
                const text = typeof payload === 'string' ? payload : payload.content;
                return interaction.channel.send(text);
            }
        };

        // --- SUBCOMMAND: ADD ---
        if (subcommand === 'add') {
            const trigger = interaction.options?.getString('trigger') || interaction.args?.slice(1, -1).join(' ');
            const response = interaction.options?.getString('response') || interaction.args?.slice(-1)[0];

            if (!trigger || !response) {
                return reply({ content: 'Please provide both a trigger phrase and a response.', flags: 64 });
            }

            autoResponders.set(trigger.toLowerCase(), response);

            return reply({
                content: `> Added autoresponder for \`${trigger.toLowerCase()}\` -> \`${response}\``
            });
        }

        // --- SUBCOMMAND: REMOVE ---
        if (subcommand === 'remove') {
            const trigger = interaction.options?.getString('trigger') || interaction.args?.slice(1).join(' ');

            if (!trigger) {
                return reply({ content: 'Please specify a trigger phrase to remove.', flags: 64 });
            }

            const key = trigger.toLowerCase();
            if (!autoResponders.has(key)) {
                return reply({ content: `No autoresponder found for trigger: \`${key}\``, flags: 64 });
            }

            autoResponders.delete(key);
            return reply({ content: `> Removed autoresponder for \`${key}\`` });
        }

        // --- SUBCOMMAND: LIST ---
        if (subcommand === 'list') {
            if (autoResponders.size === 0) {
                return reply({ content: 'There are no active autoresponders.', flags: 64 });
            }

            const guildName = interaction.guild.name;
            let listText = `**${guildName} Autoresponders**\n\n### Active Triggers\n`;

            for (const [trig, resp] of autoResponders.entries()) {
                listText += `> **${trig}** -> \`${resp}\`\n`;
            }

            return reply({ content: listText });
        }

        return reply({
            content: 'Usage: `/autorespond add <trigger> <response>`, `/autorespond remove <trigger>`, or `/autorespond list`',
            flags: 64
        });
    }
};

export { autoResponders };