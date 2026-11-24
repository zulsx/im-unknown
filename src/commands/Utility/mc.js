import { Client, GatewayIntentBits, Partials } from 'discord.js';

const mcClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

const PREFIX = ',';

mcClient.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim().toLowerCase();
  if (content !== `${PREFIX}mc` && content !== `${PREFIX}membercount`) return;

  try {
    const members = await message.guild.members.fetch();
    const totalMembers = members.size;
    const bots = members.filter((m) => m.user.bot).size;
    const humans = totalMembers - bots;
    const guildName = message.guild.name;

    await message.channel.send(
      `**${guildName}**\n\n` +
        `### Members in ${guildName}\n` +
        `> Total Members: \`${totalMembers}\`\n` +
        `> Humans: \`${humans}\`\n` +
        `> Bots: \`${bots}\``
    );
  } catch (err) {
    console.error('Error in mc command:', err);
  }
});

// Only call mcClient.login(...) here if this file logs in its own client;
// if snipes.js shares/exports its client or token elsewhere, follow that same login line.