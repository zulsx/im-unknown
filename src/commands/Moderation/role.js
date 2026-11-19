import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Gives a server role to a user (Manage Roles required)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('The user to give the role to')
      .setRequired(true)
  )
  .addRoleOption((option) =>
    option
      .setName('role')
      .setDescription('The role to give')
      .setRequired(true)
  );

async function assignRole({ guild, executor, targetMember, role }) {
  if (!executor?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return '❌ You need the **Manage Roles** permission to use this command.';
  }

  const botMember = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return '❌ I need the **Manage Roles** permission to assign roles.';
  }

  if (role.managed) {
    return `❌ **${role.name}** is an integration/bot-managed role and cannot be manually assigned.`;
  }

  if (role.position >= botMember.roles.highest.position) {
    return `❌ I cannot assign **${role.name}** because it is equal to or higher than my highest role.`;
  }

  if (guild.ownerId !== executor.id && role.position >= executor.roles.highest.position) {
    return `❌ You cannot assign **${role.name}** because it is equal to or higher than your highest role.`;
  }

  if (!targetMember) {
    return '❌ Could not find that user in this server.';
  }

  if (targetMember.roles.cache.has(role.id)) {
    return `ℹ️ **${targetMember.user.tag}** already has **${role.name}**.`;
  }

  await targetMember.roles.add(role);
  return `✅ Gave **${role.name}** to **${targetMember.user.tag}**.`;
}

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (err) {
    if (err?.code === 10062) return;
    throw err;
  }

  try {
    const targetMember = interaction.options.getMember('user');
    const role = interaction.options.getRole('role');

    const result = await assignRole({
      guild: interaction.guild,
      executor: interaction.member,
      targetMember,
      role,
    });

    await interaction.editReply(result);
  } catch (error) {
    console.error('Error in /role command:', error);
    await interaction
      .editReply('❌ Something went wrong while assigning that role.')
      .catch(() => {});
  }
}

export async function executePrefix(message, args) {
  if (!message.guild || message.author.bot) return;

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply('❌ You need the **Manage Roles** permission to use this command.');
  }

  if (args.length < 2) {
    return message.reply('Usage: `,role @user @role` (or `,role <userId> <roleId/roleName>`)');
  }

  const userId = args[0].replace(/[<@!>]/g, '');
  const rawRole = args.slice(1).join(' ').trim();
  const roleId = rawRole.replace(/[<@&>]/g, '');

  const targetMember = await message.guild.members.fetch(userId).catch(() => null);
  const role =
    message.guild.roles.cache.get(roleId) ||
    message.guild.roles.cache.find((r) => r.name.toLowerCase() === rawRole.toLowerCase());

  if (!targetMember || !role) {
    return message.reply('❌ Please provide a valid user and role.');
  }

  try {
    const result = await assignRole({
      guild: message.guild,
      executor: message.member,
      targetMember,
      role,
    });

    await message.reply(result);
  } catch (error) {
    console.error('Error in ,role command:', error);
    await message.reply('❌ Something went wrong while assigning that role.').catch(() => {});
  }
}
