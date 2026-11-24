import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('mc')
        .setDescription('Shows total members, humans, and bots in the server'),

    async execute(interaction) {
        // If triggered via prefix or message context fallback
        const guild = interaction.guild;
        if (!guild) return;

        try {
            // Fetch all members to guarantee accurate count
            const members = await guild.members.fetch();

            const totalMembers = members.size;
            const bots = members.filter(m => m.user?.bot).size;
            const humans = totalMembers - bots;
            const guildName = guild.name;

            const responseText = 
                `**${guildName}**\n\n` +
                `### Members in ${guildName}\n` +
                `> Total Members: \`${totalMembers}\`\n` +
                `> Humans: \`${humans}\`\n` +
                `> Bots: \`${bots}\``;

            // Handles both Slash Commands (interaction) and direct prefix messages
            if (interaction.reply) {
                await interaction.reply({ content: responseText });
            } else if (interaction.channel) {
                await interaction.channel.send(responseText);
            }
        } catch (error) {
            console.error('Error executing mc command:', error);
            if (interaction.reply) {
                await interaction.reply({ content: 'Failed to fetch server members.', flags: 64 });
            }
        }
    }
};