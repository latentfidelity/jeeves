import { Colors, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Overview of Jeeves moderation commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  requiredRole: 'helper',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Jeeves Help')
      .setColor(Colors.Green)
      .setDescription('Key moderation commands (use `/command` in chat):')
      .addFields(
        { name: 'Actions', value: '`ban`, `forceban`, `softban`, `unban`, `kick`, `timeout`, `untimeout`' },
        { name: 'Channel', value: '`purge`, `slowmode`, `lockdown`' },
        { name: 'User mgmt', value: '`warn`, `warnings`, `clearwarnings`, `note`, `role`, `nick`, `userinfo`' },
        { name: 'Cases', value: '`case`, `reason`' },
        { name: 'Utilities', value: '`banlist`, `diagnostics`, `ping`' },
      )
      .setFooter({ text: 'Tip: commands are permission-gated to Discord roles.' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
