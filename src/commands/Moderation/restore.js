import { SlashCommandBuilder } from 'discord.js';
import { getSavedRoles } from '../../services/roleBackupService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('restore')
    .setDescription("Restore a member's previously saved server roles")
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The member whose roles you want to restore')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const guild = interaction.guild;
      if (!guild) {
        return interaction.reply({
          content: 'This command can only be used inside a server.',
          ephemeral: true,
        });
      }

      const targetUser = interaction.options.getUser('user', true);
      const targetId = targetUser?.id;

      if (!targetId || !/^\d{17,20}$/.test(targetId)) {
        return interaction.reply({
          content: 'Invalid user ID or mention provided.',
          ephemeral: true,
        });
      }

      const savedRoleIds = await getSavedRoles(guild.id, targetId);
      if (!savedRoleIds || savedRoleIds.length === 0) {
        return interaction.reply({
          content: 'No saved roles found for that user.',
          ephemeral: true,
        });
      }

      const member =
        interaction.options.getMember('user') ||
        (await guild.members.fetch(targetId).catch(() => null));

      if (!member) {
        return interaction.reply({
          content: 'User is not currently in the server. Have them rejoin first, then run restore.',
          ephemeral: true,
        });
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
        await member.roles.add(
          rolesToAdd,
          `Roles restored by ${interaction.user.tag}`
        );
      }

      const addedNames = rolesToAdd.map((r) => r.name);
      let reply = addedNames.length
        ? `Successfully restored ${addedNames.length} role(s) for ${member.user.tag}: **${addedNames.join(', ')}**`
        : `No new roles needed to be added to ${member.user.tag}.`;

      if (skippedRoles.length > 0) {
        reply += ` *(Skipped higher/integration roles: ${skippedRoles.join(', ')})*`;
      }

      return interaction.reply({ content: reply });
    } catch (error) {
      logger.error('Error in restore command:', error);
      return interaction.reply({
        content: 'Something went wrong while restoring roles. Check my Manage Roles permission and role position.',
        ephemeral: true,
      });
    }
  },
};