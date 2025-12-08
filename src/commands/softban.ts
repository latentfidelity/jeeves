import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { getAppealLink } from '../lib/appeal';
import { tryNotifyUser } from '../lib/notify';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { getGuildConfig } from '../lib/configStore';
import { Command } from '../types/Command';

const MAX_DELETE_DAYS = 7;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban and immediately unban a user to delete recent messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to softban').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('days')
        .setDescription('Delete messages from the past N days (0-7)')
        .setMinValue(0)
        .setMaxValue(MAX_DELETE_DAYS),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the softban').setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('days') ?? 1;

    if (user.id === interaction.user.id) {
      await interaction.reply({ content: "You can't softban yourself.", ephemeral: true });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      return;
    }

    if (!member.bannable) {
      await interaction.reply({ content: 'I cannot ban that member. They may have higher permissions or roles.', ephemeral: true });
      return;
    }

    const guildConfig = await getGuildConfig(interaction.guild.id);
    const appeal = await getAppealLink(interaction.guild.id);
    const dmSent = guildConfig.dmActions !== false
      ? await tryNotifyUser(
          user,
          guildConfig.includeAppealInDm !== false && appeal
            ? `You have been softbanned from ${interaction.guild.name}. Reason: ${reason}\nAppeal here: ${appeal.url}`
            : `You have been softbanned from ${interaction.guild.name}. Reason: ${reason}`,
        )
      : false;

    await interaction.guild.members.ban(user, { reason, deleteMessageDays: deleteDays });
    await interaction.guild.members.unban(user, reason);

    const caseEntry = await addCase({
      action: 'softban',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { dm: dmSent ? 'sent' : 'failed', deleteDays: deleteDays.toString() },
    });

    await interaction.reply({
      content: `Softbanned ${user.tag}, deleted last ${deleteDays} day(s) of messages. Case #${caseEntry.id}.`,
      ephemeral: true,
    });

    const embed = createActionEmbed({
      action: 'Softban',
      targetTag: user.tag,
      targetId: user.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Messages deleted (days)', value: deleteDays.toString(), inline: true },
        { name: 'DM', value: dmSent ? 'Sent' : 'Failed', inline: true },
      ],
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
