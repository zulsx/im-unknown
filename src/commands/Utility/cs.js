import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

// Map<channelId, Array<SnipedMessageData>>
const snipesByChannel = new Map();
const MAX_SNIPES_PER_CHANNEL = 10;

/**
 * Call this from your `messageDelete` event listener.
 */
export function recordDeletedMessage(message) {
  if (!message?.guild || !message?.channelId) return;
  if (message.author?.bot) return;

  // Ignore if no text content and no attachments/embeds
  const hasContent = Boolean(message.content && message.content.trim().length > 0);
  const attachments = message.attachments ? [...message.attachments.values()] : [];
  if (!hasContent && attachments.length === 0) return;

  const entry = {
    id: message.id,
    content: message.content || '',
    authorId: message.author?.id ?? null,
    authorTag: message.author?.tag ?? 'Unknown User',
    authorAvatar: message.author?.displayAvatarURL?.() ?? null,
    attachments: attachments.map((att) => ({
      name: att.name,
      url: att.url,
      contentType: att.contentType,
    })),
    deletedAt: Date.now(),
  };

  const history = snipesByChannel.get(message.channelId) ?? [];
  history.unshift(entry);
  if (history.length > MAX_SNIPES_PER_CHANNEL) {
    history.length = MAX_SNIPES_PER_CHANNEL;
  }

  snipesByChannel.set(message.channelId, history);
}

/**
 * Handles `,s` — shows the last deleted message in the channel.
 */
export async function executeSnipe(message) {
  if (!message.guild || message.author.bot) return;

  const history = snipesByChannel.get(message.channelId);
  if (!history || history.length === 0) {
    return message.reply('❌ There are no deleted messages to snipe in this channel.');
  }

  const latest = history[0];
  const embed = new EmbedBuilder()
    .setAuthor({
      name: latest.authorTag,
      iconURL: latest.authorAvatar ?? undefined,
    })
    .setDescription(latest.content || '*[No text content]*')
    .setTimestamp(latest.deletedAt)
    .setFooter({ text: `Sniped by ${message.author.tag}` });

  if (latest.attachments.length > 0) {
    const firstImage = latest.attachments.find((a) =>
      a.contentType?.startsWith('image/')
    );
    if (firstImage) {
      embed.setImage(firstImage.url);
    }

    embed.addFields({
      name: 'Attachments',
      value: latest.attachments.map((a) => `[${a.name}](${a.url})`).join('\n'),
    });
  }

  await message.reply({ embeds: [embed] });
}

/**
 * Handles `,cs` — permanently clears sniped messages in the channel so `,s` cannot see them.
 */
export async function executeClearSnipe(message) {
  if (!message.guild || message.author.bot) return;

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return message.reply('❌ You need the **Manage Messages** permission to clear sniped messages.');
  }

  const hadSnipes = snipesByChannel.has(message.channelId) && snipesByChannel.get(message.channelId).length > 0;
  snipesByChannel.delete(message.channelId);

  if (!hadSnipes) {
    return message.reply('ℹ️ There were no sniped messages stored in this channel.');
  }

  return message.reply('🗑️ Permanently cleared sniped messages for this channel.');
}