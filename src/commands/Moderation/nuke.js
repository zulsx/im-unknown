import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Nukes and recreates the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.channel;
    const position = channel.position;

    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_nuke')
      .setLabel('Confirm Nuke')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_nuke')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    // Prompt user with interactive buttons (45-second limit)
    const response = await interaction.reply({
      content: '⚠️ Are you sure you want to nuke this channel? You have **45 seconds** to confirm.',
      components: [row],
      ephemeral: true,
      fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 45000
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'You cannot use this button.', ephemeral: true });
      }

      if (i.customId === 'confirm_nuke') {
        await i.reply({ content: 'Nuking channel...', ephemeral: true });

        try {
          // 1. Clone channel (preserves permissions & category)
          const newChannel = await channel.clone();
          
          // 2. Set identical channel position
          await newChannel.setPosition(position);

          // 3. Delete the original channel
          await channel.delete();

          // 4. Send plain text without any embed
          await newChannel.send('first');
        } catch (error) {
          console.error(error);
        }
      } else if (i.customId === 'cancel_nuke') {
        await i.update({ content: 'Nuke action cancelled.', components: [] });
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        await interaction.editReply({ 
          content: 'Time is over... action cancelled.', 
          components: [] 
        }).catch(() => {});
      }
    });
  }
};
