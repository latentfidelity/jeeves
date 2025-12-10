import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getCase, updateCase } from '../lib/caseStore';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { Command } from '../types/Command';

const MAX_REASON_LENGTH = 512;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('reason')
    .setDescription('Update the reason for a case')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option.setName('case').setDescription('Case ID to update').setRequired(true).setMinValue(1),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('New reason text')
        .setRequired(true)
        .setMaxLength(MAX_REASON_LENGTH),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const caseId = interaction.options.getInteger('case', true);
    const newReason = interaction.options.getString('reason', true);

    const existing = await getCase(caseId);
    if (!existing) {
      await interaction.reply({ content: `No case found with ID #${caseId}.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const updated = await updateCase(caseId, { reason: newReason, context: { reasonUpdatedBy: interaction.user.id } });
    if (!updated) {
      await interaction.reply({ content: 'Failed to update the case.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: `Updated reason for case #${caseId}.`, flags: MessageFlags.Ephemeral });

    const embed = createActionEmbed({
      action: 'Case Reason Updated',
      targetTag: updated.userId,
      targetId: updated.userId,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason: newReason,
      caseId: updated.id,
      extraFields: [
        { name: 'Previous reason', value: existing.reason || 'None', inline: false },
      ],
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
