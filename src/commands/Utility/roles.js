import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = ',';
const ROLES_ALIASES = ['roles', 'rolelist', 'listroles'];
const ROLES_PER_PAGE = 10;

function getSortedRoles(guild) {
  return [...guild.roles.cache.values()]
    .filter((role) => role.id !== guild.id) // Exclude @everyone
    .sort((a, b) => b.position - a.position);
}

function buildRolesEmbed(guild, roles, page, totalPages, filterQuery = '') {
  const padWidth = Math.max(2, String(roles.length).length);
  const start = page * ROLES_PER_PAGE;
  const pageRoles = roles.slice(start, start + ROLES_PER_PAGE);

  const lines =
    pageRoles.length > 0
      ? pageRoles.map((role, idx) => {
          const num = String(start + idx + 1).padStart(padWidth, '0');
          return `\`${num}\` ${role} - \`${role.id}\``;
        })
      : ['No roles matched your search.'];

  const embed = new EmbedBuilder()
    .setTitle(`Roles in ${guild.name}`)
    .setDescription(lines.join('\n'))
    .setColor(0x2b2d31)
    .setFooter({
      text: filterQuery
        ? `Page ${page + 1}/${totalPages} • Filter: "${filterQuery}"`
        : `Page ${page + 1}/${totalPages}`,
    });

  return embed;
}

function buildControls(page, totalPages, disabled = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('roles_prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page <= 0),
    new ButtonBuilder()
      .setCustomId('roles_next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId('roles_search')
      .setLabel('🔍')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('roles_close')
      .setLabel('🚫')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );

  return [row];
}

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  if (!command || !ROLES_ALIASES.includes(command)) return;

  try {
    await message.guild.roles.fetch();
    const allRoles = getSortedRoles(message.guild);

    if (allRoles.length === 0) {
      return message.reply(`There are no custom roles in **${message.guild.name}**.`);
    }

    let filteredRoles = allRoles;
    let filterQuery = '';
    let page = 0;
    let totalPages = Math.max(1, Math.ceil(filteredRoles.length / ROLES_PER_PAGE));

    const sentMessage = await message.channel.send({
      embeds: [buildRolesEmbed(message.guild, filteredRoles, page, totalPages, filterQuery)],
      components: buildControls(page, totalPages),
    });

    const collector = sentMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000, // 2 minutes
    });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          content: 'Only the user who ran this command can use these buttons.',
          ephemeral: true,
        });
      }

      if (interaction.customId === 'roles_close') {
        collector.stop('closed');
        await sentMessage.delete().catch(() => {});
        return;
      }

      if (interaction.customId === 'roles_prev') {
        page = Math.max(0, page - 1);
        await interaction.update({
          embeds: [buildRolesEmbed(message.guild, filteredRoles, page, totalPages, filterQuery)],
          components: buildControls(page, totalPages),
        });
        return;
      }

      if (interaction.customId === 'roles_next') {
        page = Math.min(totalPages - 1, page + 1);
        await interaction.update({
          embeds: [buildRolesEmbed(message.guild, filteredRoles, page, totalPages, filterQuery)],
          components: buildControls(page, totalPages),
        });
        return;
      }

      if (interaction.customId === 'roles_search') {
        const modalId = `roles_search_modal_${interaction.id}`;
        const modal = new ModalBuilder().setCustomId(modalId).setTitle('Search Roles');

        const input = new TextInputBuilder()
          .setCustomId('role_query_input')
          .setLabel('Role name or ID (leave blank to reset)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(filterQuery);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);

        const submitted = await interaction
          .awaitModalSubmit({
            time: 60_000,
            filter: (m) => m.customId === modalId && m.user.id === interaction.user.id,
          })
          .catch(() => null);

        if (!submitted) return;

        const query = submitted.fields.getTextInputValue('role_query_input').trim();
        filterQuery = query;

        if (!query) {
          filteredRoles = allRoles;
        } else {
          const lower = query.toLowerCase();
          filteredRoles = allRoles.filter(
            (r) => r.name.toLowerCase().includes(lower) || r.id === query
          );
        }

        page = 0;
        totalPages = Math.max(1, Math.ceil(filteredRoles.length / ROLES_PER_PAGE));

        await submitted.update({
          embeds: [buildRolesEmbed(message.guild, filteredRoles, page, totalPages, filterQuery)],
          components: buildControls(page, totalPages),
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'closed') return;
      await sentMessage
        .edit({
          components: buildControls(page, totalPages, true),
        })
        .catch(() => {});
    });
  } catch (err) {
    console.error(err);
    await message.reply('Could not fetch or display the server roles.');
  }
});

client.login(process.env.DISCORD_TOKEN);