import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits 
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setupcolors')
    .setDescription('Sends the color role selection menu')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Only admins can use it

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Colors')
      .setDescription(
        '----------------------------------------\n\n' +
        'Black - #BLACK\n' +
        'White - #WHITE\n' +
        'Pink - #PINK\n' +
        'Cyan - #CYAN\n' +
        'Red - #RED\n' +
        'Yellow - #YELLOW\n' +
        'Green - #GREEN\n' +
        'Blue - #BLUE\n' +
        'Purple - #PURPLE\n' +
        'Orange - #ORANGE\n\n' +
        '----------------------------------------'
      )
      .setImage('https://your-image-link.com/banner.png')
      .setFooter({ text: 'Click a color button to add or remove that role.' })
      .setColor(0x2f3136);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_black').setLabel('Black').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_white').setLabel('White').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_pink').setLabel('Pink').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_cyan').setLabel('Cyan').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_red').setLabel('Red').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_yellow').setLabel('Yellow').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_green').setLabel('Green').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_blue').setLabel('Blue').setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_purple').setLabel('Purple').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_orange').setLabel('Orange').setStyle(ButtonStyle.Secondary)
    );

    // Reply to the interaction and send the embed with buttons
    await interaction.reply({ 
      embeds: [embed], 
      components: [row1, row2, row3], 
      ephemeral: true // Makes the confirmation message visible only to the admin
    });
  },
};