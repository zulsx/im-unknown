export default {
  name: 'mc',
  aliases: ['membercount', 'members'],
  category: 'Utility',
  description: 'Shows total members, humans, and bots in the server',

  async execute(message) {
    if (!message.guild) return;

    try {
      const members = await message.guild.members.fetch();
      const totalMembers = members.size;
      const bots = members.filter((m) => m.user?.bot).size;
      const humans = totalMembers - bots;
      const guildName = message.guild.name;

      await message.channel.send(
        `**${guildName}**\n\n` +
          `### Members in ${guildName}\n` +
          `> Total Members: \`${totalMembers}\`\n` +
          `> Humans: \`${humans}\`\n` +
          `> Bots: \`${bots}\``
      );
    } catch (error) {
      console.error('Error in mc command:', error);
    }
  },

  async run(message, args, client) {
    return this.execute(message, args, client);
  },
};