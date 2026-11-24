import { GatewayIntentBits } from 'discord.js';

export const mcIntent = GatewayIntentBits.GuildMembers;

export async function sendMemberCount(message) {
  if (!message?.guild) return;

  try {
    const members = await message.guild.members.fetch();
    const totalMembers = members.size;
    const bots = members.filter((member) => member.user?.bot).size;
    const humans = totalMembers - bots;
    const guildName = message.guild.name;

    const responseText =
      `**${guildName}**\n\n` +
      `### Members in ${guildName}\n` +
      `> Total Members: \`${totalMembers}\`\n` +
      `> Humans: \`${humans}\`\n` +
      `> Bots: \`${bots}\``;

    await message.channel.send(responseText);
  } catch (error) {
    console.error('Error running mc command:', error);
  }
}

export function attachMemberCountListener(client, prefix = ',') {
  client.on('messageCreate', async (message) => {
    if (message.author?.bot || !message.guild) return;
    if (message.content.trim().toLowerCase() === `${prefix}mc`) {
      await sendMemberCount(message);
    }
  });
}

export default {
  name: 'mc',
  execute: sendMemberCount,
  run: sendMemberCount,
  attach: attachMemberCountListener,
};