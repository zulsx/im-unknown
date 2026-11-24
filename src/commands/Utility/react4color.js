import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

const COLOR_OPTIONS = [
  { key: 'black', label: 'Black', color: '#2b2d31' },
  { key: 'white', label: 'White', color: '#f2f3f5' },
  { key: 'pink', label: 'Pink', color: '#eb459e' },
  { key: 'cyan', label: 'Cyan', color: '#1abc9c' },
  { key: 'red', label: 'Red', color: '#ed4245' },
  { key: 'yellow', label: 'Yellow', color: '#fee75c' },
  { key: 'green', label: 'Green', color: '#57f287' },
  { key: 'blue', label: 'Blue', color: '#5865f2' },
  { key: 'purple', label: 'Purple', color: '#9b59b6' },
  { key: 'orange', label: 'Orange', color: '#e67e22' },
];

let buttonListenerAttached = false;

function buildDescription(guild) {
  const lines = COLOR_OPTIONS.map((item) => {
    const matchedRole = guild.roles.cache.find(
      (role) => role.name.toLowerCase() === item.label.toLowerCase()
    );
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

    const targetRole = interaction.guild.roles.cache.find(
      (role) => role.name.toLowerCase() === colorConfig.label.toLowerCase()
    );

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
        COLOR_OPTIONS.map((c) =>
          interaction.guild.roles.cache.find(
            (r) => r.name.toLowerCase() === c.label.toLowerCase()
          )?.id
        ).filter(Boolean)
      );

      const hasRole = interaction.member.roles.cache.has(targetRole.id);

      // Remove other color roles first so a user only keeps one active color role
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
        content: 'Failed to update your color role. Check my **Manage Roles** permission and role position.',
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

    const attachment = interaction.options.getAttachment('image');
    const embed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setDescription(buildDescription(interaction.guild));

    if (attachment) {
      embed.setImage(attachment.url);
    }

    await interaction.reply({
      embeds: [embed],
      components: buildButtonRows(),
    });
  },
};