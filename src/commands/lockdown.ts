import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { parseDuration, formatDuration } from '../lib/duration';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { scheduleUnlock } from '../lib/scheduler';
import { Command } from '../types/Command';

function isLockableChannel(channel: any): channel is TextChannel {
  return Boolean((channel as TextChannel)?.permissionOverwrites);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock or unlock a channel for @everyone')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('state')
        .setDescription('Lock or unlock the channel')
        .setRequired(true)
        .addChoices(
          { name: 'Lock', value: 'on' },
          { name: 'Unlock', value: 'off' },
        ),
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to lock/unlock (defaults to current)')
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('Optional duration to keep locked before auto-unlocking (e.g., 30m, 1h)')
        .setMaxLength(50),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the lock/unlock').setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const state = interaction.options.getString('state', true);
    const lock = state === 'on';
    const targetChannel =
      (interaction.options.getChannel('channel') as TextChannel | null) ||
      (interaction.channel as TextChannel | null);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const durationInput = interaction.options.getString('duration') || undefined;
    const durationMs = durationInput ? parseDuration(durationInput) : null;

    if (!targetChannel || !isLockableChannel(targetChannel)) {
      await interaction.reply({ content: 'Lockdown can only be used on text channels.', ephemeral: true });
      return;
    }

    const everyoneRole = interaction.guild.roles.everyone;
    await targetChannel.permissionOverwrites.edit(everyoneRole, {
      SendMessages: lock ? false : null,
      SendMessagesInThreads: lock ? false : null,
      AddReactions: lock ? false : null,
    }, { reason });

    if (lock && durationInput) {
      if (!durationMs) {
        await interaction.reply({ content: 'Invalid duration. Use values like 30m or 1h.', ephemeral: true });
        return;
      }
      const runAt = Date.now() + durationMs;
      await scheduleUnlock(interaction.guild.id, targetChannel.id, runAt);
    }

    const context: Record<string, string> = {
      state: lock ? 'locked' : 'unlocked',
      channelId: targetChannel.id,
    };
    if (durationInput && durationMs) {
      context.duration = formatDuration(durationMs);
    }

    const caseEntry = await addCase({
      action: lock ? 'lockdown_on' : 'lockdown_off',
      userId: `channel:${targetChannel.id}`,
      moderatorId: interaction.user.id,
      reason,
      context,
    });

    await interaction.reply({
      content: lock
        ? `Locked ${targetChannel} for @everyone. Case #${caseEntry.id}.`
        : `Unlocked ${targetChannel} for @everyone. Case #${caseEntry.id}.`,
      ephemeral: true,
    });

    const embed = createActionEmbed({
      action: lock ? 'Channel Locked' : 'Channel Unlocked',
      targetTag: targetChannel.name,
      targetId: targetChannel.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Channel', value: `<#${targetChannel.id}>`, inline: true },
        { name: 'State', value: lock ? 'Locked' : 'Unlocked', inline: true },
        ...(lock && durationInput && durationMs
          ? [{ name: 'Auto unlock', value: formatDuration(durationMs), inline: true }]
          : []),
      ],
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
