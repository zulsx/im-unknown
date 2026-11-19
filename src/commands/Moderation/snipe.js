import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getLatestSnipe, clearChannelSnipes } from '../../utils/snipeStore.js';

export const data = new SlashCommandBuilder()
  .setName('s')
  .setDescription('Shows the last deleted message in this channel');

export async function runSnipe(target) {
  const latest = getLatestSnipe(target.channelId);
  if (!latest) {
    return '❌ There are no deleted messages to snipe in this channel.';
  }

  const embed = new EmbedBuilder()
    .setAuthor({
      name: latest.authorTag,
      iconURL: latest.authorAvatar ?? undefined,
    })
    .setDescription(latest.content || '*[No text content]*')
    .setTimestamp(latest.deletedAt);

  if (latest.attachments.length > 0) {
    const firstImage = latest.attachments.find((a) => a.contentType?.startsWith('image/'));
    if (firstImage) embed.setImage(firstImage.url);
    embed.addFields({
      name: 'Attachments',
      value: latest.attachments.map((a) => `[${a.name}](${a.url})`).join('\n'),
    });
  }

  return { embeds: [embed] };
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const payload = await runSnipe(interaction);
  await interaction.editReply(payload);
}

// Prefix runner for TitanBot's message command handler
export async function run(message) {
  const payload = await runSnipe(message);
  await message.reply(payload);
}

export async function runClearSnipe(message) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return message.reply('❌ You need **Manage Messages** to clear sniped messages.');
  }
  const cleared = clearChannelSnipes(message.channelId);
  return message.reply(
    cleared
      ? '🗑️ Permanently cleared sniped messages for this channel.'
      : 'ℹ️ There were no sniped messages stored in this channel.'
  );
}
