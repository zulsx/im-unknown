import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

// Define gradient colors using primaryColor and secondaryColor
// You can also fill in roleId: '...' to lock directly to an existing role ID
const COLOR_OPTIONS = [
  { key: 'black', label: 'Black', primaryColor: '#1a1a1a', secondaryColor: '#4d4d4d', roleId: '' },
  { key: 'white', label: 'White', primaryColor: '#ffffff', secondaryColor: '#b3b3b3', roleId: '' },
  { key: 'pink', label: 'Pink', primaryColor: '#ff66c4', secondaryColor: '#ff1493', roleId: '' },
  { key: 'cyan', label: 'Cyan', primaryColor: '#00ffff', secondaryColor: '#008b8b', roleId: '' },
  { key: 'red', label: 'Red', primaryColor: '#ff3333', secondaryColor: '#8b0000', roleId: '' },
  { key: 'yellow', label: 'Yellow', primaryColor: '#ffff33', secondaryColor: '#ff8c00', roleId: '' },
  { key: 'green', label: 'Green', primaryColor: '#33ff33', secondaryColor: '#006400', roleId: '' },
  { key: 'blue', label: 'Blue', primaryColor: '#3399ff', secondaryColor: '#00008b', roleId: '' },
  { key: 'purple', label: 'Purple', primaryColor: '#b366ff', secondaryColor: '#4b0082', roleId: '' },
  { key: 'orange', label: 'Orange', primaryColor: '#ff9933', secondaryColor: '#cc3300', roleId: '' },
];

let buttonListenerAttached = false;

function findColorRole(guild, item) {
  // Check by exact Role ID first if provided
  if (item.roleId) {
    const roleById = guild.roles.cache.get(item.roleId);
    if (roleById) return roleById;
  }
  // Fall back to name lookup
  return guild.roles.cache.find(
    (role) => role.name.toLowerCase() === item.label.toLowerCase()
  );
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
        // Create role using Discord's gradient colors object
        role = await guild.roles.create({
          name: item.label,
          colors: {
            primaryColor: item.primaryColor,
            secondaryColor: item.secondaryColor,
          },
          reason: `Gradient color role created by /colors command`,
        });
        createdRoles.push(item.label);
      } catch (err) {
        console.error(`Failed to create gradient role "${item.label}":`, err);
        hierarchyIssues.push(`${item.label} (failed to create - check server gradient perks)`);
        continue;
      }
    }

    if (
      botMember &&
      role.position >= botMember.roles.highest.position
    ) {
      hierarchyIssues.push(`${item.label} (role above/equal to bot)`);
    }
  }

  return { createdRoles, hierarchyIssues };
}

function buildDescription(guild) {
  const lines = COLOR_OPTIONS.map((item) => {
    const matchedRole = findColorRole(guild, item);
    const roleDisplay = matchedRole ? `<@&${matchedRole.id}>` : '`@| RR`';
    return `✦ ${item.label} - ${roleDisplay}`;
  });

  return [
    '### Colors:',
    '────────────────────────',
    ...lines,
    '────────────────────────',
    '/holyk',
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
  if (buttonListenerAttached || !client) return;
  buttonListenerAttached = true;

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('color_role:')) return;
    if (!interaction.guild || !interaction.member) return;

    const colorKey = interaction.customId.split(':')[1];
    const colorConfig = COLOR_OPTIONS.find((c) => c.key === colorKey);
    if (!colorConfig) return;

    const targetRole = findColorRole(interaction.guild, colorConfig);
    if (!targetRole) {
      return interaction.reply({
        content: `Role **${colorConfig.label}** was not found in this server.`,
        flags: 64,
      });
    }

    const botMember = interaction.guild.members.me;
    if (
      !botMember ||
      targetRole.position >= botMember.roles.highest.position
    ) {
      return interaction.reply({
        content: `I can't manage the **${targetRole.name}** role because it's higher than or equal to my highest role.`,
        flags: 64,
      });
    }

    try {
      const allColorRoleIds = new Set(
        COLOR_OPTIONS.map((c) => findColorRole(interaction.guild, c)?.id)
          .filter(Boolean)
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
        return interaction.reply({
          content: `Removed **${targetRole.name}**.`,
          flags: 64,
        });
      }

      await interaction.member.roles.add(targetRole);
      return interaction.reply({
        content: `Gave you **${targetRole.name}**.`,
        flags: 64,
      });
    } catch (error) {
      console.error('Error toggling color role:', error);
      return interaction.reply({
        content:
          'Failed to update your color role. Check my **Manage Roles** permission and role position.',
        flags: 64,
      });
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

    await interaction.deferReply();

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
        notes.push(`Created gradient roles: ${createdRoles.join(', ')}`);
      }
      if (hierarchyIssues.length > 0) {
        notes.push(`Role setup notes: ${hierarchyIssues.join(' | ')}`);
      }
      await interaction.followUp({
        content: notes.join('\n'),
        flags: 64,
      });
    }
  },
};