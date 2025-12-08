import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { tryNotifyUser } from '../lib/notify';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { getGuildConfig } from '../lib/configStore';
import { addInfraction } from '../lib/infractions';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to kick').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the kick')
        .setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (user.id === interaction.user.id) {
      await interaction.reply({ content: "You can't kick yourself.", ephemeral: true });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({ content: 'I cannot kick that member. They may have higher permissions or roles.', ephemeral: true });
      return;
    }

    const guildConfig = await getGuildConfig(interaction.guild.id);
    const dmSent = guildConfig.dmActions !== false
      ? await tryNotifyUser(
          user,
          `You have been kicked from ${interaction.guild.name}. Reason: ${reason}`,
        )
      : false;

    await member.kick(reason);

    const caseEntry = await addCase({
      action: 'kick',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { dm: dmSent ? 'sent' : 'failed' },
    });

    await interaction.reply({ content: `Kicked ${user.tag}. Case #${caseEntry.id}.`, ephemeral: true });

    const embed = createActionEmbed({
      action: 'Kick',
      targetTag: user.tag,
      targetId: user.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [{ name: 'DM', value: dmSent ? 'Sent' : 'Failed', inline: true }],
    });

    await sendModLog(interaction.guild, embed);
    await addInfraction(interaction.guild.id, user.id, 'kick');
  },
};

export default command;
