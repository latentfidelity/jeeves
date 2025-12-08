import { GuildMember, ChatInputCommandInteraction } from 'discord.js';

export type StaffRole = 'administrator' | 'moderator' | 'helper';

const roleNames: Record<StaffRole, string> = {
  administrator: 'Administrator',
  moderator: 'Moderator',
  helper: 'Helper',
};

const hierarchy: StaffRole[] = ['helper', 'moderator', 'administrator'];

function hasNamedRole(member: GuildMember, roleName: string): boolean {
  return member.roles.cache.some((role) => role.name === roleName);
}

export function hasStaffLevel(member: GuildMember, required: StaffRole): boolean {
  const requiredIndex = hierarchy.indexOf(required);
  if (requiredIndex === -1) return false;

  return hierarchy.slice(requiredIndex).some((level) => hasNamedRole(member, roleNames[level]));
}

export async function ensureStaff(
  interaction: ChatInputCommandInteraction,
  required: StaffRole,
): Promise<boolean> {
  const member = interaction.member;
  if (!member || !(member as GuildMember).roles) {
    await interaction.reply({ content: 'Unable to verify your roles.', ephemeral: true });
    return false;
  }

  const guildMember = member as GuildMember;
  if (!hasStaffLevel(guildMember, required)) {
    await interaction.reply({
      content: `You need the ${roleNames[required]} role (or higher) to use this command.`,
      ephemeral: true,
    });
    return false;
  }

  return true;
}
