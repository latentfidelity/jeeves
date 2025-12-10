import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { getAppealLink } from '../lib/appeal';
import { tryNotifyUser } from '../lib/notify';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { getGuildConfig } from '../lib/configStore';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to unban').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for unbanning').setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const ban = await interaction.guild.bans.fetch(user.id).catch(() => null);
    if (!ban) {
      await interaction.reply({ content: `${user.tag} is not banned.`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.guild.members.unban(user, reason);

    const guildConfig = await getGuildConfig(interaction.guild.id);
    const appeal = await getAppealLink(interaction.guild.id);
    const dmSent = guildConfig.dmActions !== false
      ? await tryNotifyUser(
          user,
          guildConfig.includeAppealInDm !== false && appeal
            ? `You have been unbanned from ${interaction.guild.name}. Reason: ${reason}\nAppeal info: ${appeal.url}`
            : `You have been unbanned from ${interaction.guild.name}. Reason: ${reason}`,
        )
      : false;

    const caseEntry = await addCase({
      action: 'unban',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { dm: dmSent ? 'sent' : 'failed' },
    });

    await interaction.reply({ content: `Unbanned ${user.tag}. Case #${caseEntry.id}.`, flags: MessageFlags.Ephemeral });

    const embed = createActionEmbed({
      action: 'Unban',
      targetTag: user.tag,
      targetId: user.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [{ name: 'DM', value: dmSent ? 'Sent' : 'Failed', inline: true }],
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
