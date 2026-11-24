import {
  AuditLogEvent,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

const antiNukeConfigs = new Map();
const actionHistory = new Map();

let listenersAttached = false;

const DEFAULT_CONFIG = {
  enabled: false,
  limit: 3,
  windowMs: 10_000,
  action: 'strip',
  whitelist: new Set(),
};

function getGuildConfig(guildId) {
  if (!antiNukeConfigs.has(guildId)) {
    antiNukeConfigs.set(guildId, {
      ...DEFAULT_CONFIG,
      whitelist: new Set(),
    });
  }
  return antiNukeConfigs.get(guildId);
}

async function fetchRecentExecutor(guild, auditType, targetId = null) {
  try {
    const logs = await guild.fetchAuditLogs({
      type: auditType,
      limit: 5,
    });
    const now = Date.now();
    const entry = logs.entries.find((e) => {
      const withinWindow = now - e.createdTimestamp < 6_000;
      const matchesTarget = targetId ? e.target?.id === targetId : true;
      return withinWindow && matchesTarget && e.executor && !e.executor.bot;
    });
    return entry?.executor ?? null;
  } catch {
    return null;
  }
}

async function punishActor(guild, actor, reason) {
  const config = getGuildConfig(guild.id);
  const botMember = guild.members.me;
  if (!botMember) return;

  const targetMember = await guild.members.fetch(actor.id).catch(() => null);
  if (!targetMember) return;

  if (
    guild.ownerId === actor.id ||
    targetMember.roles.highest.position >= botMember.roles.highest.position
  ) {
    return;
  }

  try {
    if (config.action === 'ban' && guild.members.bannable) {
      await targetMember.ban({ reason });
      return;
    }

    const dangerousPerms = [
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ManageWebhooks,
    ];

    const removableRoles = targetMember.roles.cache.filter(
      (role) =>
        role.id !== guild.id &&
        role.position < botMember.roles.highest.position &&
        dangerousPerms.some((perm) => role.permissions.has(perm))
    );

    if (removableRoles.size > 0) {
      await targetMember.roles.remove(removableRoles, reason);
    }
  } catch (err) {
    console.error('[AntiNuke] Failed to punish actor:', err);
  }
}

async function recordAndCheckAction(guild, actor, actionLabel) {
  if (!guild || !actor || actor.bot) return;

  const config = getGuildConfig(guild.id);
  if (!config.enabled) return;
  if (actor.id === guild.ownerId || config.whitelist.has(actor.id)) return;

  const key = `${guild.id}:${actor.id}`;
  const now = Date.now();
  const timestamps = (actionHistory.get(key) ?? []).filter(
    (ts) => now - ts <= config.windowMs
  );

  timestamps.push(now);
  actionHistory.set(key, timestamps);

  if (timestamps.length >= config.limit) {
    actionHistory.delete(key);
    await punishActor(
      guild,
      actor,
      `Anti-Nuke triggered (${actionLabel}: ${timestamps.length} actions in ${Math.round(config.windowMs / 1000)}s)`
    );
  }
}

function attachAntiNukeListeners(client) {
  if (listenersAttached || !client) return;
  listenersAttached = true;

  client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const executor = await fetchRecentExecutor(
      channel.guild,
      AuditLogEvent.ChannelDelete,
      channel.id
    );
    if (executor) {
      await recordAndCheckAction(channel.guild, executor, 'channelDelete');
    }
  });

  client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const executor = await fetchRecentExecutor(
      channel.guild,
      AuditLogEvent.ChannelCreate,
      channel.id
    );
    if (executor) {
      await recordAndCheckAction(channel.guild, executor, 'channelCreate');
    }
  });

  client.on('roleDelete', async (role) => {
    if (!role.guild) return;
    const executor = await fetchRecentExecutor(
      role.guild,
      AuditLogEvent.RoleDelete,
      role.id
    );
    if (executor) {
      await recordAndCheckAction(role.guild, executor, 'roleDelete');
    }
  });

  client.on('roleCreate', async (role) => {
    if (!role.guild) return;
    const executor = await fetchRecentExecutor(
      role.guild,
      AuditLogEvent.RoleCreate,
      role.id
    );
    if (executor) {
      await recordAndCheckAction(role.guild, executor, 'roleCreate');
    }
  });

  client.on('guildBanAdd', async (ban) => {
    if (!ban.guild) return;
    const executor = await fetchRecentExecutor(
      ban.guild,
      AuditLogEvent.MemberBanAdd,
      ban.user?.id
    );
    if (executor) {
      await recordAndCheckAction(ban.guild, executor, 'memberBan');
    }
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure anti-nuke protection (Bot Owner Only)')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Enable or configure anti-nuke settings')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Turn anti-nuke on or off')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('Actions before triggering (default: 3)')
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('Time window in seconds (default: 10)')
            .setMinValue(3)
            .setMaxValue(120)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Punishment when triggered')
            .addChoices(
              { name: 'Strip Dangerous Roles', value: 'strip' },
              { name: 'Ban User', value: 'ban' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('whitelist')
        .setDescription('Add or remove a whitelisted user')
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Add or remove')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' }
            )
        )
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('User to whitelist or unwhitelist')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('View current anti-nuke configuration')
    ),

  async execute(interaction) {
    if (!interaction.guild) return;

    attachAntiNukeListeners(interaction.client);

    // Fetch the bot owner ID dynamically from the client application
    if (!interaction.client.application?.owner) {
      await interaction.client.application?.fetch();
    }
    const ownerId = interaction.client.application?.owner?.id;

    // Reject anyone who is not the bot owner
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: 'This command can only be used by the **Bot Owner**.',
        flags: 64,
      });
    }

    const config = getGuildConfig(interaction.guild.id);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      config.enabled = interaction.options.getBoolean('enabled');
      const limit = interaction.options.getInteger('limit');
      const seconds = interaction.options.getInteger('seconds');
      const action = interaction.options.getString('action');

      if (limit !== null) config.limit = limit;
      if (seconds !== null) config.windowMs = seconds * 1000;
      if (action !== null) config.action = action;

      return interaction.reply({
        content:
          `**${interaction.guild.name}**\n\n` +
          `### Anti-Nuke Updated\n` +
          `> Status: \`${config.enabled ? 'Enabled' : 'Disabled'}\`\n` +
          `> Threshold: \`${config.limit} actions / ${Math.round(config.windowMs / 1000)}s\`\n` +
          `> Action: \`${config.action === 'ban' ? 'Ban User' : 'Strip Dangerous Roles'}\``,
        flags: 64,
      });
    }

    if (subcommand === 'whitelist') {
      const mode = interaction.options.getString('mode');
      const user = interaction.options.getUser('user');

      if (mode === 'add') {
        config.whitelist.add(user.id);
        return interaction.reply({
          content: `> Whitelisted <@${user.id}> from anti-nuke triggers.`,
          flags: 64,
        });
      }

      config.whitelist.delete(user.id);
      return interaction.reply({
        content: `> Removed <@${user.id}> from the anti-nuke whitelist.`,
        flags: 64,
      });
    }

    if (subcommand === 'status') {
      const whitelistedList =
        config.whitelist.size > 0
          ? Array.from(config.whitelist)
              .map((id) => `<@${id}>`)
              .join(', ')
          : '`None`';

      return interaction.reply({
        content:
          `**${interaction.guild.name}**\n\n` +
          `### Anti-Nuke Status\n` +
          `> Status: \`${config.enabled ? 'Enabled' : 'Disabled'}\`\n` +
          `> Threshold: \`${config.limit} actions / ${Math.round(config.windowMs / 1000)}s\`\n` +
          `> Action: \`${config.action === 'ban' ? 'Ban User' : 'Strip Dangerous Roles'}\`\n` +
          `> Whitelist: ${whitelistedList}`,
        flags: 64,
      });
    }
  },
};

export { antiNukeConfigs };