import { Colors, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { setAppealLink, getAppealLink } from '../lib/appeal';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Set or view the server appeal link')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set the appeal link for this server')
        .addStringOption((option) =>
          option
            .setName('url')
            .setDescription('Link to your appeal form/page')
            .setRequired(true)
            .setMaxLength(2000),
        )
        .addStringOption((option) =>
          option
            .setName('label')
            .setDescription('Optional label for the appeal link')
            .setMaxLength(100),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('get').setDescription('View the current appeal link for this server'),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: 'You lack permission to set the appeal link.', flags: MessageFlags.Ephemeral });
        return;
      }

      const url = interaction.options.getString('url', true);
      const label = interaction.options.getString('label') || 'Appeal form';
      await setAppealLink(interaction.guild.id, { url, label, updatedAt: Date.now() });

      await interaction.reply({
        content: `Updated appeal link to ${url} (${label}).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'get') {
      const link = await getAppealLink(interaction.guild.id);
      if (!link) {
        await interaction.reply({ content: 'No appeal link has been set for this server.', flags: MessageFlags.Ephemeral });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(link.label || 'Appeal')
        .setURL(link.url)
        .setColor(Colors.Blue)
        .setDescription(link.url)
        .setFooter({ text: 'Updated' })
        .setTimestamp(link.updatedAt);

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
  },
};

export default command;
