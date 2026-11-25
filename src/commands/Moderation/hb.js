// src/commands/moderation/hardban.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

// Replace or load these from your antinuke config / database
const ANTINUKE_WHITELIST = new Set([
  '123456789012345678', // Example whitelisted user ID
]);

export default {
  data: new SlashCommandBuilder()
    .setName('hardban')
    .setDescription('Permanently hard-bans a user from the server and clears recent messages.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to hard-ban')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the hard ban')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    }

    // 1. Permission Check: Administrator OR Antinuke Whitelisted (or Server Owner)
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const isWhitelisted =
      ANTINUKE_WHITELIST.has(interaction.user.id) ||
      interaction.guild.ownerId === interaction.user.id;

    if (!isAdmin && !isWhitelisted) {
      return interaction.reply({
        content: '❌ You must be an **Administrator** or on the **Antinuke Whitelist** to use `/hardban`.',
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser('user', true);
    const targetId = targetUser.id;
    const reason =
      interaction.options.getString('reason')?.trim() ||
      'Hard-banned by staff (permanent server-level restriction).';

    // 2. Self / Bot / Owner Guards
    if (targetId === interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot hard-ban yourself.', ephemeral: true });
    }

    if (targetId === interaction.client.user.id) {
      return interaction.reply({ content: '❌ I cannot hard-ban myself.', ephemeral: true });
    }

    if (targetId === interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ You cannot hard-ban the server owner.', ephemeral: true });
    }

    // 3. Role Hierarchy Check if target is currently in the guild
    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (targetMember) {
      const executorMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

      if (
        interaction.user.id !== interaction.guild.ownerId &&
        executorMember &&
        targetMember.roles.highest.position >= executorMember.roles.highest.position
      ) {
        return interaction.reply({
          content: '❌ You cannot hard-ban someone with an equal or higher role than you.',
          ephemeral: true,
        });
      }

      if (!targetMember.bannable) {
        return interaction.reply({
          content: '❌ I cannot ban this user. Check my role position and ensure I have the **Ban Members** permission.',
          ephemeral: true,
        });
      }
    }

    // 4. Execute Hard Ban (permanent server ban + wipe last 7 days of messages)
    try {
      await interaction.guild.bans.create(targetId, {
        reason: `[HARDBAN by ${interaction.user.tag}] ${reason}`,
        deleteMessageSeconds: 60 * 60 * 24 * 7, // 7 days
      });

      const embed = new EmbedBuilder()
        .setColor(0xdc2626)
        .setTitle('🔨 User Hard-Banned')
        .setDescription(
          'A permanent server-level ban has been applied to block this account and network access from rejoining until manually lifted.'
        )
        .addFields(
          { name: 'Target User', value: `${targetUser.tag} (\`${targetId}\`)`, inline: true },
          { name: 'Moderator', value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: true },
          { name: 'Access Type', value: 'Administrator / Antinuke Whitelist', inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Hardban slash command error:', error);
      return interaction.reply({
        content: '❌ Failed to hard-ban the user. Make sure I have the **Ban Members** permission.',
        ephemeral: true,
      });
    }
  },
};