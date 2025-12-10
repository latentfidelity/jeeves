import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/Command';

const MAX_BANS_RETURNED = 10;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('banlist')
    .setDescription('View recently banned users')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription(`Number of bans to show (max ${MAX_BANS_RETURNED})`)
        .setMinValue(1)
        .setMaxValue(MAX_BANS_RETURNED),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const limit = interaction.options.getInteger('limit') ?? MAX_BANS_RETURNED;
    const bans = await interaction.guild.bans.fetch();

    if (bans.size === 0) {
      await interaction.reply({ content: 'No banned users found.', flags: MessageFlags.Ephemeral });
      return;
    }

    const recent = Array.from(bans.values()).slice(0, limit);
    const description = recent
      .map((ban, index) => `${index + 1}. ${ban.user.tag} (${ban.user.id}) — ${ban.reason || 'No reason'}`)
      .join('\n');

    await interaction.reply({
      content: `Bans (showing up to ${limit}):\n${description}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
