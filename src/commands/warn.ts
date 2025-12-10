import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { tryNotifyUser } from '../lib/notify';
import { addInfraction } from '../lib/infractions';
import { getGuildConfig } from '../lib/configStore';
import { addWarning } from '../lib/warnStore';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to warn').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
        .setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    const warnings = await addWarning(interaction.guild.id, user.id, {
      reason,
      moderatorId: interaction.user.id,
      createdAt: Date.now(),
    });

    const guildConfig = await getGuildConfig(interaction.guild.id);
    const dmSent = guildConfig.dmActions !== false
      ? await tryNotifyUser(
          user,
          `You have been warned in ${interaction.guild.name}. Reason: ${reason}`,
        )
      : false;

    const caseEntry = await addCase({
      action: 'warn',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { warnings: warnings.length.toString(), dm: dmSent ? 'sent' : 'failed' },
    });

    await addInfraction(interaction.guild.id, user.id, 'warning');

    await interaction.reply({
      content: `Warned ${user.tag}. They now have ${warnings.length} warning(s). Case #${caseEntry.id}.`,
      flags: MessageFlags.Ephemeral,
    });

    const embed = createActionEmbed({
      action: 'Warning',
      targetTag: user.tag,
      targetId: user.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Warnings for user', value: warnings.length.toString(), inline: true },
        { name: 'DM', value: dmSent ? 'Sent' : 'Failed', inline: true },
      ],
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
