import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Nukes and recreates the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.channel;

    await interaction.reply({
      content: 'Are you sure you want to nuke this channel? Type `yes` within 10 seconds to confirm.',
      ephemeral: true
    });

    const filter = m => m.author.id === interaction.user.id;
    
    try {
      const collected = await channel.awaitMessages({ filter, max: 1, time: 10000, errors: ['time'] });
      if (collected.first().content.toLowerCase() === 'yes') {
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Nuked!')
          .setDescription('First')
          .setFooter({ text: 'Made by x' })
          .setTimestamp();

        const newChannel = await channel.clone();
        await newChannel.send({ embeds: [embed] });
        await channel.delete();
      } else {
        await interaction.followUp({ content: 'Cancelled the nuke!', ephemeral: true });
      }
    } catch {
      await interaction.followUp({ content: 'Time is over... action cancelled.', ephemeral: true });
    }
  }
};