import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { parseDuration, formatDuration, MAX_TIMEOUT_MS } from '../lib/duration';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { tryNotifyUser } from '../lib/notify';
import { addInfraction } from '../lib/infractions';
import { Command } from '../types/Command';
import { getGuildConfig } from '../lib/configStore';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to timeout').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('Length of the timeout (e.g. 30m, 2h, 1d)')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the timeout')
        .setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const durationInput = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (user.id === interaction.user.id) {
      await interaction.reply({ content: "You can't timeout yourself.", flags: MessageFlags.Ephemeral });
      return;
    }

    const durationMs = parseDuration(durationInput);
    if (!durationMs) {
      await interaction.reply({ content: 'Invalid duration. Use formats like 30m, 2h, or 1d.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (durationMs > MAX_TIMEOUT_MS) {
      await interaction.reply({ content: 'Duration exceeds Discord\'s 28 day timeout limit.', flags: MessageFlags.Ephemeral });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({ content: 'I cannot timeout that member. They may have higher permissions or roles.', flags: MessageFlags.Ephemeral });
      return;
    }

    const guildConfig = await getGuildConfig(interaction.guild.id);
    const dmSent = guildConfig.dmActions !== false
      ? await tryNotifyUser(
          user,
          `You have been timed out in ${interaction.guild.name} for ${formatDuration(durationMs)}. Reason: ${reason}`,
        )
      : false;

    await member.timeout(durationMs, reason);

    const caseEntry = await addCase({
      action: 'timeout',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: {
        duration: formatDuration(durationMs),
        dm: dmSent ? 'sent' : 'failed',
      },
    });

    await interaction.reply({ content: `Timed out ${user.tag} for ${formatDuration(durationMs)}. Case #${caseEntry.id}.`, flags: MessageFlags.Ephemeral });

    const embed = createActionEmbed({
      action: 'Timeout',
      targetTag: user.tag,
      targetId: user.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Duration', value: formatDuration(durationMs) },
        { name: 'DM', value: dmSent ? 'Sent' : 'Failed', inline: true },
      ],
    });

    await sendModLog(interaction.guild, embed);
    await addInfraction(interaction.guild.id, user.id, 'timeout');
  },
};

export default command;
