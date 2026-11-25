import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getSavedRoles } from '../../services/roleBackupService.js';
import { getWelcomeConfig } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

function extractUserId(rawInput) {
  if (!rawInput) return null;
  const match = String(rawInput).trim().match(/^(?:<@!?)?(\d{17,20})>?$/);
  return match ? match[1] : null;
}

async function sendResponse(target, payload) {
  if (typeof target.reply === 'function') {
    if (target.deferred || target.replied) {
      return target.editReply(payload);
    }
    return target.reply(payload);
  }
  return target.channel?.send(payload);
}

export default {
  data: new SlashCommandBuilder()
    .setName('restore')
    .setDescription("Restore a member's saved roles after they leave, get kicked, or get banned")
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user whose roles you want to restore')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    try {
      const guild = interaction.guild;
      if (!guild) {
        return sendResponse(interaction, {
          content: 'This command can only be used inside a server.',
          ephemeral: true,
        });
      }

      const optionUser = interaction.options?.getUser?.('user') || interaction.targetUser || null;
      const rawArg = Array.isArray(interaction.args) ? interaction.args[0] : null;
      const targetId = optionUser?.id || extractUserId(rawArg);

      if (!targetId) {
        return sendResponse(interaction, {
          content: 'Please provide a valid user mention or ID, e.g. `restore @user`.',
          ephemeral: true,
        });
      }

      const member = await guild.members.fetch({ user: targetId, force: true }).catch(() => null);
      if (!member) {
        return sendResponse(interaction, {
          content: 'That user is not in the server right now. Have them rejoin first, then run `restore @user`.',
          ephemeral: true,
        });
      }

      const savedRoleIds = await getSavedRoles(guild.id, targetId);
      if (!savedRoleIds || savedRoleIds.length === 0) {
        return sendResponse(interaction, {
          content: `No saved roles found for **${member.user.tag}**.`,
          ephemeral: true,
        });
      }

      const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
      const botTopRolePos = botMember?.roles?.highest?.position ?? 0;

      const rolesToAdd = [];
      const skippedRoles = [];
      const missingRoles = [];

      for (const roleId of savedRoleIds) {
        if (roleId === guild.id) continue;

        const role = guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
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
        interaction.member?.user?.tag ||
        'Moderator';

      if (rolesToAdd.length > 0) {
        await member.roles.add(rolesToAdd, `Roles restored by ${executorTag}`);
      }

      const welcomeConfig = await getWelcomeConfig(interaction.client, guild.id).catch(() => null);
      const entryRoleIds = welcomeConfig?.roleIds || [];

      if (entryRoleIds.length > 0) {
        const entryRolesToRemove = entryRoleIds.filter(
          (roleId) => member.roles.cache.has(roleId) && !savedRoleIds.includes(roleId)
        );

        if (entryRolesToRemove.length > 0) {
          await member.roles
            .remove(entryRolesToRemove, `Removed auto-entry role after restore by ${executorTag}`)
            .catch((err) => {
              logger.warn(`Failed to remove auto-entry roles for ${member.id}:`, err);
            });
        }
      }

      const addedNames = rolesToAdd.map((r) => r.name);
      let reply = addedNames.length > 0
        ? `Restored ${addedNames.length} role(s) for **${member.user.tag}**: ${addedNames.join(', ')}`
        : `**${member.user.tag}** already has all restorable saved roles.`;

      if (skippedRoles.length > 0) {
        reply += ` (Skipped higher/managed roles: ${skippedRoles.join(', ')})`;
      }

      if (missingRoles.length > 0 && addedNames.length === 0) {
        reply += ` (${missingRoles.length} saved role(s) no longer exist in this server)`;
      }

      return sendResponse(interaction, { content: reply });
    } catch (error) {
      logger.error('Error executing restore command:', error);
      return sendResponse(interaction, {
        content: 'Failed to restore roles. Make sure the bot has **Manage Roles** and its highest role is above the roles being restored.',
        ephemeral: true,
      });
    }
  },
};
