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
        const msgContent = 'This command can only be used inside a server.';
        return typeof interaction.reply === 'function'
          ? interaction.reply({ content: msgContent, ephemeral: true })
          : interaction.channel?.send(msgContent);
      }

      // Handle both Slash Commands and Prefix Command args
      const targetUser = interaction.options?.getUser?.('user') || interaction.targetUser;
      const targetId =
        targetUser?.id ||
        (Array.isArray(interaction.args) ? interaction.args[0]?.replace(/[<@!>]/g, '') : null);

      if (!targetId || !/^\d{17,20}$/.test(targetId)) {
        const msgContent = 'Invalid user ID or mention provided.';
        return typeof interaction.reply === 'function'
          ? interaction.reply({ content: msgContent, ephemeral: true })
          : interaction.channel?.send(msgContent);
      }

      const savedRoleIds = await getSavedRoles(guild.id, targetId);

      // Force fetch the member from Discord API to ensure up-to-date role cache
      const member = await guild.members.fetch({ user: targetId, force: true }).catch(() => null);

      if (!member) {
        const msgContent = 'User is not currently in the server. Have them rejoin first, then run restore.';
        return typeof interaction.reply === 'function'
          ? interaction.reply({ content: msgContent, ephemeral: true })
          : interaction.channel?.send(msgContent);
      }

      logger.info(
        `[restore] guild=${guild.id} target=${targetId} savedRoleIds=${JSON.stringify(savedRoleIds)} memberRoles=${JSON.stringify([...member.roles.cache.keys()])}`
      );

      if (!savedRoleIds || savedRoleIds.length === 0) {
        const msgContent = 'No saved roles found for that user.';
        return typeof interaction.reply === 'function'
          ? interaction.reply({ content: msgContent, ephemeral: true })
          : interaction.channel?.send(msgContent);
      }

      const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
      const botTopRolePos = botMember?.roles?.highest?.position ?? 0;

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

      const executorTag =
        interaction.user?.tag ||
        interaction.author?.tag ||
        (interaction.member?.user ? interaction.member.user.tag : 'Admin');

      // Add back missing restored roles
      if (rolesToAdd.length > 0) {
        await member.roles.add(rolesToAdd, `Roles restored by ${executorTag}`);
      }

      // Fetch welcome config to detect and strip auto-entry / no-access roles
      const welcomeConfig = await getWelcomeConfig(interaction.client, guild.id).catch(() => null);
      const entryRoleIds = welcomeConfig?.roleIds || [];

      if (entryRoleIds.length > 0) {
        const entryRolesToRemove = entryRoleIds.filter(
          (roleId) => member.roles.cache.has(roleId) && !savedRoleIds.includes(roleId)
        );

        if (entryRolesToRemove.length > 0) {
          await member.roles
            .remove(
              entryRolesToRemove,
              `Auto-entry role stripped upon role restoration by ${executorTag}`
            )
            .catch((err) => {
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

      return typeof interaction.reply === 'function'
        ? interaction.reply({ content: reply })
        : interaction.channel?.send(reply);
    } catch (error) {
      logger.error('Error in restore command:', error);
      const errMsg = 'Something went wrong while restoring roles. Check my Manage Roles permission and role position.';
      return typeof interaction.reply === 'function'
        ? interaction.reply({ content: errMsg, ephemeral: true })
        : interaction.channel?.send(errMsg);
    }
  },
};
