import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { tryNotifyUser } from '../lib/notify';
import { getGuildConfig } from '../lib/configStore';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove an active timeout from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to remove timeout from').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for removing timeout').setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!member.isCommunicationDisabled()) {
      await interaction.reply({ content: `${user.tag} is not currently timed out.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({ content: 'I cannot modify that member. They may have higher permissions or roles.', flags: MessageFlags.Ephemeral });
      return;
    }

    await member.timeout(null, reason);

    const guildConfig = await getGuildConfig(interaction.guild.id);
    const dmSent = guildConfig.dmActions !== false
      ? await tryNotifyUser(
          user,
          `Your timeout in ${interaction.guild.name} has been removed. Reason: ${reason}`,
        )
      : false;

    const caseEntry = await addCase({
      action: 'untimeout',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { dm: dmSent ? 'sent' : 'failed' },
    });

    await interaction.reply({ content: `Removed timeout for ${user.tag}. Case #${caseEntry.id}.`, flags: MessageFlags.Ephemeral });

    const embed = createActionEmbed({
      action: 'Timeout Removed',
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
