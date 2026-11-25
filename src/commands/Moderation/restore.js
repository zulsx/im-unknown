import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { getSavedRoles } from '../../services/roleBackupService.js';
import { logger } from '../../utils/logger.js';

export default {
  name: 'restore',
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('restore')
    .setDescription('Restore a member\'s previously saved server roles')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The member whose roles you want to restore')
        .setRequired(true)
    ),

  async runRestore(guild, requesterMember, requesterTag, targetId, channelOrInteractionReply) {
    const hasPerms =
      requesterMember?.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
      requesterMember?.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!hasPerms) {
      return channelOrInteractionReply('You need Manage Roles or Administrator permissions to use this command.');
    }

    if (!/^\d{17,20}$/.test(targetId)) {
      return channelOrInteractionReply('Invalid user ID or mention provided.');
    }

    const savedRoleIds = await getSavedRoles(guild.id, targetId);
    if (!savedRoleIds || savedRoleIds.length === 0) {
      return channelOrInteractionReply('No saved roles found for that user.');
    }

    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
      return channelOrInteractionReply('User is not currently in the server. Have them rejoin first, then run restore.');
    }

    const botMember = guild.members.me;
    const botTopRolePos = botMember?.roles.highest.position ?? 0;

    const rolesToAdd = [];
    const skippedRoles = [];

    for (const roleId of savedRoleIds) {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;

      if (role.managed || role.position >= botTopRolePos) {
        skippedRoles.push(role.name);
        continue;
      }

      if (!member.roles.cache.has(role.id)) {
        rolesToAdd.push(role);
      }
    }

    if (rolesToAdd.length > 0) {
      await member.roles.add(rolesToAdd, `Roles restored by ${requesterTag}`);
    }

    const addedNames = rolesToAdd.map((r) => r.name);
    let reply = addedNames.length
      ? `Successfully restored ${addedNames.length} role(s) for ${member.user.tag}: **${addedNames.join(', ')}**`
      : `No new roles needed to be added to ${member.user.tag}.`;

    if (skippedRoles.length > 0) {
      reply += ` *(Skipped higher/integration roles: ${skippedRoles.join(', ')})*`;
    }

    return channelOrInteractionReply(reply);
  },

  async executePrefix(message, args) {
    try {
      const targetArg = args[0];
      if (!targetArg) {
        await message.channel.send('Usage: `restore @person` or `restore <userID>` (with your server prefix).');
        return;
      }

      const targetId = targetArg.replace(/[<@!>]/g, '');
      await this.runRestore(
        message.guild,
        message.member,
        message.author.tag,
        targetId,
        (text) => message.channel.send(text)
      );
    } catch (error) {
      logger.error('Error in prefix restore command:', error);
      await message.channel.send('Something went wrong while restoring roles.');
    }
  },

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);
      await this.runRestore(
        interaction.guild,
        interaction.member,
        interaction.user.tag,
        targetUser.id,
        (text) => interaction.reply({ content: text })
      );
    } catch (error) {
      logger.error('Error in slash restore command:', error);
      await interaction.reply({ content: 'Something went wrong while restoring roles.', ephemeral: true });
    }
  },
};