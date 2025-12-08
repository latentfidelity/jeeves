import { NewsChannel, PermissionFlagsBits, SlashCommandBuilder, TextChannel, ThreadChannel } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { Command } from '../types/Command';

function isBulkDeletableChannel(
  channel: any,
): channel is TextChannel | NewsChannel | ThreadChannel {
  return Boolean(channel?.bulkDelete);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a number of recent messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('Number of messages to delete (max 100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || !isBulkDeletableChannel(channel)) {
      await interaction.reply({ content: 'This command must be used in a text channel.', ephemeral: true });
      return;
    }

    const count = interaction.options.getInteger('count', true);
    const targetUser = interaction.options.getUser('user');

    const fetched = await channel.messages.fetch({ limit: Math.min(count, 100) });

    const toDelete = targetUser
      ? fetched.filter((message) => message.author.id === targetUser.id).first(count)
      : fetched.first(count);

    if (!toDelete || toDelete.length === 0) {
      await interaction.reply({ content: 'No messages found to delete with the given filters.', ephemeral: true });
      return;
    }

    const deleted = await channel.bulkDelete(toDelete, true);

    const caseEntry = await addCase({
      action: 'purge',
      userId: targetUser ? targetUser.id : 'channel',
      moderatorId: interaction.user.id,
      reason: targetUser ? `Targeted purge for ${targetUser.tag}` : 'Channel purge',
      context: {
        messagesDeleted: deleted.size.toString(),
        channelId: channel.id,
        target: targetUser ? targetUser.id : 'all',
      },
    });

    await interaction.reply({
      content: `Deleted ${deleted.size} message(s)${targetUser ? ` from ${targetUser.tag}` : ''}. Case #${caseEntry.id}.`,
      ephemeral: true,
    });

    const embed = createActionEmbed({
      action: 'Purge',
      targetTag: targetUser ? targetUser.tag : 'Channel purge',
      targetId: targetUser ? targetUser.id : channel.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason: targetUser ? `Targeted purge for ${targetUser.tag}` : 'Channel purge',
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Messages deleted', value: deleted.size.toString(), inline: true },
        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
      ],
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
