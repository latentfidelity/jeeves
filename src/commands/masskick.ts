import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addCase } from '../lib/caseStore';
import { Command } from '../types/Command';

const MAX_IDS = 15;

function parseIds(input: string): string[] {
  const cleaned = input
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, MAX_IDS);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('masskick')
    .setDescription('Kick multiple users at once by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('user_ids')
        .setDescription('User IDs separated by spaces or commas')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the kick(s)').setMaxLength(512),
    ),
  requiredRole: 'administrator',
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const idsInput = interaction.options.getString('user_ids', true);
    const ids = parseIds(idsInput);
    if (!ids.length) {
      await interaction.reply({ content: 'No valid user IDs provided.', flags: MessageFlags.Ephemeral });
      return;
    }

    const reason = interaction.options.getString('reason') || 'No reason provided';

    const successes: string[] = [];
    const failures: string[] = [];

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    for (const id of ids) {
      try {
        const member = await interaction.guild.members.fetch(id).catch(() => null);
        if (!member) {
          failures.push(`${id} (not in server)`);
          continue;
        }
        if (!member.kickable) {
          failures.push(`${id} (not kickable)`);
          continue;
        }

        await member.kick(reason);
        successes.push(id);

        await addCase({
          action: 'masskick',
          userId: id,
          moderatorId: interaction.user.id,
          reason,
          context: { bulk: 'true' },
        });
      } catch (error) {
        console.error(`Failed to kick ${id}`, error);
        failures.push(`${id} (error)`);
      }
    }

    const summary = [
      `Requested IDs: ${ids.length}`,
      `Kicked: ${successes.length}`,
      failures.length ? `Failed/skipped: ${failures.length}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('Masskick Summary')
      .setDescription(summary)
      .setColor(successes.length ? 0xffa500 : 0xffcc00)
      .addFields(
        successes.length
          ? { name: 'Kicked', value: successes.join(', ').slice(0, 1000), inline: false }
          : { name: 'Kicked', value: 'None', inline: false },
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
