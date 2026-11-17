import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits 
} from 'discord.js';

// Replace these with your actual Role IDs
const ROLE_MAP = {
  'role_Black': '1572149360735817758',
  'role_Red': '1572149298827632650',
  'role_Pink': '1572149607713083422',
  'role_Cyan': '1572149494097907762',
  'role_Green': '1572149545239056394',
  'role_Blue': '1572149440243048559',
  'role_Yellow': '1572155820349718668',
  'role_Purple': '1572155997110407218',
};

export default {
  data: new SlashCommandBuilder()
    .setName('setupcolors')
    .setDescription('Sends the color role selection menu')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Colors:')
      .setDescription(
        '--------------------------------------------------\n\n' +
        `• Black - <@&${1572149360735817758}>\n` +
        `• Red - <@&${1572149298827632650}>\n` +
        `• Pink - <@&${1572149607713083422}>\n` +
        `• Cyan - <@&${1572149494097907762}>\n` +
        `• Green - <@&${1572149545239056394}>\n` +
        `• Blue - <@&${1572149440243048559}>\n` +
        `• Yellow - <@&${1572155820349718668}>\n` +
        `• Purple - <@&${1572155997110407218}>\n` +
        '--------------------------------------------------'
      )
      .setImage('https://imglink.cc/cdn/ItXrWZQriP.webp') // Put your cherry blossom or banner image link here
      .setFooter({ text: 'Click a color button to add or remove that role.' })
      .setColor(0x2f3136);

    // Row 1 (5 buttons)
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_Black').setLabel('Black').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_Red').setLabel('Red').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_pink').setLabel('Pink').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_cyan').setLabel('Cyan').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_Green').setLabel('Green').setStyle(ButtonStyle.Secondary)
    );

    // Row 2 (5 buttons)
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_Blue').setLabel('Blue').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_Yellow').setLabel('Yellow').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_Purple').setLabel('Purple').setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ 
      embeds: [embed], 
      components: [row1, row2] 
    });
  },
};

export { ROLE_MAP };
