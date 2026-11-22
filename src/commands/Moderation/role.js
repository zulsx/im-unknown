const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) // Requires caller to have Manage Roles
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The member to modify')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('The role to give or remove')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetMember = interaction.options.getMember('target');
    const role = interaction.options.getRole('role');
    const botMember = interaction.guild.members.me;

    // 1. Check if bot has Manage Roles permission
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: '❌ I do not have permission to manage roles in this server.',
        ephemeral: true,
      });
    }

    // 2. Role hierarchy check (Bot vs Target Role)
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `❌ I cannot assign **${role.name}** because it is positioned higher than or equal to my highest role.`,
        ephemeral: true,
      });
    }

    // 3. Role hierarchy check (User vs Target Role)
    if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: `❌ You cannot assign **${role.name}** because it is higher than or equal to your highest role.`,
        ephemeral: true,
      });
    }

    try {
      // Toggle role: add if missing, remove if present
      if (targetMember.roles.cache.has(role.id)) {
        await targetMember.roles.remove(role);
        return interaction.reply({
          content: `✅ Removed **${role.name}** from ${targetMember.user.tag}.`,
        });
      } else {
        await targetMember.roles.add(role);
        return interaction.reply({
          content: `✅ Added **${role.name}** to ${targetMember.user.tag}.`,
        });
      }
    } catch (error) {
      console.error(error);
      return interaction.reply({
        content: '❌ An error occurred while trying to update member roles.',
        ephemeral: true,
      });
    }
  },
};