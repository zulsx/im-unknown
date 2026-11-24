import { MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';

// Keep this list in sync with COLOR_OPTIONS in src/commands/Utility/colors.js
const COLOR_ROLE_MAP = new Map([
  ['black',  { label: 'Black',  roleId: '1574655385044779088' }],
  ['white',  { label: 'White',  roleId: '1574655385158287381' }],
  ['pink',   { label: 'Pink',   roleId: '1574655386328375459' }],
  ['cyan',   { label: 'Cyan',   roleId: '1574655386957520966' }],
  ['red',    { label: 'Red',    roleId: '1574655387645509742' }],
  ['yellow', { label: 'Yellow', roleId: '1574655388324995082' }],
  ['green',  { label: 'Green',  roleId: '1574655389864173629' }],
  ['blue',   { label: 'Blue',   roleId: '1574655390963077160' }],
  ['purple', { label: 'Purple', roleId: '1574655391864852517' }],
  ['orange', { label: 'Orange', roleId: '1574655393102172170' }],
]);

async function replyEphemeral(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
  if (interaction.deferred) {
    return interaction.editReply(payload).catch(() => null);
  }
  if (interaction.replied) {
    return interaction.followUp(payload).catch(() => null);
  }
  return interaction.reply(payload).catch(() => null);
}

function resolveRole(guild, key, label) {
  const entry = COLOR_ROLE_MAP.get(key);
  if (entry?.roleId) {
    const byId = guild.roles.cache.get(entry.roleId);
    if (byId) return byId;
  }
  return guild.roles.cache.find(
    (role) => role.name.toLowerCase() === label.toLowerCase()
  );
}

export default {
  name: 'color_role',

  async execute(interaction) {
    if (!interaction.guild || !interaction.member) return;

    const colorKey = interaction.customId.split(':')[1];
    const colorConfig = COLOR_ROLE_MAP.get(colorKey);
    if (!colorConfig) {
      return replyEphemeral(interaction, 'Unknown color option.');
    }

    const targetRole = resolveRole(interaction.guild, colorKey, colorConfig.label);
    if (!targetRole) {
      return replyEphemeral(
        interaction,
        `Role **${colorConfig.label}** was not found in this server.`
      );
    }

    const botMember =
      interaction.guild.members.me ??
      (await interaction.guild.members.fetchMe().catch(() => null));

    if (!botMember || targetRole.position >= botMember.roles.highest.position) {
      return replyEphemeral(
        interaction,
        `I can't manage **${targetRole.name}** because it is higher than or equal to my highest role.`
      );
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    try {
      const allColorRoleIds = new Set(
        Array.from(COLOR_ROLE_MAP.entries())
          .map(([k, v]) => resolveRole(interaction.guild, k, v.label)?.id)
          .filter(Boolean)
      );

      const hasRole = interaction.member.roles.cache.has(targetRole.id);

      const otherColorRoles = interaction.member.roles.cache.filter(
        (role) => allColorRoleIds.has(role.id) && role.id !== targetRole.id
      );
      if (otherColorRoles.size > 0) {
        await interaction.member.roles.remove(otherColorRoles);
      }

      if (hasRole) {
        await interaction.member.roles.remove(targetRole);
        return replyEphemeral(interaction, `Removed **${targetRole.name}**.`);
      }

      await interaction.member.roles.add(targetRole);
      return replyEphemeral(interaction, `Gave you **${targetRole.name}**.`);
    } catch (error) {
      logger.error('Error toggling color role:', error);
      return replyEphemeral(
        interaction,
        'Failed to update your color role. Check my **Manage Roles** permission and role hierarchy.'
      );
    }
  },
};