import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { clearWarnings, getWarnings } from '../lib/warnStore';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to clear warnings for').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for clearing warnings').setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const existing = await getWarnings(interaction.guild.id, user.id);
    await clearWarnings(interaction.guild.id, user.id);

    const caseEntry = await addCase({
      action: 'clearwarnings',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { cleared: existing.length.toString() },
    });

    await interaction.reply({ content: `Cleared ${existing.length} warning(s) for ${user.tag}. Case #${caseEntry.id}.`, flags: MessageFlags.Ephemeral });

    const embed = createActionEmbed({
      action: 'Clear Warnings',
      targetTag: user.tag,
      targetId: user.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [{ name: 'Warnings cleared', value: existing.length.toString(), inline: true }],
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
