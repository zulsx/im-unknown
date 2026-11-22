import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const PREFIX = ',';
const COMMAND_ALIASES = ['role', 'r'];

// Normalizes names like "# DEMONTIME" -> "demontime" for flexible matching
function normalizeRoleName(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // strip symbols/emojis/punctuation like '#'
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingRole(rolesCache, rawInput) {
  const trimmed = rawInput.trim();

  // 1. Mention <@&id> or exact role ID
  const mentionMatch = trimmed.match(/^<@&(\d+)>$/);
  const roleId = mentionMatch?.[1] || (/^\d+$/.test(trimmed) ? trimmed : null);
  if (roleId) {
    const byId = rolesCache.get(roleId);
    if (byId) return byId;
  }

  const lowerInput = trimmed.toLowerCase();
  const normInput = normalizeRoleName(trimmed);
  const compactInput = normInput.replace(/\s+/g, '');

  const roles = [...rolesCache.values()].filter((r) => r.id !== r.guild.id);

  // 2. Exact case-insensitive match
  const exactRaw = roles.find((r) => r.name.toLowerCase() === lowerInput);
  if (exactRaw) return exactRaw;

  // 3. Exact normalized match (ignores '#', emojis, extra spaces)
  const exactNorm = roles.find((r) => {
    const normName = normalizeRoleName(r.name);
    return normName === normInput || normName.replace(/\s+/g, '') === compactInput;
  });
  if (exactNorm) return exactNorm;

  // 4. Partial match (e.g. "demon" -> "# DEMONTIME")
  if (!compactInput) return null;

  const partialMatches = roles
    .map((r) => {
      const normName = normalizeRoleName(r.name);
      const compactName = normName.replace(/\s+/g, '');
      const words = normName.split(' ');

      let score = 0;
      if (words.some((w) => w.startsWith(normInput))) score += 3;
      if (compactName.startsWith(compactInput)) score += 2;
      if (compactName.includes(compactInput)) score += 1;

      return { role: r, score, lengthDiff: Math.abs(compactName.length - compactInput.length) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.lengthDiff !== b.lengthDiff) return a.lengthDiff - b.lengthDiff;
      return b.role.position - a.role.position;
    });

  return partialMatches[0]?.role ?? null;
}

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  if (!command || !COMMAND_ALIASES.includes(command)) return;

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply('You need the **Manage Roles** permission to use this command.');
  }

  const botMember = message.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply('I need the **Manage Roles** permission to assign or remove roles.');
  }

  const userMatch = args[0]?.match(/^<@!?(\d+)>$|^(\d+)$/);
  const targetId = userMatch?.[1] || userMatch?.[2];
  const targetMember =
    message.mentions.members.first() ||
    (targetId ? await message.guild.members.fetch(targetId).catch(() => null) : null);

  const rawRoleInput = args.slice(1).join(' ').trim();
  if (!targetMember || !rawRoleInput) {
    return message.reply(`Usage: \`${PREFIX}role @user <role name>\` or \`${PREFIX}r @user <role name>\``);
  }

  await message.guild.roles.fetch();
  const role = findMatchingRole(message.guild.roles.cache, rawRoleInput);

  if (!role) {
    return message.reply(`Could not find a role matching "${rawRoleInput}".`);
  }

  if (role.position >= botMember.roles.highest.position) {
    return message.reply(
      `I cannot manage **${role.name}** because it is above or equal to my highest role.`
    );
  }

  if (
    role.position >= message.member.roles.highest.position &&
    message.guild.ownerId !== message.author.id
  ) {
    return message.reply(
      `You cannot manage **${role.name}** because it is above or equal to your highest role.`
    );
  }

  try {
    if (targetMember.roles.cache.has(role.id)) {
      await targetMember.roles.remove(role);
      return message.reply(`Removed **${role.name}** from ${targetMember.user.tag}.`);
    } else {
      await targetMember.roles.add(role);
      return message.reply(`Added **${role.name}** to ${targetMember.user.tag}.`);
    }
  } catch (err) {
    console.error(err);
    return message.reply('Failed to update roles. Check my role hierarchy and permissions.');
  }
});

client.login(process.env.DISCORD_TOKEN);