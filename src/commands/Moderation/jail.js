const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

// Map to store user roles prior to being jailed: Map<guildId_userId, string[]>
const roleBackupMap = new Map();

// Initialize Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// Top-Level Slash Command Definitions
const setupCommand = new SlashCommandBuilder()
  .setName('jailsetup')
  .setDescription('Create the Jail role and private Jail channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const jailUserCommand = new SlashCommandBuilder()
  .setName('jail')
  .setDescription('Jail a user, strip their roles, and isolate them in the jail channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(opt =>
    opt.setName('target')
      .setDescription('The user to jail')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('reason')
      .setDescription('Reason for jailing')
  );

const unjailUserCommand = new SlashCommandBuilder()
  .setName('unjail')
  .setDescription('Unjail a user and restore their previous roles')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(opt =>
    opt.setName('target')
      .setDescription('The user to unjail')
      .setRequired(true)
  );

// Interaction Handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild, member } = interaction;

  if (!['jailsetup', 'jail', 'unjail'].includes(commandName)) return;

  // Verify Administrator permissions explicitly
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You must be an Administrator to use this command.',
      ephemeral: true
    });
  }

  // -------------------------------------------------------------
  // 1. /jailsetup
  // -------------------------------------------------------------
  if (commandName === 'jailsetup') {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Find or create Jail role
      let jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jailed');
      if (!jailRole) {
        jailRole = await guild.roles.create({
          name: 'Jailed',
          color: '#34495e',
          reason: 'Jail system setup'
        });
      }

      // Find or create Jail channel
      let jailChannel = guild.channels.cache.find(
        c => c.name === 'jail' && c.type === ChannelType.GuildText
      );
      if (!jailChannel) {
        jailChannel = await guild.channels.create({
          name: 'jail',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: jailRole.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages
              ]
            }
          ]
        });
      }

      // Hide all other channels from the Jailed role
      await Promise.all(
        guild.channels.cache.map(async (channel) => {
          if (channel.id !== jailChannel.id) {
            await channel.permissionOverwrites.edit(jailRole, {
              ViewChannel: false
            }).catch(() => {});
          }
        })
      );

      return interaction.editReply(
        `✅ **Jail Setup Complete!** Role ${jailRole} and channel ${jailChannel} are ready.`
      );
    } catch (err) {
      console.error(err);
      return interaction.editReply(
        '❌ Failed to complete jail setup. Check that the bot has `Manage Roles` and `Manage Channels` permissions.'
      );
    }
  }

  // -------------------------------------------------------------
  // 2. /jail @target
  // -------------------------------------------------------------
  if (commandName === 'jail') {
    const targetMember = interaction.options.getMember('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!targetMember) {
      return interaction.reply({
        content: '❌ Target member not found in this server.',
        ephemeral: true
      });
    }

    const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jailed');
    if (!jailRole) {
      return interaction.reply({
        content: '❌ Jail role not found. Run `/jailsetup` first.',
        ephemeral: true
      });
    }

    if (targetMember.roles.cache.has(jailRole.id)) {
      return interaction.reply({
        content: '⚠️ That user is already jailed.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      // Save existing roles (excluding @everyone and managed integration/bot roles)
      const rolesToBackup = targetMember.roles.cache
        .filter(role => role.id !== guild.roles.everyone.id && !role.managed)
        .map(role => role.id);

      const backupKey = `${guild.id}_${targetMember.id}`;
      roleBackupMap.set(backupKey, rolesToBackup);

      // Strip all assignable roles and assign only the Jailed role
      await targetMember.roles.set(
        [jailRole.id],
        `Jailed by ${interaction.user.tag}: ${reason}`
      );

      return interaction.editReply(
        `🔒 **${targetMember.user.tag}** has been jailed.\n**Reason:** ${reason}`
      );
    } catch (err) {
      console.error(err);
      return interaction.editReply(
        "❌ Failed to jail user. Make sure the bot's highest role is above the target user's highest role."
      );
    }
  }

  // -------------------------------------------------------------
  // 3. /unjail @target
  // -------------------------------------------------------------
  if (commandName === 'unjail') {
    const targetMember = interaction.options.getMember('target');

    if (!targetMember) {
      return interaction.reply({
        content: '❌ Target member not found in this server.',
        ephemeral: true
      });
    }

    const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jailed');
    if (!jailRole) {
      return interaction.reply({
        content: '❌ Jail role not found.',
        ephemeral: true
      });
    }

    if (!targetMember.roles.cache.has(jailRole.id)) {
      return interaction.reply({
        content: '⚠️ That user is not currently jailed.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const backupKey = `${guild.id}_${targetMember.id}`;
      const savedRoleIds = roleBackupMap.get(backupKey) || [];

      if (savedRoleIds.length > 0) {
        await targetMember.roles.set(
          savedRoleIds,
          `Unjailed by ${interaction.user.tag}`
        );
        roleBackupMap.delete(backupKey);
      } else {
        await targetMember.roles.remove(
          jailRole.id,
          `Unjailed by ${interaction.user.tag}`
        );
      }

      return interaction.editReply(
        `🔓 **${targetMember.user.tag}** has been unjailed and their previous roles have been restored.`
      );
    } catch (err) {
      console.error(err);
      return interaction.editReply(
        '❌ Failed to restore roles. Some saved roles may have been deleted or sit above the bot in role hierarchy.'
      );
    }
  }
});