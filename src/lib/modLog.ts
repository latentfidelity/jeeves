import { Colors, EmbedBuilder, Guild } from 'discord.js';
import config from '../config';
import { getGuildConfig } from './configStore';

type ActionEmbedOptions = {
  action: string;
  targetTag: string;
  targetId: string;
  moderatorTag: string;
  moderatorId: string;
  reason?: string;
  extraFields?: { name: string; value: string; inline?: boolean }[];
  caseId?: number;
};

export function createActionEmbed(options: ActionEmbedOptions): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(options.action)
    .setColor(Colors.Orange)
    .addFields(
      { name: 'User', value: `${options.targetTag} (${options.targetId})` },
      { name: 'Moderator', value: `${options.moderatorTag} (${options.moderatorId})` },
      { name: 'Reason', value: options.reason || 'No reason provided' },
    )
    .setTimestamp();

  if (typeof options.caseId === 'number') {
    embed.addFields({ name: 'Case', value: `#${options.caseId}`, inline: true });
  }

  if (options.extraFields?.length) {
    embed.addFields(options.extraFields);
  }

  return embed;
}

export async function sendModLog(guild: Guild, embed: EmbedBuilder): Promise<void> {
  const guildConfig = await getGuildConfig(guild.id);
  const channelId = guildConfig.modLogChannelId || config.modLogChannelId;
  if (!channelId) return;

  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.warn('Failed to send mod log message', error);
  }
}
