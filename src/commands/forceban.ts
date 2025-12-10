import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { getAppealLink } from '../lib/appeal';
import { tryNotifyUser } from '../lib/notify';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { getGuildConfig } from '../lib/configStore';
import { Command } from '../types/Command';

const MAX_DELETE_DAYS = 7;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('forceban')
    .setDescription('Ban a user by ID, even if they are not in the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to ban').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('days')
        .setDescription('Delete messages from the past N days (0-7)')
        .setMinValue(0)
        .setMaxValue(MAX_DELETE_DAYS),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the ban').setMaxLength(512),
    ),
  requiredRole: 'administrator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('days') ?? 0;

    if (user.id === interaction.user.id) {
      await interaction.reply({ content: "You can't ban yourself.", flags: MessageFlags.Ephemeral });
      return;
    }

    const existingBan = await interaction.guild.bans.fetch(user.id).catch(() => null);
    if (existingBan) {
      await interaction.reply({ content: `${user.tag} is already banned.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const guildConfig = await getGuildConfig(interaction.guild.id);
    const appeal = await getAppealLink(interaction.guild.id);
    const dmSent = guildConfig.dmActions !== false
      ? await tryNotifyUser(
          user,
          guildConfig.includeAppealInDm !== false && appeal
            ? `You have been banned from ${interaction.guild.name}. Reason: ${reason}\nAppeal here: ${appeal.url}`
            : `You have been banned from ${interaction.guild.name}. Reason: ${reason}`,
        )
      : false;

    await interaction.guild.members.ban(user, {
      reason,
      deleteMessageDays: deleteDays,
    });

    const caseEntry = await addCase({
      action: 'forceban',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { deleteDays: deleteDays.toString(), dm: dmSent ? 'sent' : 'failed' },
    });

    await interaction.reply({
      content: `Forcebanned ${user.tag}. Deleted ${deleteDays} day(s) of messages. Case #${caseEntry.id}.`,
      flags: MessageFlags.Ephemeral,
    });

    const embed = createActionEmbed({
      action: 'Forceban',
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
