import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

const COLOR_OPTIONS = [
  { key:  'black',  label: 'Black',  primaryColor: '#0c0c0c', secondaryColor: '#545454', roleId: '1574655385044779088' },
  
  { key:  'white',  label: 'White',  primaryColor: '#ffffff', secondaryColor: '#bababa', roleId: '1574655385158287381' },
  
  { key:   'pink',   label: 'Pink',   primaryColor: '#f7a9f2', secondaryColor: '#ff5ebf', roleId: '1574655386328375459' },
  
  { key:   'cyan',   label: 'Cyan',   primaryColor: '#79ebfa', secondaryColor: '#9fc1ff', roleId: '1574655386957520966' },
  
  { key:    'red',    label: 'Red',    primaryColor: '#ed4043', secondaryColor: '#801017', roleId: '1574655387645509742' },
  
  { key:'yellow', label: 'Yellow', primaryColor: '#faed30', secondaryColor: '#e6e2b3', roleId: '1574655388324995082' },
  
  { key:  'green',  label: 'Green',  primaryColor: '#369876', secondaryColor: '#71ff9e', roleId: '1574655389864173629' },
  
  { key:    'blue',   label: 'Blue',   primaryColor: '#181ff7', secondaryColor: '#3e74d8', roleId: '1574655390963077160' },
  
  { key:'purple', label: 'Purple', primaryColor: '#826bc2', secondaryColor: '#b29efe', roleId: '1574655391864852517' },
  
  { key:'orange', label: 'Orange', primaryColor: '#d57b2c', secondaryColor: '#d8ad48', roleId: '1574655393102172170' },
];

const attachedClients = new WeakSet();

async function sendButtonResponse(interaction, content) {
  const payload = { content, flags: 64 };
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(payload).catch(() => null);
  }
  return interaction.reply(payload).catch(() => null);
}

function findColorRole(guild, item) {
  if (item.roleId) {
    const roleById = guild.roles.cache.get(item.roleId);
    if (roleById) return roleById;
  }

  return guild.roles.cache.find(
    (role) => role.name.toLowerCase() === item.label.toLowerCase()
  );
}

async function createRoleWithGradientFallback(guild, item) {
  try {
    return await guild.roles.create({
      name: item.label,
      colors: {
        primaryColor: item.primaryColor,
        secondaryColor: item.secondaryColor,
      },
      reason: 'Gradient color role created by /colors command',
    });
  } catch {
    return guild.roles.create({
      name: item.label,
      color: item.primaryColor,
      reason: 'Color role created by /colors command (fallback)',
    });
  }
}

async function ensureColorRoles(guild) {
  const botMember = guild.members.me;
  const canManageRoles = Boolean(
    botMember?.permissions.has(PermissionFlagsBits.ManageRoles)
  );
  const createdRoles = [];
  const hierarchyIssues = [];

  for (const item of COLOR_OPTIONS) {
    let role = findColorRole(guild, item);

    if (!role) {
      if (!canManageRoles) {
        hierarchyIssues.push(`${item.label} (missing Manage Roles permission)`);
        continue;
      }

      try {
        role = await createRoleWithGradientFallback(guild, item);
        createdRoles.push(item.label);
      } catch (err) {
        console.error(`Failed to create color role "${item.label}":`, err);
        hierarchyIssues.push(`${item.label} (failed to create)`);
        continue;
      }
    }

    if (botMember && role.position >= botMember.roles.highest.position) {
      hierarchyIssues.push(`${item.label} (role above/equal to bot)`);
    }
  }

  return { createdRoles, hierarchyIssues };
}

function buildDescription(guild) {
  const lines = COLOR_OPTIONS.map((item) => {
    const matchedRole = findColorRole(guild, item);
    const roleDisplay = matchedRole ? `<@&${matchedRole.id}>` : '`@| ✦`';
    return `✦ ${item.label} - ${roleDisplay}`;
  });

  return [
    '### Colors:',
    '────────────────────────',
    ...lines,
    '────────────────────────',
    '/unkw',
  ].join('\n');
}

function buildButtonRows() {
  const firstRow = new ActionRowBuilder().addComponents(
    COLOR_OPTIONS.slice(0, 5).map((item) =>
      new ButtonBuilder()
        .setCustomId(`color_role:${item.key}`)
        .setLabel(item.label)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const secondRow = new ActionRowBuilder().addComponents(
    COLOR_OPTIONS.slice(5, 10).map((item) =>
      new ButtonBuilder()
        .setCustomId(`color_role:${item.key}`)
        .setLabel(item.label)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return [firstRow, secondRow];
}

function attachColorButtonListener(client) {
  if (!client || attachedClients.has(client)) return;
  attachedClients.add(client);

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('color_role:')) return;
    if (!interaction.guild || !interaction.member) return;

    const colorKey = interaction.customId.split(':')[1];
    const colorConfig = COLOR_OPTIONS.find((c) => c.key === colorKey);
    if (!colorConfig) return;

    const targetRole = findColorRole(interaction.guild, colorConfig);
    if (!targetRole) {
      return sendButtonResponse(
        interaction,
        `Role **${colorConfig.label}** was not found in this server.`
      );
    }

    const botMember = interaction.guild.members.me;
    if (!botMember || targetRole.position >= botMember.roles.highest.position) {
      return sendButtonResponse(
        interaction,
        `I can't manage the **${targetRole.name}** role because it's higher than or equal to my highest role.`
      );
    }

    try {
      const allColorRoleIds = new Set(
        COLOR_OPTIONS.map((c) => findColorRole(interaction.guild, c)?.id).filter(Boolean)
      );

      const hasRole = interaction.member.roles.cache.has(targetRole.id);

      const rolesToRemove = interaction.member.roles.cache.filter(
        (role) => allColorRoleIds.has(role.id) && role.id !== targetRole.id
      );
      if (rolesToRemove.size > 0) {
        await interaction.member.roles.remove(rolesToRemove);
      }

      if (hasRole) {
        await interaction.member.roles.remove(targetRole);
        return sendButtonResponse(interaction, `Removed **${targetRole.name}**.`);
      }

      await interaction.member.roles.add(targetRole);
      return sendButtonResponse(interaction, `Gave you **${targetRole.name}**.`);
    } catch (error) {
      console.error('Error toggling color role:', error);
      return sendButtonResponse(
        interaction,
        'Failed to update your color role. Check my **Manage Roles** permission and role position.'
      );
    }
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('colors')
    .setDescription('Post the color roles panel with an optional embed image')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addAttachmentOption((option) =>
      option
        .setName('image')
        .setDescription('Optional image to attach inside the embed')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) return;

    attachColorButtonListener(interaction.client);

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const { createdRoles, hierarchyIssues } = await ensureColorRoles(
      interaction.guild
    );

    const attachment = interaction.options.getAttachment('image');
    const embed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setDescription(buildDescription(interaction.guild));

    if (attachment) {
      embed.setImage(attachment.url);
    }

    await interaction.editReply({
      embeds: [embed],
      components: buildButtonRows(),
    });

    if (createdRoles.length > 0 || hierarchyIssues.length > 0) {
      const notes = [];
      if (createdRoles.length > 0) {
        notes.push(`Created roles: ${createdRoles.join(', ')}`);
      }
      if (hierarchyIssues.length > 0) {
        notes.push(`Role setup notes: ${hierarchyIssues.join(' | ')}`);
      }
      await interaction.followUp({
        content: notes.join('\n'),
        flags: 64,
      }).catch(() => null);
    }
  },
};
