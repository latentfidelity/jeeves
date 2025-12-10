import {
  GuildMember,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  PermissionResolvable,
} from 'discord.js';

export type StaffRole = 'administrator' | 'moderator' | 'helper';

const roleNames: Record<StaffRole, string> = {
  administrator: 'Administrator',
  moderator: 'Moderator',
  helper: 'Helper',
};

const hierarchy: StaffRole[] = ['helper', 'moderator', 'administrator'];
const permissionFallbacks: Record<StaffRole, PermissionResolvable[]> = {
  administrator: [PermissionFlagsBits.Administrator],
  moderator: [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.ManageMessages,
  ],
  helper: [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.ManageMessages,
  ],
};

const permissionFallbackLabels: Record<StaffRole, string> = {
  administrator: 'the Administrator permission',
  moderator: 'a mod permission like Ban Members, Kick Members, or Manage Messages',
  helper: 'a staff permission like Manage Messages or Moderate Members',
};

function hasNamedRole(member: GuildMember, roleName: string): boolean {
  return member.roles.cache.some((role) => role.name === roleName);
}

function hasPermissionLevel(member: GuildMember, level: StaffRole): boolean {
  const permissions = permissionFallbacks[level];
  return permissions.some((perm) => member.permissions.has(perm));
}

export function hasStaffLevel(member: GuildMember, required: StaffRole): boolean {
  const requiredIndex = hierarchy.indexOf(required);
  if (requiredIndex === -1) return false;

  const eligibleLevels = hierarchy.slice(requiredIndex);
  const hasRole = eligibleLevels.some((level) => hasNamedRole(member, roleNames[level]));
  if (hasRole) return true;

  return eligibleLevels.some((level) => hasPermissionLevel(member, level));
}

export async function ensureStaff(
  interaction: ChatInputCommandInteraction,
  required: StaffRole,
): Promise<boolean> {
  const member = interaction.member;
  if (!member || !(member as GuildMember).roles) {
    await interaction.reply({ content: 'Unable to verify your roles.', flags: MessageFlags.Ephemeral });
    return false;
  }

  const guildMember = member as GuildMember;
  if (!hasStaffLevel(guildMember, required)) {
    await interaction.reply({
      content: `You need the ${roleNames[required]} role (or ${permissionFallbackLabels[required]}) to use this command.`,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}
