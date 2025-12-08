import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getWarnings } from '../lib/warnStore';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a member')
    .setDefaultMemberPermissions(null)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to check').setRequired(true),
    ),
  requiredRole: 'helper',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const warnings = await getWarnings(interaction.guild.id, user.id);

    if (!warnings.length) {
      await interaction.reply({ content: `${user.tag} has no warnings.`, ephemeral: true });
      return;
    }

    const description = warnings
      .map((warning, index) => {
        const date = new Date(warning.createdAt).toLocaleString();
        return `${index + 1}. ${warning.reason} — by <@${warning.moderatorId}> on ${date}`;
      })
      .join('\n');

    await interaction.reply({
      content: `Warnings for ${user.tag}:\n${description}`,
      ephemeral: true,
    });
  },
};

export default command;
