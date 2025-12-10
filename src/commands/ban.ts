import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { getAppealLink } from '../lib/appeal';
import { tryNotifyUser } from '../lib/notify';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { getGuildConfig } from '../lib/configStore';
import { addInfraction } from '../lib/infractions';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to ban').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the ban')
        .setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (user.id === interaction.user.id) {
      await interaction.reply({ content: "You can't ban yourself.", flags: MessageFlags.Ephemeral });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!member.bannable) {
      await interaction.reply({ content: 'I cannot ban that member. They may have higher permissions or roles.', flags: MessageFlags.Ephemeral });
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

    await member.ban({ reason });

    const caseEntry = await addCase({
      action: 'ban',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { dm: dmSent ? 'sent' : 'failed' },
    });

    await interaction.reply({ content: `Banned ${user.tag}. Case #${caseEntry.id}.`, flags: MessageFlags.Ephemeral });

    const embed = createActionEmbed({
      action: 'Ban',
      targetTag: user.tag,
      targetId: user.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [{ name: 'DM', value: dmSent ? 'Sent' : 'Failed', inline: true }],
    });

    await sendModLog(interaction.guild, embed);
    await addInfraction(interaction.guild.id, user.id, 'ban');
  },
};

export default command;
