import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Required to read ",role ..." text
    GatewayIntentBits.GuildMembers,  // Required to fetch/modify member roles reliably
  ],
});

const PREFIX = ',';

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  if (command !== 'role') return;

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply('You need the **Manage Roles** permission to use this command.');
  }

  const botMember = message.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply('I need the **Manage Roles** permission to assign or remove roles.');
  }

  // Target member: mention or user ID
  const userMatch = args[0]?.match(/^<@!?(\d+)>$|^(\d+)$/);
  const targetId = userMatch?.[1] || userMatch?.[2];
  const targetMember =
    message.mentions.members.first() ||
    (targetId ? await message.guild.members.fetch(targetId).catch(() => null) : null);

  const rawRoleInput = args.slice(1).join(' ').trim();
  if (!targetMember || !rawRoleInput) {
    return message.reply('Usage: `,role @user <role name, mention, or ID>`');
  }

  // Role: mention <@&id>, ID, or case-insensitive name
  const roleMentionMatch = rawRoleInput.match(/^<@&(\d+)>$/);
  const roleIdCandidate = roleMentionMatch?.[1] || (/^\d+$/.test(rawRoleInput) ? rawRoleInput : null);

  await message.guild.roles.fetch();
  const role =
    (roleIdCandidate && message.guild.roles.cache.get(roleIdCandidate)) ||
    message.guild.roles.cache.find((r) => r.name.toLowerCase() === rawRoleInput.toLowerCase());

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