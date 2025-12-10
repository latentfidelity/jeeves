import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { removeWarning, getWarnings } from '../lib/warnStore';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('delwarn')
    .setDescription('Remove a single warning from a member by index')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to modify').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('index')
        .setDescription('Warning number to remove (1 = oldest)')
        .setRequired(true)
        .setMinValue(1),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for removing').setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const indexInput = interaction.options.getInteger('index', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const warnings = await getWarnings(interaction.guild.id, user.id);
    if (!warnings.length) {
      await interaction.reply({ content: `${user.tag} has no warnings.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (indexInput < 1 || indexInput > warnings.length) {
      await interaction.reply({
        content: `Invalid warning number. ${user.tag} has ${warnings.length} warning(s).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = await removeWarning(interaction.guild.id, user.id, indexInput - 1);
    if (!result.success || !result.removed) {
      await interaction.reply({ content: 'Failed to remove that warning.', flags: MessageFlags.Ephemeral });
      return;
    }

    const caseEntry = await addCase({
      action: 'warning_removed',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { removedIndex: indexInput.toString(), remaining: result.remaining.length.toString() },
    });

    await interaction.reply({
      content: `Removed warning #${indexInput} for ${user.tag}. ${result.remaining.length} warning(s) remain. Case #${caseEntry.id}.`,
      flags: MessageFlags.Ephemeral,
    });

    const embed = createActionEmbed({
      action: 'Warning Removed',
      targetTag: user.tag,
      targetId: user.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Removed warning', value: result.removed.reason, inline: false },
        { name: 'Remaining warnings', value: result.remaining.length.toString(), inline: true },
      ],
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
