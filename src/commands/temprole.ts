import { MessageFlags, PermissionFlagsBits, Role, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { parseDuration, formatDuration } from '../lib/duration';
import { scheduleRoleRemoval } from '../lib/scheduler';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('temprole')
    .setDescription('Assign a role for a limited time')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to modify').setRequired(true),
    )
    .addRoleOption((option) =>
      option.setName('role').setDescription('Role to assign temporarily').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('How long the role should stay (e.g., 30m, 2h)')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the temporary role').setMaxLength(512),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true) as Role;
    const durationInput = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const durationMs = parseDuration(durationInput);
    if (!durationMs) {
      await interaction.reply({ content: 'Invalid duration. Use values like 30m or 2h.', flags: MessageFlags.Ephemeral });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!member.manageable) {
      await interaction.reply({ content: 'I cannot modify that member. They may have higher permissions or roles.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!role.editable) {
      await interaction.reply({ content: 'I cannot assign that role. It may be higher than my highest role or managed.', flags: MessageFlags.Ephemeral });
      return;
    }

    await member.roles.add(role, reason);

    const removeAt = Date.now() + durationMs;
    await scheduleRoleRemoval(interaction.guild.id, user.id, role.id, removeAt);

    const caseEntry = await addCase({
      action: 'temprole',
      userId: user.id,
      moderatorId: interaction.user.id,
      reason,
      context: { role: role.id, duration: formatDuration(durationMs) },
    });

    await interaction.reply({
      content: `Assigned ${role.name} to ${user.tag} for ${formatDuration(durationMs)}. Case #${caseEntry.id}.`,
      flags: MessageFlags.Ephemeral,
    });

    const embed = createActionEmbed({
      action: 'Temporary Role',
      targetTag: user.tag,
      targetId: user.id,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      reason,
      caseId: caseEntry.id,
      extraFields: [
        { name: 'Role', value: `<@&${role.id}>`, inline: true },
        { name: 'Duration', value: formatDuration(durationMs), inline: true },
      ],
    });

    await sendModLog(interaction.guild, embed);
  },
};

export default command;
