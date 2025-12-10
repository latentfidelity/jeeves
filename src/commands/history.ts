import { Colors, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getCasesForUser } from '../lib/caseStore';
import { getInfractions } from '../lib/infractions';
import { getNotes } from '../lib/noteStore';
import { getWarnings } from '../lib/warnStore';
import { Command } from '../types/Command';

const MAX_ITEMS = 5;

function formatList(items: string[], emptyText: string): string {
  if (!items.length) return emptyText;
  return items.slice(0, MAX_ITEMS).join('\n');
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View a consolidated moderation history for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('User to inspect').setRequired(true),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('user', true);

    const [warnings, notes, cases, infractions] = await Promise.all([
      getWarnings(interaction.guild.id, user.id),
      getNotes(interaction.guild.id, user.id),
      getCasesForUser(user.id),
      getInfractions(interaction.guild.id, user.id),
    ]);

    const warningLines = warnings.map((w, idx) => {
      const date = new Date(w.createdAt).toLocaleString();
      return `${idx + 1}. ${w.reason} — <@${w.moderatorId}> on ${date}`;
    });

    const noteLines = notes.map((n, idx) => {
      const date = new Date(n.createdAt).toLocaleString();
      return `${idx + 1}. ${n.note} — <@${n.moderatorId}> on ${date}`;
    });

    const caseLines = cases
      .slice(-MAX_ITEMS)
      .reverse()
      .map((c) => `#${c.id} • ${c.action} • ${c.reason || 'No reason'} • ${new Date(c.createdAt).toLocaleString()}`);

    const infLines = infractions.map((inf) => `${inf.type}: ${inf.count}`);

    const embed = new EmbedBuilder()
      .setTitle(`History for ${user.tag}`)
      .setColor(Colors.DarkBlue)
      .addFields(
        { name: 'Warnings', value: formatList(warningLines, 'None'), inline: false },
        { name: 'Notes', value: formatList(noteLines, 'None'), inline: false },
        { name: 'Cases (latest)', value: formatList(caseLines, 'None'), inline: false },
        { name: 'Infractions', value: formatList(infLines, 'None'), inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
