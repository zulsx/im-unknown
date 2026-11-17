import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits 
} from 'discord.js';

const ROLE_MAP = {
  'role_black': '1572149360735817758',
  'role_red': '1572149298827632650',
  'role_pink': '1572149007713083422',
  'role_cyan': '1572149494989707762',
  'role_green': '1572149545239056394',
  'role_blue': '1572149440343048559',
  'role_yellow': '1572155820349718668',
  'role_purple': '1572155997110487218',
};

export default {
  data: new SlashCommandBuilder()
    .setName('setupcolors')
    .setDescription('Sends the color role selection menu')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Colors')
      .setDescription(
        '----------------------------------------\n\n' +
        'Black - #BLACK\n' +
        
        'Red - #RED\n' +
        
        'Pink - #PINK\n' +
        
        'Cyan - #CYAN\n' +
        
        'Green - #GREEN\n' +
        
        'Blue - #BLUE\n' +
        
        'Yellow - #YELLOW\n' +
        
        'Purple - #PURPLE\n' +
        '----------------------------------------'
      )
      .setImage('https://imglink.cc/cdn/ItXrWZQriP.webp')
      .setFooter({ text: 'Click a color button to add or remove that role.' })
      .setColor(0x2f3136);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_black').setLabel('Black').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_red').setLabel('Red').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_pink').setLabel('Pink').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_cyan').setLabel('Cyan').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_green').setLabel('Green').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_blue').setLabel('Blue').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_yellow').setLabel('Yellow').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_purple').setLabel('Purple').setStyle(ButtonStyle.Secondary)
    );

    // Immediately reply to satisfy Discord's 3-second rule without errors
    await interaction.reply({ 
      embeds: [embed], 
      components: [row1, row2] 
    });
  },
};

export { ROLE_MAP };
