import { GuildMember, PermissionFlagsBits, Role, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { createActionEmbed, sendModLog } from '../lib/modLog';
import { Command } from '../types/Command';

function isRoleEditable(role: Role): boolean {
  return role.editable && !role.managed;
}

async function ensureManageable(member: GuildMember): Promise<boolean> {
  return member.manageable;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove roles from members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a role to a member')
        .addUserOption((option) =>
          option.setName('user').setDescription('User to modify').setRequired(true),
        )
        .addRoleOption((option) =>
          option.setName('role').setDescription('Role to add').setRequired(true),
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for adding').setMaxLength(512),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a role from a member')
        .addUserOption((option) =>
          option.setName('user').setDescription('User to modify').setRequired(true),
        )
        .addRoleOption((option) =>
          option.setName('role').setDescription('Role to remove').setRequired(true),
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for removal').setMaxLength(512),
        ),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true) as Role;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      return;
    }

    if (!await ensureManageable(member)) {
      await interaction.reply({ content: 'I cannot modify that member. They may have higher permissions or roles.', ephemeral: true });
      return;
    }

    if (!isRoleEditable(role)) {
      await interaction.reply({ content: 'I cannot modify that role. It may be higher than my highest role or is managed.', ephemeral: true });
      return;
    }

    if (sub === 'add') {
      if (member.roles.cache.has(role.id)) {
        await interaction.reply({ content: `${user.tag} already has ${role.name}.`, ephemeral: true });
        return;
      }

      await member.roles.add(role, reason);

      const caseEntry = await addCase({
        action: 'role_add',
        userId: user.id,
        moderatorId: interaction.user.id,
        reason,
        context: { role: role.id },
      });

      await interaction.reply({ content: `Added ${role.name} to ${user.tag}. Case #${caseEntry.id}.`, ephemeral: true });

      const embed = createActionEmbed({
        action: 'Role Added',
        targetTag: user.tag,
        targetId: user.id,
        moderatorTag: interaction.user.tag,
        moderatorId: interaction.user.id,
        reason,
        caseId: caseEntry.id,
        extraFields: [{ name: 'Role', value: `<@&${role.id}>`, inline: true }],
      });
      await sendModLog(interaction.guild, embed);
      return;
    }

    if (sub === 'remove') {
      if (!member.roles.cache.has(role.id)) {
        await interaction.reply({ content: `${user.tag} does not have ${role.name}.`, ephemeral: true });
        return;
      }

      await member.roles.remove(role, reason);

      const caseEntry = await addCase({
        action: 'role_remove',
        userId: user.id,
        moderatorId: interaction.user.id,
        reason,
        context: { role: role.id },
      });

      await interaction.reply({ content: `Removed ${role.name} from ${user.tag}. Case #${caseEntry.id}.`, ephemeral: true });

      const embed = createActionEmbed({
        action: 'Role Removed',
        targetTag: user.tag,
        targetId: user.id,
        moderatorTag: interaction.user.tag,
        moderatorId: interaction.user.id,
        reason,
        caseId: caseEntry.id,
        extraFields: [{ name: 'Role', value: `<@&${role.id}>`, inline: true }],
      });
      await sendModLog(interaction.guild, embed);
      return;
    }

    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};

export default command;
