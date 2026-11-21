const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    PermissionFlagsBits 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('votekick')
        .setDescription('Starts a vote to kick a member from the server.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The member you want to votekick')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('required_votes')
                .setDescription('Number of votes required to pass (default: 5)')
                .setMinValue(2)
                .setMaxValue(20)
                .setRequired(false))
        .setDMPermission(false),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        const requiredVotes = interaction.options.getInteger('required_votes') || 5;
        const DURATION = 60000; // Vote duration in milliseconds (60 seconds)

        // Basic Validation Checks
        if (!targetMember) {
            return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
        }
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot start a votekick against yourself.', ephemeral: true });
        }
        if (targetUser.id === interaction.client.user.id) {
            return interaction.reply({ content: 'You cannot votekick me!', ephemeral: true });
        }
        if (targetMember.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You cannot votekick an Administrator.', ephemeral: true });
        }
        if (!targetMember.kickable) {
            return interaction.reply({ content: 'I cannot kick this member due to role hierarchy.', ephemeral: true });
        }

        // Vote tracking setup
        const votes = {
            yes: new Set(),
            no: new Set()
        };

        // Create Interactive Buttons
        const yesButton = new ButtonBuilder()
            .setCustomId('votekick_yes')
            .setLabel('Vote Yes (0)')
            .setStyle(ButtonStyle.Danger);

        const noButton = new ButtonBuilder()
            .setCustomId('votekick_no')
            .setLabel('Vote No (0)')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(yesButton, noButton);

        const initialEmbed = {
            color: 0xFF9900,
            title: '🚨 Votekick Initiated!',
            description: `A vote has been started to kick **${targetUser.tag}**.\n\n` +
                         `**Started by:** ${interaction.user}\n` +
                         `**Required Votes:** ${requiredVotes}\n` +
                         `**Time Remaining:** <t:${Math.floor((Date.now() + DURATION) / 1000)}:R>`,
            footer: { text: 'Click the buttons below to cast your vote.' }
        };

        const responseMessage = await interaction.reply({
            embeds: [initialEmbed],
            components: [row],
            fetchReply: true
        });

        // Create Component Collector for Buttons
        const collector = responseMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: DURATION
        });

        collector.on('collect', async i => {
            const userId = i.user.id;

            if (i.customId === 'votekick_yes') {
                votes.no.delete(userId);
                votes.yes.add(userId);
            } else if (i.customId === 'votekick_no') {
                votes.yes.delete(userId);
                votes.no.add(userId);
            }

            // Update button labels with updated counts
            yesButton.setLabel(`Vote Yes (${votes.yes.size})`);
            noButton.setLabel(`Vote No (${votes.no.size})`);
            const updatedRow = new ActionRowBuilder().addComponents(yesButton, noButton);

            await i.update({ components: [updatedRow] });

            // Early threshold check
            if (votes.yes.size >= requiredVotes) {
                collector.stop('passed');
            }
        });

        collector.on('end', async (_, reason) => {
            // Disable buttons after vote ends
            yesButton.setDisabled(true);
            noButton.setDisabled(true);
            const disabledRow = new ActionRowBuilder().addComponents(yesButton, noButton);

            if (reason === 'passed' || votes.yes.size >= requiredVotes) {
                try {
                    await targetMember.kick(`Votekick passed with ${votes.yes.size} votes.`);
                    await interaction.editReply({
                        embeds: [{
                            color: 0x00FF00,
                            title: '✅ Votekick Passed',
                            description: `**${targetUser.tag}** has been kicked from the server.\n\n` +
                                         `**Final Votes:** ${votes.yes.size} Yes / ${votes.no.size} No (Target: ${requiredVotes})`
                        }],
                        components: [disabledRow]
                    });
                } catch (error) {
                    await interaction.editReply({
                        embeds: [{
                            color: 0xFF0000,
                            title: '❌ Votekick Failed',
                            description: `The vote passed, but I failed to kick **${targetUser.tag}**. Check my permissions.`
                        }],
                        components: [disabledRow]
                    });
                }
            } else {
                await interaction.editReply({
                    embeds: [{
                        color: 0xFF0000,
                        title: '❌ Votekick Failed',
                        description: `The vote to kick **${targetUser.tag}** failed due to insufficient votes.\n\n` +
                                     `**Final Votes:** ${votes.yes.size} Yes / ${votes.no.size} No (Needed: ${requiredVotes})`
                    }],
                    components: [disabledRow]
                });
            }
        });
    }
};