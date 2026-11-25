import { Events } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { extractRoleIds, saveMemberRoles, getSavedRoles } from '../services/roleBackupService.js';
import { logger } from '../utils/logger.js';

export default {
  name: Events.GuildMemberUpdate,
  once: false,

  async execute(oldMember, newMember) {
    try {
      if (!newMember?.guild) return;

      const resolvedOldMember = oldMember?.partial
        ? await oldMember.fetch().catch(() => oldMember)
        : oldMember;

      const oldRoles = extractRoleIds(resolvedOldMember);
      const newRoles = extractRoleIds(newMember);

      const rolesChanged =
        oldRoles.length !== newRoles.length ||
        oldRoles.some((id) => !newRoles.includes(id)) ||
        newRoles.some((id) => !oldRoles.includes(id));

      if (rolesChanged && newRoles.length > 0) {
        // Fetch existing backup to prevent autorole on rejoin from overwriting a full backup
        const existingSaved = await getSavedRoles(newMember.guild.id, newMember.id);

        // If the user currently has fewer roles than what is backed up (e.g. autorole upon rejoin),
        // do not overwrite the backup!
        if (existingSaved.length > 0 && newRoles.length < existingSaved.length) {
          console.log(
            `[DEBUG guildMemberUpdate] Ignored overwrite for ${newMember.id}: member has ${newRoles.length} live roles, but database holds ${existingSaved.length} saved roles.`
          );
        } else {
          console.log(
            `[DEBUG guildMemberUpdate] saving ${newRoles.length} roles for ${newMember.id} in ${newMember.guild.id}:`,
            newRoles
          );
          await saveMemberRoles(newMember.guild.id, newMember.id, newRoles);
        }
      }

      if (resolvedOldMember?.nickname !== newMember.nickname) {
        await logEvent({
          client: newMember.client,
          guildId: newMember.guild.id,
          eventType: EVENT_TYPES.MEMBER_NAME_CHANGE,
          data: {
            title: 'Nickname changed',
            lines: [
              `**User:** ${newMember.user.toString()} (${newMember.user.tag})`,
              `**ID:** \`${newMember.user.id}\``,
              `**Before:** ${resolvedOldMember?.nickname || '*(no nickname)*'}`,
              `**After:** ${newMember.nickname || '*(no nickname)*'}`,
            ],
            thumbnail: newMember.user.displayAvatarURL({ dynamic: true }),
            userId: newMember.user.id,
          },
        });
      }
    } catch (error) {
      logger.error('Error in guildMemberUpdate event:', error);
    }
  },
};
