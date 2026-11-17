async execute(interaction) {
    // 1. Tell Discord "I'm working on it" immediately so it doesn't time out
    await interaction.deferReply({ ephemeral: true });

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
      .setImage('https://your-image-link.com/banner.png')
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

    // 2. Use editReply instead of reply to post the menu safely
    await interaction.editReply({ 
      embeds: [embed], 
      components: [row1, row2] 
    });
  },
