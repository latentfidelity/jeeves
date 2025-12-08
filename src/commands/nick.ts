import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { Command } from '../types/Command';

const MAX_NICK_LENGTH = 32;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change or reset a member nickname')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to change nickname for').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('nickname')
        .setDescription('New nickname (leave empty to reset)')
        .setRequired(false)
        .setMaxLength(MAX_NICK_LENGTH),
    )
    .addBooleanOption((option) =>
      option
        .setName('reset')
        .setDescription('Reset nickname to username')
        .setRequired(false),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the change').setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const nickname = interaction.options.getString('nickname');
    const reset = interaction.options.getBoolean('reset') ?? false;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (nickname && reset) {
      await interaction.reply({ content: 'Provide a nickname or set reset=true, not both.', ephemeral: true });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      return;
    }

    if (!member.manageable) {
      await interaction.reply({ content: 'I cannot modify that member. They may have higher permissions or roles.', ephemeral: true });
      return;
    }

    const newNick = reset ? null : nickname;
    await member.setNickname(newNick, reason);

    const caseEntry = await addCase({
      action: reset ? 'nick_reset' : 'nick_change',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { nickname: newNick ?? 'reset' },
    });

    await interaction.reply({
      content: reset
        ? `Reset nickname for ${user.tag}. Case #${caseEntry.id}.`
        : `Changed nickname for ${user.tag} to "${nickname}". Case #${caseEntry.id}.`,
      ephemeral: true,
    });

    const embed = createActionEmbed({
      action: reset ? 'Nickname Reset' : 'Nickname Changed',
      targetTag: user.tag,
      targetId: user.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Nickname', value: newNick ?? 'Reset to username', inline: true },
      ],
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
