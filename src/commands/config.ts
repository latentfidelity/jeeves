import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig, setDmActionsEnabled, setIncludeAppealInDm, setModLogChannel } from '../lib/configStore';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure Jeeves settings for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('modlog')
        .setDescription('Set the mod-log channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel for moderation logs (leave empty to clear)')
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('dm_actions')
        .setDescription('Toggle whether users are DM’d for actions')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable DMs for actions').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('appeal_dm')
        .setDescription('Toggle including appeal link in DMs')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Include appeal links in DMs').setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName('show').setDescription('Show current settings')),
  requiredRole: 'administrator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'modlog') {
      const channel = interaction.options.getChannel('channel');
      const updated = await setModLogChannel(interaction.guild.id, channel?.id);
      await interaction.reply({
        content: channel
          ? `Mod-log channel set to ${channel}.`
          : 'Mod-log channel cleared (falls back to MOD_LOG_CHANNEL_ID env if set).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'dm_actions') {
      const enabled = interaction.options.getBoolean('enabled', true);
      const updated = await setDmActionsEnabled(interaction.guild.id, enabled);
      await interaction.reply({
        content: `DMs for actions are now ${enabled ? 'enabled' : 'disabled'}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'appeal_dm') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await setIncludeAppealInDm(interaction.guild.id, enabled);
      await interaction.reply({
        content: `Including appeal links in DMs is now ${enabled ? 'enabled' : 'disabled'}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'show') {
      const cfg = await getGuildConfig(interaction.guild.id);
      await interaction.reply({
        content: [
          `Mod-log channel: ${cfg.modLogChannelId ?? 'not set'}`,
          `DM actions: ${cfg.dmActions !== false ? 'enabled' : 'disabled'}`,
          `Appeal links in DMs: ${cfg.includeAppealInDm !== false ? 'enabled' : 'disabled'}`,
        ].join('\n'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
  },
};

export default command;
