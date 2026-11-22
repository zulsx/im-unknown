import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Partials,
} from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

const PREFIX = ',';
const MAX_SNIPES_PER_CHANNEL = 25;

// Map<channelId, Array<{ authorId, authorTag, authorName, authorAvatar, content, attachments, deletedAt }>>
const snipesByChannel = new Map();

function getChannelSnipes(channelId) {
  if (!snipesByChannel.has(channelId)) {
    snipesByChannel.set(channelId, []);
  }
  return snipesByChannel.get(channelId);
}

function formatRelativeSeconds(timestampMs) {
  const diffSeconds = Math.max(1, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSeconds < 60) return `${diffSeconds} second${diffSeconds === 1 ? '' : 's'} ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

client.on('messageDelete', async (message) => {
  if (!message.guild || !message.channel) return;
  if (message.author?.bot) return;

  // Ignore bot command triggers like ",s" or ",cs"
  const content = message.content ?? '';
  if (
    content.trim().toLowerCase() === `${PREFIX}s` ||
    content.trim().toLowerCase() === `${PREFIX}cs`
  ) {
    return;
  }

  const attachments = message.attachments
    ? [...message.attachments.values()].map((att) => att.url)
    : [];

  // Skip completely empty uncached messages
  if (!content && attachments.length === 0) return;

  const list = getChannelSnipes(message.channel.id);

  // Store newest deleted message at index 0
  list.unshift({
    authorId: message.author?.id ?? 'unknown',
    authorName: message.member?.displayName ?? message.author?.username ?? 'Unknown User',
    authorAvatar:
      message.author?.displayAvatarURL({ extension: 'png', size: 128 }) ?? null,
    content,
    attachments,
    deletedAt: Date.now(),
  });

  if (list.length > MAX_SNIPES_PER_CHANNEL) {
    list.length = MAX_SNIPES_PER_CHANNEL;
  }
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  // ,cs -> Clear snipes for this channel
  if (command === 'cs') {
    snipesByChannel.set(message.channel.id, []);

    const clearedEmbed = new EmbedBuilder()
      .setColor(0x57f287) // Green accent bar
      .setDescription(`✅ <@${message.author.id}>: Cleared snipes for this channel.`);

    return message.channel.send({ embeds: [clearedEmbed] });
  }

  // ,s [@user] [number] -> Snipe latest deleted message (optionally filtered by user & index)
  if (command === 's') {
    const allChannelSnipes = getChannelSnipes(message.channel.id);

    if (allChannelSnipes.length === 0) {
      return message.reply('There are no deleted messages to snipe in this channel.');
    }

    let targetUserId = null;
    let indexArg = null;

    for (const arg of args) {
      const mentionMatch = arg.match(/^<@!?(\d+)>$|^(\d+)$/);
      const possibleId = mentionMatch?.[1] || mentionMatch?.[2];

      if (possibleId && possibleId.length >= 15) {
        targetUserId = possibleId;
      } else if (/^\d+$/.test(arg)) {
        indexArg = parseInt(arg, 10);
      }
    }

    const candidates = targetUserId
      ? allChannelSnipes.filter((entry) => entry.authorId === targetUserId)
      : allChannelSnipes;

    if (candidates.length === 0) {
      return message.reply('No deleted messages found for that user in this channel.');
    }

    const chosenIndex =
      indexArg && indexArg >= 1 && indexArg <= candidates.length ? indexArg - 1 : 0;
    const sniped = candidates[chosenIndex];

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({
        name: sniped.authorName,
        iconURL: sniped.authorAvatar ?? undefined,
      })
      .setDescription(sniped.content || '*[No text content]*')
      .setFooter({
        text: `Deleted ${formatRelativeSeconds(sniped.deletedAt)} • ${chosenIndex + 1}/${candidates.length} messages`,
        iconURL: sniped.authorAvatar ?? undefined,
      });

    if (sniped.attachments.length > 0) {
      embed.addFields({
        name: 'Attachments',
        value: sniped.attachments.join('\n'),
      });
    }

    return message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);