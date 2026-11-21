import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('votekick')
        .setDescription('Starts a vote to kick a member from the server.')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member you want to votekick')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('required_votes')
                .setDescription('Number of votes required to pass (default: 5)')
                .setMinValue(2)
                .setMaxValue(20)
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'This command can only be used inside a server.',
                flags: MessageFlags.Ephemeral
            });
        }

        const targetUser = interaction.options.getUser('target', true);
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        const requiredVotes = interaction.options.getInteger('required_votes') ?? 5;
        const durationMs = 60_000; // 60 seconds

        if (!targetMember) {
            return interaction.reply({
                content: 'That user is not in this server.',
                flags: MessageFlags.Ephemeral
            });
        }
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: 'You cannot start a votekick against yourself.',
                flags: MessageFlags.Ephemeral
            });
        }
        if (targetUser.id === interaction.client.user.id) {
            return interaction.reply({
                content: 'You cannot votekick me!',
                flags: MessageFlags.Ephemeral
            });
        }
        if (targetMember.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: 'You cannot votekick an Administrator.',
                flags: MessageFlags.Ephemeral
            });
        }
        if (!targetMember.kickable) {
            return interaction.reply({
                content: 'I cannot kick this member due to role hierarchy or missing Kick Members permission.',
                flags: MessageFlags.Ephemeral
            });
        }

        const votes = {
            yes: new Set(),
            no: new Set()
        };

        const buildRow = (disabled = false) =>
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('votekick_yes')
                    .setLabel(`Vote Yes (${votes.yes.size})`)
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('votekick_no')
                    .setLabel(`Vote No (${votes.no.size})`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled)
            );

        const initialEmbed = {
            color: 0xff9900,
            title: '🚨 Votekick Initiated!',
            description:
                `A vote has been started to kick **${targetUser.tag}**.\n\n` +
                `**Started by:** ${interaction.user}\n` +
                `**Required Votes:** ${requiredVotes}\n` +
                `**Time Remaining:** <t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`,
            footer: { text: 'Click the buttons below to cast your vote.' }
        };

        const response = await interaction.reply({
            embeds: [initialEmbed],
            components: [buildRow(false)],
            withResponse: true
        });

        const message = response.resource?.message;
        if (!message) {
            return interaction.followUp({
                content: 'Could not attach vote collector to the message.',
                flags: MessageFlags.Ephemeral
            });
        }

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: durationMs
        });

        collector.on('collect', async buttonInteraction => {
            const userId = buttonInteraction.user.id;

            if (buttonInteraction.customId === 'votekick_yes') {
                votes.no.delete(userId);
                votes.yes.add(userId);
            } else if (buttonInteraction.customId === 'votekick_no') {
                votes.yes.delete(userId);
                votes.no.add(userId);
            }

            await buttonInteraction.update({
                components: [buildRow(false)]
            });

            if (votes.yes.size >= requiredVotes) {
                collector.stop('passed');
            }
        });

        collector.on('end', async (_, reason) => {
            const passed = reason === 'passed' || votes.yes.size >= requiredVotes;

            if (passed) {
                try {
                    await targetMember.kick(`Votekick passed with ${votes.yes.size} votes.`);
                    await interaction.editReply({
                        embeds: [{
                            color: 0x00ff00,
                            title: '✅ Votekick Passed',
                            description:
                                `**${targetUser.tag}** has been kicked from the server.\n\n` +
                                `**Final Votes:** ${votes.yes.size} Yes / ${votes.no.size} No (Target: ${requiredVotes})`
                        }],
                        components: [buildRow(true)]
                    });
                } catch {
                    await interaction.editReply({
                        embeds: [{
                            color: 0xff0000,
                            title: '❌ Votekick Failed',
                            description: `The vote passed, but I failed to kick **${targetUser.tag}**. Check my role position and Kick Members permission.`
                        }],
                        components: [buildRow(true)]
                    });
                }
            } else {
                await interaction.editReply({
                    embeds: [{
                        color: 0xff0000,
                        title: '❌ Votekick Failed',
                        description:
                            `The vote to kick **${targetUser.tag}** failed due to insufficient votes.\n\n` +
                            `**Final Votes:** ${votes.yes.size} Yes / ${votes.no.size} No (Needed: ${requiredVotes})`
                    }],
                    components: [buildRow(true)]
                });
            }
        });
    }
};