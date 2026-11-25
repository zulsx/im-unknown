// src/commands/moderation/hardban.js
import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';

// Replace or dynamically pull from your DB / Config
const ANTINUKE_WHITELIST = new Set([
  '123456789012345678', // Example whitelisted user ID
]);

export default {
  name: 'hardban',
  aliases: ['hb'], // Responds to both !hardban and !hb
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

    // 2. Target User & Reason Parsing
    const rawTarget = args[0];
    if (!rawTarget) {
      return message.reply({
        content: '⚠️ Usage: `!hardban <@user or userID> [reason]` or `!hb <@user or userID> [reason]`',
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

    // 3. Hierarchy Check if Target is in Server
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

    // 4. Execute Ban & Message Erasure (7 Days)
    try {
      await message.guild.bans.create(targetId, {
        reason: `[HARDBAN by ${message.author.tag}] ${reason}`,
        deleteMessageSeconds: 60 * 60 *