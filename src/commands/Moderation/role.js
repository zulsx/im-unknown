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
    return message.reply(
      `Usage: \`${PREFIX}role @user <role1, role2, ...>\` or \`${PREFIX}r @user <role1, role2, ...>\``
    );
  }

  // Split by comma to allow any number of roles in a single command
  const roleQueries = rawRoleInput
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  await message.guild.roles.fetch();

  const notFound = [];
  const blockedByBot = [];
  const blockedByUser = [];
  const uniqueRoles = new Map();

  for (const query of roleQueries) {
    const role = findMatchingRole(message.guild.roles.cache, query);

    if (!role) {
      notFound.push(query);
      continue;
    }

    if (role.position >= botMember.roles.highest.position) {
      blockedByBot.push(role.name);
      continue;
    }

    if (
      role.position >= message.member.roles.highest.position &&
      message.guild.ownerId !== message.author.id
    ) {
      blockedByUser.push(role.name);
      continue;
    }

    uniqueRoles.set(role.id, role);
  }

  const rolesToAdd = [];
  const rolesToRemove = [];

  for (const role of uniqueRoles.values()) {
    if (targetMember.roles.cache.has(role.id)) {
      rolesToRemove.push(role);
    } else {
      rolesToAdd.push(role);
    }
  }

  if (rolesToAdd.length === 0 && rolesToRemove.length === 0) {
    const issues = [];
    if (notFound.length) issues.push(`Could not find roles matching: ${notFound.join(', ')}`);
    if (blockedByBot.length) {
      issues.push(`Above/equal to my highest role: **${blockedByBot.join(', ')}**`);
    }
    if (blockedByUser.length) {
      issues.push(`Above/equal to your highest role: **${blockedByUser.join(', ')}**`);
    }
    return message.reply(issues.join('\n') || 'No valid roles to update.');
  }

  try {
    if (rolesToAdd.length > 0) {
      await targetMember.roles.add(rolesToAdd);
    }
    if (rolesToRemove.length > 0) {
      await targetMember.roles.remove(rolesToRemove);
    }

    const lines = [];
    if (rolesToAdd.length > 0) {
      lines.push(
        `Added **${rolesToAdd.map((r) => r.name).join(', ')}** to ${targetMember.user.tag}.`
      );
    }
    if (rolesToRemove.length > 0) {
      lines.push(
        `Removed **${rolesToRemove.map((r) => r.name).join(', ')}** from ${targetMember.user.tag}.`
      );
    }
    if (notFound.length > 0) {
      lines.push(`Could not find roles matching: ${notFound.join(', ')}`);
    }
    if (blockedByBot.length > 0) {
      lines.push(`Skipped (above/equal to my role): **${blockedByBot.join(', ')}**`);
    }
    if (blockedByUser.length > 0) {
      lines.push(`Skipped (above/equal to your role): **${blockedByUser.join(', ')}**`);
    }

    return message.reply(lines.join('\n'));
  } catch (err) {
    console.error(err);
    return message.reply('Failed to update roles. Check my role hierarchy and permissions.');
  }
});

client.login(process.env.DISCORD_TOKEN);
