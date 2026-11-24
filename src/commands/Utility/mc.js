import {
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mc')
    .setDescription('Shows total members, humans, and bots in the server'),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;

    try {
      const members = await guild.members.fetch();

      const totalMembers = members.size;
      const bots = members.filter((m) => m.user?.bot).size;
      const humans = totalMembers - bots;
      const guildName = guild.name;

      const textDisplay = new TextDisplayBuilder().setContent(
        `**${guildName}**\n\n` +
          `### Members in ${guildName}\n` +
          `> Total Members: \`${totalMembers}\`\n` +
          `> Humans: \`${humans}\`\n` +
          `> Bots: \`${bots}\``
      );

      const container = new ContainerBuilder().addTextDisplayComponents(
        textDisplay
      );

      await interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error('Error executing mc command:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'Failed to fetch server members.',
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: 'Failed to fetch server members.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};