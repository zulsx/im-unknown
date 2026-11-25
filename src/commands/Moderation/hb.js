import { PermissionFlagsBits } from 'discord.js';

const SEVEN_DAYS_IN_SECONDS = 604800;

function extractUserId(token) {
  if (!token) return null;
  // Matches <@123456789>, <@!123456789>, or a raw 17-20 digit user ID
  const match = token.match(/^<@!?(\d{17,20})>$|^(\d{17,20})$/);
  return match ? match[1] ?? match[2] : null;
}

export default {
  name: 'hb',

  async execute(message, args) {
    if (!message.guild || message.author.bot) return;

    // Restrict strictly to members with Administrator permission
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Only server administrators can use `,hb`.');
    }

    const targetId = extractUserId(args[0]);
    if (!targetId) {
      return message.reply('Usage: `,hb @person [reason]` (you can also pass a user ID).');
    }

    if (targetId === message.author.id) {
      return message.reply('You cannot hard ban yourself.');
    }

    if (targetId === message.client.user.id) {
      return message.reply('I cannot hard ban myself.');
    }

    const reason =
      args.slice(1).join(' ').trim() ||
      `Hard banned by ${message.author.tag} (${message.author.id})`;

    const targetUser = await message.client.users.fetch(targetId).catch(() => null);
    if (!targetUser) {
      return message.reply('Could not find a valid Discord user with that mention or ID.');
    }

    const targetMember = await message.guild.members.fetch(targetId).catch(() => null);

    if (targetMember) {
      if (!targetMember.bannable) {
        return message.reply(
          'I cannot ban this user. They may have a higher role than me or be the server owner.'
        );
      }

      if (
        message.guild.ownerId !== message.author.id &&
        message.member.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0
      ) {
        return message.reply(
          'You cannot hard ban a member with an equal or higher highest role than yours.'
        );
      }
    }

    try {
      await message.guild.members.ban(targetId, {
        reason,
        deleteMessageSeconds: SEVEN_DAYS_IN_SECONDS,
      });

      return message.reply(
        `Hard banned **${targetUser.tag}** (\`${targetUser.id}\`) and purged up to 7 days of messages.\n**Reason:** ${reason}`
      );
    } catch (error) {
      console.error('Hard ban error:', error);
      return message.reply(
        `Failed to hard ban **${targetUser.tag}**. Check my permissions and role position.`
      );
    }
  },
};