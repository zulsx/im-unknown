import { EmbedBuilder } from 'discord.js';

export default {
  name: 'mc',
  aliases: ['membercount', 'members'],
  description: 'Shows total members, humans, and bots in the server',

  async execute(message) {
    if (!message.guild) return;

    try {
      const members = await message.guild.members.fetch();

      const totalMembers = members.size;
      const bots = members.filter((member) => member.user.bot).size;
      const humans = totalMembers - bots;

      const embed = new EmbedBuilder()
        .setAuthor({ name: message.guild.name })
        .setDescription(
          `### Members in ${message.guild.name}\n` +
            `> Total Members: \`${totalMembers}\`\n` +
            `> Humans: \`${humans}\`\n` +
            `> Bots: \`${bots}\``
        );

      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to fetch members for mc command:', error);
      await message.channel.send(
        'Could not load member counts. Make sure **Server Members Intent** is enabled in the Discord Developer Portal.'
      );
    }
  },
};