// src/commands/hardban.js
import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';

// Replace or load from your database / config
const ANTINUKE_WHITELIST = new Set([
  '123456789012345678', // Example whitelisted user ID
]);

const HARDBANNED_USERS = new Set();

export default {
  name: 'hardban',
  description: 'Permanently hard-bans a user from the server and clears recent messages.',

  async execute(message, args) {
    if (!message.guild) return;

    // 1. Permission Check: Administrator OR Antinuke Whitelisted
    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
    const isWhitelisted =
      ANTINUKE_WHITELIST.has(message.author.id) ||
      message.guild.ownerId === message.author.id;

    if (!isAdmin && !isWhitelisted) {
      return message.reply({
        content: '❌ You must be an **Administrator** or on the **Antinuke Whitelist** to run this command.',
      });
    }

    // 2. Parse Target User (mention or ID) and Reason
    const rawTarget = args[0];
    if (!rawTarget) {
      return message.reply({
        content: '⚠️ Usage: `!hardban <@user or userID> [reason]`',
      });
    }

    const targetId = rawTarget.replace(/[<@!>]/g, '');
    if (!/^\d{17,20}$/.test(targetId)) {
      return message.reply({
        content: '❌ Please provide a valid user mention or Discord User ID.',
      });
    }

    if (targetId === message.author.id) {
      return message.reply({ content: '❌ You cannot hard-ban yourself.' });
    }

    if (targetId === message.client.user.id) {
      return message.reply({ content: '❌ I cannot hard-ban myself.' });
    }

    if (targetId === message.guild.ownerId) {
      return message.reply({ content: '❌ You cannot hard-ban the server owner.' });
    }

    const reason =
      args.slice(1).join(' ').trim() ||
      'Hard-banned by staff (permanent server-level restriction).';

    // 3. Role Hierarchy Check if user is currently in the guild
    const targetMember = await message.guild.members.fetch(targetId).catch(() => null);
    if (targetMember) {
      if (
        message.author.id !== message.guild.ownerId &&
        targetMember.roles.highest.position >= message.member.roles.highest.position
      ) {
        return message.reply({
          content: '❌ You cannot hard-ban someone with an equal or higher role than you.',
        });
      }

      if (!targetMember.bannable) {
        return message.reply({
          content: '❌ I do not have permission to ban this user. Check my role position and Ban Members permission.',
        });
      }
    }

    // 4. Execute Hard Ban (permanent server ban + wipe last 7 days of messages)
    try {
      await message.guild.bans.create(targetId, {
        reason: `[HARDBAN by ${message.author.tag}] ${reason}`,
        deleteMessageSeconds: 60 * 60 * 24 * 7, // 7 days (max allowed by Discord API)
      });

      HARDBANNED_USERS.add(targetId);

      const embed = new EmbedBuilder()
        .setColor(0xdc2626)
        .setTitle('🔨 User Hard-Banned')
        .setDescription(
          'A permanent server-level ban has been applied to block this account and network access from rejoining until manually lifted.'
        )
        .addFields(
          { name: 'Target User ID', value: `\`${targetId}\``, inline: true },
          { name: 'Moderator', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
          { name: 'Access Type', value: 'Administrator / Antinuke Whitelist', inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Hardban error:', error);
      return message.reply({
        content: '❌ Failed to hard-ban the user. Make sure I have the **Ban Members** permission.',
      });
    }
  },
};