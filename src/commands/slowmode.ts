import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, TextChannel, ThreadChannel } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { parseDuration } from '../lib/duration';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { scheduleSlowmodeClear } from '../lib/scheduler';
import { Command } from '../types/Command';

function isSlowmodeChannel(channel: any): channel is TextChannel | ThreadChannel {
  return typeof channel?.setRateLimitPerUser === 'function';
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set or disable slowmode for a text channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('Slowmode duration (e.g. 10s, 1m, 5m, or off)')
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to modify (defaults to current)')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread,
        ),
    )
    .addStringOption((option) =>
      option
        .setName('reset_after')
        .setDescription('Optional duration to reset slowmode to off (e.g., 30m, 1h)')
        .setRequired(false),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for slowmode change').setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const durationInput = interaction.options.getString('duration', true).trim().toLowerCase();
    const targetChannel =
      (interaction.options.getChannel('channel') as TextChannel | ThreadChannel | null) ||
      (interaction.channel as TextChannel | ThreadChannel | null);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const resetAfterInput = interaction.options.getString('reset_after') || undefined;
    const resetMs = resetAfterInput ? parseDuration(resetAfterInput) : null;

    if (!targetChannel || !isSlowmodeChannel(targetChannel)) {
      await interaction.reply({ content: 'Slowmode can only be set on text channels or threads.', ephemeral: true });
      return;
    }

    const disableKeywords = ['off', 'none', '0'];
    let seconds = 0;
    if (!disableKeywords.includes(durationInput)) {
      const ms = parseDuration(durationInput);
      if (!ms) {
        await interaction.reply({ content: 'Invalid duration. Use values like 10s, 1m, 5m, or off.', ephemeral: true });
        return;
      }
      seconds = Math.floor(ms / 1000);
    }

    if (seconds > 21600) {
      await interaction.reply({ content: 'Slowmode cannot exceed 6 hours.', ephemeral: true });
      return;
    }

    if (resetAfterInput && !resetMs) {
      await interaction.reply({ content: 'Invalid reset duration. Use values like 30m or 1h.', ephemeral: true });
      return;
    }

    await targetChannel.setRateLimitPerUser(seconds, reason);

    if (resetMs) {
      const runAt = Date.now() + resetMs;
      await scheduleSlowmodeClear(interaction.guild.id, targetChannel.id, runAt);
    }

    const caseEntry = await addCase({
      action: seconds === 0 ? 'slowmode_off' : 'slowmode_on',
      userId: `channel:${targetChannel.id}`,
      moderatorId: interaction.user.id,
      reason,
      context: {
        seconds: seconds.toString(),
        channelId: targetChannel.id,
      },
    });

    await interaction.reply({
      content: seconds === 0
        ? `Disabled slowmode in ${targetChannel}. Case #${caseEntry.id}.`
        : `Set slowmode in ${targetChannel} to ${seconds}s. Case #${caseEntry.id}.`,
      ephemeral: true,
    });

    const extraFields = [
      { name: 'Channel', value: `<#${targetChannel.id}>`, inline: true },
      { name: 'Slowmode', value: `${seconds}s`, inline: true },
    ];

    if (resetAfterInput && resetMs) {
      extraFields.push({ name: 'Resets after', value: resetAfterInput, inline: true });
    }

    const embed = createActionEmbed({
      action: seconds === 0 ? 'Slowmode Disabled' : 'Slowmode Set',
      targetTag: targetChannel.name,
      targetId: targetChannel.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields,
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
