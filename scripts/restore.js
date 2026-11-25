import { SlashCommandBuilder } from 'discord.js';
import { getSavedRoles } from '../../services/roleBackupService.js';
import { getWelcomeConfig } from '../../utils/database.js';
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

      const member =
        interaction.options.getMember('user') ||
        (await guild.members.fetch(targetId).catch(() => null));

      if (!member) {
        return interaction.reply({
          content: 'User is not currently in the server. Have them rejoin first, then run restore.',
          ephemeral: true,
        });
      }

      logger.info(
        `[restore] guild=${guild.id} target=${targetId} savedRoleIds=${JSON.stringify(savedRoleIds)} memberRoles=${JSON.stringify([...member.roles.cache.keys()])}`
      );

      if (!savedRoleIds || savedRoleIds.length === 0) {
        return interaction.reply({
          content: 'No saved roles found for that user.',
          ephemeral: true,
        });
      }

      const botMember = guild.members.me;
      const botTopRolePos = botMember?.roles.highest.position ?? 0;

      const rolesToAdd = [];
      const skippedRoles = [];
      const missingRoles = [];

      for (const roleId of savedRoleIds) {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          missingRoles.push(roleId);
          continue;
        }

        if (role.managed || role.position >= botTopRolePos) {
          skippedRoles.push(role.name);
          continue;
        }

        if (!member.roles.cache.has(role.id)) {
          rolesToAdd.push(role);
        }
      }

      // Add back missing restored roles
      if (rolesToAdd.length > 0) {
        await member.roles.add(
          rolesToAdd,
          `Roles restored by ${interaction.user.tag}`
        );
      }

      // Fetch welcome config to detect and strip auto-entry / no-access roles
      const welcomeConfig = await getWelcomeConfig(interaction.client, guild.id).catch(() => null);
      const entryRoleIds = welcomeConfig?.roleIds || [];

      if (entryRoleIds.length > 0) {
        // Filter for entry roles the user currently has, excluding any entry role that was intentionally restored
        const entryRolesToRemove = entryRoleIds.filter(
          (roleId) => member.roles.cache.has(roleId) && !savedRoleIds.includes(roleId)
        );

        if (entryRolesToRemove.length > 0) {
          await member.roles.remove(
            entryRolesToRemove,
            `Auto-entry role stripped upon role restoration by ${interaction.user.tag}`
          ).catch((err) => {
            logger.warn(`Failed to remove auto-entry role(s) for ${member.id}:`, err);
          });
        }
      }

      const addedNames = rolesToAdd.map((r) => r.name);
      let reply = addedNames.length
        ? `Successfully restored ${addedNames.length} role(s) for ${member.user.tag}: **${addedNames.join(', ')}**`
        : `No new roles needed to be added to ${member.user.tag}.`;

      if (skippedRoles.length > 0) {
        reply += ` *(Skipped higher/integration roles: ${skippedRoles.join(', ')})*`;
      }

      if (missingRoles.length > 0 && addedNames.length === 0) {
        reply += ` *(${missingRoles.length} saved role ID(s) no longer exist in this server)*`;
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
