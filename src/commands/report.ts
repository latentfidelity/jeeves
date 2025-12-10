import { Colors, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import config from '../config';
import { getGuildConfig } from '../lib/configStore';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a user or message to the moderation team')
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User you are reporting').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the report')
        .setRequired(true)
        .setMaxLength(1000),
    )
    .addStringOption((option) =>
      option
        .setName('message_link')
        .setDescription('Optional message link for context')
        .setMaxLength(512),
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const messageLink = interaction.options.getString('message_link') || 'None provided';

    const guildConfig = await getGuildConfig(interaction.guild.id);
    const modLogChannelId = guildConfig.modLogChannelId || config.modLogChannelId;

    if (!modLogChannelId) {
      await interaction.reply({
        content: 'Reporting channel is not configured. Please notify a moderator.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('New Report')
      .setColor(Colors.Red)
      .addFields(
        { name: 'Reported user', value: `${targetUser.tag} (${targetUser.id})` },
        { name: 'Reporter', value: `${interaction.user.tag} (${interaction.user.id})` },
        { name: 'Reason', value: reason },
        { name: 'Message link', value: messageLink },
      )
      .setTimestamp();

    try {
      const channel = await interaction.guild.channels.fetch(modLogChannelId);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({
          content: 'Reporting channel is not available. Please notify a moderator.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: 'Thank you. Your report has been sent to the moderators.', flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('Failed to send report', error);
      await interaction.reply({
        content: 'Failed to send the report. Please try again or contact a moderator.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
