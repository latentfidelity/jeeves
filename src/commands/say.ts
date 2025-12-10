import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextBasedChannel } from 'discord.js';
import { Command } from '../types/Command';

const MAX_MESSAGE_LENGTH = 2000;

function isSendable(channel: any): channel is TextBasedChannel {
  return Boolean(channel && typeof channel.isTextBased === 'function' && channel.isTextBased());
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message as Jeeves')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Message to send')
        .setRequired(true)
        .setMaxLength(MAX_MESSAGE_LENGTH),
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to send to (defaults to current)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread),
    )
    .addBooleanOption((option) =>
      option
        .setName('allow_mentions')
        .setDescription('Allow role/everyone mentions (default: no)')
        .setRequired(false),
    ),
  requiredRole: 'administrator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const message = interaction.options.getString('message', true);
    const targetRaw =
      (interaction.options.getChannel('channel') as TextBasedChannel | null) ||
      (interaction.channel as TextBasedChannel | null);
    const target = isSendable(targetRaw) ? targetRaw : null;
    const allowMentions = interaction.options.getBoolean('allow_mentions') ?? false;

    if (!target) {
      await interaction.reply({ content: 'Please choose a text channel or thread.', flags: MessageFlags.Ephemeral });
      return;
    }

    await (target as any).send({
      content: message,
      allowedMentions: allowMentions ? undefined : { parse: [] },
    });

    await interaction.reply({
      content: `Sent message to ${target}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
