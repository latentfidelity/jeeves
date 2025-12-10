import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getCase, getCasesForUser } from '../lib/caseStore';
import { Command } from '../types/Command';

const MAX_CASES_RETURNED = 10;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('Lookup moderation cases')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('id')
        .setDescription('View a specific case by ID')
        .addIntegerOption((option) =>
          option.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('user')
        .setDescription('View recent cases for a user')
        .addUserOption((option) =>
          option.setName('user').setDescription('User to view cases for').setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription(`Number of cases to return (max ${MAX_CASES_RETURNED})`)
            .setMinValue(1)
            .setMaxValue(MAX_CASES_RETURNED),
        ),
    ),
  requiredRole: 'moderator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'id') {
      const id = interaction.options.getInteger('id', true);
      const entry = await getCase(id);
      if (!entry) {
        await interaction.reply({ content: `No case found with ID #${id}.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const created = new Date(entry.createdAt).toLocaleString();
      const context = entry.context
        ? Object.entries(entry.context)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
        : 'None';

      await interaction.reply({
        content: [
          `Case #${entry.id}`,
          `Action: ${entry.action}`,
          `User: <@${entry.userId}> (${entry.userId})`,
          `Moderator: <@${entry.moderatorId}> (${entry.moderatorId})`,
          `Reason: ${entry.reason || 'No reason provided'}`,
          `When: ${created}`,
          `Context: ${context}`,
        ].join('\n'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'user') {
      const user = interaction.options.getUser('user', true);
      const limit = interaction.options.getInteger('limit') ?? MAX_CASES_RETURNED;
      const cases = await getCasesForUser(user.id);
      if (!cases.length) {
        await interaction.reply({ content: `${user.tag} has no cases recorded.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const recent = cases.slice(-limit).reverse();
      const description = recent
        .map((entry) => {
          const created = new Date(entry.createdAt).toLocaleString();
          return `#${entry.id} • ${entry.action} • ${entry.reason || 'No reason'} • ${created}`;
        })
        .join('\n');

      await interaction.reply({
        content: `Cases for ${user.tag} (showing up to ${limit}):\n${description}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
  },
};

export default command;
