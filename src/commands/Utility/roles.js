import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = ',';
const ROLES_ALIASES = ['roles', 'rolelist', 'listroles'];
const MAX_MESSAGE_LENGTH = 2000;

function formatRolesList(guild, rolesCollection) {
  const roles = [...rolesCollection.values()]
    .filter((role) => role.id !== guild.id) // Exclude @everyone
    .sort((a, b) => b.position - a.position);

  if (roles.length === 0) {
    return [`There are no custom roles in **${guild.name}**.`];
  }

  const header = `**Roles in ${guild.name} (${roles.length}):**\n`;
  const lines = roles.map((role, index) => `${index + 1}. ${role} (\`${role.id}\`)`);

  const chunks = [];
  let current = header;

  for (const line of lines) {
    const addition = `${line}\n`;
    if (current.length + addition.length > MAX_MESSAGE_LENGTH) {
      chunks.push(current.trimEnd());
      current = `${line}\n`;
    } else {
      current += addition;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trimEnd());
  }

  return chunks;
}

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  if (!command || !ROLES_ALIASES.includes(command)) return;

  try {
    await message.guild.roles.fetch();
    const chunks = formatRolesList(message.guild, message.guild.roles.cache);

    for (const chunk of chunks) {
      await message.channel.send(chunk);
    }
  } catch (err) {
    console.error(err);
    await message.reply('Could not fetch or display the server roles.');
  }
});

client.login(process.env.DISCORD_TOKEN);