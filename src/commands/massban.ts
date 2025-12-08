import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { Command } from '../types/Command';

const MAX_IDS = 15;
const MAX_DELETE_DAYS = 7;

function parseIds(input: string): string[] {
  const cleaned = input
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, MAX_IDS);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('massban')
    .setDescription('Ban multiple user IDs at once')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('user_ids')
        .setDescription('User IDs separated by spaces or commas')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('days')
        .setDescription('Delete messages from the past N days (0-7)')
        .setMinValue(0)
        .setMaxValue(MAX_DELETE_DAYS),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the ban(s)').setMaxLength(512),
    ),
  requiredRole: 'administrator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const idsInput = interaction.options.getString('user_ids', true);
    const ids = parseIds(idsInput);
    if (!ids.length) {
      await interaction.reply({ content: 'No valid user IDs provided.', ephemeral: true });
      return;
    }

    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('days') ?? 0;

    const successes: string[] = [];
    const failures: string[] = [];

    await interaction.deferReply({ ephemeral: true });

    for (const id of ids) {
      try {
        const existing = await interaction.guild.bans.fetch(id).catch(() => null);
        if (existing) {
          failures.push(`${id} (already banned)`);
          continue;
        }

        await interaction.guild.members.ban(id, { reason, deleteMessageDays: deleteDays });
        successes.push(id);

        await addCase({
          action: 'massban',
          userId: id,
          moderatorId: interaction.user.id,
          reason,
          context: { deleteDays: deleteDays.toString(), bulk: 'true' },
        });
      } catch (error) {
        console.error(`Failed to ban ${id}`, error);
        failures.push(`${id} (error)`);
      }
    }

    const summary = [
      `Requested IDs: ${ids.length}`,
      `Banned: ${successes.length}`,
      failures.length ? `Failed/skipped: ${failures.length}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('Massban Summary')
      .setDescription(summary)
      .setColor(successes.length ? 0xff4d4d : 0xffa500)
      .addFields(
        successes.length
          ? { name: 'Banned', value: successes.join(', ').slice(0, 1000), inline: false }
          : { name: 'Banned', value: 'None', inline: false },
      );

    if (failures.length) {
      embed.addFields({
        name: 'Failed / skipped',
        value: failures.join(', ').slice(0, 1000),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
