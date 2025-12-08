import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getCasesForUser } from '../lib/caseStore';
import { getNotes } from '../lib/noteStore';
import { getWarnings } from '../lib/warnStore';
import { Command } from '../types/Command';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('View moderation-relevant info about a member')
    .setDefaultMemberPermissions(null)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to inspect').setRequired(true),
    ),
  requiredRole: 'helper',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const warnings = await getWarnings(interaction.guild.id, user.id);
    const notes = await getNotes(interaction.guild.id, user.id);
    const cases = await getCasesForUser(user.id);

    const embed = new EmbedBuilder()
      .setTitle(`User info: ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'User ID', value: user.id, inline: true },
        { name: 'Account created', value: formatDate(user.createdTimestamp), inline: true },
        { name: 'Warnings', value: warnings.length.toString(), inline: true },
        { name: 'Notes', value: notes.length.toString(), inline: true },
        { name: 'Cases', value: cases.length.toString(), inline: true },
      )
      .setTimestamp();

    if (member) {
      embed.addFields(
        { name: 'Joined server', value: formatDate(member.joinedTimestamp ?? Date.now()), inline: true },
        {
          name: 'Roles',
          value: member.roles.cache
            .filter((role) => role.id !== interaction.guild?.roles.everyone.id)
            .map((role) => `<@&${role.id}>`)
            .join(', ') || 'None',
        },
      );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
