import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Toggles a role on or off for a user')
  .addUserOption(option =>
    option
      .setName('target')
      .setDescription('The member to add or remove the role from')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option
      .setName('role')
      .setDescription('The role to give or take')
      .setRequired(true)
  );

/**
 * Core logic to check permissions and toggle the role.
 */
async function executeRoleToggle(guild, executorMember, targetMember, role) {
  // Check executor permissions
  if (!executorMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return '❌ You need the **Manage Roles** permission to run this command.';
  }

  // Check bot permissions
  const botMember = guild.members.me;
  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return '❌ I lack the **Manage Roles** permission to edit user roles.';
  }

  // Check role hierarchy
  if (role.position >= botMember.roles.highest.position) {
    return `❌ I cannot manage **${role.name}** because it is equal to or higher than my highest role.`;
  }

  if (role.position >= executorMember.roles.highest.position && guild.ownerId !== executorMember.id) {
    return `❌ You cannot manage **${role.name}** because it is equal to or higher than your highest role.`;
  }

  // Toggle role
  try {
    if (targetMember.roles.cache.has(role.id)) {
      await targetMember.roles.remove(role);
      return `✅ Removed **${role.name}** from **${targetMember.user.tag}**.`;
    } else {
      await targetMember.roles.add(role);
      return `✅ Added **${role.name}** to **${targetMember.user.tag}**.`;
    }
  } catch (error) {
    console.error('Error toggling role:', error);
    return '❌ An error occurred while updating the role.';
  }
}

/**
 * Handles Slash Command interaction (/role)
 */
export async function execute(interaction) {
  // Acknowledge immediately to prevent 10062 / 3-second timeouts
  await interaction.deferReply({ ephemeral: true });

  const targetMember = interaction.options.getMember('target');
  const role = interaction.options.getRole('role');

  if (!targetMember || !role) {
    return interaction.editReply('❌ Could not find that member or role in this server.');
  }

  const response = await executeRoleToggle(
    interaction.guild,
    interaction.member,
    targetMember,
    role
  );

  await interaction.editReply(response);
}

/**
 * Handles Prefix command (,role @user @role)
 */
export async function executePrefix(message, args) {
  if (args.length < 2) {
    return message.reply('Usage: `,role @user @role` (or `,role <userID> <roleID/roleName>`)');
  }

  const userMention = args[0].replace(/[<@!>]/g, '');
  const roleMention = args[1].replace(/[<@&>]/g, '');

  const targetMember = await message.guild.members.fetch(userMention).catch(() => null);
  const role =
    message.guild.roles.cache.get(roleMention) ||
    message.guild.roles.cache.find(r => r.name.toLowerCase() === args.slice(1).join(' ').toLowerCase());

  if (!targetMember || !role) {
    return message.reply('❌ Please mention a valid user and a valid role.');
  }

  const response = await executeRoleToggle(
    message.guild,
    message.member,
    targetMember,
    role
  );

  await message.reply(response);
}